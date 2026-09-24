import { computed, inject, Injectable } from '@angular/core';
import { Api } from '../../core/api';
import { formatDate } from '../../core/lifecycle';
import { humanGap } from '../../core/relative-time';
import { RegistryStore } from '../../core/registry.store';

/** The notice thresholds, as seeded in notification_rule. */
export const THRESHOLDS = [180, 90, 30, 0] as const;

export type Threshold = (typeof THRESHOLDS)[number];

export interface Mention {
  name: string;
  /** The Teams sign-in address. A display name alone cannot be mentioned. */
  upn: string;
  why: string;
}

export interface Fact {
  title: string;
  value: string;
}

export interface PendingNotification {
  id: string;
  threshold: Threshold;
  /** Red past end of life, amber inside the notice window. */
  tone: 'attention' | 'warning';
  heading: string;
  technology: string;
  cycle: string;
  facts: Fact[];
  mention: Mention | null;
  /** Deep links rendered as card actions. */
  actions: { title: string; url: string }[];
  daysToEol: number | null;
}

/**
 * What the 08:00 run would send, worked out from the data already on screen.
 *
 * Deliberately computed in the browser: this is a preview, and it must not
 * depend on a notification service that does not exist yet. When the service
 * lands it becomes the same calculation server-side, and this page becomes a
 * window onto it rather than its own implementation.
 */
@Injectable({ providedIn: 'root' })
export class NotificationPreview {
  private readonly store = inject(RegistryStore);
  private readonly api = inject(Api);

  /**
   * Which notice a cycle currently falls under.
   *
   * A real run fires on the day a threshold is crossed and then stays quiet.
   * A preview cannot know what was already sent, so it shows the band each
   * cycle sits in today — which is what the next run would announce for
   * anything not yet notified.
   */
  private thresholdFor(days: number | null): Threshold | null {
    if (days === null) {
      return null;
    }
    if (days <= 0) {
      return 0;
    }
    if (days <= 30) {
      return 30;
    }
    if (days <= 90) {
      return 90;
    }
    return days <= 180 ? 180 : null;
  }

  readonly pending = computed<PendingNotification[]>(() => {
    const out: PendingNotification[] = [];

    for (const entry of this.store.cyclesInUse()) {
      const threshold = this.thresholdFor(entry.days);
      if (threshold === null) {
        continue;
      }

      const deployments = this.store.deploymentsUsing(entry.cycle);
      if (deployments.length === 0) {
        continue;
      }

      const action = this.store.actionFor(entry.cycle);
      const projectId = deployments[0].projectId;
      const project = this.api.projects().find((p) => p.id === projectId);

      const past = (entry.days ?? 0) <= 0;

      out.push({
        id: `${entry.cycle.id}-${threshold}`,
        threshold,
        tone: past ? 'attention' : 'warning',
        heading: past
          ? `Unsupported for ${humanGap(entry.days ?? 0)}`
          : `Support ends in ${humanGap(entry.days ?? 0)}`,
        technology: entry.cycle.technology,
        cycle: entry.cycle.cycle,
        daysToEol: entry.days,
        facts: [
          {
            title: 'Project',
            value: project ? `${project.name} (${project.code})` : deployments[0].customer,
          },
          {
            title: deployments.length === 1 ? 'Environment' : 'Environments',
            value: deployments.map((d) => d.environment).join(', '),
          },
          { title: 'Running', value: this.versionsOn(entry.cycle.technology, deployments) },
          { title: 'Support ends', value: formatDate(entry.cycle.eolDate) },
          {
            title: 'Latest in cycle',
            value: entry.cycle.latestPatch ?? 'not published',
          },
          {
            title: 'Plan',
            value: action?.assignee ?? 'None',
          },
        ],
        mention: this.mentionFor(project, action?.assignee ?? null),
        actions: this.actionsFor(entry.cycle.technology, entry.cycle.cycle),
      });
    }

    // Most urgent first, which is also the order they would be sent in.
    return out.sort((a, b) => (a.daysToEol ?? 0) - (b.daysToEol ?? 0));
  });

  /** Grouped by threshold, because that is how the rules are configured. */
  readonly byThreshold = computed(() => {
    const groups = new Map<Threshold, PendingNotification[]>();
    for (const item of this.pending()) {
      groups.set(item.threshold, [...(groups.get(item.threshold) ?? []), item]);
    }
    return THRESHOLDS.filter((t) => groups.has(t)).map((threshold) => ({
      threshold,
      items: groups.get(threshold)!,
    }));
  });

  /**
   * Who gets pinged.
   *
   * The assignee when there is a plan, the project lead when there is not —
   * someone has to own the gap. Never the whole team: six mentions on twenty
   * cards is how a channel gets muted.
   */
  private mentionFor(
    project: { engineers: { name: string; email?: string; isLead: boolean }[] } | undefined,
    assignee: string | null,
  ): Mention | null {
    if (!project || project.engineers.length === 0) {
      return null;
    }

    const named = assignee
      ? project.engineers.find((e) => e.name === assignee)
      : undefined;

    const lead = project.engineers.find((e) => e.isLead) ?? project.engineers[0];
    const person = named ?? lead;

    return {
      name: person.name,
      // The API does not return engineer emails on the project payload yet, so
      // this resolves through the accounts list.
      upn: this.upnFor(person.name),
      why: named ? 'assigned to the plan' : 'project lead — nobody is assigned',
    };
  }

  private upnFor(name: string): string {
    return this.api.users().find((u) => u.name === name)?.email ?? 'unknown';
  }

  private versionsOn(
    technology: string,
    deployments: { components: { technology: string; version: string }[] }[],
  ): string {
    const versions = new Set(
      deployments
        .flatMap((d) => d.components)
        .filter((c) => c.technology === technology)
        .map((c) => c.version),
    );
    return [...versions].join(', ') || '—';
  }

  private actionsFor(technology: string, cycle: string) {
    // One action. Ticket links arrive when Jira does.
    return [
      {
        title: 'Plan the upgrade',
        url: `${location.origin}/plan?technology=${encodeURIComponent(technology)}&cycle=${encodeURIComponent(cycle)}`,
      },
    ];
  }

  /** The exact Adaptive Card body a run would POST. */
  payloadFor(item: PendingNotification): string {
    const body: Record<string, unknown>[] = [
      {
        type: 'TextBlock',
        text: item.heading,
        weight: 'Bolder',
        size: 'Medium',
        color: item.tone === 'attention' ? 'Attention' : 'Warning',
      },
      {
        type: 'TextBlock',
        text: `${item.technology} ${item.cycle}`,
        size: 'Large',
        spacing: 'None',
      },
      { type: 'FactSet', facts: item.facts },
    ];

    const card: Record<string, unknown> = {
      type: 'AdaptiveCard',
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      version: '1.4',
      body,
      actions: item.actions.map((a) => ({
        type: 'Action.OpenUrl',
        title: a.title,
        url: a.url,
      })),
    };

    if (item.mention) {
      body.splice(2, 0, {
        type: 'TextBlock',
        text: `<at>${item.mention.name}</at>`,
        wrap: true,
      });

      card['msteams'] = {
        entities: [
          {
            type: 'mention',
            text: `<at>${item.mention.name}</at>`,
            mentioned: { id: item.mention.upn, name: item.mention.name },
          },
        ],
      };
    }

    return JSON.stringify(
      {
        type: 'message',
        attachments: [
          {
            contentType: 'application/vnd.microsoft.card.adaptive',
            content: card,
          },
        ],
      },
      null,
      2,
    );
  }
}
