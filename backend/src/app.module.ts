import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { MembersModule } from "./members/members.module";
import { PrismaModule } from "./prisma/prisma.module";
import { FinanceModule } from "./finance/finance.module";
import { FilesModule } from "./files/files.module";

@Module({
  imports: [PrismaModule, AuthModule, MembersModule, FinanceModule, FilesModule],
})
export class AppModule {}
