import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  Header,
  Res,
  BadRequestException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { Response } from "express";
import * as path from "path";
import { randomUUID } from "crypto";
import ical from "ical-generator";
import { VeranstaltungenService, VERANSTALTUNG_ATTACHMENT_DIR } from "./veranstaltungen.service";
import { CreateVeranstaltungDto } from "./dto/create-veranstaltung.dto";
import { UpdateVeranstaltungDto } from "./dto/update-veranstaltung.dto";
import { CreateFormRowDto } from "./dto/create-form-row.dto";
import { UpdateFormRowDto } from "./dto/update-form-row.dto";
import { UpdateFormTemplateDto } from "./dto/update-form-template.dto";
import { AccessLevel } from "../auth/access-level.decorator";
import { AccessLevelGuard } from "../auth/access-level.guard";

@Controller("veranstaltungen")
export class VeranstaltungenICalController {
  constructor(private service: VeranstaltungenService) {}

  @Get("ical")
  @Header("Access-Control-Allow-Origin", "*")
  async getICal(@Res() res: Response) {
    const events = await this.service.findAll();

    const cal = ical({
      name: "Junge Löwen Events",
      timezone: "Europe/Berlin",
      prodId: "//Junge Löwen//Events//DE",
    });

    for (const v of events) {
      const day = new Date(v.date);
      cal.createEvent({
        id: `veranstaltung-${v.id}@junge-loewen`,
        summary: v.name,
        description: v.description ?? "",
        start: day,
        end: day,
        allDay: true,
      });
    }

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", 'inline; filename="junge-loewen.ics"');
    res.send(cal.toString());
  }
}

const multerOptions = {
  storage: diskStorage({
    destination: VERANSTALTUNG_ATTACHMENT_DIR,
    filename: (_req: any, file: any, cb: any) => {
      const ext = path.extname(file.originalname);
      cb(null, `${randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
};

@Controller("veranstaltungen")
@UseGuards(AuthGuard("jwt"), AccessLevelGuard)
export class VeranstaltungenController {
  constructor(private service: VeranstaltungenService) {}

  // ── Veranstaltung CRUD ────────────────────────────────────────────────────

  @Get()
  @AccessLevel(0)
  findAll() {
    return this.service.findAll();
  }

  @Post()
  @AccessLevel(2)
  create(@Body() dto: CreateVeranstaltungDto) {
    return this.service.create(dto);
  }

  @Get(":id")
  @AccessLevel(0)
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(":id")
  @AccessLevel(2)
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateVeranstaltungDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  @AccessLevel(2)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.service.remove(id);
  }

  // ── Financials ─────────────────────────────────────────────────────────────

  @Get(":id/financials")
  @AccessLevel(0)
  getFinancials(@Param("id", ParseIntPipe) id: number) {
    return this.service.getFinancials(id);
  }

  // ── All Attachments ────────────────────────────────────────────────────────

  @Get(":id/all-attachments")
  @AccessLevel(0)
  getAllAttachments(@Param("id", ParseIntPipe) id: number) {
    return this.service.getAllAttachments(id);
  }

  // ── Direct Attachments ─────────────────────────────────────────────────────

  @Get(":id/attachments")
  @AccessLevel(0)
  findAttachments(@Param("id", ParseIntPipe) id: number) {
    return this.service.findAttachments(id);
  }

  @Post(":id/attachments")
  @AccessLevel(2)
  @UseInterceptors(FileInterceptor("file", multerOptions))
  uploadAttachment(
    @Param("id", ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException("No file uploaded");
    return this.service.createAttachment(id, file);
  }

  @Get(":id/attachments/:aid/download")
  @AccessLevel(0)
  async downloadAttachment(
    @Param("id", ParseIntPipe) id: number,
    @Param("aid", ParseIntPipe) aid: number,
    @Res() res: Response,
  ) {
    const a = await this.service.findAttachment(id, aid);
    const filePath = path.join(VERANSTALTUNG_ATTACHMENT_DIR, a.storedName);
    res.setHeader("Content-Disposition", `attachment; filename="${a.filename}"`);
    res.setHeader("Content-Type", a.mimeType);
    res.sendFile(filePath);
  }

  @Delete(":id/attachments/:aid")
  @AccessLevel(2)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeAttachment(
    @Param("id", ParseIntPipe) id: number,
    @Param("aid", ParseIntPipe) aid: number,
  ) {
    return this.service.removeAttachment(id, aid);
  }

  // ── Form ──────────────────────────────────────────────────────────────────

  @Get(":id/form")
  @AccessLevel(0)
  getForm(@Param("id", ParseIntPipe) id: number) {
    return this.service.getForm(id);
  }

  @Patch(":id/form")
  @AccessLevel(2)
  updateFormColumns(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateFormTemplateDto,
  ) {
    return this.service.updateFormColumns(id, dto.columns);
  }

  @Post(":id/form/rows")
  @AccessLevel(2)
  addFormRow(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: CreateFormRowDto,
  ) {
    return this.service.addFormRow(id, dto);
  }

  @Patch(":id/form/rows/:rowId")
  @AccessLevel(2)
  updateFormRow(
    @Param("id", ParseIntPipe) id: number,
    @Param("rowId", ParseIntPipe) rowId: number,
    @Body() dto: UpdateFormRowDto,
  ) {
    return this.service.updateFormRow(id, rowId, dto);
  }

  @Delete(":id/form/rows/:rowId")
  @AccessLevel(2)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeFormRow(
    @Param("id", ParseIntPipe) id: number,
    @Param("rowId", ParseIntPipe) rowId: number,
  ) {
    return this.service.removeFormRow(id, rowId);
  }
}

@Controller("veranstaltung-form-template")
@UseGuards(AuthGuard("jwt"), AccessLevelGuard)
export class FormTemplateController {
  constructor(private service: VeranstaltungenService) {}

  @Get()
  @AccessLevel(0)
  getTemplate() {
    return this.service.getOrCreateTemplate();
  }

  @Patch()
  @AccessLevel(5)
  updateTemplate(@Body() dto: UpdateFormTemplateDto) {
    return this.service.updateTemplate(dto);
  }
}
