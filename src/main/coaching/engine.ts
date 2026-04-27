// ============================================================
// Coaching Engine -- Orchestrates rule evaluation, persists
// insights via CoachingRepository, and broadcasts to UI
// ============================================================

import type Database from 'better-sqlite3';
import type { CoachingRule, RuleContext, RuleResult } from './types';
import { CoachingRepository } from '../db/repositories/coaching-repo';
import { broadcastToAll } from '../windows';
import { IPC } from '../../shared/ipc-channels';
import { nowISO } from '../../shared/utils';

import { SessionComparisonRule } from './rules/session-comparison';
import { TrendDetectionRule } from './rules/trend-detection';
import { LegendRecommendationRule } from './rules/legend-recommendation';
import { DeathTimingRule } from './rules/death-timing';
import { WeaponPerformanceRule } from './rules/weapon-performance';
import { WarmUpDetectionRule } from './rules/warmup-detection';
import { RankedProgressRule } from './rules/ranked-progress';
import { DamagePerKillRule } from './rules/damage-per-kill';
import { KnockConversionRule } from './rules/knock-conversion';
import { TiltDetectionRule } from './rules/tilt-detection';

export class CoachingEngine {
  private db: Database.Database;
  private coachingRepo: CoachingRepository;
  private rules: CoachingRule[] = [];
  private ctx: RuleContext;

  // Deduplication: track insights emitted this session to avoid spam
  private sessionInsightKeys = new Set<string>();

  constructor(db: Database.Database, coachingRepo?: CoachingRepository) {
    this.db = db;
    this.coachingRepo = coachingRepo ?? new CoachingRepository(db);

    // Create rule context (provides DB access to rules)
    this.ctx = {
      query: <T>(sql: string, ...params: unknown[]): T[] => {
        return this.db.prepare(sql).all(...params) as T[];
      },
      queryOne: <T>(sql: string, ...params: unknown[]): T | undefined => {
        return this.db.prepare(sql).get(...params) as T | undefined;
      },
    };

    // Register rules
    this.registerRules();
  }

  private registerRules(): void {
    this.rules.push(new SessionComparisonRule());
    this.rules.push(new TrendDetectionRule());
    this.rules.push(new LegendRecommendationRule());
    this.rules.push(new DeathTimingRule());
    this.rules.push(new WeaponPerformanceRule());
    this.rules.push(new WarmUpDetectionRule());
    this.rules.push(new RankedProgressRule());
    this.rules.push(new DamagePerKillRule());
    this.rules.push(new KnockConversionRule());
    this.rules.push(new TiltDetectionRule());

    console.log(`[Coaching] ${this.rules.length} rules registered`);
  }

  /**
   * Run all post-match rules and persist/broadcast insights.
   */
  evaluatePostMatch(matchId: number, sessionId: number): void {
    const allInsights: RuleResult[] = [];

    for (const rule of this.rules) {
      if (rule.evaluatePostMatch) {
        try {
          const results = rule.evaluatePostMatch(matchId, sessionId, this.ctx);
          allInsights.push(...results);
        } catch (error) {
          console.error(`[Coaching] Rule "${rule.id}" failed on post-match:`, error);
        }
      }
    }

    // Persist and broadcast
    for (const insight of allInsights) {
      this.persistAndBroadcast(insight, matchId, sessionId);
    }
  }

  /**
   * Run all session-level rules.
   */
  evaluateSession(sessionId: number): void {
    const allInsights: RuleResult[] = [];

    for (const rule of this.rules) {
      if (rule.evaluateSession) {
        try {
          const results = rule.evaluateSession(sessionId, this.ctx);
          allInsights.push(...results);
        } catch (error) {
          console.error(`[Coaching] Rule "${rule.id}" failed on session:`, error);
        }
      }
    }

    for (const insight of allInsights) {
      this.persistAndBroadcast(insight, null, sessionId);
    }
  }

  private persistAndBroadcast(
    insight: RuleResult,
    matchId: number | null,
    sessionId: number | null,
  ): void {
    // Deduplication check (except for achievements)
    const dedupeKey = `${insight.ruleId}:${insight.type}`;
    if (insight.severity !== 'achievement' && this.sessionInsightKeys.has(dedupeKey)) {
      return;
    }
    this.sessionInsightKeys.add(dedupeKey);

    // Persist via CoachingRepository (includes repo-level dedup by matchId+type)
    const insightId = this.coachingRepo.save({
      matchId,
      sessionId,
      type: insight.type,
      ruleId: insight.ruleId,
      message: insight.message,
      severity: insight.severity,
      dataJson: insight.data ?? null,
    });

    // Broadcast to UI
    broadcastToAll(IPC.COACHING_INSIGHT, {
      id: insightId,
      matchId,
      sessionId,
      ...insight,
      createdAt: nowISO(),
    });
  }

  /**
   * Reset session deduplication (call when new session starts).
   */
  resetSession(): void {
    this.sessionInsightKeys.clear();
  }
}
