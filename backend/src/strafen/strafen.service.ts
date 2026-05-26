import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateStrafeDto } from "./dto/create-strafe.dto";
import { UpdateStrafeDto } from "./dto/update-strafe.dto";
import { CreateStrafeEintragDto } from "./dto/create-strafe-eintrag.dto";
import { UpdateStrafeEintragDto } from "./dto/update-strafe-eintrag.dto";

@Injectable()
export class StrafenService {
  constructor(private prisma: PrismaService) {}

  // ── Katalog ──────────────────────────────────────────────────────────────────

  findAllKatalog() {
    return this.prisma.strafe.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { eintraege: true } } },
    });
  }

  async findOneKatalog(id: number) {
    const s = await this.prisma.strafe.findUnique({
      where: { id },
      include: { _count: { select: { eintraege: true } } },
    });
    if (!s) throw new NotFoundException(`Strafe ${id} nicht gefunden.`);
    return s;
  }

  createKatalog(dto: CreateStrafeDto) {
    return this.prisma.strafe.create({ data: dto });
  }

  async updateKatalog(id: number, dto: UpdateStrafeDto) {
    await this.findOneKatalog(id);
    return this.prisma.strafe.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.beschreibung !== undefined && { beschreibung: dto.beschreibung }),
        ...(dto.betrag !== undefined && { betrag: dto.betrag }),
      },
    });
  }

  async removeKatalog(id: number) {
    const s = await this.findOneKatalog(id);
    if ((s as any)._count.eintraege > 0) {
      throw new BadRequestException(
        `Strafe wird in ${(s as any)._count.eintraege} Eintrag/Einträgen verwendet und kann nicht gelöscht werden.`,
      );
    }
    await this.prisma.strafe.delete({ where: { id } });
  }

  // ── Einträge ─────────────────────────────────────────────────────────────────

  findAllEintraege(filters: {
    memberId?: number;
    strafeId?: number;
    businessYearId?: number;
    bezahlt?: boolean;
  }) {
    return this.prisma.strafeEintrag.findMany({
      where: {
        ...(filters.memberId !== undefined && { memberId: filters.memberId }),
        ...(filters.strafeId !== undefined && { strafeId: filters.strafeId }),
        ...(filters.businessYearId !== undefined && { businessYearId: filters.businessYearId }),
        ...(filters.bezahlt !== undefined && { bezahlt: filters.bezahlt }),
      },
      include: {
        member: { select: { id: true, firstname: true, lastname: true } },
        strafe: { select: { id: true, name: true, betrag: true } },
        businessYear: { select: { id: true, year: true } },
      },
      orderBy: [{ businessYearId: "desc" }, { createdAt: "desc" }],
    });
  }

  async findOneEintrag(id: number) {
    const e = await this.prisma.strafeEintrag.findUnique({
      where: { id },
      include: {
        member: { select: { id: true, firstname: true, lastname: true } },
        strafe: true,
        businessYear: { select: { id: true, year: true } },
      },
    });
    if (!e) throw new NotFoundException(`StrafeEintrag ${id} nicht gefunden.`);
    return e;
  }

  async createEintrag(dto: CreateStrafeEintragDto) {
    const [member, strafe, year] = await Promise.all([
      this.prisma.member.findUnique({ where: { id: dto.memberId } }),
      this.prisma.strafe.findUnique({ where: { id: dto.strafeId } }),
      this.prisma.businessYear.findUnique({ where: { id: dto.businessYearId } }),
    ]);
    if (!member) throw new NotFoundException(`Member ${dto.memberId} nicht gefunden.`);
    if (!strafe) throw new NotFoundException(`Strafe ${dto.strafeId} nicht gefunden.`);
    if (!year) throw new NotFoundException(`Geschäftsjahr ${dto.businessYearId} nicht gefunden.`);

    return this.prisma.strafeEintrag.create({
      data: {
        memberId: dto.memberId,
        strafeId: dto.strafeId,
        businessYearId: dto.businessYearId,
        grund: dto.grund,
      },
      include: {
        member: { select: { id: true, firstname: true, lastname: true } },
        strafe: { select: { id: true, name: true, betrag: true } },
        businessYear: { select: { id: true, year: true } },
      },
    });
  }

  async updateEintrag(id: number, dto: UpdateStrafeEintragDto) {
    await this.findOneEintrag(id);
    return this.prisma.strafeEintrag.update({
      where: { id },
      data: {
        ...(dto.bezahlt !== undefined && { bezahlt: dto.bezahlt }),
        ...(dto.grund !== undefined && { grund: dto.grund }),
      },
      include: {
        member: { select: { id: true, firstname: true, lastname: true } },
        strafe: { select: { id: true, name: true, betrag: true } },
        businessYear: { select: { id: true, year: true } },
      },
    });
  }

  async removeEintrag(id: number) {
    await this.findOneEintrag(id);
    await this.prisma.strafeEintrag.delete({ where: { id } });
  }

  async getSummary(filters: { memberId?: number; businessYearId?: number }) {
    const eintraege = await this.prisma.strafeEintrag.findMany({
      where: {
        ...(filters.memberId !== undefined && { memberId: filters.memberId }),
        ...(filters.businessYearId !== undefined && { businessYearId: filters.businessYearId }),
      },
      include: {
        member: { select: { id: true, firstname: true, lastname: true } },
        strafe: { select: { id: true, name: true, betrag: true } },
        businessYear: { select: { id: true, year: true } },
      },
    });

    // aggregate by memberId × businessYearId
    const map = new Map<string, any>();
    for (const e of eintraege) {
      const key = `${e.memberId}:${e.businessYearId}`;
      if (!map.has(key)) {
        map.set(key, {
          memberId: e.memberId,
          member: e.member,
          businessYearId: e.businessYearId,
          businessYear: e.businessYear,
          anzahlGesamt: 0,
          anzahlBezahlt: 0,
          anzahlOffen: 0,
          gesamtbetrag: 0,
          bezahltBetrag: 0,
          offenBetrag: 0,
        });
      }
      const row = map.get(key);
      row.anzahlGesamt++;
      row.gesamtbetrag += e.strafe.betrag;
      if (e.bezahlt) {
        row.anzahlBezahlt++;
        row.bezahltBetrag += e.strafe.betrag;
      } else {
        row.anzahlOffen++;
        row.offenBetrag += e.strafe.betrag;
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => b.businessYearId - a.businessYearId || a.memberId - b.memberId,
    );
  }
}
