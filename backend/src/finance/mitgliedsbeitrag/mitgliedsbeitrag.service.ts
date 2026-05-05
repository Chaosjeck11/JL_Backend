import { Injectable, NotFoundException } from "@nestjs/common";
import { BeitragStatus, TransactionType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { UpdateMitgliedsbeitragDto } from "./dto/update-mitgliedsbeitrag.dto";

const INCLUDE = {
  member: {
    select: {
      id: true,
      firstname: true,
      lastname: true,
      email: true,
      active: true,
      inactiveSince: true,
      u18: true,
      bereitsMitglied: true,
      schuelerStudentAzubi: true,
      berufstaetig: true,
    },
  },
  businessYear: true,
} as const;

@Injectable()
export class MitgliedsbeitragService {
  constructor(private prisma: PrismaService) {}

  findAll(filters: {
    businessYearId?: number;
    memberId?: number;
    status?: BeitragStatus;
  } = {}) {
    return this.prisma.mitgliedsbeitrag.findMany({
      where: {
        businessYearId: filters.businessYearId,
        memberId: filters.memberId,
        status: filters.status,
      },
      include: INCLUDE,
      orderBy: [{ businessYear: { year: "desc" } }, { member: { lastname: "asc" } }],
    });
  }

  async findOne(id: number) {
    const record = await this.prisma.mitgliedsbeitrag.findUnique({
      where: { id },
      include: INCLUDE,
    });
    if (!record) throw new NotFoundException("Mitgliedsbeitrag nicht gefunden.");
    return record;
  }

  async update(id: number, dto: UpdateMitgliedsbeitragDto) {
    const record = await this.findOne(id);

    const bezahltJL = dto.bezahltJL ?? record.bezahltJL;
    const bezahltKG = dto.bezahltKG ?? record.bezahltKG;
    const status = computeStatus(bezahltJL, bezahltKG, record.betragJL, record.betragKG);

    return this.prisma.mitgliedsbeitrag.update({
      where: { id },
      data: { bezahltJL, bezahltKG, status },
      include: INCLUDE,
    });
  }

  // Called by TransactionService when an EINZAHLUNG on Mitgliedsbeitrag category is created
  async processPayment(memberId: number, businessYearId: number, amount: number) {
    const member = await this.prisma.member.findUnique({ where: { id: memberId } });
    if (!member) return;

    const isReduced = member.u18 || member.schuelerStudentAzubi || member.bereitsMitglied;

    const beitrag = await this.prisma.mitgliedsbeitrag.upsert({
      where: { memberId_businessYearId: { memberId, businessYearId } },
      update: {},
      create: {
        memberId,
        businessYearId,
        betragJL: 35,
        betragKG: isReduced ? 0 : 65,
      },
    });

    const remainingJL = Math.max(0, beitrag.betragJL - beitrag.bezahltJL);
    const toJL = Math.min(amount, remainingJL);
    const toKG = amount - toJL;
    const newJL = beitrag.bezahltJL + toJL;
    const newKG = beitrag.bezahltKG + toKG;
    const status = computeStatus(newJL, newKG, beitrag.betragJL, beitrag.betragKG);

    await this.prisma.mitgliedsbeitrag.update({
      where: { id: beitrag.id },
      data: { bezahltJL: newJL, bezahltKG: newKG, status },
    });
  }

  // Called by TransactionService after an EINZAHLUNG on Mitgliedsbeitrag is deleted
  async recompute(memberId: number, businessYearId: number) {
    const beitrag = await this.prisma.mitgliedsbeitrag.findUnique({
      where: { memberId_businessYearId: { memberId, businessYearId } },
    });
    if (!beitrag) return;

    const transactions = await this.prisma.transaction.findMany({
      where: {
        memberId,
        businessYearId,
        type: TransactionType.EINZAHLUNG,
        category: { isMitgliedsbeitrag: true },
      },
      orderBy: { date: "asc" },
    });

    let bezahltJL = 0;
    let bezahltKG = 0;

    for (const tx of transactions) {
      const remainingJL = Math.max(0, beitrag.betragJL - bezahltJL);
      const toJL = Math.min(tx.amount, remainingJL);
      bezahltJL += toJL;
      bezahltKG += tx.amount - toJL;
    }

    const status = computeStatus(bezahltJL, bezahltKG, beitrag.betragJL, beitrag.betragKG);

    await this.prisma.mitgliedsbeitrag.update({
      where: { id: beitrag.id },
      data: { bezahltJL, bezahltKG, status },
    });
  }
}

function computeStatus(
  bezahltJL: number,
  bezahltKG: number,
  betragJL: number,
  betragKG: number,
): BeitragStatus {
  const total = betragJL + betragKG;
  const paid = bezahltJL + bezahltKG;
  if (paid <= 0) return BeitragStatus.AUSSTEHEND;
  if (paid >= total) return BeitragStatus.BEZAHLT;
  return BeitragStatus.TEILWEISE;
}
