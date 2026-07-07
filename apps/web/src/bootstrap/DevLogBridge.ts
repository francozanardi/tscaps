const ENDPOINT = '/__client_log';

/**
 * Forwards every `console.log` / `warn` / `error` call, every
 * `console.time` / `timeEnd` pair, and every uncaught error or
 * unhandled rejection to the Vite dev server's `/__client_log`
 * endpoint so a developer can inspect a session by tailing the
 * server-side log file. Original console output is preserved
 * verbatim — the bridge only adds an extra delivery channel.
 *
 * Install once, at app boot, only in dev.
 */
export class DevLogBridge {
  private readonly timerStartsByLabel = new Map<string, number>();

  install(): void {
    this.installConsoleInterceptors();
    this.installErrorListeners();
  }

  private installConsoleInterceptors(): void {
    const originalLog = console.log.bind(console);
    const originalWarn = console.warn.bind(console);
    const originalError = console.error.bind(console);
    const originalTime = console.time.bind(console);
    const originalTimeEnd = console.timeEnd.bind(console);

    console.log = (...args: unknown[]) => {
      originalLog(...args);
      this.send('log', this.formatArgs(args));
    };
    console.warn = (...args: unknown[]) => {
      originalWarn(...args);
      this.send('warn', this.formatArgs(args));
    };
    console.error = (...args: unknown[]) => {
      originalError(...args);
      this.send('error', this.formatArgs(args));
    };
    console.time = (label?: string) => {
      originalTime(label);
      if (typeof label === 'string') this.timerStartsByLabel.set(label, performance.now());
    };
    console.timeEnd = (label?: string) => {
      originalTimeEnd(label);
      if (typeof label !== 'string') return;
      const startedAt = this.timerStartsByLabel.get(label);
      if (startedAt === undefined) return;
      const elapsedMs = performance.now() - startedAt;
      this.send('time', `${label}: ${elapsedMs.toFixed(2)} ms`);
      this.timerStartsByLabel.delete(label);
    };
  }

  private installErrorListeners(): void {
    window.addEventListener('error', (event) => {
      const stack = event.error instanceof Error ? event.error.stack ?? '' : '';
      this.send('window.error', `${event.message}\n${stack}`);
    });
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      const message = reason instanceof Error
        ? `${reason.message}\n${reason.stack ?? ''}`
        : String(reason);
      this.send('unhandledrejection', message);
    });
  }

  private formatArgs(args: unknown[]): string {
    return args.map((arg) => this.stringify(arg)).join(' ');
  }

  private stringify(value: unknown): string {
    if (typeof value === 'string') return value;
    if (value instanceof Error) return `${value.name}: ${value.message}\n${value.stack ?? ''}`;
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  private send(level: string, message: string): void {
    const line = `[${level}] ${message}`;
    void fetch(ENDPOINT, {
      method: 'POST',
      body: line,
      keepalive: true,
    }).catch(() => {});
  }
}
