import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import { Module } from "@nestjs/common";
import { MulterModule } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { PrismaModule } from "../prisma/prisma.module";
import { BusinessYearController } from "./business-year/business-year.controller";
import { BusinessYearService } from "./business-year/business-year.service";
import { CategoryController } from "./category/category.controller";
import { CategoryService } from "./category/category.service";
import { TransactionController } from "./transaction/transaction.controller";
import { TransactionService } from "./transaction/transaction.service";
import { MitgliedsbeitragController } from "./mitgliedsbeitrag/mitgliedsbeitrag.controller";
import { MitgliedsbeitragService } from "./mitgliedsbeitrag/mitgliedsbeitrag.service";
import { AttachmentController } from "./attachment/attachment.controller";
import { AttachmentService } from "./attachment/attachment.service";

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "attachments");
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
        const blocked = [".exe", ".sh", ".bat", ".cmd", ".com", ".ps1", ".dll", ".vbs", ".js", ".msi"];
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
  controllers: [
    BusinessYearController,
    CategoryController,
    TransactionController,
    MitgliedsbeitragController,
    AttachmentController,
  ],
  providers: [
    BusinessYearService,
    CategoryService,
    TransactionService,
    MitgliedsbeitragService,
    AttachmentService,
  ],
})
export class FinanceModule {}
