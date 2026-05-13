import { Injectable, NotFoundException } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";
import { TransactionType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateVeranstaltungDto } from "./dto/create-veranstaltung.dto";
import { UpdateVeranstaltungDto } from "./dto/update-veranstaltung.dto";
import { CreateFormRowDto } from "./dto/create-form-row.dto";
import { UpdateFormRowDto } from "./dto/update-form-row.dto";
import { UpdateFormTemplateDto } from "./dto/update-form-template.dto";

export const VERANSTALTUNG_ATTACHMENT_DIR = path.join(
  process.cwd(),
  "uploads",
  "veranstaltung-attachments",
);
fs.mkdirSync(VERANSTALTUNG_ATTACHMENT_DIR, { recursive: true });

@Injectable()
export class VeranstaltungenService {
  constructor(private prisma: PrismaService) {}

  // ── CRUD ──────────────────────────────────────────────────────────────────

  findAll() {
    return this.prisma.veranstaltung.findMany({
      orderBy: { date: "desc" },
      include: {
        _count: { select: { transactions: true, attachments: true } },
      },
    });
  }

  async findOne(id: number) {
    const v = await this.prisma.veranstaltung.findUnique({
      where: { id },
      include: {
        transactions: {
          include: {
            category: true,
            member: { select: { id: true, firstname: true, lastname: true } },
          },
          orderBy: { date: "asc" },
        },
        attachments: { orderBy: { uploadedAt: "asc" } },
        form: { include: { rows: { orderBy: { rowIndex: "asc" } } } },
      },
    });
    if (!v) throw new NotFoundException(`Veranstaltung ${id} nicht gefunden.`);
    return v;
  }

  async create(dto: CreateVeranstaltungDto) {
    const template = await this.getOrCreateTemplate();

    return this.prisma.veranstaltung.create({
      data: {
        name: dto.name,
        date: new Date(dto.date),
        description: dto.description,
        form: {
          create: {
            columns: (template.columns as unknown[]) ?? [],
          },
        },
      },
      include: { form: true },
    });
  }

