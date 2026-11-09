import { useEffect, useState } from 'react';
import { FONT_SCALE_PX, loadSettings, type FontScale } from '../lib/settings';

/** The subset of RecorderSettings the panel renders against. */
export interface PanelSettings {
  debugMode: boolean;
  darkMode: boolean;
  fontScale: FontScale;
}

const initialSettings: PanelSettings = {
  debugMode: false,
  darkMode: false,
  fontScale: 'medium',
};

/**
 * Loads the panel-facing settings and keeps them in sync with the options page,
 * which lives in a separate document and writes to chrome.storage.sync.
 * Also applies the two settings that are pure document side effects: the `dark`
 * class Tailwind's `dark:` variant keys off, and the root font-size every
 * rem-based text size in the panel cascades from (see index.css).
 */
export function usePanelSettings(): PanelSettings {
  const [settings, setSettings] = useState<PanelSettings>(initialSettings);

  useEffect(() => {
    let cancelled = false;
    loadSettings().then(s => {
      if (cancelled) return;
      setSettings({
        debugMode: !!s.debugMode,
        darkMode: !!s.darkMode,
        fontScale: s.fontScale,
      });
    });

    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName !== 'sync' || !changes.recorderSettings) return;
      const updated = changes.recorderSettings.newValue;
      if (!updated) return;
      setSettings(prev => ({
        ...prev,
        debugMode: !!updated.debugMode,
        darkMode: !!updated.darkMode,
        fontScale: updated.fontScale === 'small' || updated.fontScale === 'large' ? updated.fontScale : 'medium',
      }));
    };
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => {
      cancelled = true;
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.darkMode);
    document.body.style.margin = '0';
  }, [settings.darkMode]);

  useEffect(() => {
    document.documentElement.style.setProperty('--font-size', `${FONT_SCALE_PX[settings.fontScale]}px`);
  }, [settings.fontScale]);

  return settings;
}
