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
import { CategoryService } from "./category.service";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";
import { AccessLevel } from "../../auth/access-level.decorator";
import { AccessLevelGuard } from "../../auth/access-level.guard";

@Controller("finance/categories")
@UseGuards(AuthGuard("jwt"), AccessLevelGuard)
export class CategoryController {
  constructor(private categoryService: CategoryService) {}

  @Get()
  @AccessLevel(3)
  findAll() {
    return this.categoryService.findAll();
  }

  @Get(":id")
  @AccessLevel(3)
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.categoryService.findOne(id);
  }

  @Post()
  @AccessLevel(5)
  create(@Body() dto: CreateCategoryDto) {
    return this.categoryService.create(dto);
  }

  @Patch(":id")
  @AccessLevel(5)
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoryService.update(id, dto);
  }

  @Delete(":id")
  @AccessLevel(5)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.categoryService.remove(id);
  }
}
