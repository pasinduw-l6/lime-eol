import { appConfig } from './app.config';
import { authConfig } from './auth.config';
import { eolConfig } from './eol.config';
import { notificationConfig } from './notification.config';

export * from './app.config';
export * from './auth.config';
export * from './eol.config';
export * from './notification.config';

/** Every namespace loaded by AppConfigModule. */
export const configNamespaces = [
  appConfig,
  authConfig,
  eolConfig,
  notificationConfig,
];
