import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Request } from "express";
import { StrafenService } from "./strafen.service";
import { CreateStrafeDto } from "./dto/create-strafe.dto";
import { UpdateStrafeDto } from "./dto/update-strafe.dto";
import { CreateStrafeEintragDto } from "./dto/create-strafe-eintrag.dto";
import { UpdateStrafeEintragDto } from "./dto/update-strafe-eintrag.dto";
import { BezahlenEintragDto } from "./dto/bezahlen-eintrag.dto";
import { AccessLevel } from "../auth/access-level.decorator";
import { AccessLevelGuard } from "../auth/access-level.guard";

// L1 (Strafenwart) and L3+ (Vorstand, Kassenwart, Admin) can read all entries.
// L0 and L2 (Orgateam) see only their own entries.
function canReadAllStrafen(level: number): boolean {
  return level === 1 || level >= 3;
}

// L1 and L3+ can create, edit, and delete entries.
function canWriteStrafen(level: number): boolean {
  return level === 1 || level >= 3;
}

// L1 and L4+ can mark entries as bezahlt or stornieren.
function canPayStrafen(level: number): boolean {
  return level === 1 || level >= 4;
}

function userLevel(req: Request): number {
  return (req.user as any).accessLevel as number;
}

function userSub(req: Request): number {
  return (req.user as any).sub as number;
}

@Controller("strafen")
@UseGuards(AuthGuard("jwt"), AccessLevelGuard)
export class StrafenController {
  constructor(private service: StrafenService) {}

  // ── Katalog ──────────────────────────────────────────────────────────────────

  @Get()
  @AccessLevel(0)
  findAllKatalog() {
    return this.service.findAllKatalog();
  }

  @Post()
  @AccessLevel(0)
  createKatalog(@Req() req: Request, @Body() dto: CreateStrafeDto) {
    if (!canWriteStrafen(userLevel(req))) throw new ForbiddenException("Insufficient permissions");
    return this.service.createKatalog(dto);
  }

  @Get(":id")
  @AccessLevel(0)
  findOneKatalog(@Param("id", ParseIntPipe) id: number) {
    return this.service.findOneKatalog(id);
  }

  @Patch(":id")
  @AccessLevel(0)
  updateKatalog(
    @Req() req: Request,
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateStrafeDto,
  ) {
    if (!canWriteStrafen(userLevel(req))) throw new ForbiddenException("Insufficient permissions");
    return this.service.updateKatalog(id, dto);
  }

  @Delete(":id")
  @AccessLevel(0)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeKatalog(@Req() req: Request, @Param("id", ParseIntPipe) id: number) {
    if (!canWriteStrafen(userLevel(req))) throw new ForbiddenException("Insufficient permissions");
    return this.service.removeKatalog(id);
  }
}

@Controller("strafen/eintraege")
@UseGuards(AuthGuard("jwt"), AccessLevelGuard)
export class StrafeEintraegeController {
  constructor(private service: StrafenService) {}

  @Get()
  @AccessLevel(0)
  findAll(
    @Req() req: Request,
    @Query("memberId") memberId?: string,
    @Query("strafeId") strafeId?: string,
    @Query("businessYearId") businessYearId?: string,
    @Query("bezahlt") bezahlt?: string,
  ) {
    const level = userLevel(req);
    const resolvedMemberId = canReadAllStrafen(level)
      ? (memberId ? parseInt(memberId, 10) : undefined)
      : userSub(req);

    return this.service.findAllEintraege({
      memberId: resolvedMemberId,
      strafeId: strafeId ? parseInt(strafeId, 10) : undefined,
      businessYearId: businessYearId ? parseInt(businessYearId, 10) : undefined,
      bezahlt: bezahlt !== undefined ? bezahlt === "true" : undefined,
    });
  }

  @Get("summary")
  @AccessLevel(0)
  getSummary(
    @Req() req: Request,
    @Query("memberId") memberId?: string,
    @Query("businessYearId") businessYearId?: string,
  ) {
    const level = userLevel(req);
    const resolvedMemberId = canReadAllStrafen(level)
      ? (memberId ? parseInt(memberId, 10) : undefined)
      : userSub(req);

    return this.service.getSummary({
      memberId: resolvedMemberId,
      businessYearId: businessYearId ? parseInt(businessYearId, 10) : undefined,
    });
  }

  @Get(":id")
  @AccessLevel(0)
  async findOne(@Req() req: Request, @Param("id", ParseIntPipe) id: number) {
    const level = userLevel(req);
    const entry = await this.service.findOneEintrag(id);
    if (!canReadAllStrafen(level) && entry.memberId !== userSub(req)) {
      throw new ForbiddenException("Insufficient permissions");
    }
    return entry;
  }

  @Post()
  @AccessLevel(0)
  create(@Req() req: Request, @Body() dto: CreateStrafeEintragDto) {
    if (!canWriteStrafen(userLevel(req))) {
      throw new ForbiddenException("Insufficient permissions");
    }
    return this.service.createEintrag(dto);
  }

  @Patch(":id")
  @AccessLevel(0)
  update(
    @Req() req: Request,
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateStrafeEintragDto,
  ) {
    const level = userLevel(req);
    if (!canWriteStrafen(level)) {
      throw new ForbiddenException("Insufficient permissions");
    }
    if (dto.bezahlt !== undefined && !canPayStrafen(level)) {
      throw new ForbiddenException("Keine Berechtigung, Strafen als bezahlt zu markieren");
    }
    return this.service.updateEintrag(id, dto);
  }

  @Post(":id/bezahlen")
  @AccessLevel(0)
  bezahlen(
    @Req() req: Request,
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: BezahlenEintragDto,
  ) {
    if (!canPayStrafen(userLevel(req))) {
      throw new ForbiddenException("Keine Berechtigung, Strafen als bezahlt zu markieren");
    }
    return this.service.bezahlenEintrag(id, dto);
  }

  @Post(":id/stornieren")
  @AccessLevel(0)
  stornieren(@Req() req: Request, @Param("id", ParseIntPipe) id: number) {
    if (!canPayStrafen(userLevel(req))) {
      throw new ForbiddenException("Keine Berechtigung, Strafen zu stornieren");
    }
    return this.service.stornierenEintrag(id);
  }

  @Delete(":id")
  @AccessLevel(0)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Req() req: Request, @Param("id", ParseIntPipe) id: number) {
    if (!canWriteStrafen(userLevel(req))) {
      throw new ForbiddenException("Insufficient permissions");
    }
    return this.service.removeEintrag(id);
  }
}
