export class UpdateMemberDto {
  firstname?: string;
  password?: string;
  lastname?: string;
  email?: string;
  birthday?: string | null;
  phone?: string | null;
  address?: string | null;
  avatarPath?: string | null;
  roleId?: number;
  active?: boolean;
  inactiveSince?: string | null;
  u18?: boolean;
  bereitsMitglied?: boolean;
  schuelerStudentAzubi?: boolean;
  berufstaetig?: boolean;
  excludeFromBeitrag?: boolean;
  joinedAt?: string;
  /** Jahr-IDs, für die eine Beitragsänderung rückwirkend übernommen werden soll */
  retroactiveYearIds?: number[];
}
