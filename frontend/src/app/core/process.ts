import { ApiUpgradeAction, Decision } from './api';
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

