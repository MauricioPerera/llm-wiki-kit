export interface Logger {
  debug(msg: string, ctx?: Record<string, unknown>): void;
  info(msg: string, ctx?: Record<string, unknown>): void;
  warn(msg: string, ctx?: Record<string, unknown>): void;
  error(msg: string, ctx?: Record<string, unknown>): void;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

export interface StderrLoggerOptions {
  minLevel?: LogLevel;
  write?: (line: string) => void;
}

export function createStderrLogger(opts: StderrLoggerOptions = {}): Logger {
  const min = LEVEL_ORDER[opts.minLevel ?? 'info'];
  const write =
    opts.write ??
    ((line: string): void => {
      const w = (globalThis as { process?: { stderr?: { write?: (s: string) => void } } })
        .process?.stderr?.write;
      if (typeof w === 'function') w(line + '\n');
    });
  const emit = (level: LogLevel, msg: string, ctx?: Record<string, unknown>): void => {
    if (LEVEL_ORDER[level] < min) return;
    const record = { level, msg, time: new Date().toISOString(), ...(ctx ?? {}) };
    write(JSON.stringify(record));
  };
  return {
    debug: (m, c) => emit('debug', m, c),
    info: (m, c) => emit('info', m, c),
    warn: (m, c) => emit('warn', m, c),
    error: (m, c) => emit('error', m, c)
  };
}

export const silentLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {}
};
