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
import { BusinessYearService } from "./business-year.service";
import { CreateBusinessYearDto } from "./dto/create-business-year.dto";
import { UpdateBusinessYearDto } from "./dto/update-business-year.dto";
import { AccessLevel } from "../../auth/access-level.decorator";
import { AccessLevelGuard } from "../../auth/access-level.guard";

@Controller("finance/business-years")
@UseGuards(AuthGuard("jwt"), AccessLevelGuard)
export class BusinessYearController {
  constructor(private businessYearService: BusinessYearService) {}

  @Get()
  @AccessLevel(0)
  findAll() {
    return this.businessYearService.findAll();
  }

  @Get(":id")
  @AccessLevel(0)
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.businessYearService.findOne(id);
  }

  @Post()
  @AccessLevel(5)
  create(@Body() dto: CreateBusinessYearDto) {
    return this.businessYearService.create(dto);
  }

  @Patch(":id")
  @AccessLevel(5)
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateBusinessYearDto,
  ) {
    return this.businessYearService.update(id, dto);
  }

  @Delete(":id")
  @AccessLevel(5)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.businessYearService.remove(id);
  }
}
