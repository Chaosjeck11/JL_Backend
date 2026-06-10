export class CreateDrinkDto {
  name: string;
  pricePerUnit: number;
  description?: string;
  category?: string;
  sortOrder?: number;
  active?: boolean;
}
