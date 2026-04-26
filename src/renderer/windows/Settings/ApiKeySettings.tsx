import React, { useState } from 'react';

export function ApiKeySettings() {
  const [apiKey, setApiKey] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [platform, setPlatform] = useState('PC');

  const handleSave = async () => {
    await window.apexCoach.invoke(window.apexCoach.channels.SETTINGS_SET, 'api.key', apiKey);
    await window.apexCoach.invoke(window.apexCoach.channels.SETTINGS_SET, 'api.playerName', playerName);
    await window.apexCoach.invoke(window.apexCoach.channels.SETTINGS_SET, 'api.platform', platform);
  };

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">API Configuration</h2>
      <div className="flex flex-col gap-3">
        <div>
          <label className="block text-sm text-white/60 mb-1">API Key (mozambiquehe.re)</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your API key"
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-apex-blue"
          />
          <a
            href="https://apexlegendsapi.com"
            className="text-xs text-apex-blue mt-1 inline-block"
          >
            Get a free API key
          </a>
        </div>

        <div>
          <label className="block text-sm text-white/60 mb-1">Player Name</label>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Your Apex Legends name"
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-apex-blue"
          />
        </div>

        <div>
          <label className="block text-sm text-white/60 mb-1">Platform</label>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-apex-blue"
          >
            <option value="PC">PC (Origin/Steam)</option>
            <option value="PS4">PlayStation</option>
            <option value="X1">Xbox</option>
          </select>
        </div>

        <button
          onClick={handleSave}
          className="bg-apex-blue hover:bg-apex-blue/80 text-white font-semibold py-2 px-4 rounded transition-colors"
        >
          Save API Settings
        </button>
      </div>
    </div>
  );
}
