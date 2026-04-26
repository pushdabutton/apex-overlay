import React from 'react';
import { ApiKeySettings } from './ApiKeySettings';
import { GeneralSettings } from './GeneralSettings';
import { OverlaySettings } from './OverlaySettings';

export function Settings() {
  return (
    <div className="bg-gray-900 text-white p-6 w-[500px] h-[600px] overflow-y-auto">
      <h1 className="text-xl font-bold mb-4">Apex Coach Settings</h1>

      <div className="flex flex-col gap-6">
        <ApiKeySettings />
        <OverlaySettings />
        <GeneralSettings />
      </div>

      <div className="mt-6 text-xs text-white/30">
        Apex Coach v1.0.0 | PureBrain
      </div>
    </div>
  );
}
