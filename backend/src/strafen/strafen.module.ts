import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { StrafenService } from "./strafen.service";
import { StrafenController, StrafeEintraegeController } from "./strafen.controller";

@Module({
  imports: [PrismaModule],
  controllers: [StrafeEintraegeController, StrafenController],
  providers: [StrafenService],
})
export class StrafenModule {}
