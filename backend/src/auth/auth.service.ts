import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async login(email: string, password: string) {
    const member = await this.prisma.member.findUnique({
      where: { email },
      include: { role: true },
    });

    if (!member || !member.active) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const valid = await bcrypt.compare(
      password,
      member.passwordHash,
    );

    if (!valid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const payload = {
      sub: member.id,
      email: member.email,
      accessLevel: member.role.accessLevel,
      role: member.role.name,
    };

    return {
      access_token: this.jwt.sign(payload),
    };
  }
}
