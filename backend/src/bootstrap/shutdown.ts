const SHUTDOWN_SIGNALS: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

/**
 * Resolves when the process is asked to stop.
 *
 * The worker has no HTTP server, so until cron jobs are registered nothing
 * keeps the event loop alive and the process would exit immediately. Awaiting
 * this keeps it running and lets Nest's shutdown hooks close cleanly.
 */
export function waitForShutdownSignal(): Promise<NodeJS.Signals> {
  return new Promise((resolve) => {
    const handle = (signal: NodeJS.Signals) => {
      SHUTDOWN_SIGNALS.forEach((s) => process.removeListener(s, handle));
      resolve(signal);
    };

    SHUTDOWN_SIGNALS.forEach((signal) => process.once(signal, handle));
  });
}
