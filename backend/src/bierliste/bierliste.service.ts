import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateDrinkDto } from "./dto/create-drink.dto";
import { UpdateDrinkDto } from "./dto/update-drink.dto";
import { UpdateFridgeDto } from "./dto/update-fridge.dto";
import { CreateConsumptionDto } from "./dto/create-consumption.dto";
import { CreateCashboxTransactionDto } from "./dto/create-cashbox-transaction.dto";
import * as path from "path";
import * as fs from "fs";

@Injectable()
export class BierlisteService {
  constructor(private prisma: PrismaService) {}

  // ── Drinks ────────────────────────────────────────────────────────────────

  async findAllDrinks(includeInactive = false) {
    return this.prisma.bierDrink.findMany({
      where: includeInactive ? undefined : { active: true },
      include: { fridge: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }

  async findOneDrink(id: number) {
    const drink = await this.prisma.bierDrink.findUnique({
      where: { id },
      include: { fridge: true },
    });
    if (!drink) throw new NotFoundException(`Drink ${id} not found`);
    return drink;
  }

  async createDrink(dto: CreateDrinkDto) {
    return this.prisma.bierDrink.create({
      data: {
        name: dto.name,
        pricePerUnit: dto.pricePerUnit,
        description: dto.description,
        category: dto.category,
        sortOrder: dto.sortOrder ?? 0,
        active: dto.active ?? true,
        fridge: { create: { stock: 0 } },
      },
      include: { fridge: true },
    });
  }

  async updateDrink(id: number, dto: UpdateDrinkDto) {
    await this.findOneDrink(id);
    return this.prisma.bierDrink.update({
      where: { id },
      data: dto,
      include: { fridge: true },
    });
  }

  async deleteDrink(id: number) {
    const drink = await this.findOneDrink(id);
    if (drink.imagePath) {
      const fullPath = path.join(process.cwd(), drink.imagePath);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }
    await this.prisma.bierDrink.delete({ where: { id } });
  }

  async uploadDrinkImage(id: number, file: Express.Multer.File) {
    const drink = await this.findOneDrink(id);
    if (drink.imagePath) {
      const oldPath = path.join(process.cwd(), drink.imagePath);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    const ext = path.extname(file.originalname);
    const storedName = `${crypto.randomUUID()}${ext}`;
    const uploadDir = path.join(process.cwd(), "uploads", "bier-drinks");
    fs.mkdirSync(uploadDir, { recursive: true });
    fs.renameSync(file.path, path.join(uploadDir, storedName));
    const imagePath = `uploads/bier-drinks/${storedName}`;
    return this.prisma.bierDrink.update({
      where: { id },
      data: { imagePath },
      include: { fridge: true },
    });
  }

  // ── Fridge ────────────────────────────────────────────────────────────────

  async findFridge() {
    return this.prisma.bierFridge.findMany({
      include: { drink: true },
      orderBy: { drink: { sortOrder: "asc" } },
    });
  }

  async updateFridge(drinkId: number, dto: UpdateFridgeDto) {
    const fridge = await this.prisma.bierFridge.findUnique({
      where: { drinkId },
    });
    if (!fridge) throw new NotFoundException(`Fridge entry for drink ${drinkId} not found`);

    let newStock: number;
    if (dto.mode === "set") {
      newStock = dto.value;
    } else if (dto.mode === "add") {
      newStock = fridge.stock + dto.value;
    } else {
      newStock = Math.max(0, fridge.stock - dto.value);
    }

    return this.prisma.bierFridge.update({
      where: { drinkId },
      data: {
        stock: newStock,
        ...(dto.minStock !== undefined && { minStock: dto.minStock }),
        ...(dto.maxStock !== undefined && { maxStock: dto.maxStock }),
        ...(dto.location !== undefined && { location: dto.location }),
      },
      include: { drink: true },
    });
  }

  // ── Consumption ───────────────────────────────────────────────────────────

  async getMyConsumption(memberId: number) {
    return this.prisma.bierConsumption.findMany({
      where: { memberId },
      include: { drink: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  async createConsumption(memberId: number, dto: CreateConsumptionDto) {
    const drink = await this.prisma.bierDrink.findUnique({
      where: { id: dto.drinkId },
    });
    if (!drink || !drink.active)
      throw new NotFoundException(`Drink ${dto.drinkId} not found or inactive`);

    const cost = Number((drink.pricePerUnit * dto.amount).toFixed(2));

    const [consumption] = await this.prisma.$transaction([
      this.prisma.bierConsumption.create({
        data: { memberId, drinkId: dto.drinkId, amount: dto.amount, note: dto.note },
        include: { drink: true },
      }),
      this.prisma.bierMemberBalance.upsert({
        where: { memberId },
        create: { memberId, openAmount: Math.max(0, cost), paidAmount: 0 },
        update: { openAmount: { increment: cost } },
      }),
    ]);

    return consumption;
  }

  // ── Balance ───────────────────────────────────────────────────────────────

  async getMyBalance(memberId: number) {
    const balance = await this.prisma.bierMemberBalance.findUnique({
      where: { memberId },
    });
    return balance ?? { memberId, openAmount: 0, paidAmount: 0 };
  }

  async getAllBalances() {
    return this.prisma.bierMemberBalance.findMany({
      include: {
        member: { select: { id: true, firstname: true, lastname: true } },
      },
      orderBy: { openAmount: "desc" },
    });
  }

  async payMember(memberId: number, amount: number, adminId: number) {
    const balance = await this.prisma.bierMemberBalance.findUnique({
      where: { memberId },
    });
    const currentOpen = balance?.openAmount ?? 0;
    const actualPayment = Math.min(amount, currentOpen);

    await this.prisma.$transaction([
      this.prisma.bierMemberBalance.upsert({
        where: { memberId },
        create: { memberId, openAmount: 0, paidAmount: actualPayment },
        update: {
          openAmount: { decrement: actualPayment },
          paidAmount: { increment: actualPayment },
        },
      }),
      this.prisma.bierCashboxTransaction.create({
        data: {
          amount: actualPayment,
          direction: "IN",
          reason: "Mitgliedszahlung Bierliste",
          createdById: adminId,
          userIdPaid: memberId,
        },
      }),
    ]);

    return this.prisma.bierMemberBalance.findUnique({ where: { memberId } });
  }

  async adjustMemberAmounts(
    memberId: number,
    openAmount?: number,
    paidAmount?: number,
  ) {
    return this.prisma.bierMemberBalance.upsert({
      where: { memberId },
      create: {
        memberId,
        openAmount: openAmount ?? 0,
        paidAmount: paidAmount ?? 0,
      },
      update: {
        ...(openAmount !== undefined && { openAmount }),
        ...(paidAmount !== undefined && { paidAmount }),
      },
    });
  }

  // ── Cashbox ───────────────────────────────────────────────────────────────

  async getCashbox() {
    const transactions = await this.prisma.bierCashboxTransaction.findMany({
      include: {
        createdBy: { select: { id: true, firstname: true, lastname: true } },
        paidMember: { select: { id: true, firstname: true, lastname: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const balance = transactions.reduce((sum, t) => {
      if (t.direction === "OUT") return sum - t.amount;
      return sum + t.amount;
    }, 0);

    return { balance: Number(balance.toFixed(2)), transactions };
  }

  async createCashboxTransaction(dto: CreateCashboxTransactionDto, createdById: number) {
    return this.prisma.bierCashboxTransaction.create({
      data: {
        amount: dto.amount,
        direction: dto.direction as any,
        reason: dto.reason,
        paymentType: dto.paymentType,
        createdById,
        userIdPaid: dto.userIdPaid,
      },
      include: {
        createdBy: { select: { id: true, firstname: true, lastname: true } },
        paidMember: { select: { id: true, firstname: true, lastname: true } },
      },
    });
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  async getUserStats() {
    const consumptions = await this.prisma.bierConsumption.findMany({
      include: {
        member: { select: { id: true, firstname: true, lastname: true } },
        drink: { select: { id: true, name: true, pricePerUnit: true } },
      },
    });

    const balances = await this.prisma.bierMemberBalance.findMany({
      include: {
        member: { select: { id: true, firstname: true, lastname: true } },
      },
    });

    const balanceMap = new Map(balances.map((b) => [b.memberId, b]));

    const memberMap = new Map<
      number,
      { member: any; totalAmount: number; totalCost: number; byDrink: Map<number, any> }
    >();

    for (const c of consumptions) {
      if (!memberMap.has(c.memberId)) {
        memberMap.set(c.memberId, {
          member: c.member,
          totalAmount: 0,
          totalCost: 0,
          byDrink: new Map(),
        });
      }
      const entry = memberMap.get(c.memberId)!;
      entry.totalAmount += c.amount;
      entry.totalCost += c.drink.pricePerUnit * c.amount;

      if (!entry.byDrink.has(c.drinkId)) {
        entry.byDrink.set(c.drinkId, { drink: c.drink, amount: 0, cost: 0 });
      }
      const drinkEntry = entry.byDrink.get(c.drinkId)!;
      drinkEntry.amount += c.amount;
      drinkEntry.cost += c.drink.pricePerUnit * c.amount;
    }

    return Array.from(memberMap.values()).map((e) => ({
      member: e.member,
      totalAmount: e.totalAmount,
      totalCost: Number(e.totalCost.toFixed(2)),
      openAmount: balanceMap.get(e.member.id)?.openAmount ?? 0,
      paidAmount: balanceMap.get(e.member.id)?.paidAmount ?? 0,
      byDrink: Array.from(e.byDrink.values()).map((d) => ({
        ...d,
        cost: Number(d.cost.toFixed(2)),
      })),
    }));
  }
}
