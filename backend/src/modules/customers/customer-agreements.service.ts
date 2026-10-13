import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AgreementType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  agreementDto,
  contactDto,
  currentAgreement,
  toDate,
} from './agreement.util';
import {
  CreateAgreementDto,
  CreateContactDto,
  UpdateAgreementDto,
  UpdateContactDto,
} from './dto/agreement.dto';

@Injectable()
export class CustomerAgreementsService {
  constructor(private readonly prisma: PrismaService) {}

  async createAgreement(customerId: string, input: CreateAgreementDto) {
    await this.mustExist(customerId);
    const data = this.agreementData(input, null);
    const row = await this.prisma.customerAgreement.create({
      data: { ...data, type: input.type as AgreementType, customerId } as Prisma.CustomerAgreementUncheckedCreateInput,
    });
    await this.syncCustomer(customerId);
    return agreementDto(row);
  }

  async updateAgreement(customerId: string, id: string, input: UpdateAgreementDto) {
    const current = await this.prisma.customerAgreement.findFirst({ where: { id, customerId } });
    if (!current) throw new NotFoundException('No such agreement.');
    const row = await this.prisma.customerAgreement.update({
      where: { id },
      data: this.agreementData(input, current),
    });
    await this.syncCustomer(customerId);
    return agreementDto(row);
  }

  async deleteAgreement(customerId: string, id: string): Promise<void> {
    const current = await this.prisma.customerAgreement.findFirst({ where: { id, customerId } });
    if (!current) throw new NotFoundException('No such agreement.');
    await this.prisma.customerAgreement.delete({ where: { id } });
    await this.syncCustomer(customerId);
  }

  async createContact(customerId: string, input: CreateContactDto) {
    await this.mustExist(customerId);
    const first = (await this.prisma.customerContact.count({ where: { customerId } })) === 0;
    const isPrimary = input.isPrimary ?? first;
    const row = await this.prisma.$transaction(async (tx) => {
      if (isPrimary) {
        await tx.customerContact.updateMany({ where: { customerId }, data: { isPrimary: false } });
      }
      return tx.customerContact.create({
        data: {
          customerId,
          name: input.name.trim(),
          role: input.role?.trim() || null,
          email: input.email?.trim() || null,
          phone: input.phone?.trim() || null,
          isPrimary,
        },
      });
    });
    await this.syncCustomer(customerId);
    return contactDto(row);
  }

  async updateContact(customerId: string, id: string, input: UpdateContactDto) {
    const current = await this.prisma.customerContact.findFirst({ where: { id, customerId } });
    if (!current) throw new NotFoundException('No such contact.');
    const row = await this.prisma.$transaction(async (tx) => {
      if (input.isPrimary) {
        await tx.customerContact.updateMany({ where: { customerId }, data: { isPrimary: false } });
      }
      return tx.customerContact.update({
        where: { id },
        data: {
          name: input.name?.trim(),
          role: input.role === undefined ? undefined : input.role?.trim() || null,
          email: input.email === undefined ? undefined : input.email?.trim() || null,
          phone: input.phone === undefined ? undefined : input.phone?.trim() || null,
          isPrimary: input.isPrimary,
        },
      });
    });
    await this.syncCustomer(customerId);
    return contactDto(row);
  }

  async deleteContact(customerId: string, id: string): Promise<void> {
    const current = await this.prisma.customerContact.findFirst({ where: { id, customerId } });
    if (!current) throw new NotFoundException('No such contact.');
    await this.prisma.customerContact.delete({ where: { id } });
    if (current.isPrimary) {
      const next = await this.prisma.customerContact.findFirst({
        where: { customerId },
        orderBy: { createdAt: 'asc' },
      });
      if (next) await this.prisma.customerContact.update({ where: { id: next.id }, data: { isPrimary: true } });
    }
    await this.syncCustomer(customerId);
  }

  private agreementData(
    input: UpdateAgreementDto,
    current: { type: AgreementType; startDate: Date | null; endDate: Date | null } | null,
  ): Prisma.CustomerAgreementUncheckedUpdateInput {
    const type = (input.type ?? current?.type) as AgreementType | undefined;
    const start = input.startDate === undefined ? current?.startDate ?? null : toDate(input.startDate);
    const end = input.endDate === undefined ? current?.endDate ?? null : toDate(input.endDate);
    if (start && end && end.getTime() <= start.getTime()) {
      throw new BadRequestException('The agreement must end after it starts.');
    }
    const license = type === 'LICENSE';
    return {
      type: input.type as AgreementType | undefined,
      startDate: input.startDate === undefined ? undefined : start,
      endDate: input.endDate === undefined ? undefined : end,
      renewalDate: input.renewalDate === undefined ? undefined : toDate(input.renewalDate),
      noticeDays: input.noticeDays,
      autoRenew: input.autoRenew,
      upgradesPerYear: input.upgradesPerYear,
      supportLevel: input.supportLevel === undefined ? undefined : input.supportLevel?.trim() || null,
      reference: input.reference === undefined ? undefined : input.reference?.trim() || null,
      documentUrl: input.documentUrl === undefined ? undefined : input.documentUrl?.trim() || null,
      infrastructure: license
        ? input.infrastructure === undefined
          ? current
            ? undefined
            : 'QUOTED'
          : (input.infrastructure ?? 'QUOTED')
        : type
          ? null
          : undefined,
      licensedUsers: license ? input.licensedUsers : type ? null : undefined,
      notes: input.notes === undefined ? undefined : input.notes?.trim() || null,
    };
  }

  private async syncCustomer(customerId: string): Promise<void> {
    const [agreements, primary] = await Promise.all([
      this.prisma.customerAgreement.findMany({ where: { customerId } }),
      this.prisma.customerContact.findFirst({ where: { customerId, isPrimary: true } }),
    ]);
    const current = currentAgreement(agreements);
    await this.prisma.customer.update({
      where: { id: customerId },
      data: {
        commercialModel: current ? (current.type === 'LICENSE' ? 'LICENSE' : 'SUBSCRIPTION') : null,
        contractStart: current?.startDate ?? null,
        contractEnd: current?.endDate ?? null,
        contact: primary ? (primary.email ? `${primary.name} <${primary.email}>` : primary.name) : null,
      },
    });
  }

  private async mustExist(customerId: string): Promise<void> {
    const customer = await this.prisma.customer.findFirst({ where: { id: customerId, archivedAt: null } });
    if (!customer) throw new NotFoundException(`No customer "${customerId}"`);
  }
}
