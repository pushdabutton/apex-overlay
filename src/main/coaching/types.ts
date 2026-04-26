// ============================================================
// Coaching Engine Types
// ============================================================

import { InsightSeverity, InsightType } from '../../shared/types';

export interface RuleResult {
  type: InsightType;
  ruleId: string;
  message: string;
  severity: InsightSeverity;
  data?: Record<string, unknown>;
}

export interface CoachingRule {
  /** Unique identifier for this rule */
  id: string;

  /** Human-readable name */
  name: string;

  /** Evaluate this rule after a match ends */
  evaluatePostMatch?(matchId: number, sessionId: number, ctx: RuleContext): RuleResult[];

  /** Evaluate this rule for a session summary */
  evaluateSession?(sessionId: number, ctx: RuleContext): RuleResult[];

  /** Evaluate this rule in real-time during a match */
  evaluateRealTime?(ctx: RuleContext): RuleResult[];
}

export interface RuleContext {
  /** Query the database */
  query<T>(sql: string, ...params: unknown[]): T[];

  /** Query the database for a single row */
  queryOne<T>(sql: string, ...params: unknown[]): T | undefined;
}
