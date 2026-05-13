import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateVeranstaltungKategorieDto } from "./dto/create-veranstaltung-kategorie.dto";
import { UpdateVeranstaltungKategorieDto } from "./dto/update-veranstaltung-kategorie.dto";

@Injectable()
export class VeranstaltungKategorienService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.veranstaltungKategorie.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { veranstaltungen: true } } },
    });
  }

  async findOne(id: number) {
    const k = await this.prisma.veranstaltungKategorie.findUnique({
      where: { id },
      include: { _count: { select: { veranstaltungen: true } } },
    });
    if (!k) throw new NotFoundException(`Kategorie ${id} nicht gefunden.`);
    return k;
  }

  async create(dto: CreateVeranstaltungKategorieDto) {
    return this.prisma.veranstaltungKategorie.create({
      data: {
        name: dto.name,
        description: dto.description,
        color: dto.color,
      },
    });
  }

  async update(id: number, dto: UpdateVeranstaltungKategorieDto) {
    await this.findOne(id);
    return this.prisma.veranstaltungKategorie.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.color !== undefined && { color: dto.color }),
      },
    });
  }

  async remove(id: number) {
    const k = await this.findOne(id);
    if ((k as any)._count.veranstaltungen > 0) {
      throw new BadRequestException(
        `Kategorie wird von ${(k as any)._count.veranstaltungen} Veranstaltung(en) verwendet und kann nicht gelöscht werden.`,
      );
    }
    await this.prisma.veranstaltungKategorie.delete({ where: { id } });
  }
}
