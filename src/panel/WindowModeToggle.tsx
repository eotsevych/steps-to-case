import React, { useEffect, useState } from 'react';
import { Button } from './components/ui/button';
import { PictureInPicture2, PanelRight } from 'lucide-react';

const POPUP_WINDOW_WIDTH = 420;
const POPUP_WINDOW_HEIGHT = 720;
const HINT_STORAGE_KEY = 'qa-window-hint-shown';
const HINT_TIMEOUT_MS = 5000;

/** The panel renders in a popup window when opened with ?mode=popup (see toggleWindowMode). */
function isPopupMode(): boolean {
  return new URLSearchParams(window.location.search).get('mode') === 'popup';
}

async function openSidePanel() {
  const windows = await chrome.windows.getAll({ windowTypes: ['normal'] });
  const target = windows.find(w => w.focused) || windows[0];
  if (target?.id !== undefined) {
    await chrome.sidePanel.open({ windowId: target.id });
  }
}

async function openPopupWindow() {
  const url = chrome.runtime.getURL('sidepanel.html') + '?mode=popup';
  const { width, height } = window.screen;
  await chrome.windows.create({
    url,
    type: 'popup',
    width: POPUP_WINDOW_WIDTH,
    height: POPUP_WINDOW_HEIGHT,
    left: Math.max(0, width - POPUP_WINDOW_WIDTH - 20),
    top: Math.max(0, height - POPUP_WINDOW_HEIGHT - 80),
    focused: true,
  });
}

/**
 * Floating toggle that moves the panel between Chrome's side panel and a
 * picture-in-picture popup window. Shows a one-time hint pointing at itself.
 */
export function WindowModeToggle() {
  const [popupMode] = useState(isPopupMode);
  const [showHint, setShowHint] = useState(() => !localStorage.getItem(HINT_STORAGE_KEY));

  // Auto-dismiss the hint; clicking the toggle dismisses it through the same path.
  useEffect(() => {
    if (!showHint) return;
    const t = setTimeout(() => setShowHint(false), HINT_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [showHint]);

  // One write covers both dismissal routes.
  useEffect(() => {
    if (!showHint) localStorage.setItem(HINT_STORAGE_KEY, '1');
  }, [showHint]);

  const toggleWindowMode = async () => {
    try {
      if (popupMode) {
        await openSidePanel();
      } else {
        await openPopupWindow();
      }
    } catch (e) {
      console.error('[StepsToCase] Failed to switch window mode:', e);
      // Only the side-panel path is safe to close on failure — the popup may not exist.
      if (!popupMode) return;
    }
    window.close();
  };

  return (
    <div className="fixed bottom-2 right-2 z-50 flex flex-col items-end gap-1.5">
      {showHint && !popupMode && (
        <div className="flex items-center gap-1.5 animate-fade-up">
          <span className="text-xs text-muted-foreground bg-background/90 backdrop-blur border border-border rounded px-2 py-1 shadow-sm whitespace-nowrap">
            Open in floating window
          </span>
          <span className="text-muted-foreground">↓</span>
        </div>
      )}
      <div className="relative">
        {showHint && (
          <span className="absolute inset-0 rounded-md bg-primary/30 animate-ping" />
        )}
        <Button
          id="qa-window-mode-toggle"
          data-qa="window-mode-toggle"
          variant="ghost"
          size="icon"
          onClick={() => {
            setShowHint(false);
            void toggleWindowMode();
          }}
          title={popupMode ? 'Switch to side panel' : 'Switch to picture-in-picture window'}
          className="relative h-8 w-8 bg-background/80 backdrop-blur border border-border shadow-sm hover:bg-background"
        >
          {popupMode ? <PanelRight className="w-4 h-4" /> : <PictureInPicture2 className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}
