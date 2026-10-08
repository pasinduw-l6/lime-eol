import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Customer } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const customers = await this.prisma.customer.findMany({
      where: { archivedAt: null },
      orderBy: { name: 'asc' },
      include: { _count: { select: { projects: { where: { archivedAt: null } } } } },
    });

    return customers.map((customer) => this.toDto(customer, customer._count.projects));
  }

  async update(id: string, input: UpdateCustomerDto) {
    const customer = await this.prisma.customer.findFirst({ where: { id, archivedAt: null } });
    if (!customer) {
      throw new NotFoundException(`No customer "${id}"`);
    }

    if (input.name && input.name !== customer.name) {
      const clash = await this.prisma.customer.findUnique({ where: { name: input.name } });
      if (clash) {
        throw new ConflictException(`A customer called ${input.name} already exists.`);
      }
    }

    const start =
      input.contractStart === undefined ? customer.contractStart : toDate(input.contractStart);
    const end = input.contractEnd === undefined ? customer.contractEnd : toDate(input.contractEnd);
    if (start && end && end.getTime() <= start.getTime()) {
      throw new BadRequestException('The contract must end after it starts.');
    }

    const updated = await this.prisma.customer.update({
      where: { id },
      data: {
        name: input.name,
        contact: input.contact === undefined ? undefined : input.contact?.trim() || null,
        notes: input.notes === undefined ? undefined : input.notes?.trim() || null,
        commercialModel: input.commercialModel,
        contractStart: input.contractStart === undefined ? undefined : start,
        contractEnd: input.contractEnd === undefined ? undefined : end,
      },
      include: { _count: { select: { projects: { where: { archivedAt: null } } } } },
    });

    return this.toDto(updated, updated._count.projects);
  }

  private toDto(customer: Customer, projectCount: number) {
    return {
      id: customer.id,
      name: customer.name,
      code: customer.code,
      contact: customer.contact,
      notes: customer.notes,
      commercialModel: customer.commercialModel,
      contractStart: isoDate(customer.contractStart),
      contractEnd: isoDate(customer.contractEnd),
      projectCount,
    };
  }
}

function toDate(value: string | null | undefined): Date | null {
  return value ? new Date(`${value.slice(0, 10)}T00:00:00.000Z`) : null;
}

function isoDate(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}
