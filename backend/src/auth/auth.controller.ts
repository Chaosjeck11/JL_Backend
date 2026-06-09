import { Controller, Post, Body } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post("login")
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async login(
    @Body("email") email: string,
    @Body("password") password: string,
  ) {
    return this.auth.login(email, password);
  }
}
