import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { BierlisteService } from "./bierliste.service";
import {
  BierDrinksController,
  BierFridgeController,
  BierConsumptionController,
  BierMembersController,
  BierCashboxController,
  BierStatsController,
} from "./bierliste.controller";

@Module({
  imports: [PrismaModule],
  controllers: [
    BierDrinksController,
    BierFridgeController,
    BierConsumptionController,
    BierMembersController,
    BierCashboxController,
    BierStatsController,
  ],
  providers: [BierlisteService],
})
export class BierlisteModule {}
