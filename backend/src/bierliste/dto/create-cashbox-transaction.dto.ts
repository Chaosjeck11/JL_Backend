import { IsNumber, IsOptional, IsString, IsIn, IsInt, Min } from "class-validator";

export class CreateCashboxTransactionDto {
  @IsNumber()
  @Min(0)
  amount: number;

  @IsIn(["IN", "OUT", "CORRECTION"])
  direction: "IN" | "OUT" | "CORRECTION";

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  paymentType?: string;

  @IsOptional()
  @IsInt()
  userIdPaid?: number;
}
