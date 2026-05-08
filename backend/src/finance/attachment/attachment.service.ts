import { Injectable, NotFoundException } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class AttachmentService {
  constructor(private prisma: PrismaService) {}

  async create(transactionId: number, file: Express.Multer.File) {
    const tx = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
    });
    if (!tx) throw new NotFoundException(`Transaction ${transactionId} not found`);

    return this.prisma.transactionAttachment.create({
      data: {
        transactionId,
        filename: file.originalname,
        storedName: file.filename,
        mimeType: file.mimetype,
        size: file.size,
      },
    });
  }

  async findAll(transactionId: number) {
    const tx = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
    });
    if (!tx) throw new NotFoundException(`Transaction ${transactionId} not found`);

    return this.prisma.transactionAttachment.findMany({
      where: { transactionId },
      orderBy: { uploadedAt: "asc" },
    });
  }

  async findOne(transactionId: number, attachmentId: number) {
    const attachment = await this.prisma.transactionAttachment.findFirst({
      where: { id: attachmentId, transactionId },
    });
    if (!attachment)
      throw new NotFoundException(`Attachment ${attachmentId} not found`);
    return attachment;
  }

  async remove(transactionId: number, attachmentId: number) {
    const attachment = await this.findOne(transactionId, attachmentId);

    const filePath = path.join(
      process.cwd(),
      "uploads",
      "attachments",
      attachment.storedName,
    );
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await this.prisma.transactionAttachment.delete({
      where: { id: attachmentId },
    });
  }
}
