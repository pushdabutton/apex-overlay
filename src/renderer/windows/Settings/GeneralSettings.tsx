import React, { useEffect, useState } from 'react';
import { IPC } from '../../../shared/ipc-channels';

interface GeneralSettingsData {
  sessionGapMinutes: number;
  autoShowPostMatch: boolean;
  postMatchDismissSeconds: number;
}

const DEFAULTS: GeneralSettingsData = {
  sessionGapMinutes: 30,
  autoShowPostMatch: true,
  postMatchDismissSeconds: 60,
};

export function GeneralSettings() {
  const [settings, setSettings] = useState<GeneralSettingsData>(DEFAULTS);

  useEffect(() => {
    (async () => {
      try {
        const persisted = await window.apexCoach.invoke(IPC.SETTINGS_GET_ALL) as Record<string, unknown> | null;
        if (persisted) {
          setSettings({
            sessionGapMinutes: (persisted['general.sessionGapMinutes'] as number) ?? DEFAULTS.sessionGapMinutes,
            autoShowPostMatch: (persisted['general.autoShowPostMatch'] as boolean) ?? DEFAULTS.autoShowPostMatch,
            postMatchDismissSeconds: (persisted['general.postMatchDismissSeconds'] as number) ?? DEFAULTS.postMatchDismissSeconds,
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
      <h2 className="text-lg font-semibold mb-3">General</h2>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/70">Session gap threshold (minutes)</span>
          <input
            type="number"
            value={settings.sessionGapMinutes}
            min={5}
            max={120}
            onChange={(e) => {
              const val = Number(e.target.value);
              setSettings((s) => ({ ...s, sessionGapMinutes: val }));
              updateSetting('general.sessionGapMinutes', val);
            }}
            className="w-20 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-center"
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/70">Auto-show post-match</span>
          <input
            type="checkbox"
            checked={settings.autoShowPostMatch}
            onChange={(e) => {
              const val = e.target.checked;
              setSettings((s) => ({ ...s, autoShowPostMatch: val }));
              updateSetting('general.autoShowPostMatch', val);
            }}
            className="w-4 h-4"
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/70">Post-match auto-dismiss (seconds)</span>
          <input
            type="number"
            value={settings.postMatchDismissSeconds}
            min={10}
            max={300}
            onChange={(e) => {
              const val = Number(e.target.value);
              setSettings((s) => ({ ...s, postMatchDismissSeconds: val }));
              updateSetting('general.postMatchDismissSeconds', val);
            }}
            className="w-20 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-center"
          />
        </div>
      </div>
    </div>
  );
}
