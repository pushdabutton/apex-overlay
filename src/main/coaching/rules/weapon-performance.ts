// ============================================================
// Weapon Performance Rule (Stub)
// Analyzes accuracy and weapon selection patterns
// NOTE: Depends on weapon-specific GEP data which may be limited
// ============================================================

import type { CoachingRule, RuleContext, RuleResult } from '../types';

export class WeaponPerformanceRule implements CoachingRule {
  id = 'weapon-performance';
  name = 'Weapon Performance Analysis';

  evaluatePostMatch(_matchId: number, _sessionId: number, _ctx: RuleContext): RuleResult[] {
    // TODO: Implement when weapon-specific GEP data is confirmed available
    // This rule requires:
    // - Per-weapon kill tracking
    // - Per-weapon accuracy (shots hit/fired by weapon)
    // - Weapon category classification
    //
    // These may not be available through standard GEP events.
    // Phase 2 implementation after GEP data audit.
    return [];
  }
}
