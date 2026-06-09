import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: any) {
    if (
      typeof payload?.sub !== "number" ||
      typeof payload?.accessLevel !== "number" ||
      typeof payload?.email !== "string"
    ) {
      throw new Error("Invalid JWT payload");
    }
    return payload;
  }
}
