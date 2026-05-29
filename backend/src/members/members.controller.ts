import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
  BadRequestException,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Res,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Request, Response } from "express";
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

  // L0/L1 get only id, firstname, lastname. L2+ get full record.
  @Get()
  @AccessLevel(0)
  async findAll(@Req() req: Request) {
    const level = (req.user as any).accessLevel as number;
    const list = await this.members.findAll();
    if (level < 2) {
      return list.map((m) => ({ id: m.id, firstname: m.firstname, lastname: m.lastname }));
    }
    return list;
  }

  @Get("roles")
  @AccessLevel(0)
  findAllRoles() {
    return this.members.findAllRoles();
  }

  // Detail view: Orgateam (L2) and above only
  @Get(":id")
  @AccessLevel(2)
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.members.findOne(id);
  }

  // Create: Vorstand (L3) and above
  @Post()
  @AccessLevel(3)
  create(@Body() dto: CreateMemberDto) {
    return this.members.create(dto);
  }

  // Edit general fields: Vorstand (L3) and above
  @Patch(":id")
  @AccessLevel(3)
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.members.update(id, dto);
  }

  // Deactivate: Vorstand (L3) and above
  @Patch(":id/deactivate")
  @AccessLevel(3)
  deactivate(@Param("id", ParseIntPipe) id: number) {
    return this.members.deactivate(id);
  }

  // Avatar upload: own avatar only for L0-L4; L5 can change anyone's
  @Post(":id/avatar")
  @AccessLevel(0)
  @UseInterceptors(FileInterceptor("file"))
  uploadAvatar(
    @Req() req: Request,
    @Param("id", ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException("No file uploaded");
    const user = req.user as any;
    if (user.accessLevel < 5 && user.sub !== id) {
      throw new ForbiddenException("Nur eigenes Avatar ändern erlaubt");
    }
    return this.members.uploadAvatar(id, file);
  }

  @Get(":id/avatar")
  @AccessLevel(0)
  async getAvatar(@Param("id", ParseIntPipe) id: number, @Res() res: Response) {
    const { filePath, mimeType } = await this.members.getAvatar(id);
    res.setHeader("Content-Type", mimeType);
    res.sendFile(filePath);
  }

  // Avatar delete: own avatar only for L0-L4; L5 can delete anyone's
  @Delete(":id/avatar")
  @AccessLevel(0)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeAvatar(@Req() req: Request, @Param("id", ParseIntPipe) id: number) {
    const user = req.user as any;
    if (user.accessLevel < 5 && user.sub !== id) {
      throw new ForbiddenException("Nur eigenes Avatar löschen erlaubt");
    }
    return this.members.removeAvatar(id);
  }
}
