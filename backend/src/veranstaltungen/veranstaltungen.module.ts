import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { VeranstaltungenController, FormTemplateController } from "./veranstaltungen.controller";
import { VeranstaltungenService } from "./veranstaltungen.service";

@Module({
  imports: [PrismaModule],
  controllers: [VeranstaltungenController, FormTemplateController],
  providers: [VeranstaltungenService],
})
export class VeranstaltungenModule {}
