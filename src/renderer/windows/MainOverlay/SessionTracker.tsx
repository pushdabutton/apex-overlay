import React, { memo, useEffect } from 'react';
import { StatCard } from '../../components/StatCard';
import { useMatchStore } from '../../stores/match-store';
import { useSessionStore } from '../../stores/session-store';
import { IPC } from '../../../shared/ipc-channels';

function SessionTrackerInner() {
  const kills = useMatchStore((s) => s.kills);
  const deaths = useMatchStore((s) => s.deaths);
  const damage = useMatchStore((s) => s.damage);
  const assists = useMatchStore((s) => s.assists);
  const avgKills = useSessionStore((s) => s.avgKills);
  const avgDamage = useSessionStore((s) => s.avgDamage);

  // Subscribe to IPC updates for match and session data
  useEffect(() => {
    const unsubMatch = window.apexCoach.on(IPC.MATCH_UPDATE, (data) => {
      useMatchStore.getState().updateFromIpc(data as Record<string, unknown>);
    });
    const unsubSession = window.apexCoach.on(IPC.SESSION_UPDATE, (data) => {
      useSessionStore.getState().updateFromIpc(data as Record<string, unknown>);
    });
    const unsubWeapons = window.apexCoach.on(IPC.WEAPONS_UPDATE, (data) => {
      useMatchStore.getState().updateFromIpc({
        type: 'weapons',
        weapons: data,
      } as Record<string, unknown>);
    });
    // Listen for API player profile to extract rank data.
    // GEP's "rank" feature only sends "victory" (true/false) --
    // the actual rank name and score come from the mozambiquehe.re API.
    const unsubProfile = window.apexCoach.on(IPC.API_PLAYER_PROFILE, (data) => {
      const profile = data as Record<string, unknown>;
      if (profile.rankName && typeof profile.rankName === 'string' && profile.rankName !== 'Unknown') {
        useMatchStore.getState().updateFromIpc({
          type: 'rank',
          rankName: profile.rankName,
          rankScore: typeof profile.rankScore === 'number' ? profile.rankScore : 0,
        } as Record<string, unknown>);
      }
    });
    return () => {
      unsubMatch();
      unsubSession();
      unsubWeapons();
      unsubProfile();
    };
  }, []);

  return (
    <div className="grid grid-cols-2 gap-1.5">
      <StatCard
        label="Kills"
        value={kills}
        previousValue={avgKills}
        compact
      />
      <StatCard
        label="Deaths"
        value={deaths}
        compact
      />
      <StatCard
        label="Damage"
        value={damage}
        previousValue={avgDamage}
        compact
      />
      <StatCard
        label="Assists"
        value={assists}
        compact
      />
    </div>
  );
}

export const SessionTracker = memo(SessionTrackerInner);
