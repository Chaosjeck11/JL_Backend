import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { MembersModule } from "./members/members.module";
import { PrismaModule } from "./prisma/prisma.module";
import { FinanceModule } from "./finance/finance.module";
import { FilesModule } from "./files/files.module";
import { VeranstaltungenModule } from "./veranstaltungen/veranstaltungen.module";
import { VeranstaltungKategorienModule } from "./veranstaltung-kategorien/veranstaltung-kategorien.module";
import { StrafenModule } from "./strafen/strafen.module";
import { UpdateModule } from "./update/update.module";

@Module({
  imports: [PrismaModule, AuthModule, MembersModule, FinanceModule, FilesModule, VeranstaltungenModule, VeranstaltungKategorienModule, StrafenModule, UpdateModule],
})
export class AppModule {}
