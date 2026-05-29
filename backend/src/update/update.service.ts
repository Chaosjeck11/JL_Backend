import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import * as path from "path";
import * as fs from "fs";
import * as semver from "semver";
import { StreamableFile } from "@nestjs/common";
import { Response } from "express";

const BUILDS_DIR = path.join(process.cwd(), "..", "Builds");

const PLATFORM_FILES: Record<string, string> = {
  linux: ".AppImage",
  windows: ".exe",
  android: ".apk",
};

@Injectable()
export class UpdateService {
  getLatestVersion(): string {
    if (!fs.existsSync(BUILDS_DIR)) {
      throw new NotFoundException("Builds directory not found");
    }

    const entries = fs.readdirSync(BUILDS_DIR, { withFileTypes: true });
    const versions = entries
      .filter((e) => e.isDirectory() && semver.valid(e.name))
      .map((e) => e.name)
      .sort(semver.rcompare);

    if (versions.length === 0) {
      throw new NotFoundException("No valid versions found");
    }

    return versions[0];
  }

  check(
    clientVersion: string,
    platform: string,
  ): { updateAvailable: boolean; latestVersion: string } {
    if (!semver.valid(clientVersion)) {
      throw new BadRequestException("Invalid version format");
    }
    if (!PLATFORM_FILES[platform]) {
      throw new BadRequestException("Invalid platform");
    }

    const latestVersion = this.getLatestVersion();
    return {
      updateAvailable: semver.gt(latestVersion, clientVersion),
      latestVersion,
    };
  }

  streamFile(platform: string, res: Response): StreamableFile {
    if (!PLATFORM_FILES[platform]) {
      throw new BadRequestException("Invalid platform");
    }

    const ext = PLATFORM_FILES[platform];
    const latestVersion = this.getLatestVersion();
    const dir = path.join(BUILDS_DIR, latestVersion, platform);

    if (!fs.existsSync(dir)) {
      throw new NotFoundException(`No build found for platform: ${platform}`);
    }

    const files = fs.readdirSync(dir).filter((f) => f.endsWith(ext));
    if (files.length === 0) {
      throw new NotFoundException(
        `No ${ext} file found in ${latestVersion}/${platform}`,
      );
    }

    const filePath = path.join(dir, files[0]);
    const stat = fs.statSync(filePath);

    res.set({
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${files[0]}"`,
      "Content-Length": stat.size.toString(),
    });

    return new StreamableFile(fs.createReadStream(filePath));
  }
}
