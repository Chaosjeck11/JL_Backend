import { PaymentTag } from "@prisma/client";

export class UpdateTransactionDto {
  date?: string;
  description?: string;
  categoryId?: number;
  beitragYearId?: number | null;
  memberId?: number | null;
  tag?: PaymentTag | null;
  veranstaltungId?: number | null;
}
