import { CustomerAgreement, CustomerContact } from '@prisma/client';

const DAY = 86_400_000;
export const EXPIRING_DAYS = 90;

export type AgreementStatus = 'ACTIVE' | 'EXPIRING' | 'EXPIRED' | 'UPCOMING' | 'NONE';

export function todayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export function currentAgreement<T extends Pick<CustomerAgreement, 'startDate' | 'endDate'>>(
  agreements: T[],
  today = todayUtc(),
): T | null {
  const t = today.getTime();
  const byStartDesc = [...agreements].sort((a, b) => (b.startDate?.getTime() ?? 0) - (a.startDate?.getTime() ?? 0));

  const live = byStartDesc.find(
    (a) => (!a.startDate || a.startDate.getTime() <= t) && (!a.endDate || a.endDate.getTime() >= t),
  );
  if (live) return live;

  const past = byStartDesc.find((a) => !a.startDate || a.startDate.getTime() <= t);
  if (past) return past;

  return [...agreements].sort((a, b) => (a.startDate?.getTime() ?? 0) - (b.startDate?.getTime() ?? 0))[0] ?? null;
}

export function statusOf(
  agreement: Pick<CustomerAgreement, 'startDate' | 'endDate'> | null,
  today = todayUtc(),
): AgreementStatus {
  if (!agreement) return 'NONE';
  const t = today.getTime();
  if (agreement.startDate && agreement.startDate.getTime() > t) return 'UPCOMING';
  if (agreement.endDate && agreement.endDate.getTime() < t) return 'EXPIRED';
  if (agreement.endDate && agreement.endDate.getTime() - t <= EXPIRING_DAYS * DAY) return 'EXPIRING';
  return 'ACTIVE';
}

export type InfraTerms = 'INCLUDED' | 'QUOTED' | 'ENDED';
export type ApplicationTerms = 'VIA_LIME' | 'SEPARATE';

export interface Coverage {
  infrastructure: InfraTerms;
  application: ApplicationTerms;
}

export function coverageOf(
  agreement: Pick<CustomerAgreement, 'type' | 'infrastructure' | 'startDate' | 'endDate'> | null,
  today = todayUtc(),
): Coverage {
  if (!agreement) return { infrastructure: 'QUOTED', application: 'SEPARATE' };

  const ended = statusOf(agreement, today) === 'EXPIRED';
  if (agreement.type === 'SUBSCRIPTION') {
    return { infrastructure: ended ? 'ENDED' : 'INCLUDED', application: 'VIA_LIME' };
  }

  const infrastructure = agreement.infrastructure === 'INCLUDED' ? (ended ? 'ENDED' : 'INCLUDED') : 'QUOTED';
  return { infrastructure, application: 'SEPARATE' };
}

export type UpgradeTerms = 'INCLUDED' | 'VIA_LIME' | 'QUOTE' | 'TERM_ENDED';

export function termsFor(scope: 'INFRASTRUCTURE' | 'APPLICATION', coverage: Coverage): UpgradeTerms {
  if (scope === 'APPLICATION') return coverage.application === 'VIA_LIME' ? 'VIA_LIME' : 'QUOTE';
  if (coverage.infrastructure === 'INCLUDED') return 'INCLUDED';
  return coverage.infrastructure === 'ENDED' ? 'TERM_ENDED' : 'QUOTE';
}


export function agreementDto(agreement: CustomerAgreement) {
  return {
    id: agreement.id,
    type: agreement.type,
    status: statusOf(agreement),
    startDate: iso(agreement.startDate),
    endDate: iso(agreement.endDate),
    renewalDate: iso(agreement.renewalDate),
    noticeDays: agreement.noticeDays,
    autoRenew: agreement.autoRenew,
    upgradesPerYear: agreement.upgradesPerYear,
    supportLevel: agreement.supportLevel,
    reference: agreement.reference,
    documentUrl: agreement.documentUrl,
    infrastructure: agreement.infrastructure,
    licensedUsers: agreement.licensedUsers,
    coverage: coverageOf(agreement),
    notes: agreement.notes,
    updatedAt: agreement.updatedAt.toISOString(),
  };
}

export function contactDto(contact: CustomerContact) {
  return {
    id: contact.id,
    name: contact.name,
    role: contact.role,
    email: contact.email,
    phone: contact.phone,
    isPrimary: contact.isPrimary,
  };
}

export function iso(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

export function toDate(value: string | null | undefined): Date | null {
  return value ? new Date(`${value.slice(0, 10)}T00:00:00.000Z`) : null;
}
