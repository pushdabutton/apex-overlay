import React from 'react';

export function OverlaySettings() {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">Overlay Appearance</h2>
      <div className="flex flex-col gap-3">
        <div>
          <label className="block text-sm text-white/60 mb-1">
            Opacity: <span className="text-white">85%</span>
          </label>
          <input
            type="range"
            min={30}
            max={100}
            defaultValue={85}
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-sm text-white/60 mb-1">
            Scale: <span className="text-white">100%</span>
          </label>
          <input
            type="range"
            min={75}
            max={150}
            defaultValue={100}
            className="w-full"
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm text-white/60">Show on overlay:</span>
          <label className="flex items-center gap-2 text-sm text-white/70">
            <input type="checkbox" defaultChecked className="w-4 h-4" />
            Map rotation
          </label>
          <label className="flex items-center gap-2 text-sm text-white/70">
            <input type="checkbox" defaultChecked className="w-4 h-4" />
            Crafting rotation
          </label>
          <label className="flex items-center gap-2 text-sm text-white/70">
            <input type="checkbox" defaultChecked className="w-4 h-4" />
            Ranked progress
          </label>
          <label className="flex items-center gap-2 text-sm text-white/70">
            <input type="checkbox" defaultChecked className="w-4 h-4" />
            Coaching alerts
          </label>
          <label className="flex items-center gap-2 text-sm text-white/70">
            <input type="checkbox" defaultChecked className="w-4 h-4" />
            Session stats
          </label>
        </div>
      </div>
    </div>
  );
}
