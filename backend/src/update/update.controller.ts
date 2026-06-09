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
import { AccessLevel } from "../auth/access-level.decorator";
import { AccessLevelGuard } from "../auth/access-level.guard";

@Controller("update")
@UseGuards(AuthGuard("jwt"), AccessLevelGuard)
export class UpdateController {
  constructor(private readonly updateService: UpdateService) {}

  @Get("check")
  @AccessLevel(0)
  check(
    @Query("version") version: string,
    @Query("platform") platform: "linux" | "windows" | "android",
  ) {
    return this.updateService.check(version, platform);
  }

  @Get("download")
  @AccessLevel(0)
  download(
    @Query("platform") platform: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.updateService.streamFile(platform, res);
  }
}
