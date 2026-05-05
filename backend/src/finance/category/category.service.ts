import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";

@Injectable()
export class CategoryService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.category.findMany({ orderBy: { name: "asc" } });
  }

  async findOne(id: number) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException("Kategorie nicht gefunden.");
    return category;
  }

  async create(dto: CreateCategoryDto) {
    const existing = await this.prisma.category.findUnique({
      where: { name: dto.name },
    });
    if (existing) {
      throw new ConflictException(`Kategorie "${dto.name}" existiert bereits.`);
    }
    return this.prisma.category.create({
      data: {
        name: dto.name,
        description: dto.description,
        isMitgliedsbeitrag: dto.isMitgliedsbeitrag ?? false,
      },
    });
  }

  async update(id: number, dto: UpdateCategoryDto) {
    await this.findOne(id);

    if (dto.name) {
      const existing = await this.prisma.category.findUnique({
        where: { name: dto.name },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(`Kategorie "${dto.name}" existiert bereits.`);
      }
    }

    return this.prisma.category.update({ where: { id }, data: dto });
  }

  async remove(id: number) {
    await this.findOne(id);

    const transactionCount = await this.prisma.transaction.count({
      where: { categoryId: id },
    });
    if (transactionCount > 0) {
      throw new BadRequestException(
        "Kategorie kann nicht gelöscht werden, da noch Transaktionen zugeordnet sind.",
      );
    }

    return this.prisma.category.delete({ where: { id } });
  }
}
