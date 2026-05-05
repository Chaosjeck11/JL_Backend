import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { Prisma, TransactionType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { BusinessYearService } from "../business-year/business-year.service";
import { CreateTransactionDto } from "./dto/create-transaction.dto";
import { UpdateTransactionDto } from "./dto/update-transaction.dto";

const TRANSACTION_INCLUDE = {
  category: true,
  businessYear: true,
} satisfies Prisma.TransactionInclude;

interface FindAllFilters {
  businessYearId?: number;
  categoryId?: number;
  type?: TransactionType;
}

@Injectable()
export class TransactionService {
  constructor(
    private prisma: PrismaService,
    private businessYearService: BusinessYearService,
  ) {}

  findAll(filters: FindAllFilters = {}) {
    const where: Prisma.TransactionWhereInput = {};

    if (filters.businessYearId) where.businessYearId = filters.businessYearId;
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.type) where.type = filters.type;

    return this.prisma.transaction.findMany({
      where,
      orderBy: { date: "asc" },
      include: TRANSACTION_INCLUDE,
    });
  }

  async findOne(id: number) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
      include: {
        ...TRANSACTION_INCLUDE,
        relatedTransaction: true,
        reversals: true,
      },
    });

    if (!transaction) {
      throw new NotFoundException("Transaktion nicht gefunden.");
    }

    return transaction;
  }

  async create(dto: CreateTransactionDto) {
    if (dto.businessYearId == null) {
      throw new BadRequestException("businessYearId ist erforderlich.");
    }
    if (dto.categoryId == null) {
      throw new BadRequestException("categoryId ist erforderlich.");
    }
    if (dto.amount <= 0) {
      throw new BadRequestException("Der Betrag muss größer als 0 sein.");
    }

    if (dto.type === TransactionType.RUECKBUCHUNG) {
      if (!dto.relatedTransactionId) {
        throw new BadRequestException(
          "Rückbuchungen erfordern eine relatedTransactionId.",
        );
      }

      const related = await this.prisma.transaction.findUnique({
        where: { id: dto.relatedTransactionId },
      });

      if (!related) {
        throw new NotFoundException(
          "Die zu stornierende Transaktion wurde nicht gefunden.",
        );
      }

      if (related.type === TransactionType.RUECKBUCHUNG) {
        throw new BadRequestException(
          "Rückbuchungen können nicht selbst zurückgebucht werden.",
        );
      }
    } else if (dto.relatedTransactionId != null) {
      throw new BadRequestException(
        "relatedTransactionId darf nur bei Rückbuchungen gesetzt werden.",
      );
    }

    return this.prisma.transaction.create({
      data: { ...dto, date: new Date(dto.date) },
      include: TRANSACTION_INCLUDE,
    });
  }

  async update(id: number, dto: UpdateTransactionDto) {
    await this.findOneOrFail(id);

    return this.prisma.transaction.update({
      where: { id },
      data: {
        description: dto.description,
        categoryId: dto.categoryId,
        date: dto.date ? new Date(dto.date) : undefined,
      },
      include: TRANSACTION_INCLUDE,
    });
  }

  async remove(id: number) {
    await this.findOneOrFail(id);

    const reversalCount = await this.prisma.transaction.count({
      where: { relatedTransactionId: id },
    });

    if (reversalCount > 0) {
      throw new ConflictException(
        "Transaktion kann nicht gelöscht werden, da eine Rückbuchung darauf verweist.",
      );
    }

    return this.prisma.transaction.delete({ where: { id } });
  }

  async getRunningBalance(businessYearId: number) {
    const { carryOver } = await this.businessYearService.findOne(businessYearId);

    const transactions = await this.prisma.transaction.findMany({
      where: { businessYearId },
      orderBy: { date: "asc" },
      include: {
        ...TRANSACTION_INCLUDE,
        relatedTransaction: true,
      },
    });

    let running = carryOver;

    return transactions.map((tx) => {
      if (tx.type === TransactionType.EINZAHLUNG) {
        running += tx.amount;
      } else if (tx.type === TransactionType.AUSZAHLUNG) {
        running -= tx.amount;
      } else if (tx.type === TransactionType.RUECKBUCHUNG) {
        const originalType = tx.relatedTransaction?.type;
        if (originalType === TransactionType.AUSZAHLUNG) {
          running += tx.amount;
        } else if (originalType === TransactionType.EINZAHLUNG) {
          running -= tx.amount;
        }
      }

      return { transaction: tx, runningBalance: running };
    });
  }

  private async findOneOrFail(id: number) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
    });

    if (!transaction) {
      throw new NotFoundException("Transaktion nicht gefunden.");
    }

    return transaction;
  }
}
