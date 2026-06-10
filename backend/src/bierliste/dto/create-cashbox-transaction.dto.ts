export class CreateCashboxTransactionDto {
  amount: number;
  direction: "IN" | "OUT" | "CORRECTION";
  reason?: string;
  paymentType?: string;
  userIdPaid?: number;
}
