import type { RenderQuality } from '../engine/SceneRenderer';
import { parseRenderQualityPreference } from '../engine/SceneRenderer';

export const RENDER_QUALITY_STORAGE_KEY = 'aether_fps_render_quality_r6f1';
export const UI_SCALE_STORAGE_KEY = 'aether_fps_ui_scale_r6f3';
export const UI_SCALE_VALUES = [0.9, 1, 1.15, 1.25] as const;
export type UiScale = typeof UI_SCALE_VALUES[number];

export interface DisplaySettingsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function isUiScaleValue(value: number): value is UiScale {
  return UI_SCALE_VALUES.includes(value as UiScale);
}

export function parseUiScalePreference(value: string | null): UiScale | null {
  if (value === null) return null;
  const scale = Number(value);
  return isUiScaleValue(scale) ? scale : null;
}

export function loadDisplaySettings(storage: Pick<DisplaySettingsStorage, 'getItem'>): { renderQuality: RenderQuality | null; uiScale: UiScale | null } {
  return {
    renderQuality: parseRenderQualityPreference(storage.getItem(RENDER_QUALITY_STORAGE_KEY)),
    uiScale: parseUiScalePreference(storage.getItem(UI_SCALE_STORAGE_KEY)),
  };
}

export function saveRenderQualityPreference(storage: Pick<DisplaySettingsStorage, 'setItem'>, quality: RenderQuality): void {
  storage.setItem(RENDER_QUALITY_STORAGE_KEY, quality);
}

export function saveUiScalePreference(storage: Pick<DisplaySettingsStorage, 'setItem'>, scale: number): boolean {
  if (!isUiScaleValue(scale)) return false;
  storage.setItem(UI_SCALE_STORAGE_KEY, String(scale));
  return true;
}
