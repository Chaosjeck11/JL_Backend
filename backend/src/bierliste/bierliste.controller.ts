import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
  UseGuards,
  Req,
  ForbiddenException,
  UseInterceptors,
  UploadedFile,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import * as path from "path";
import * as os from "os";
import { BierlisteService } from "./bierliste.service";
import { AccessLevel } from "../auth/access-level.decorator";
import { AccessLevelGuard } from "../auth/access-level.guard";
import { CreateDrinkDto } from "./dto/create-drink.dto";
import { UpdateDrinkDto } from "./dto/update-drink.dto";
import { UpdateFridgeDto } from "./dto/update-fridge.dto";
import { CreateConsumptionDto } from "./dto/create-consumption.dto";
import { CreateCashboxTransactionDto } from "./dto/create-cashbox-transaction.dto";
import { PayMemberDto } from "./dto/pay-member.dto";

const BIER_ADMIN_MIN_LEVEL = parseInt(process.env.BIERLISTE_ADMIN_MIN_LEVEL ?? "3", 10);

function isBierAdmin(level: number) {
  return level >= BIER_ADMIN_MIN_LEVEL;
}

const guards = [AuthGuard("jwt"), AccessLevelGuard];

// ── Drinks ────────────────────────────────────────────────────────────────────

@UseGuards(...guards)
@Controller("bierliste/drinks")
export class BierDrinksController {
  constructor(private readonly service: BierlisteService) {}

  @Get()
  @AccessLevel(0)
  findAll(@Query("includeInactive") includeInactive: string, @Req() req: any) {
    const showInactive = includeInactive === "true" && isBierAdmin(req.user.accessLevel);
    return this.service.findAllDrinks(showInactive);
  }

  @Get(":id")
  @AccessLevel(0)
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.service.findOneDrink(id);
  }

  @Post()
  @AccessLevel(0)
  create(@Body() dto: CreateDrinkDto, @Req() req: any) {
    if (!isBierAdmin(req.user.accessLevel))
      throw new ForbiddenException("Bierliste Admin required");
    return this.service.createDrink(dto);
  }

  @Patch(":id")
  @AccessLevel(0)
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateDrinkDto,
    @Req() req: any,
  ) {
    if (!isBierAdmin(req.user.accessLevel))
      throw new ForbiddenException("Bierliste Admin required");
    return this.service.updateDrink(id, dto);
  }

  @Delete(":id")
  @AccessLevel(0)
  remove(@Param("id", ParseIntPipe) id: number, @Req() req: any) {
    if (!isBierAdmin(req.user.accessLevel))
      throw new ForbiddenException("Bierliste Admin required");
    return this.service.deleteDrink(id);
  }

  @Post(":id/image")
  @AccessLevel(0)
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: os.tmpdir(),
        filename: (_, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_, file, cb) => {
        const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
        cb(null, allowed.includes(file.mimetype));
      },
    }),
  )
  uploadImage(
    @Param("id", ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    if (!isBierAdmin(req.user.accessLevel))
      throw new ForbiddenException("Bierliste Admin required");
    return this.service.uploadDrinkImage(id, file);
  }
}

// ── Fridge ────────────────────────────────────────────────────────────────────

@UseGuards(...guards)
@Controller("bierliste/fridge")
export class BierFridgeController {
  constructor(private readonly service: BierlisteService) {}

  @Get()
  @AccessLevel(0)
  findAll() {
    return this.service.findFridge();
  }

  @Patch(":drinkId")
  @AccessLevel(0)
  update(
    @Param("drinkId", ParseIntPipe) drinkId: number,
    @Body() dto: UpdateFridgeDto,
    @Req() req: any,
  ) {
    if (!isBierAdmin(req.user.accessLevel))
      throw new ForbiddenException("Bierliste Admin required");
    return this.service.updateFridge(drinkId, dto);
  }
}

// ── Consumption ───────────────────────────────────────────────────────────────

@UseGuards(...guards)
@Controller("bierliste/consumption")
export class BierConsumptionController {
  constructor(private readonly service: BierlisteService) {}

  @Get("me")
  @AccessLevel(0)
  getMyConsumption(@Req() req: any) {
    return this.service.getMyConsumption(req.user.sub);
  }

  @Post()
  @AccessLevel(0)
  create(@Body() dto: CreateConsumptionDto, @Req() req: any) {
    return this.service.createConsumption(req.user.sub, dto);
  }
}

// ── Members / Balance ─────────────────────────────────────────────────────────

@UseGuards(...guards)
@Controller("bierliste/members")
export class BierMembersController {
  constructor(private readonly service: BierlisteService) {}

  @Get("balance")
  @AccessLevel(0)
  getAllBalances(@Req() req: any) {
    if (!isBierAdmin(req.user.accessLevel))
      throw new ForbiddenException("Bierliste Admin required");
    return this.service.getAllBalances();
  }

  @Get("balance/me")
  @AccessLevel(0)
  getMyBalance(@Req() req: any) {
    return this.service.getMyBalance(req.user.sub);
  }

  @Patch(":id/pay")
  @AccessLevel(0)
  pay(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: PayMemberDto,
    @Req() req: any,
  ) {
    if (!isBierAdmin(req.user.accessLevel))
      throw new ForbiddenException("Bierliste Admin required");
    return this.service.payMember(id, dto.amount, req.user.sub);
  }

  @Patch(":id/amounts")
  @AccessLevel(0)
  adjustAmounts(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: { openAmount?: number; paidAmount?: number },
    @Req() req: any,
  ) {
    if (!isBierAdmin(req.user.accessLevel))
      throw new ForbiddenException("Bierliste Admin required");
    return this.service.adjustMemberAmounts(id, body.openAmount, body.paidAmount);
  }
}

// ── Cashbox ───────────────────────────────────────────────────────────────────

@UseGuards(...guards)
@Controller("bierliste/cashbox")
export class BierCashboxController {
  constructor(private readonly service: BierlisteService) {}

  @Get()
  @AccessLevel(0)
  getCashbox(@Req() req: any) {
    if (!isBierAdmin(req.user.accessLevel))
      throw new ForbiddenException("Bierliste Admin required");
    return this.service.getCashbox();
  }

  @Post()
  @AccessLevel(0)
  create(@Body() dto: CreateCashboxTransactionDto, @Req() req: any) {
    if (!isBierAdmin(req.user.accessLevel))
      throw new ForbiddenException("Bierliste Admin required");
    return this.service.createCashboxTransaction(dto, req.user.sub);
  }
}

// ── Stats ─────────────────────────────────────────────────────────────────────

@UseGuards(...guards)
@Controller("bierliste/stats")
export class BierStatsController {
  constructor(private readonly service: BierlisteService) {}

  @Get("users")
  @AccessLevel(0)
  getUserStats(@Req() req: any) {
    if (!isBierAdmin(req.user.accessLevel))
      throw new ForbiddenException("Bierliste Admin required");
    return this.service.getUserStats();
  }
}
