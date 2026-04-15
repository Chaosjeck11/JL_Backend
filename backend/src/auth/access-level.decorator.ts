import { SetMetadata } from "@nestjs/common";

export const ACCESS_LEVEL_KEY = "accessLevel";
export const AccessLevel = (level: number) =>
  SetMetadata(ACCESS_LEVEL_KEY, level);
