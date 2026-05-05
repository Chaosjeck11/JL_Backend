import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { BusinessYearController } from "./business-year/business-year.controller";
import { BusinessYearService } from "./business-year/business-year.service";
import { CategoryController } from "./category/category.controller";
import { CategoryService } from "./category/category.service";
import { TransactionController } from "./transaction/transaction.controller";
import { TransactionService } from "./transaction/transaction.service";

@Module({
  imports: [PrismaModule],
  controllers: [BusinessYearController, CategoryController, TransactionController],
  providers: [BusinessYearService, CategoryService, TransactionService],
})
export class FinanceModule {}
