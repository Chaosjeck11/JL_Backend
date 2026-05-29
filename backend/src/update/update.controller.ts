import {
  Controller,
  Get,
  Query,
  Res,
} from "@nestjs/common";
import { Response } from "express";
import { UpdateService } from "./update.service";

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
