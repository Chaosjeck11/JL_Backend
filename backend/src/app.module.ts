import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { MembersModule } from "./members/members.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [PrismaModule, AuthModule, MembersModule],
})
export class AppModule {}
