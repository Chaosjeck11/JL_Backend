import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { StrafenService } from "./strafen.service";
import { CreateStrafeDto } from "./dto/create-strafe.dto";
import { UpdateStrafeDto } from "./dto/update-strafe.dto";
import { CreateStrafeEintragDto } from "./dto/create-strafe-eintrag.dto";
import { UpdateStrafeEintragDto } from "./dto/update-strafe-eintrag.dto";
import { BezahlenEintragDto } from "./dto/bezahlen-eintrag.dto";
import { AccessLevel } from "../auth/access-level.decorator";
import { AccessLevelGuard } from "../auth/access-level.guard";

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
  @AccessLevel(5)
  createKatalog(@Body() dto: CreateStrafeDto) {
    return this.service.createKatalog(dto);
  }

  @Get(":id")
  @AccessLevel(0)
  findOneKatalog(@Param("id", ParseIntPipe) id: number) {
    return this.service.findOneKatalog(id);
  }

  @Patch(":id")
  @AccessLevel(5)
  updateKatalog(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateStrafeDto,
  ) {
    return this.service.updateKatalog(id, dto);
  }

  @Delete(":id")
  @AccessLevel(5)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeKatalog(@Param("id", ParseIntPipe) id: number) {
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
    @Query("memberId") memberId?: string,
    @Query("strafeId") strafeId?: string,
    @Query("businessYearId") businessYearId?: string,
    @Query("bezahlt") bezahlt?: string,
  ) {
    return this.service.findAllEintraege({
      memberId: memberId ? parseInt(memberId, 10) : undefined,
      strafeId: strafeId ? parseInt(strafeId, 10) : undefined,
      businessYearId: businessYearId ? parseInt(businessYearId, 10) : undefined,
      bezahlt: bezahlt !== undefined ? bezahlt === "true" : undefined,
    });
  }

  @Get("summary")
  @AccessLevel(0)
  getSummary(
    @Query("memberId") memberId?: string,
    @Query("businessYearId") businessYearId?: string,
  ) {
    return this.service.getSummary({
      memberId: memberId ? parseInt(memberId, 10) : undefined,
      businessYearId: businessYearId ? parseInt(businessYearId, 10) : undefined,
    });
  }

  @Get(":id")
  @AccessLevel(0)
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.service.findOneEintrag(id);
  }

  @Post()
  @AccessLevel(5)
  create(@Body() dto: CreateStrafeEintragDto) {
    return this.service.createEintrag(dto);
  }

  @Patch(":id")
  @AccessLevel(5)
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateStrafeEintragDto,
  ) {
    return this.service.updateEintrag(id, dto);
  }

  @Post(":id/bezahlen")
  @AccessLevel(5)
  bezahlen(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: BezahlenEintragDto,
  ) {
    return this.service.bezahlenEintrag(id, dto);
  }

  @Post(":id/stornieren")
  @AccessLevel(5)
  stornieren(@Param("id", ParseIntPipe) id: number) {
    return this.service.stornierenEintrag(id);
  }

  @Delete(":id")
  @AccessLevel(5)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.service.removeEintrag(id);
  }
}
