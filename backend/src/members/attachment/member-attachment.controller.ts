import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  ParseIntPipe,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  Res,
  BadRequestException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { Response } from "express";
import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import { MemberAttachmentService } from "./member-attachment.service";
import { AccessLevel } from "../../auth/access-level.decorator";
import { AccessLevelGuard } from "../../auth/access-level.guard";

const ATTACHMENT_DIR = path.join(process.cwd(), "uploads", "member-attachments");
fs.mkdirSync(ATTACHMENT_DIR, { recursive: true });

const multerOptions = {
  storage: diskStorage({
    destination: ATTACHMENT_DIR,
    filename: (_req: any, file: any, cb: any) => {
      const ext = path.extname(file.originalname);
      cb(null, `${randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
};

@Controller("members/:memberId/attachments")
@UseGuards(AuthGuard("jwt"), AccessLevelGuard)
export class MemberAttachmentController {
  constructor(private attachmentService: MemberAttachmentService) {}

  @Get()
  @AccessLevel(2)
  findAll(@Param("memberId", ParseIntPipe) memberId: number) {
    return this.attachmentService.findAll(memberId);
  }

  @Post()
  @AccessLevel(5)
  @UseInterceptors(FileInterceptor("file", multerOptions))
  upload(
    @Param("memberId", ParseIntPipe) memberId: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException("No file uploaded");
    return this.attachmentService.create(memberId, file);
  }

  @Get(":attachmentId/download")
  @AccessLevel(2)
  async download(
    @Param("memberId", ParseIntPipe) memberId: number,
    @Param("attachmentId", ParseIntPipe) attachmentId: number,
    @Res() res: Response,
  ) {
    const attachment = await this.attachmentService.findOne(memberId, attachmentId);
    const filePath = path.join(ATTACHMENT_DIR, attachment.storedName);
    res.setHeader("Content-Disposition", `attachment; filename="${attachment.filename}"`);
    res.setHeader("Content-Type", attachment.mimeType);
    res.sendFile(filePath);
  }

  @Delete(":attachmentId")
  @AccessLevel(5)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param("memberId", ParseIntPipe) memberId: number,
    @Param("attachmentId", ParseIntPipe) attachmentId: number,
  ) {
    return this.attachmentService.remove(memberId, attachmentId);
  }
}
