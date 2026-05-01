// ============================================================
// GEP Raw Data Logger -- Writes every GEP event/info update to
// a JSONL log file for debugging. One line per event, timestamped.
//
// Log location: logs/gep-raw-YYYY-MM-DD.log
// Auto-creates the log directory if missing.
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

/**
 * Append-only logger for raw GEP data.
 * Each line is a self-contained JSON object:
 *   {"ts":"...","type":"info"|"event","gameId":...,"feature":"...","category":"...","key":"...","value":"..."}
 */
export class GEPRawLogger {
  private logDir: string;
  private stream: fs.WriteStream | null = null;
  private currentDate: string | null = null;

  constructor() {
    // Resolve log directory relative to the app's working directory.
    // In development this is the project root; in production it's the app dir.
    const baseDir = app?.isPackaged
      ? path.dirname(app.getPath('exe'))
      : process.cwd();
    this.logDir = path.join(baseDir, 'logs');
  }

  /**
   * Ensure the log directory exists (creates recursively if missing).
   */
  private ensureLogDir(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * Get or create the write stream for today's date.
   * Rolls over to a new file at midnight.
   */
  private getStream(): fs.WriteStream {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    if (this.currentDate !== today || !this.stream) {
      this.ensureLogDir();
      if (this.stream) {
        this.stream.end();
      }
      const logPath = path.join(this.logDir, `gep-raw-${today}.log`);
      this.stream = fs.createWriteStream(logPath, { flags: 'a' });
      this.currentDate = today;
    }
    return this.stream;
  }

  /**
   * Log a raw GEP info update before any processing.
   */
  logInfoUpdate(gameId: number, rawInfo: unknown): void {
    try {
      const entry = {
        ts: new Date().toISOString(),
        type: 'info',
        gameId,
        ...(this.extractInfoFields(rawInfo)),
      };
      this.writeLine(JSON.stringify(entry));
    } catch {
      // Logger must never crash the app
    }
  }

  /**
   * Log a raw GEP game event before any processing.
   */
  logGameEvent(gameId: number, rawEvent: unknown): void {
    try {
      const entry = {
        ts: new Date().toISOString(),
        type: 'event',
        gameId,
        ...(this.extractEventFields(rawEvent)),
      };
      this.writeLine(JSON.stringify(entry));
    } catch {
      // Logger must never crash the app
    }
  }

  /**
   * Close the log stream gracefully.
   */
  close(): void {
    if (this.stream) {
      this.stream.end();
      this.stream = null;
    }
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  private writeLine(line: string): void {
    const stream = this.getStream();
    stream.write(line + '\n');
  }

  /**
   * Extract structured fields from a raw info update.
   * Handles both ow-electron key-value format and legacy nested format.
   */
  private extractInfoFields(raw: unknown): Record<string, unknown> {
    if (!raw || typeof raw !== 'object') {
      return { raw: String(raw) };
    }
    const obj = raw as Record<string, unknown>;
    // ow-electron key-value: { gameId, feature, category, key, value }
    if (typeof obj.key === 'string') {
      return {
        feature: obj.feature ?? 'unknown',
        category: obj.category ?? 'unknown',
        key: obj.key,
        value: obj.value,
      };
    }
    // Fallback: dump the entire object
    return { raw: obj };
  }

  /**
   * Extract structured fields from a raw game event.
   * Handles both ow-electron format and legacy format.
   */
  private extractEventFields(raw: unknown): Record<string, unknown> {
    if (!raw || typeof raw !== 'object') {
      return { raw: String(raw) };
    }
    const obj = raw as Record<string, unknown>;
    return {
      feature: obj.feature ?? 'unknown',
      key: obj.name ?? obj.key ?? 'unknown',
      value: obj.data ?? obj.value ?? obj,
    };
  }
}

// Singleton instance -- import and use directly
let _instance: GEPRawLogger | null = null;

export function getGEPRawLogger(): GEPRawLogger {
  if (!_instance) {
    _instance = new GEPRawLogger();
  }
  return _instance;
}
