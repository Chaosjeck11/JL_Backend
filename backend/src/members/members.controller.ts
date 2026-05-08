import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
  BadRequestException,
  HttpCode,
  HttpStatus,
  Res,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Response } from "express";
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

  @Get("roles")
  @AccessLevel(0)
  findAllRoles() {
    return this.members.findAllRoles();
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

  @Post(":id/avatar")
  @AccessLevel(5)
  @UseInterceptors(FileInterceptor("file"))
  uploadAvatar(
    @Param("id", ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException("No file uploaded");
    return this.members.uploadAvatar(id, file);
  }

  @Get(":id/avatar")
  @AccessLevel(0)
  async getAvatar(@Param("id", ParseIntPipe) id: number, @Res() res: Response) {
    const { filePath, mimeType } = await this.members.getAvatar(id);
    res.setHeader("Content-Type", mimeType);
    res.sendFile(filePath);
  }

  @Delete(":id/avatar")
  @AccessLevel(5)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeAvatar(@Param("id", ParseIntPipe) id: number) {
    return this.members.removeAvatar(id);
  }
}
