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

  sendRaw(label: string, card: Record<string, unknown>): Promise<void>;
}
