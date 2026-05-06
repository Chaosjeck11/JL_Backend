import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateMemberDto } from "./dto/create-member.dto";
import { UpdateMemberDto } from "./dto/update-member.dto";
import * as bcrypt from "bcrypt";

const MEMBER_INCLUDE = {
  role: true,
  mitgliedsbeitraege: {
    include: { businessYear: true },
    orderBy: { businessYear: { year: "desc" as const } },
  },
} as const;

@Injectable()
export class MembersService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.member.findMany({
      orderBy: { lastname: "asc" },
      include: MEMBER_INCLUDE,
    });
  }

  async findOne(id: number) {
    const member = await this.prisma.member.findUnique({
      where: { id },
      include: {
        ...MEMBER_INCLUDE,
        transactions: {
          include: { category: true, businessYear: true },
          orderBy: { date: "desc" },
        },
      },
    });

    if (!member) throw new NotFoundException("Member not found");
    return member;
  }

  async create(dto: CreateMemberDto) {
    const passwordHash = await bcrypt.hash(dto.password, 10);

    const member = await this.prisma.member.create({
      data: {
        firstname: dto.firstname,
        lastname: dto.lastname,
        email: dto.email,
        passwordHash,
        birthday: dto.birthday ? new Date(dto.birthday) : undefined,
        phone: dto.phone,
        address: dto.address,
        roleId: dto.roleId,
        accessLevel: dto.accessLevel ?? 0,
        u18: dto.u18 ?? false,
        bereitsMitglied: dto.bereitsMitglied ?? false,
        schuelerStudentAzubi: dto.schuelerStudentAzubi ?? false,
        berufstaetig: dto.berufstaetig ?? false,
      },
    });

    const isReduced = member.u18 || member.schuelerStudentAzubi || member.bereitsMitglied;
    const betragJL = 35;
    const betragKG = isReduced ? 0 : 65;
    const businessYears = await this.prisma.businessYear.findMany();

    for (const by of businessYears) {
      // Nur Jahre ab Beitrittsdatum: Geschäftsjahr endet 31.01. des Folgejahres
      const byEnd = new Date(by.year + 1, 0, 31);
      if (byEnd >= member.joinedAt) {
        await this.prisma.mitgliedsbeitrag.create({
          data: { memberId: member.id, businessYearId: by.id, betragJL, betragKG },
        });
      }
    }

    return this.findOne(member.id);
  }

  async update(id: number, dto: UpdateMemberDto) {
    const currentMember = await this.findOne(id);

    const data: Record<string, unknown> = {};

    if (dto.firstname !== undefined) data.firstname = dto.firstname;
    if (dto.lastname !== undefined) data.lastname = dto.lastname;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.birthday !== undefined)
      data.birthday = dto.birthday ? new Date(dto.birthday) : null;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.avatarPath !== undefined) data.avatarPath = dto.avatarPath;
    if (dto.roleId !== undefined) data.roleId = dto.roleId;
    if (dto.accessLevel !== undefined) data.accessLevel = dto.accessLevel;
    if (dto.u18 !== undefined) data.u18 = dto.u18;
    if (dto.bereitsMitglied !== undefined) data.bereitsMitglied = dto.bereitsMitglied;
    if (dto.schuelerStudentAzubi !== undefined)
      data.schuelerStudentAzubi = dto.schuelerStudentAzubi;
    if (dto.berufstaetig !== undefined) data.berufstaetig = dto.berufstaetig;

    if (dto.active !== undefined) {
      data.active = dto.active;
      if (dto.active === false) {
        // auto-set inactiveSince unless explicitly provided
        data.inactiveSince =
          dto.inactiveSince !== undefined
            ? dto.inactiveSince
              ? new Date(dto.inactiveSince)
              : null
            : new Date();
      } else if (dto.active === true && dto.inactiveSince === undefined) {
        data.inactiveSince = null;
      }
    }

    if (dto.inactiveSince !== undefined && data.inactiveSince === undefined) {
      data.inactiveSince = dto.inactiveSince ? new Date(dto.inactiveSince) : null;
    }

    const updated = await this.prisma.member.update({
      where: { id },
      data,
      include: MEMBER_INCLUDE,
    });

    // Beiträge nach jedem Update neu berechnen
    const isReduced =
      updated.u18 || updated.schuelerStudentAzubi || updated.bereitsMitglied;
    const betragJL = 35;
    const betragKG = isReduced ? 0 : 65;
    const retroactiveIds = new Set(dto.retroactiveYearIds ?? []);
    const businessYears = await this.prisma.businessYear.findMany();
    const isReactivation = dto.active === true && !currentMember.active;
    const today = new Date();

    for (const by of businessYears) {
      const applyBetrag = retroactiveIds.has(by.id);

      if (updated.active) {
        const existing = await this.prisma.mitgliedsbeitrag.findUnique({
          where: { memberId_businessYearId: { memberId: id, businessYearId: by.id } },
        });
        if (existing) {
          // Betrag nur rückwirkend übernehmen wenn Jahr explizit angegeben
          if (applyBetrag) {
            await this.prisma.mitgliedsbeitrag.update({
              where: { id: existing.id },
              data: { betragJL, betragKG },
            });
          }
        } else {
          // Bei Reaktivierung: nur Jahre erstellen, die noch nicht vollständig abgelaufen sind
          if (isReactivation) {
            const byEnd = new Date(by.year + 1, 0, 31); // 31. Jan des Folgejahres
            if (byEnd < today) continue;
          }
          await this.prisma.mitgliedsbeitrag.create({
            data: { memberId: id, businessYearId: by.id, betragJL, betragKG },
          });
        }
      } else {
        // Inaktiv: Beiträge für Jahre löschen, die nach inactiveSince begonnen haben
        const inactiveSince = updated.inactiveSince;
        if (inactiveSince) {
          const byStart = new Date(by.year, 1, 1); // 1. Feb des Jahres
          if (byStart > inactiveSince) {
            // Nur löschen wenn keine Zahlungen gebucht wurden
            await this.prisma.mitgliedsbeitrag.deleteMany({
              where: { memberId: id, businessYearId: by.id, bezahltJL: 0, bezahltKG: 0 },
            });
            continue;
          }
        }
        // Betrag nur rückwirkend übernehmen wenn explizit angegeben
        if (applyBetrag) {
          await this.prisma.mitgliedsbeitrag.updateMany({
            where: { memberId: id, businessYearId: by.id },
            data: { betragJL, betragKG },
          });
        }
      }
    }

    return this.findOne(id);
  }

  async deactivate(id: number) {
    await this.findOne(id);
    return this.prisma.member.update({
      where: { id },
      data: { active: false, inactiveSince: new Date() },
      include: MEMBER_INCLUDE,
    });
  }
}
