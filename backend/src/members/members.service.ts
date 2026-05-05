import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateMemberDto } from "./dto/create-member.dto";
import { UpdateMemberDto } from "./dto/update-member.dto";
import * as bcrypt from "bcrypt";

const BEITRAG_JL = 35;
const BEITRAG_KG = 65;

function beitragsBetraege(member: {
  u18: boolean;
  schuelerStudentAzubi: boolean;
  bereitsMitglied: boolean;
}) {
  const isReduced =
    member.u18 || member.schuelerStudentAzubi || member.bereitsMitglied;
  return { betragJL: BEITRAG_JL, betragKG: isReduced ? 0 : BEITRAG_KG };
}

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

    // Create Mitgliedsbeitrag for every active BusinessYear (started on or before today)
    const now = new Date();
    const businessYears = await this.prisma.businessYear.findMany();
    const { betragJL, betragKG } = beitragsBetraege(member);

    for (const by of businessYears) {
      const startDate = new Date(by.year, 1, 1); // Feb 1
      if (startDate <= now) {
        await this.prisma.mitgliedsbeitrag.upsert({
          where: {
            memberId_businessYearId: { memberId: member.id, businessYearId: by.id },
          },
          update: {},
          create: { memberId: member.id, businessYearId: by.id, betragJL, betragKG },
        });
      }
    }

    return this.findOne(member.id);
  }

  async update(id: number, dto: UpdateMemberDto) {
    await this.findOne(id);

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

    return this.prisma.member.update({
      where: { id },
      data,
      include: MEMBER_INCLUDE,
    });
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
