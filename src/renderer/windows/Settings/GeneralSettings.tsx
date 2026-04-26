import React from 'react';

export function GeneralSettings() {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">General</h2>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/70">Session gap threshold (minutes)</span>
          <input
            type="number"
            defaultValue={30}
            min={5}
            max={120}
            className="w-20 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-center"
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/70">Auto-show post-match</span>
          <input type="checkbox" defaultChecked className="w-4 h-4" />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/70">Post-match auto-dismiss (seconds)</span>
          <input
            type="number"
            defaultValue={60}
            min={10}
            max={300}
            className="w-20 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-center"
          />
        </div>
      </div>
    </div>
  );
}
