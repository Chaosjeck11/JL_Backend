import { PaymentTag, TransactionType } from "@prisma/client";

export class CreateTransactionDto {
  date: string;
  description: string;
  type: TransactionType;
  amount: number;
  categoryId: number;
  businessYearId: number;
  memberId?: number;
  relatedTransactionId?: number;
  tag?: PaymentTag;
}
