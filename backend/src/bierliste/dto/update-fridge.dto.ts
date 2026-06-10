import { IsString, IsNumber, IsOptional, IsIn, Min } from "class-validator";

export class UpdateFridgeDto {
  @IsIn(["set", "add", "subtract"])
  mode: "set" | "add" | "subtract";

  @IsNumber()
  @Min(0)
  value: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minStock?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxStock?: number;

  @IsOptional()
  @IsString()
  location?: string;
}
