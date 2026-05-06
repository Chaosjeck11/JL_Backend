import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { TransactionType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateBusinessYearDto } from "./dto/create-business-year.dto";
import { UpdateBusinessYearDto } from "./dto/update-business-year.dto";

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

function byDates(year: number) {
  return {
    startDate: new Date(year, 1, 1),      // Feb 1 of named year
    endDate: new Date(year + 1, 0, 31),   // Jan 31 of following year
  };
}

@Injectable()
export class BusinessYearService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const years = await this.prisma.businessYear.findMany({
      orderBy: { year: "desc" },
    });
    return years.map((by) => ({ ...by, ...byDates(by.year) }));
  }

  async findOne(id: number) {
    const businessYear = await this.findOneOrFail(id);
    const carryOver = await this.computeCarryOver(businessYear.year);
    const { totalIncome, totalExpenses, reversalNet } =
      await this.aggregateTotals(id);
    const balance = carryOver + totalIncome - totalExpenses + reversalNet;

    const mitgliedsbeitraege = await this.prisma.mitgliedsbeitrag.findMany({
      where: { businessYearId: id },
      include: {
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
      },
      orderBy: { member: { lastname: "asc" } },
    });

    return {
      ...businessYear,
      ...byDates(businessYear.year),
      carryOver,
      totalIncome,
      totalExpenses,
      balance,
      mitgliedsbeitraege,
    };
  }

  async create(dto: CreateBusinessYearDto) {
    const existing = await this.prisma.businessYear.findUnique({
      where: { year: dto.year },
    });
    if (existing) {
      throw new ConflictException(
        `Geschäftsjahr ${dto.year} existiert bereits.`,
      );
    }

    let carryOver = dto.carryOver ?? 0;
    const newestYear = await this.prisma.businessYear.findFirst({
      orderBy: { year: "desc" },
    });
    if (newestYear) {
      const liveCarryOver = await this.computeCarryOver(newestYear.year);
      const { totalIncome, totalExpenses, reversalNet } =
        await this.aggregateTotals(newestYear.id);
      carryOver = liveCarryOver + totalIncome - totalExpenses + reversalNet;
    }

    const businessYear = await this.prisma.businessYear.create({
      data: { year: dto.year, carryOver },
    });

    // Beiträge nur für aktuell aktive Mitglieder erstellen
    const members = await this.prisma.member.findMany({
      where: { active: true, excludeFromBeitrag: false },
    });
    for (const member of members) {
      const { betragJL, betragKG } = beitragsBetraege(member);
      await this.prisma.mitgliedsbeitrag.create({
        data: { memberId: member.id, businessYearId: businessYear.id, betragJL, betragKG },
      });
    }

    return this.findOne(businessYear.id);
  }

  async update(id: number, dto: UpdateBusinessYearDto) {
    await this.findOneOrFail(id);
    await this.prisma.businessYear.update({
      where: { id },
      data: { carryOver: dto.carryOver },
    });
    return this.findOne(id);
  }

  async remove(id: number) {
    await this.findOneOrFail(id);

    const transactionCount = await this.prisma.transaction.count({
      where: { businessYearId: id },
    });
    if (transactionCount > 0) {
      throw new ConflictException(
        "Geschäftsjahr kann nicht gelöscht werden, da noch Transaktionen vorhanden sind.",
      );
    }

    await this.prisma.mitgliedsbeitrag.deleteMany({ where: { businessYearId: id } });
    return this.prisma.businessYear.delete({ where: { id } });
  }

  private async findOneOrFail(id: number) {
    const businessYear = await this.prisma.businessYear.findUnique({
      where: { id },
    });
    if (!businessYear) throw new NotFoundException("Geschäftsjahr nicht gefunden.");
    return businessYear;
  }

  private async computeCarryOver(year: number): Promise<number> {
    const priorYears = await this.prisma.businessYear.findMany({
      where: { year: { lt: year } },
      orderBy: { year: "asc" },
    });

    if (priorYears.length === 0) {
      const self = await this.prisma.businessYear.findFirst({ where: { year } });
      return self?.carryOver ?? 0;
    }

    let running = priorYears[0].carryOver;
    for (const py of priorYears) {
      const { totalIncome, totalExpenses, reversalNet } =
        await this.aggregateTotals(py.id);
      running = running + totalIncome - totalExpenses + reversalNet;
    }
    return running;
  }

  private async aggregateTotals(businessYearId: number) {
    const [incomeAgg, expenseAgg, reversals] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: { businessYearId, type: "EINZAHLUNG" },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { businessYearId, type: "AUSZAHLUNG" },
        _sum: { amount: true },
      }),
      this.prisma.transaction.findMany({
        where: { businessYearId, type: "RUECKBUCHUNG" },
        include: { relatedTransaction: { select: { type: true } } },
      }),
    ]);

    let reversalNet = 0;
    for (const tx of reversals) {
      const originalType = tx.relatedTransaction?.type;
      if (originalType === TransactionType.AUSZAHLUNG) reversalNet += tx.amount;
      else if (originalType === TransactionType.EINZAHLUNG) reversalNet -= tx.amount;
    }

    return {
      totalIncome: incomeAgg._sum.amount ?? 0,
      totalExpenses: expenseAgg._sum.amount ?? 0,
      reversalNet,
    };
  }
}
