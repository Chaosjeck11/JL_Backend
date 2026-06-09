import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import { Module } from "@nestjs/common";
import { MulterModule } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { PrismaModule } from "../prisma/prisma.module";
import { FilesController } from "./files.controller";
import { FilesService } from "./files.service";

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "files");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

@Module({
  imports: [
    PrismaModule,
    MulterModule.register({
      storage: diskStorage({
        destination: UPLOAD_DIR,
        filename: (_req, file, cb) => {
          const ext = path.extname(file.originalname);
          cb(null, `${randomUUID()}${ext}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        const blocked = [".exe", ".sh", ".bat", ".cmd", ".com", ".ps1", ".dll", ".vbs", ".msi"];
        const ext = path.extname(file.originalname).toLowerCase();
        if (blocked.includes(ext)) {
          cb(new Error("File type not allowed"), false);
        } else {
          cb(null, true);
        }
      },
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  ],
  controllers: [FilesController],
  providers: [FilesService],
})
export class FilesModule {}
