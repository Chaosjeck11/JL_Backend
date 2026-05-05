import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateBusinessYearDto } from "./dto/create-business-year.dto";
import { UpdateBusinessYearDto } from "./dto/update-business-year.dto";

@Injectable()
export class BusinessYearService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.businessYear.findMany({
      orderBy: { year: "desc" },
    });
  }

  async findOne(id: number) {
    const businessYear = await this.findOneOrFail(id);
    const { totalIncome, totalExpenses } = await this.aggregateTotals(id);
    const balance = businessYear.carryOver + totalIncome - totalExpenses;

    return { ...businessYear, totalIncome, totalExpenses, balance };
  }

  async create(dto: CreateBusinessYearDto) {
    let carryOver = dto.carryOver ?? 0;

    const prevYear = await this.prisma.businessYear.findUnique({
      where: { year: dto.year - 1 },
    });

    if (prevYear) {
      const { totalIncome, totalExpenses } = await this.aggregateTotals(
        prevYear.id,
      );
      carryOver = prevYear.carryOver + totalIncome - totalExpenses;
    }

    return this.prisma.businessYear.create({
      data: { year: dto.year, carryOver },
    });
  }

  async update(id: number, dto: UpdateBusinessYearDto) {
    await this.findOneOrFail(id);

    return this.prisma.businessYear.update({
      where: { id },
      data: { carryOver: dto.carryOver },
    });
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

    return this.prisma.businessYear.delete({ where: { id } });
  }

  private async findOneOrFail(id: number) {
    const businessYear = await this.prisma.businessYear.findUnique({
      where: { id },
    });

    if (!businessYear) {
      throw new NotFoundException("Geschäftsjahr nicht gefunden.");
    }

    return businessYear;
  }

  private async aggregateTotals(businessYearId: number) {
    const [incomeAgg, expenseAgg] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: { businessYearId, type: "EINZAHLUNG" },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { businessYearId, type: "AUSZAHLUNG" },
        _sum: { amount: true },
      }),
    ]);

    return {
      totalIncome: incomeAgg._sum.amount ?? 0,
      totalExpenses: expenseAgg._sum.amount ?? 0,
    };
  }
}
