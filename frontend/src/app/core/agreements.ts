import { AgreementStatus, AgreementType, Coverage, UpgradeTerms } from './api';

export const AGREEMENT_TYPES: { key: AgreementType; label: string; hint: string }[] = [
  {
    key: 'SUBSCRIPTION',
    label: 'Subscription',
    hint: 'Infrastructure setup and upgrade support for the agreed five-year period. Application dependencies are handled through Lime releases.',
  },
  {
    key: 'LICENSE',
    label: 'License',
    hint: 'Infrastructure per the customer agreement. Application dependency upgrades are not automatically included and are assessed separately.',
  },
];

export const SCOPES: { key: 'INFRASTRUCTURE' | 'APPLICATION'; label: string; examples: string }[] = [
  {
    key: 'INFRASTRUCTURE',
    label: 'Infrastructure',
    examples: 'Kubernetes / Tanzu, operating systems, Docker, Calico, databases, middleware, ingress, monitoring',
  },
  {
    key: 'APPLICATION',
    label: 'Application dependencies',
    examples: 'Node.js, AngularJS, MongoDB, application frameworks, third-party libraries',
  },
];

export const SUPPORT_LEVELS = ['Standard', 'Priority', '24×7'];

export const STATUS_INFO: Record<AgreementStatus, { label: string; colour: string }> = {
  ACTIVE: { label: 'Active', colour: 'var(--color-good)' },
  EXPIRING: { label: 'Expiring', colour: 'var(--color-soon)' },
  EXPIRED: { label: 'Expired', colour: 'var(--color-overdue)' },
  UPCOMING: { label: 'Starts later', colour: 'var(--color-info, var(--primary))' },
  NONE: { label: 'No agreement', colour: 'var(--muted-foreground)' },
};

export const TYPE_COLOURS: Record<AgreementType, string> = {
  SUBSCRIPTION: 'var(--primary)',
  LICENSE: 'oklch(0.55 0.15 255)',
};

export const TERMS_INFO: Record<UpgradeTerms, { label: string; long: string; colour: string }> = {
  INCLUDED: {
    label: 'Included',
    long: 'Included in the subscription: Lime plans and performs the upgrade with the customer',
    colour: 'var(--color-good)',
  },
  VIA_LIME: {
    label: 'Via Lime release',
    long: 'Handled through the applicable Lime release',
    colour: 'oklch(0.55 0.15 255)',
  },
  QUOTE: {
    label: 'Quote',
    long: 'Not automatically included: assessed separately under the customer agreement',
    colour: 'var(--muted-foreground)',
  },
  TERM_ENDED: {
    label: 'Term ended',
    long: 'The agreed support period has ended: renew the agreement or quote the upgrade',
    colour: 'var(--color-overdue)',
  },
};

export function typeLabel(type: AgreementType | null | undefined): string {
  return AGREEMENT_TYPES.find((t) => t.key === type)?.label ?? 'None';
}

export function typeHint(type: AgreementType): string {
  return AGREEMENT_TYPES.find((t) => t.key === type)?.hint ?? '';
}

export function termsFor(scope: 'INFRASTRUCTURE' | 'APPLICATION', coverage: Coverage | null | undefined): UpgradeTerms {
  if (!coverage) return 'QUOTE';
  if (scope === 'APPLICATION') return coverage.application === 'VIA_LIME' ? 'VIA_LIME' : 'QUOTE';
  if (coverage.infrastructure === 'INCLUDED') return 'INCLUDED';
  return coverage.infrastructure === 'ENDED' ? 'TERM_ENDED' : 'QUOTE';
}

export function infraText(coverage: Coverage): string {
  switch (coverage.infrastructure) {
    case 'INCLUDED':
      return 'Included: setup and upgrade support for the agreed period';
    case 'ENDED':
      return 'The agreed support period has ended';
    default:
      return 'Per the customer agreement: quoted';
  }
}

export function applicationText(coverage: Coverage): string {
  return coverage.application === 'VIA_LIME'
    ? 'Handled through applicable Lime releases'
    : 'Not automatically included: assessed separately';
}

export function daysUntil(value: string | null | undefined): number | null {
  if (!value) return null;
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((Date.parse(`${value}T00:00:00Z`) - today) / 86_400_000);
}

export function termNote(endDate: string | null | undefined): string {
  const days = daysUntil(endDate);
  if (days === null) return 'No end date';
  if (days < 0) return `Ended ${humanDays(-days)} ago`;
  if (days === 0) return 'Ends today';
  return `${humanDays(days)} left`;
}

function humanDays(days: number): string {
  if (days >= 365) {
    const years = days / 365.25;
    return `${years.toFixed(years >= 10 ? 0 : 1)} years`;
  }
  if (days >= 60) return `${Math.round(days / 30.4)} months`;
  return `${days} day${days === 1 ? '' : 's'}`;
}
