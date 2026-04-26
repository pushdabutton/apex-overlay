/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore } from '../../../src/renderer/stores/settings-store';

describe('Settings Store', () => {
  beforeEach(() => {
    useSettingsStore.getState().reset();
  });

  it('default overlay position is top-right', () => {
    const state = useSettingsStore.getState();
    expect(state.overlayPosition).toBe('top-right');
  });

  it('default overlayVisible is true', () => {
    const state = useSettingsStore.getState();
    expect(state.overlayVisible).toBe(true);
  });

  it('default apiKey is empty string', () => {
    const state = useSettingsStore.getState();
    expect(state.apiKey).toBe('');
  });

  it('setOverlayVisible toggles visibility', () => {
    const initialVisible = useSettingsStore.getState().overlayVisible;
    useSettingsStore.getState().setOverlayVisible(!initialVisible);
    expect(useSettingsStore.getState().overlayVisible).toBe(!initialVisible);

    useSettingsStore.getState().setOverlayVisible(initialVisible);
    expect(useSettingsStore.getState().overlayVisible).toBe(initialVisible);
  });

  it('setOverlayPosition updates position', () => {
    useSettingsStore.getState().setOverlayPosition('bottom-left');
    expect(useSettingsStore.getState().overlayPosition).toBe('bottom-left');

    useSettingsStore.getState().setOverlayPosition('top-left');
    expect(useSettingsStore.getState().overlayPosition).toBe('top-left');
  });

  it('setApiKey stores key', () => {
    useSettingsStore.getState().setApiKey('test-api-key-12345');
    expect(useSettingsStore.getState().apiKey).toBe('test-api-key-12345');
  });

  it('reset returns all values to defaults', () => {
    useSettingsStore.getState().setOverlayVisible(false);
    useSettingsStore.getState().setOverlayPosition('bottom-right');
    useSettingsStore.getState().setApiKey('some-key');

    useSettingsStore.getState().reset();

    const state = useSettingsStore.getState();
    expect(state.overlayVisible).toBe(true);
    expect(state.overlayPosition).toBe('top-right');
    expect(state.apiKey).toBe('');
  });
});
