import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const customers = await this.prisma.customer.findMany({
      where: { archivedAt: null },
      orderBy: { name: 'asc' },
      include: { _count: { select: { projects: { where: { archivedAt: null } } } } },
    });

    return customers.map((customer) => ({
      id: customer.id,
      name: customer.name,
      code: customer.code,
      projectCount: customer._count.projects,
    }));
  }
}
