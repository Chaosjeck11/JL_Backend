export class CreateMemberDto {
  firstname: string;
  lastname: string;
  email: string;
  password: string;

  birthday?: string;
  phone?: string;
  address?: string;

  roleId: number;
  accessLevel?: number;
}
