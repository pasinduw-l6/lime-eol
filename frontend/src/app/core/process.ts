import { ApiCustomer, ApiUpgradeAction, ComponentScope, Decision } from './api';
import { NOTICE_DAYS, parseDate, today } from './lifecycle';

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export const SEVERITY: Record<Severity, { label: string; colour: string; rule: string }> = {
  CRITICAL: { label: 'Critical', colour: 'var(--destructive)', rule: 'Already past end of life' },
  HIGH: { label: 'High', colour: 'var(--warning)', rule: 'Support ends within 90 days' },
  MEDIUM: {
    label: 'Medium',
    colour: 'var(--info)',
    rule: `Support ends within ${NOTICE_DAYS} days, or security fixes only`,
  },
  LOW: { label: 'Low', colour: 'var(--muted-foreground)', rule: `More than ${NOTICE_DAYS} days away` },
};

export function severityOf(days: number | null, activeSupportEnd?: string | null): Severity | null {
  if (days === null) return null;
  if (days <= 0) return 'CRITICAL';
  if (days <= 90) return 'HIGH';
  if (days <= NOTICE_DAYS) return 'MEDIUM';
  const active = parseDate(activeSupportEnd ?? null);
  if (active && active.getTime() <= today().getTime()) return 'MEDIUM';
  return 'LOW';
}

export type Stage = 'IDENTIFIED' | 'ASSESSED' | 'DECIDED' | 'PLANNED' | 'NOTIFIED' | 'UPGRADING' | 'CLOSED';

export const STAGES: { key: Stage; label: string }[] = [
  { key: 'IDENTIFIED', label: 'Identified' },
  { key: 'ASSESSED', label: 'Assessed' },
  { key: 'DECIDED', label: 'Decided' },
  { key: 'PLANNED', label: 'Planned' },
  { key: 'NOTIFIED', label: 'Customer notified' },
  { key: 'UPGRADING', label: 'Upgrading' },
  { key: 'CLOSED', label: 'Closed' },
];

export function stageOf(action: ApiUpgradeAction): Stage {
  if (action.status === 'COMPLETED') return 'CLOSED';
  if (action.decision === 'ACCEPT_RISK' && action.riskApprover) return 'CLOSED';
  if (action.status === 'IN_PROGRESS' || action.progress.done > 0) return 'UPGRADING';
  if (
    action.customerNotifiedAt ||
    action.customerComm === 'SENT' ||
    action.customerComm === 'ACKNOWLEDGED'
  ) {
    return 'NOTIFIED';
  }
  if (action.plannedDate) return 'PLANNED';
  if (action.decision) return 'DECIDED';
  if (action.assessment) return 'ASSESSED';
  return 'IDENTIFIED';
}

export function stageIndex(stage: Stage): number {
  return STAGES.findIndex((s) => s.key === stage);
}

export const DECISIONS: { key: Decision; label: string; hint: string }[] = [
  { key: 'UPGRADE', label: 'Upgrade', hint: 'Move to a supported version' },
  { key: 'EXTENDED_SUPPORT', label: 'Extended support', hint: 'Buy paid vendor support beyond the end date' },
  { key: 'ACCEPT_RISK', label: 'Accept risk', hint: 'Keep running it, signed off with an expiry date' },
  { key: 'COMMERCIAL_QUOTE', label: 'Commercial quote', hint: 'Not included; quote the work separately' },
];

export function decisionLabel(decision: Decision | null): string {
  return DECISIONS.find((d) => d.key === decision)?.label ?? 'No decision yet';
}

export type Tone = 'good' | 'warn' | 'bad' | 'neutral';

export const TONE_CLASS: Record<Tone, string> = {
  good: 'border-success/30 bg-success/10 text-success',
  warn: 'border-warning/30 bg-warning/10 text-warning',
  bad: 'border-destructive/30 bg-destructive/10 text-destructive',
  neutral: 'text-muted-foreground',
};

export function coverOf(
  customer: ApiCustomer | undefined,
  scope: ComponentScope | undefined,
): { label: string; tone: Tone; detail: string } {
  if (!customer?.commercialModel) {
    return {
      label: 'Model not set',
      tone: 'neutral',
      detail: 'Set Subscription or License on the customer to know whether this is included.',
    };
  }

  if (customer.commercialModel === 'SUBSCRIPTION') {
    if (scope === 'APPLICATION') {
      return { label: 'Via Lime release', tone: 'good', detail: 'Handled through an applicable Lime release.' };
    }
    const end = parseDate(customer.contractEnd);
    if (end && end.getTime() < today().getTime()) {
      return {
        label: 'Outside contract',
        tone: 'warn',
        detail: 'The five-year support period has ended. Check the agreement.',
      };
    }
    return { label: 'Included', tone: 'good', detail: 'Infrastructure upgrades are included in the subscription.' };
  }

  if (scope === 'APPLICATION') {
    return {
      label: 'Quote required',
      tone: 'warn',
      detail: 'License customer: application dependency upgrades are assessed and quoted separately.',
    };
  }
  return { label: 'Per agreement', tone: 'neutral', detail: 'License customer: follow the customer agreement.' };
}

export const COMMERCIAL_MODELS: { key: 'SUBSCRIPTION' | 'LICENSE'; label: string }[] = [
  { key: 'SUBSCRIPTION', label: 'Subscription' },
  { key: 'LICENSE', label: 'License' },
];
