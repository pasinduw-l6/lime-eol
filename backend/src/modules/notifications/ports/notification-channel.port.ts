/**
 * Where a notification goes.
 *
 * Consumers depend on this, never on Power Automate directly, so adding email
 * or Slack later is another provider rather than a rewrite — the same shape as
 * EOL_DATA_SOURCE.
 */
export const NOTIFICATION_CHANNEL = Symbol('NOTIFICATION_CHANNEL');

/** One fact row on a card. */
export interface CardFact {
  title: string;
  value: string;
}

export interface CardMention {
  /** The Teams sign-in address. A display name alone cannot be mentioned. */
  upn: string;
  name: string;
}

export interface CardAction {
  title: string;
  url: string;
}

/**
 * A notification, before it knows what it will be rendered into.
 *
 * Deliberately not an Adaptive Card: email and Slack need the same facts in a
 * different shape, and a model that is already a Teams card cannot give them
 * one.
 */
export interface NotificationCard {
  /** Drives the colour band, not the wording. */
  severity: 'attention' | 'warning' | 'good';
  heading: string;
  title: string;
  facts: CardFact[];
  mention: CardMention | null;
  actions: CardAction[];
  /** Digest only: the grouped lines under each heading. */
  sections?: { heading: string; lines: string[] }[];
}

export interface NotificationChannel {
  /** Named in the log, so a row says where it went without holding the URL. */
  readonly name: string;
  /** Throws on failure. The caller records that, it does not swallow it. */
  send(card: NotificationCard): Promise<void>;
}
