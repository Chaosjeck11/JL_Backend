import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { TransactionType } from "@prisma/client";
import { TransactionService } from "./transaction.service";
import { CreateTransactionDto } from "./dto/create-transaction.dto";
import { UpdateTransactionDto } from "./dto/update-transaction.dto";
import { AccessLevel } from "../../auth/access-level.decorator";
import { AccessLevelGuard } from "../../auth/access-level.guard";

@Controller("finance/transactions")
@UseGuards(AuthGuard("jwt"), AccessLevelGuard)
export class TransactionController {
  constructor(private transactionService: TransactionService) {}

  @Get()
  @AccessLevel(0)
  findAll(
    @Query("businessYearId") businessYearId?: string,
    @Query("categoryId") categoryId?: string,
    @Query("memberId") memberId?: string,
    @Query("type") type?: TransactionType,
  ) {
    return this.transactionService.findAll({
      businessYearId: businessYearId ? parseInt(businessYearId, 10) : undefined,
      categoryId: categoryId ? parseInt(categoryId, 10) : undefined,
      memberId: memberId ? parseInt(memberId, 10) : undefined,
      type,
    });
  }

  // Defined before /:id to prevent "balance" being captured as an id param
  @Get("balance/:businessYearId")
  @AccessLevel(0)
  getRunningBalance(
    @Param("businessYearId", ParseIntPipe) businessYearId: number,
  ) {
    return this.transactionService.getRunningBalance(businessYearId);
  }

  @Get(":id")
  @AccessLevel(0)
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.transactionService.findOne(id);
  }

  @Post()
  @AccessLevel(5)
  create(@Body() dto: CreateTransactionDto) {
    return this.transactionService.create(dto);
  }

  @Patch(":id")
  @AccessLevel(5)
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateTransactionDto,
  ) {
    return this.transactionService.update(id, dto);
  }

  @Delete(":id")
  @AccessLevel(5)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.transactionService.remove(id);
  }
}
