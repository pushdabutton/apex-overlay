import React from 'react';
import { MainOverlay } from './windows/MainOverlay/MainOverlay';
import { PostMatch } from './windows/PostMatch/PostMatch';
import { SessionDashboard } from './windows/SessionDashboard/SessionDashboard';
import { Settings } from './windows/Settings/Settings';

/**
 * App Router -- Renders the correct window based on the ?window= query parameter.
 * Each overlay window loads the same HTML but renders a different component tree.
 */
function App() {
  const params = new URLSearchParams(window.location.search);
  const windowName = params.get('window') ?? 'main-overlay';

  switch (windowName) {
    case 'main-overlay':
      return <MainOverlay />;
    case 'post-match':
      return <PostMatch />;
    case 'session-dashboard':
      return <SessionDashboard />;
    case 'settings':
      return <Settings />;
    default:
      return <MainOverlay />;
  }
}

export default App;
