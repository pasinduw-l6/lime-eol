export const NOTIFICATION_CHANNEL = Symbol('NOTIFICATION_CHANNEL');

export interface CardFact {
  title: string;
  value: string;
}

export interface CardMention {
  upn: string;
  name: string;
}

export interface CardAction {
  title: string;
  url: string;
}

export interface NotificationCard {
  severity: 'attention' | 'warning' | 'good';
  heading: string;
  title: string;
  facts: CardFact[];
  mentions: CardMention[];
  actions: CardAction[];
  sections?: { heading: string; lines: string[] }[];
}

export interface NotificationChannel {
  readonly name: string;
  send(card: NotificationCard): Promise<void>;

  /**
   * Posts a card that has already been built.
   *
   * The event pipeline renders its own Adaptive Card, because ten kinds of
   * message do not fit the one NotificationCard shape the deadline alerts use.
   * It still goes out through here so the webhook, the retries and the dry-run
   * switch stay in one place.
   */
  sendRaw(label: string, card: Record<string, unknown>): Promise<void>;
}
