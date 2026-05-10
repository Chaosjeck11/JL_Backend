import { Injectable, NotFoundException } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateFileDto } from "./dto/update-file.dto";

@Injectable()
export class FilesService {
  constructor(private prisma: PrismaService) {}

  findAll(folderPath?: string) {
    return this.prisma.file.findMany({
      where: folderPath ? { path: folderPath } : undefined,
      include: {
        uploader: { select: { id: true, firstname: true, lastname: true } },
      },
      orderBy: { uploadedAt: "desc" },
    });
  }

  async findFolders(): Promise<string[]> {
    const rows = await this.prisma.file.findMany({
      select: { path: true },
      distinct: ["path"],
      orderBy: { path: "asc" },
    });
    return rows.map((r) => r.path);
  }

  create(
    file: Express.Multer.File,
    uploadedBy: number,
    folderPath: string,
    description?: string,
  ) {
    return this.prisma.file.create({
      data: {
        filename: file.originalname,
        storedName: file.filename,
        mimeType: file.mimetype,
        size: file.size,
        path: folderPath,
        uploadedBy,
        description,
      },
    });
  }

  async findOne(id: number) {
    const file = await this.prisma.file.findUnique({ where: { id } });
    if (!file) throw new NotFoundException(`File ${id} not found`);
    return file;
  }

  async update(id: number, dto: UpdateFileDto) {
    await this.findOne(id);
    return this.prisma.file.update({ where: { id }, data: dto });
  }

  async remove(id: number) {
    const file = await this.findOne(id);
    const filePath = path.join(
      process.cwd(),
      "uploads",
      "files",
      file.storedName,
    );
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    await this.prisma.file.delete({ where: { id } });
  }

  async resolveFilePath(id: number) {
    const file = await this.findOne(id);
    const filePath = path.join(
      process.cwd(),
      "uploads",
      "files",
      file.storedName,
    );
    return { file, filePath };
  }
}
