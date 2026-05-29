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
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  Res,
  Req,
  BadRequestException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { FileInterceptor } from "@nestjs/platform-express";
import { Response, Request } from "express";
import { FilesService } from "./files.service";
import { UpdateFileDto } from "./dto/update-file.dto";
import { AccessLevel } from "../auth/access-level.decorator";
import { AccessLevelGuard } from "../auth/access-level.guard";

@Controller("files")
@UseGuards(AuthGuard("jwt"), AccessLevelGuard)
export class FilesController {
  constructor(private filesService: FilesService) {}

  @Get()
  @AccessLevel(0)
  findAll(@Query("path") folderPath?: string) {
    return this.filesService.findAll(folderPath);
  }

  @Get("folders")
  @AccessLevel(0)
  findFolders() {
    return this.filesService.findFolders();
  }

  @Post("upload")
  @AccessLevel(0)
  @UseInterceptors(FileInterceptor("file"))
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
    @Body("path") folderPath?: string,
    @Body("description") description?: string,
  ) {
    if (!file) throw new BadRequestException("No file uploaded");
    const uploadedBy = (req.user as any).sub as number;
    return this.filesService.create(file, uploadedBy, folderPath ?? "", description);
  }

  @Get(":id/download")
  @AccessLevel(0)
  async download(
    @Param("id", ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const { file, filePath } = await this.filesService.resolveFilePath(id);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${file.filename}"`,
    );
    res.setHeader("Content-Type", file.mimeType);
    res.sendFile(filePath);
  }

  @Get(":id/preview")
  @AccessLevel(0)
  async preview(
    @Param("id", ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const { file, filePath } = await this.filesService.resolveFilePath(id);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${file.filename}"`,
    );
    res.setHeader("Content-Type", file.mimeType);
    res.sendFile(filePath);
  }

  @Patch(":id")
  @AccessLevel(0)
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateFileDto,
  ) {
    return this.filesService.update(id, dto);
  }

  @Delete(":id")
  @AccessLevel(0)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.filesService.remove(id);
  }
}
