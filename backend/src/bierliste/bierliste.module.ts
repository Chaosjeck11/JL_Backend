import { Module } from "@nestjs/common";
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
