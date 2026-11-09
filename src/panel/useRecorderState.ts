import { useCallback, useEffect, useRef, useState } from 'react';
import type { RecordingState } from '../types';

const defaultState: RecordingState = {
  phase: 'idle',
  mode: 'full',
  testMetadata: {},
  actions: [],
  pages: [],
  manualSteps: [],
  preconditions: [],
  startTime: undefined,
  isElementPickerActive: false,
};

export function useRecorderState() {
  const [state, setState] = useState<RecordingState>(defaultState);
  // Keep a ref to the current port so reconnect logic always uses the latest one.
  const portRef = useRef<chrome.runtime.Port | null>(null);
  const destroyedRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    destroyedRef.current = false;

    function fetchState() {
      chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
        if (chrome.runtime.lastError) return; // SW may still be starting
        if (response) setState(response);
      });
    }

    function connect() {
      if (destroyedRef.current) return;

      const port = chrome.runtime.connect({ name: 'panel' });
      portRef.current = port;

      // The SW sends STATE_UPDATED immediately on connect (after restoreState).
      // Also handle it here in case the port message arrives before the runtime listener.
      port.onMessage.addListener((message: { type: string; state: RecordingState }) => {
        if (message.type === 'STATE_UPDATED' && message.state) {
          setState(message.state);
        }
      });

      port.onDisconnect.addListener(() => {
        // Port disconnected — the service worker was killed by Chrome.
        // Reconnect so the keepalive is re-established and re-fetch state.
        portRef.current = null;
        if (!destroyedRef.current) {
          // Small delay to let the SW finish restarting before we connect.
          reconnectTimerRef.current = setTimeout(() => {
            reconnectTimerRef.current = null;
            connect();
            fetchState();
          }, 200);
        }
      });
    }

    connect();
    fetchState();

    // Listen for state updates pushed by the service worker
    const listener = (message: { type: string; state: RecordingState }) => {
      if (message.type === 'STATE_UPDATED') {
        setState(message.state);
      }
    };
    chrome.runtime.onMessage.addListener(listener);

    return () => {
      destroyedRef.current = true;
      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      chrome.runtime.onMessage.removeListener(listener);
      portRef.current?.disconnect();
      portRef.current = null;
    };
  }, []);

  const send = useCallback((message: Record<string, unknown>) => {
    return new Promise<void>((resolve) => {
      chrome.runtime.sendMessage(message, () => {
        if (chrome.runtime.lastError) {
          // SW was restarting; retry once after a short delay.
          setTimeout(() => {
            chrome.runtime.sendMessage(message, () => resolve());
          }, 300);
        } else {
          resolve();
        }
      });
    });
  }, []);

  return { state, send };
}
