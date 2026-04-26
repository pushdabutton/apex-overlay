import React, { useEffect, useState } from 'react';
import { IPC } from '../../../shared/ipc-channels';

interface OverlaySettingsData {
  opacity: number;
  scale: number;
  showMapRotation: boolean;
  showCraftingRotation: boolean;
  showRankedProgress: boolean;
  showCoachingAlerts: boolean;
  showSessionStats: boolean;
}

const DEFAULTS: OverlaySettingsData = {
  opacity: 85,
  scale: 100,
  showMapRotation: true,
  showCraftingRotation: true,
  showRankedProgress: true,
  showCoachingAlerts: true,
  showSessionStats: true,
};

export function OverlaySettings() {
  const [settings, setSettings] = useState<OverlaySettingsData>(DEFAULTS);

  useEffect(() => {
    (async () => {
      try {
        const persisted = await window.apexCoach.invoke(IPC.SETTINGS_GET_ALL) as Record<string, unknown> | null;
        if (persisted) {
          setSettings({
            opacity: (persisted['overlay.opacity'] as number) ?? DEFAULTS.opacity,
            scale: (persisted['overlay.scale'] as number) ?? DEFAULTS.scale,
            showMapRotation: (persisted['overlay.showMapRotation'] as boolean) ?? DEFAULTS.showMapRotation,
            showCraftingRotation: (persisted['overlay.showCraftingRotation'] as boolean) ?? DEFAULTS.showCraftingRotation,
            showRankedProgress: (persisted['overlay.showRankedProgress'] as boolean) ?? DEFAULTS.showRankedProgress,
            showCoachingAlerts: (persisted['overlay.showCoachingAlerts'] as boolean) ?? DEFAULTS.showCoachingAlerts,
            showSessionStats: (persisted['overlay.showSessionStats'] as boolean) ?? DEFAULTS.showSessionStats,
          });
        }
      } catch {
        // Use defaults on error
      }
    })();
  }, []);

  const updateSetting = (key: string, value: unknown) => {
    window.apexCoach.invoke(IPC.SETTINGS_SET, key, value);
  };

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">Overlay Appearance</h2>
      <div className="flex flex-col gap-3">
        <div>
          <label className="block text-sm text-white/60 mb-1">
            Opacity: <span className="text-white">{settings.opacity}%</span>
          </label>
          <input
            type="range"
            min={30}
            max={100}
            value={settings.opacity}
            onChange={(e) => {
              const val = Number(e.target.value);
              setSettings((s) => ({ ...s, opacity: val }));
              updateSetting('overlay.opacity', val);
            }}
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-sm text-white/60 mb-1">
            Scale: <span className="text-white">{settings.scale}%</span>
          </label>
          <input
            type="range"
            min={75}
            max={150}
            value={settings.scale}
            onChange={(e) => {
              const val = Number(e.target.value);
              setSettings((s) => ({ ...s, scale: val }));
              updateSetting('overlay.scale', val);
            }}
            className="w-full"
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm text-white/60">Show on overlay:</span>
          <label className="flex items-center gap-2 text-sm text-white/70">
            <input
              type="checkbox"
              checked={settings.showMapRotation}
              onChange={(e) => {
                const val = e.target.checked;
                setSettings((s) => ({ ...s, showMapRotation: val }));
                updateSetting('overlay.showMapRotation', val);
              }}
              className="w-4 h-4"
            />
            Map rotation
          </label>
          <label className="flex items-center gap-2 text-sm text-white/70">
            <input
              type="checkbox"
              checked={settings.showCraftingRotation}
              onChange={(e) => {
                const val = e.target.checked;
                setSettings((s) => ({ ...s, showCraftingRotation: val }));
                updateSetting('overlay.showCraftingRotation', val);
              }}
              className="w-4 h-4"
            />
            Crafting rotation
          </label>
          <label className="flex items-center gap-2 text-sm text-white/70">
            <input
              type="checkbox"
              checked={settings.showRankedProgress}
              onChange={(e) => {
                const val = e.target.checked;
                setSettings((s) => ({ ...s, showRankedProgress: val }));
                updateSetting('overlay.showRankedProgress', val);
              }}
              className="w-4 h-4"
            />
            Ranked progress
          </label>
          <label className="flex items-center gap-2 text-sm text-white/70">
            <input
              type="checkbox"
              checked={settings.showCoachingAlerts}
              onChange={(e) => {
                const val = e.target.checked;
                setSettings((s) => ({ ...s, showCoachingAlerts: val }));
                updateSetting('overlay.showCoachingAlerts', val);
              }}
              className="w-4 h-4"
            />
            Coaching alerts
          </label>
          <label className="flex items-center gap-2 text-sm text-white/70">
            <input
              type="checkbox"
              checked={settings.showSessionStats}
              onChange={(e) => {
                const val = e.target.checked;
                setSettings((s) => ({ ...s, showSessionStats: val }));
                updateSetting('overlay.showSessionStats', val);
              }}
              className="w-4 h-4"
            />
            Session stats
          </label>
        </div>
      </div>
    </div>
  );
}
