import { describe, expect, it } from 'vitest';
import {
  loadDisplaySettings,
  parseUiScalePreference,
  RENDER_QUALITY_STORAGE_KEY,
  saveRenderQualityPreference,
  saveUiScalePreference,
  UI_SCALE_STORAGE_KEY,
} from '../services/displaySettings';
import type { DisplaySettingsStorage } from '../services/displaySettings';

class MemoryStorage implements DisplaySettingsStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

describe('R6F5 display settings persistence', () => {
  it('persists and reloads render quality and UI scale, including legacy render quality', () => {
    const storage = new MemoryStorage();
    saveRenderQualityPreference(storage, 'crisp');
    expect(saveUiScalePreference(storage, 1.15)).toBe(true);
    expect(storage.getItem(RENDER_QUALITY_STORAGE_KEY)).toBe('crisp');
    expect(storage.getItem(UI_SCALE_STORAGE_KEY)).toBe('1.15');
    expect(loadDisplaySettings(storage)).toEqual({ renderQuality: 'crisp', uiScale: 1.15 });

    storage.setItem(RENDER_QUALITY_STORAGE_KEY, 'sharp');
    expect(loadDisplaySettings(storage).renderQuality).toBe('crisp');
  });

  it('rejects unknown settings and unsupported UI scales without writing them', () => {
    const storage = new MemoryStorage();
    storage.setItem(RENDER_QUALITY_STORAGE_KEY, 'ultra');
    storage.setItem(UI_SCALE_STORAGE_KEY, '2');
    expect(loadDisplaySettings(storage)).toEqual({ renderQuality: null, uiScale: null });
    expect(parseUiScalePreference(null)).toBeNull();
    expect(saveUiScalePreference(storage, 2)).toBe(false);
    expect(storage.getItem(UI_SCALE_STORAGE_KEY)).toBe('2');
  });
});
