import { Injectable, NotFoundException } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class MemberAttachmentService {
  constructor(private prisma: PrismaService) {}

  async create(memberId: number, file: Express.Multer.File) {
    const member = await this.prisma.member.findUnique({ where: { id: memberId } });
    if (!member) throw new NotFoundException(`Member ${memberId} not found`);

    return this.prisma.memberAttachment.create({
      data: {
        memberId,
        filename: file.originalname,
        storedName: file.filename,
        mimeType: file.mimetype,
        size: file.size,
      },
    });
  }

  async findAll(memberId: number) {
    const member = await this.prisma.member.findUnique({ where: { id: memberId } });
    if (!member) throw new NotFoundException(`Member ${memberId} not found`);

    return this.prisma.memberAttachment.findMany({
      where: { memberId },
      orderBy: { uploadedAt: "asc" },
    });
  }

  async findOne(memberId: number, attachmentId: number) {
    const attachment = await this.prisma.memberAttachment.findFirst({
      where: { id: attachmentId, memberId },
    });
    if (!attachment) throw new NotFoundException(`Attachment ${attachmentId} not found`);
    return attachment;
  }

  async remove(memberId: number, attachmentId: number) {
    const attachment = await this.findOne(memberId, attachmentId);

    const filePath = path.join(
      process.cwd(),
      "uploads",
      "member-attachments",
      attachment.storedName,
    );
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await this.prisma.memberAttachment.delete({ where: { id: attachmentId } });
  }
}
