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
import { Response } from "express";
import * as path from "path";
import { AttachmentService } from "./attachment.service";
import { AccessLevel } from "../../auth/access-level.decorator";
import { AccessLevelGuard } from "../../auth/access-level.guard";

@Controller("finance/transactions/:transactionId/attachments")
@UseGuards(AuthGuard("jwt"), AccessLevelGuard)
export class AttachmentController {
  constructor(private attachmentService: AttachmentService) {}

  @Get()
  @AccessLevel(3)
  findAll(@Param("transactionId", ParseIntPipe) transactionId: number) {
    return this.attachmentService.findAll(transactionId);
  }

  @Post()
  @AccessLevel(4)
  @UseInterceptors(FileInterceptor("file"))
  upload(
    @Param("transactionId", ParseIntPipe) transactionId: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException("No file uploaded");
    return this.attachmentService.create(transactionId, file);
  }

  @Get(":attachmentId/download")
  @AccessLevel(3)
  async download(
    @Param("transactionId", ParseIntPipe) transactionId: number,
    @Param("attachmentId", ParseIntPipe) attachmentId: number,
    @Res() res: Response,
  ) {
    const attachment = await this.attachmentService.findOne(
      transactionId,
      attachmentId,
    );
    const filePath = path.join(
      process.cwd(),
      "uploads",
      "attachments",
      attachment.storedName,
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${attachment.filename}"`,
    );
    res.setHeader("Content-Type", attachment.mimeType);
    res.sendFile(filePath);
  }

  @Delete(":attachmentId")
  @AccessLevel(4)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param("transactionId", ParseIntPipe) transactionId: number,
    @Param("attachmentId", ParseIntPipe) attachmentId: number,
  ) {
    return this.attachmentService.remove(transactionId, attachmentId);
  }
}
