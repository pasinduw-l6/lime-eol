import {
  containerStyleFor,
  iconFor,
  NotificationEvent,
} from './notification-event';

/**
 * One Adaptive Card, from any event.
 *
 * Pinned to schema 1.4 deliberately. Teams renders 1.5 inconsistently - the
 * desktop client copes and mobile does not - and a card that looks right on the
 * machine it was tested on and broken on everyone's phone is worse than one
 * that is plainer everywhere.
 */
export function toAdaptiveCard(event: NotificationEvent): Record<string, unknown> {
  const body: Record<string, unknown>[] = [
    {
      type: 'Container',
      style: containerStyleFor(event.severity),
      bleed: true,
      items: [
        {
          type: 'TextBlock',
          text: `${iconFor(event.severity)} ${event.title}`,
          weight: 'Bolder',
          size: 'Medium',
          wrap: true,
        },
      ],
    },
  ];

  if (event.subtitle) {
    body.push({
      type: 'TextBlock',
      text: event.subtitle,
      isSubtle: true,
      spacing: 'Small',
      wrap: true,
    });
  }

  if (event.facts.length > 0) {
    body.push({
      type: 'FactSet',
      facts: event.facts.map((fact) => ({
        title: fact.title,
        value: fact.value,
      })),
    });
  }

  for (const line of event.lines ?? []) {
    body.push({
      type: 'TextBlock',
      text: line,
      wrap: true,
      spacing: line === '' ? 'Small' : 'None',
    });
  }

  // Every <at> tag needs a matching entity, in the same order. A mismatch does
  // not degrade to plain text - Teams refuses to render the card at all.
  if (event.mentions.length > 0) {
    body.push({
      type: 'TextBlock',
      text: event.mentions.map((m) => `<at>${m.name}</at>`).join(' '),
      wrap: true,
      spacing: 'Medium',
    });
  }

  const card: Record<string, unknown> = {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.4',
    body,
  };

  if (event.actions.length > 0) {
    card['actions'] = event.actions.map((action) => ({
      type: 'Action.OpenUrl',
      title: action.label,
      url: action.url,
    }));
  }

  if (event.mentions.length > 0) {
    card['msteams'] = {
      entities: event.mentions.map((mention) => ({
        type: 'mention',
        text: `<at>${mention.name}</at>`,
        mentioned: { id: mention.upn, name: mention.name },
      })),
    };
  }

  return card;
}
