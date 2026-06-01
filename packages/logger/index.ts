import { useMemo } from "react";

export enum LogLeveL {
  ERROR = 100,
  WARN = 200,
  INFO = 400,
  AUTH = 401,
  MIDDLE_LAYER = 402,
  DEBUG = 800,
}

export const GLOBAL_LEVEL = LogLeveL.INFO;

export class Logger {
  protected readonly prefix: string;

  constructor(
    prefix: string,
    protected readonly currentLevel: LogLeveL = GLOBAL_LEVEL,
  ) {
    this.prefix = prefix.replaceAll("/", ".");
  }

  info(...messages: any[]) {
    this._log(LogLeveL.INFO, ...messages);
  }

  warn(...messages: any[]) {
    this._log(LogLeveL.WARN, ...messages);
  }

  debug(...messages: any[]) {
    this._log(LogLeveL.DEBUG, ...messages);
  }

  error(...messages: any[]) {
    this._log(LogLeveL.ERROR, ...messages);
  }

  protected _log(level: LogLeveL, ...messages: any[]) {
    if (level <= GLOBAL_LEVEL)
      console.info(`[${LogLeveL[level]}][${this.prefix}]`, ...messages);
  }

  log(...messages: any[]) {
    this._log(this.currentLevel, ...messages);
  }
}

export class AuthLogger extends Logger {
  constructor(prefix: string) {
    super(prefix, LogLeveL.AUTH);
  }

  auth(...messages: any[]) {
    this._log(LogLeveL.AUTH, ...messages);
  }
}

export function useLogger(name: string) {
  return useMemo(() => {
    return new Logger(name);
  }, [name]);
}
