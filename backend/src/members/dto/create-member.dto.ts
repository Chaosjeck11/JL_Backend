export class CreateMemberDto {
  firstname: string;
  lastname: string;
  email: string;
  password: string;

  joinedAt?: string;
  birthday?: string;
  phone?: string;
  address?: string;

  roleId: number;
  accessLevel?: number;

  u18?: boolean;
  bereitsMitglied?: boolean;
  schuelerStudentAzubi?: boolean;
  berufstaetig?: boolean;
}
