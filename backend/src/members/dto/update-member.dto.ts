export class UpdateMemberDto {
  firstname?: string;
  lastname?: string;
  email?: string;
  birthday?: string;
  phone?: string;
  address?: string;

  roleId?: number;
  accessLevel?: number;
  active?: boolean;

  u18?: boolean;
  bereitsMitglied?: boolean;
  schuelerStudentAzubi?: boolean;
  berufstaetig?: boolean;
}
