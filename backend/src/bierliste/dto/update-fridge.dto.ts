export class UpdateFridgeDto {
  mode: "set" | "add" | "subtract";
  value: number;
  minStock?: number;
  maxStock?: number;
  location?: string;
}
