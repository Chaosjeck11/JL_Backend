import { IsNumber, IsOptional, IsString, IsNotIn } from "class-validator";

export class CreateConsumptionDto {
  @IsNumber()
  drinkId: number;

  @IsNumber()
  @IsNotIn([0], { message: "amount must not be zero" })
  amount: number;

  @IsOptional()
  @IsString()
  note?: string;
}
