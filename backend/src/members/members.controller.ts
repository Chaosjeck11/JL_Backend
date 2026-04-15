import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
} from "@nestjs/common";
import { MembersService } from "./members.service";
import { CreateMemberDto } from "./dto/create-member.dto";
import { UpdateMemberDto } from "./dto/update-member.dto";
import { AuthGuard } from "@nestjs/passport";
import { AccessLevel } from "../auth/access-level.decorator";
import { AccessLevelGuard } from "../auth/access-level.guard";

@Controller("members")
@UseGuards(AuthGuard("jwt"), AccessLevelGuard)
export class MembersController {
  constructor(private members: MembersService) {}

  // 🔍 Alle Mitglieder (lesen reicht)
  @Get()
  @AccessLevel(0)
  findAll() {
    return this.members.findAll();
  }

  // 🔍 Einzelnes Mitglied
  @Get(":id")
  @AccessLevel(0)
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.members.findOne(id);
  }

  // ➕ Neues Mitglied (Admin)
  @Post()
  @AccessLevel(5)
  create(@Body() dto: CreateMemberDto) {
    return this.members.create(dto);
  }

  // ✏️ Mitglied ändern (Admin)
  @Patch(":id")
  @AccessLevel(5)
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.members.update(id, dto);
  }

  // 🚫 Mitglied deaktivieren
  @Patch(":id/deactivate")
  @AccessLevel(5)
  deactivate(@Param("id", ParseIntPipe) id: number) {
    return this.members.deactivate(id);
  }
}
