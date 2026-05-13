import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { VeranstaltungKategorienService } from "./veranstaltung-kategorien.service";
import { CreateVeranstaltungKategorieDto } from "./dto/create-veranstaltung-kategorie.dto";
import { UpdateVeranstaltungKategorieDto } from "./dto/update-veranstaltung-kategorie.dto";
import { AccessLevel } from "../auth/access-level.decorator";
import { AccessLevelGuard } from "../auth/access-level.guard";

@Controller("veranstaltung-kategorien")
@UseGuards(AuthGuard("jwt"), AccessLevelGuard)
export class VeranstaltungKategorienController {
  constructor(private service: VeranstaltungKategorienService) {}

  @Get()
  @AccessLevel(0)
  findAll() {
    return this.service.findAll();
  }

  @Get(":id")
  @AccessLevel(0)
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  @AccessLevel(5)
  create(@Body() dto: CreateVeranstaltungKategorieDto) {
    return this.service.create(dto);
  }

  @Patch(":id")
  @AccessLevel(5)
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateVeranstaltungKategorieDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  @AccessLevel(5)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
