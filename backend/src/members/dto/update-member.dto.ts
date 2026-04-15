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
}
