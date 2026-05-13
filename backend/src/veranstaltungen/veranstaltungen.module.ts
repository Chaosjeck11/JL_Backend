import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { VeranstaltungenController, VeranstaltungenICalController, FormTemplateController } from "./veranstaltungen.controller";
import { VeranstaltungenService } from "./veranstaltungen.service";

@Module({
  imports: [PrismaModule],
  controllers: [VeranstaltungenICalController, VeranstaltungenController, FormTemplateController],
  providers: [VeranstaltungenService],
})
export class VeranstaltungenModule {}
