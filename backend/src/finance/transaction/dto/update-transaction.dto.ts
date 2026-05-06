import { PaymentTag } from "@prisma/client";

export class UpdateTransactionDto {
  date?: string;
  description?: string;
  categoryId?: number;
  memberId?: number | null;
  tag?: PaymentTag | null;
}
