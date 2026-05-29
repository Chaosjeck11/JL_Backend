import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
} from "@nestjs/common";
import { BeitragStatus } from "@prisma/client";
import { AuthGuard } from "@nestjs/passport";
import { AccessLevel } from "../../auth/access-level.decorator";
import { AccessLevelGuard } from "../../auth/access-level.guard";
import { MitgliedsbeitragService } from "./mitgliedsbeitrag.service";
import { UpdateMitgliedsbeitragDto } from "./dto/update-mitgliedsbeitrag.dto";

@Controller("finance/mitgliedsbeitraege")
@UseGuards(AuthGuard("jwt"), AccessLevelGuard)
export class MitgliedsbeitragController {
  constructor(private service: MitgliedsbeitragService) {}

  @Post("generate")
  @AccessLevel(5)
  generateAll() {
    return this.service.generateAll();
  }

  @Get()
  @AccessLevel(3)
  findAll(
    @Query("businessYearId") businessYearId?: string,
    @Query("memberId") memberId?: string,
    @Query("status") status?: BeitragStatus,
  ) {
    return this.service.findAll({
      businessYearId: businessYearId ? parseInt(businessYearId) : undefined,
      memberId: memberId ? parseInt(memberId) : undefined,
      status,
    });
  }

  @Get(":id")
  @AccessLevel(3)
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(":id")
  @AccessLevel(4)
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateMitgliedsbeitragDto,
  ) {
    return this.service.update(id, dto);
  }
}
