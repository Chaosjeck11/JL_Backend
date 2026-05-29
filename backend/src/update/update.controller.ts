import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Response } from "express";
import { UpdateService } from "./update.service";

@UseGuards(AuthGuard("jwt"))
@Controller("update")
export class UpdateController {
  constructor(private readonly updateService: UpdateService) {}

  @Get("check")
  check(
    @Query("version") version: string,
    @Query("platform") platform: "linux" | "windows" | "android",
  ) {
    return this.updateService.check(version, platform);
  }

  @Get("download")
  download(
    @Query("platform") platform: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.updateService.streamFile(platform, res);
  }
}
