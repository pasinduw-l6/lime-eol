const SHUTDOWN_SIGNALS: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

export function waitForShutdownSignal(): Promise<NodeJS.Signals> {
  return new Promise((resolve) => {
    const handle = (signal: NodeJS.Signals) => {
      SHUTDOWN_SIGNALS.forEach((s) => process.removeListener(s, handle));
      resolve(signal);
    };

    SHUTDOWN_SIGNALS.forEach((signal) => process.once(signal, handle));
  });
}
