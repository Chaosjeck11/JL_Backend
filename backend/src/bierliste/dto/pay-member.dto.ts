import { IsNumber, Min } from "class-validator";

export class PayMemberDto {
  @IsNumber()
  @Min(0.01)
  amount: number;
}
