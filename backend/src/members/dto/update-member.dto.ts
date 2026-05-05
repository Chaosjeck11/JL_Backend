export class UpdateMemberDto {
  firstname?: string;
  lastname?: string;
  email?: string;
  birthday?: string | null;
  phone?: string | null;
  address?: string | null;
  avatarPath?: string | null;
  roleId?: number;
  accessLevel?: number;
  active?: boolean;
  inactiveSince?: string | null;
  u18?: boolean;
  bereitsMitglied?: boolean;
  schuelerStudentAzubi?: boolean;
  berufstaetig?: boolean;
}
