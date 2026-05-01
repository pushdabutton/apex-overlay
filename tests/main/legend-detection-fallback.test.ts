// ============================================================
// Legend Detection Fallback Tests
//
// Bug: GEP_REQUIRED_FEATURES is missing 'team' feature, so
// legendSelect_0/1/2 info updates are never received from real
// GEP. Also, when the overlay starts mid-game (after legend
// selection), there is no fallback to read legend from roster
// data.
//
// Fix:
// 1. Add all 17 features to GEP_REQUIRED_FEATURES
// 2. Add roster-based legend fallback via roster_X info updates
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { GEP_REQUIRED_FEATURES } from '../../src/main/gep/gep-manager';
import { EventProcessor } from '../../src/main/gep/event-processor';
import type { DomainEvent } from '../../src/shared/types';

describe('GEP Required Features', () => {
  it('should include team feature for legendSelect_X info updates', () => {
    expect(GEP_REQUIRED_FEATURES).toContain('team');
  });

  it('should include roster feature for player legend fallback', () => {
    expect(GEP_REQUIRED_FEATURES).toContain('roster');
  });

  it('should include match_state feature for match lifecycle', () => {
    expect(GEP_REQUIRED_FEATURES).toContain('match_state');
  });

  it('should include match_summary feature for placement data', () => {
    expect(GEP_REQUIRED_FEATURES).toContain('match_summary');
  });

  it('should include location feature for player position', () => {
    expect(GEP_REQUIRED_FEATURES).toContain('location');
  });

  it('should include gep_internal feature (required by GEP)', () => {
    expect(GEP_REQUIRED_FEATURES).toContain('gep_internal');
  });

  it('should include all 17 documented Apex Legends GEP features', () => {
    const expected = [
      'gep_internal', 'me', 'localization', 'game_info', 'match_info',
      'match_state', 'team', 'roster', 'location', 'rank',
      'match_summary', 'damage', 'inventory', 'kill', 'revive',
      'death', 'kill_feed',
    ];
    for (const feature of expected) {
      expect(GEP_REQUIRED_FEATURES, `Missing feature: ${feature}`).toContain(feature);
    }
  });
});

describe('Roster-based legend fallback', () => {
  let processor: EventProcessor;
  let emittedEvents: DomainEvent[];

  beforeEach(() => {
    processor = new EventProcessor();
    emittedEvents = [];
    processor.on('domain-event', (event: DomainEvent) => {
      emittedEvents.push(event);
    });
  });

  it('should extract local player legend from roster_X when is_local is true', () => {
    processor.processInfoUpdate({
      info: {
        key: 'roster_5',
        value: {
          name: 'TestPlayer',
          isTeammate: true,
          team_id: 3,
          platform_hw: 2,
          state: 'alive',
          is_local: '1',
          character_name: 'Wraith',
        },
        feature: 'roster',
        category: 'roster',
      },
    });

    const legends = emittedEvents.filter((e) => e.type === 'LEGEND_SELECTED');
    expect(legends.length).toBe(1);
    expect((legends[0] as { type: 'LEGEND_SELECTED'; legend: string }).legend).toBe('Wraith');
  });

  it('should clean localization key from roster legend name', () => {
    processor.processInfoUpdate({
      info: {
        key: 'roster_12',
        value: {
          name: 'Player',
          isTeammate: false,
          team_id: 5,
          platform_hw: 7,
          state: 'alive',
          is_local: true,
          character_name: '#character_horizon_NAME',
        },
        feature: 'roster',
        category: 'roster',
      },
    });

    const legends = emittedEvents.filter((e) => e.type === 'LEGEND_SELECTED');
    expect(legends.length).toBe(1);
    expect((legends[0] as { type: 'LEGEND_SELECTED'; legend: string }).legend).toBe('Horizon');
  });

  it('should ignore roster entries where is_local is false/0', () => {
    processor.processInfoUpdate({
      info: {
        key: 'roster_3',
        value: {
          name: 'OtherPlayer',
          isTeammate: true,
          team_id: 3,
          platform_hw: 2,
          state: 'alive',
          is_local: false,
          character_name: 'Lifeline',
        },
        feature: 'roster',
        category: 'roster',
      },
    });

    processor.processInfoUpdate({
      info: {
        key: 'roster_4',
        value: {
          name: 'OtherPlayer2',
          isTeammate: false,
          team_id: 7,
          platform_hw: 0,
          state: 'alive',
          is_local: '0',
          character_name: 'Octane',
        },
        feature: 'roster',
        category: 'roster',
      },
    });

    const legends = emittedEvents.filter((e) => e.type === 'LEGEND_SELECTED');
    expect(legends.length).toBe(0);
  });

  it('should handle roster with is_local as numeric 1', () => {
    processor.processInfoUpdate({
      info: {
        key: 'roster_0',
        value: {
          name: 'NumPlayer',
          isTeammate: true,
          team_id: 1,
          platform_hw: 2,
          state: 'alive',
          is_local: 1,
          character_name: 'Bangalore',
        },
        feature: 'roster',
        category: 'roster',
      },
    });

    const legends = emittedEvents.filter((e) => e.type === 'LEGEND_SELECTED');
    expect(legends.length).toBe(1);
    expect((legends[0] as { type: 'LEGEND_SELECTED'; legend: string }).legend).toBe('Bangalore');
  });

  it('should handle roster with is_local as string "true"', () => {
    processor.processInfoUpdate({
      info: {
        key: 'roster_2',
        value: {
          name: 'StrPlayer',
          isTeammate: true,
          team_id: 2,
          platform_hw: 2,
          state: 'alive',
          is_local: 'true',
          character_name: 'Caustic',
        },
        feature: 'roster',
        category: 'roster',
      },
    });

    const legends = emittedEvents.filter((e) => e.type === 'LEGEND_SELECTED');
    expect(legends.length).toBe(1);
    expect((legends[0] as { type: 'LEGEND_SELECTED'; legend: string }).legend).toBe('Caustic');
  });

  it('should ignore roster entries without character_name', () => {
    processor.processInfoUpdate({
      info: {
        key: 'roster_1',
        value: {
          name: 'NoLegend',
          isTeammate: true,
          team_id: 1,
          platform_hw: 2,
          state: 'alive',
          is_local: true,
        },
        feature: 'roster',
        category: 'roster',
      },
    });

    const legends = emittedEvents.filter((e) => e.type === 'LEGEND_SELECTED');
    expect(legends.length).toBe(0);
  });
});
