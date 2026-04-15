import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ACCESS_LEVEL_KEY } from "./access-level.decorator";

@Injectable()
export class AccessLevelGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredLevel =
      this.reflector.get<number>(
        ACCESS_LEVEL_KEY,
        context.getHandler(),
      ) ?? 0;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || user.accessLevel < requiredLevel) {
      throw new ForbiddenException("Insufficient permissions");
    }

    return true;
  }
}