  async update(id: number, dto: UpdateVeranstaltungDto) {
    await this.findOneOrFail(id);
    return this.prisma.veranstaltung.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.date !== undefined && { date: new Date(dto.date) }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
    });
  }

  async remove(id: number) {
    await this.findOneOrFail(id);
    const attachments = await this.prisma.veranstaltungAttachment.findMany({
      where: { veranstaltungId: id },
    });
    for (const a of attachments) {
      const p = path.join(VERANSTALTUNG_ATTACHMENT_DIR, a.storedName);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    await this.prisma.veranstaltung.delete({ where: { id } });
  }

  // ── Financials ─────────────────────────────────────────────────────────────

  async getFinancials(id: number) {
    await this.findOneOrFail(id);
    const transactions = await this.prisma.transaction.findMany({
      where: { veranstaltungId: id },
      include: { relatedTransaction: { select: { type: true } } },
    });

    let einnahmen = 0;
    let ausgaben = 0;
    for (const tx of transactions) {
      if (tx.type === TransactionType.EINZAHLUNG) {
        einnahmen += tx.amount;
      } else if (tx.type === TransactionType.AUSZAHLUNG) {
        ausgaben += tx.amount;
      } else if (tx.type === TransactionType.RUECKBUCHUNG) {
        const origType = (tx as any).relatedTransaction?.type;
        if (origType === TransactionType.AUSZAHLUNG) einnahmen += tx.amount;
        else if (origType === TransactionType.EINZAHLUNG) ausgaben += tx.amount;
      }
    }

    return { einnahmen, ausgaben, saldo: einnahmen - ausgaben };
  }

  // ── All Attachments ────────────────────────────────────────────────────────

  async getAllAttachments(id: number) {
    await this.findOneOrFail(id);

    const [direct, fromTransactions] = await Promise.all([
      this.prisma.veranstaltungAttachment.findMany({
        where: { veranstaltungId: id },
        orderBy: { uploadedAt: "asc" },
      }),
      this.prisma.transactionAttachment.findMany({
        where: { transaction: { veranstaltungId: id } },
        include: {
          transaction: {
            select: { id: true, description: true, date: true, amount: true, type: true },
          },
        },
        orderBy: { uploadedAt: "asc" },
      }),
    ]);

    return {
      direct: direct.map((a) => ({ ...a, source: "direct" as const })),
      fromTransactions: fromTransactions.map((a) => ({
        ...a,
        source: "transaction" as const,
      })),
    };
  }

  // ── Direct Attachments ─────────────────────────────────────────────────────

  async findAttachments(id: number) {
    await this.findOneOrFail(id);
    return this.prisma.veranstaltungAttachment.findMany({
      where: { veranstaltungId: id },
      orderBy: { uploadedAt: "asc" },
    });
  }

  async findAttachment(veranstaltungId: number, attachmentId: number) {
    const a = await this.prisma.veranstaltungAttachment.findFirst({
      where: { id: attachmentId, veranstaltungId },
    });
    if (!a) throw new NotFoundException(`Anhang ${attachmentId} nicht gefunden.`);
    return a;
  }

  async createAttachment(id: number, file: Express.Multer.File) {
    await this.findOneOrFail(id);
    return this.prisma.veranstaltungAttachment.create({
      data: {
        veranstaltungId: id,
        filename: file.originalname,
        storedName: file.filename,
        mimeType: file.mimetype,
        size: file.size,
      },
    });
  }

  async removeAttachment(id: number, attachmentId: number) {
    const a = await this.findAttachment(id, attachmentId);
    const p = path.join(VERANSTALTUNG_ATTACHMENT_DIR, a.storedName);
    if (fs.existsSync(p)) fs.unlinkSync(p);
    await this.prisma.veranstaltungAttachment.delete({ where: { id: attachmentId } });
  }

  // ── Form Rows ──────────────────────────────────────────────────────────────

  async getForm(id: number) {
    await this.findOneOrFail(id);
    const form = await this.prisma.veranstaltungForm.findUnique({
      where: { veranstaltungId: id },
      include: { rows: { orderBy: { rowIndex: "asc" } } },
    });
    if (!form) throw new NotFoundException(`Formular für Veranstaltung ${id} nicht gefunden.`);
    return form;
  }

  async addFormRow(id: number, dto: CreateFormRowDto) {
    const form = await this.prisma.veranstaltungForm.findUnique({
      where: { veranstaltungId: id },
    });
    if (!form) throw new NotFoundException(`Formular für Veranstaltung ${id} nicht gefunden.`);

    let rowIndex = dto.rowIndex;
    if (rowIndex === undefined) {
      const agg = await this.prisma.veranstaltungFormRow.aggregate({
        where: { formId: form.id },
        _max: { rowIndex: true },
      });
      rowIndex = (agg._max.rowIndex ?? -1) + 1;
    }

    return this.prisma.veranstaltungFormRow.create({
      data: { formId: form.id, rowIndex, cells: (dto.cells as object) ?? {} },
    });
  }

  async updateFormRow(id: number, rowId: number, dto: UpdateFormRowDto) {
    const form = await this.prisma.veranstaltungForm.findUnique({
      where: { veranstaltungId: id },
    });
    if (!form) throw new NotFoundException(`Formular für Veranstaltung ${id} nicht gefunden.`);

    const row = await this.prisma.veranstaltungFormRow.findFirst({
      where: { id: rowId, formId: form.id },
    });
    if (!row) throw new NotFoundException(`Zeile ${rowId} nicht gefunden.`);

    return this.prisma.veranstaltungFormRow.update({
      where: { id: rowId },
      data: {
        ...(dto.cells !== undefined && { cells: dto.cells as object }),
        ...(dto.rowIndex !== undefined && { rowIndex: dto.rowIndex }),
      },
    });
  }

  async removeFormRow(id: number, rowId: number) {
    const form = await this.prisma.veranstaltungForm.findUnique({
      where: { veranstaltungId: id },
    });
    if (!form) throw new NotFoundException(`Formular für Veranstaltung ${id} nicht gefunden.`);

    const row = await this.prisma.veranstaltungFormRow.findFirst({
      where: { id: rowId, formId: form.id },
    });
    if (!row) throw new NotFoundException(`Zeile ${rowId} nicht gefunden.`);

    await this.prisma.veranstaltungFormRow.delete({ where: { id: rowId } });
  }

  async updateFormColumns(id: number, columns: Array<{ id: string; label: string; type: string }>) {
    const form = await this.prisma.veranstaltungForm.findUnique({
      where: { veranstaltungId: id },
    });
    if (!form) throw new NotFoundException(`Formular für Veranstaltung ${id} nicht gefunden.`);
    return this.prisma.veranstaltungForm.update({
      where: { id: form.id },
      data: { columns },
    });
  }

  // ── Form Template ──────────────────────────────────────────────────────────

  async getOrCreateTemplate() {
    let template = await this.prisma.veranstaltungFormTemplate.findFirst();
    if (!template) {
      template = await this.prisma.veranstaltungFormTemplate.create({
        data: { columns: [] },
      });
    }
    return template;
  }

  async updateTemplate(dto: UpdateFormTemplateDto) {
    const template = await this.getOrCreateTemplate();
    return this.prisma.veranstaltungFormTemplate.update({
      where: { id: template.id },
      data: { columns: dto.columns },
    });
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private async findOneOrFail(id: number) {
    const v = await this.prisma.veranstaltung.findUnique({ where: { id } });
    if (!v) throw new NotFoundException(`Veranstaltung ${id} nicht gefunden.`);
    return v;
  }
}
