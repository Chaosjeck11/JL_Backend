import { Controller, Post, Body } from "@nestjs/common";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post("login")
  async login(
    @Body("email") email: string,
    @Body("password") password: string,
  ) {
    return this.auth.login(email, password);
  }
}
