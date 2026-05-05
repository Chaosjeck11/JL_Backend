import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateMemberDto } from "./dto/create-member.dto";
import { UpdateMemberDto } from "./dto/update-member.dto";
import * as bcrypt from "bcrypt";

@Injectable()
export class MembersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.member.findMany({
      orderBy: { lastname: "asc" },
      include: { role: true },
    });
  }

  async findOne(id: number) {
    const member = await this.prisma.member.findUnique({
      where: { id },
      include: { role: true },
    });

    if (!member) {
      throw new NotFoundException("Member not found");
    }

    return member;
  }

  async create(dto: CreateMemberDto) {
    const passwordHash = await bcrypt.hash(dto.password, 10);

    return this.prisma.member.create({
      data: {
        firstname: dto.firstname,
        lastname: dto.lastname,
        email: dto.email,
        passwordHash,
        birthday: dto.birthday ? new Date(dto.birthday) : undefined,
        phone: dto.phone,
        address: dto.address,
        roleId: dto.roleId,
        accessLevel: dto.accessLevel ?? 0,
        u18: dto.u18 ?? false,
        bereitsMitglied: dto.bereitsMitglied ?? false,
        schuelerStudentAzubi: dto.schuelerStudentAzubi ?? false,
        berufstaetig: dto.berufstaetig ?? false,
      },
    });
  }

  async update(id: number, dto: UpdateMemberDto) {
    return this.prisma.member.update({
      where: { id },
      data: {
        ...dto,
        birthday: dto.birthday ? new Date(dto.birthday) : undefined,
      },
    });
  }

  async deactivate(id: number) {
    return this.prisma.member.update({
      where: { id },
      data: { active: false },
    });
  }
}
