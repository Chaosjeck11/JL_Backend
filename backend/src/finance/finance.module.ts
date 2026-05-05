import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { BusinessYearController } from "./business-year/business-year.controller";
import { BusinessYearService } from "./business-year/business-year.service";
import { CategoryController } from "./category/category.controller";
import { CategoryService } from "./category/category.service";
import { TransactionController } from "./transaction/transaction.controller";
import { TransactionService } from "./transaction/transaction.service";
import { MitgliedsbeitragController } from "./mitgliedsbeitrag/mitgliedsbeitrag.controller";
import { MitgliedsbeitragService } from "./mitgliedsbeitrag/mitgliedsbeitrag.service";

@Module({
  imports: [PrismaModule],
  controllers: [
    BusinessYearController,
    CategoryController,
    TransactionController,
    MitgliedsbeitragController,
  ],
  providers: [
    BusinessYearService,
    CategoryService,
    TransactionService,
    MitgliedsbeitragService,
  ],
})
export class FinanceModule {}
