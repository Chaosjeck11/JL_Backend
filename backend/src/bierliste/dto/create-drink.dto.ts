import { IsString, IsNumber, IsOptional, IsBoolean, Min } from "class-validator";

export class CreateDrinkDto {
  @IsString()
  name: string;

  @IsNumber()
  @Min(0)
  pricePerUnit: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
