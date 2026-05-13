import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { VeranstaltungKategorienController } from "./veranstaltung-kategorien.controller";
import { VeranstaltungKategorienService } from "./veranstaltung-kategorien.service";

@Module({
  imports: [PrismaModule],
  controllers: [VeranstaltungKategorienController],
  providers: [VeranstaltungKategorienService],
})
export class VeranstaltungKategorienModule {}
