type Level = 'info' | 'warn' | 'error';

function emit(level: Level, message: string, context?: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'test') return;

  const line = { level, message, time: new Date().toISOString(), ...context };
  console[level === 'info' ? 'log' : level](JSON.stringify(line));
}

export const logger = {
  info: (message: string, context?: Record<string, unknown>) => emit('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) => emit('warn', message, context),
  error: (message: string, context?: Record<string, unknown>) => emit('error', message, context),
};
