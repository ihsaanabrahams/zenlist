import { invoke } from '@tauri-apps/api/core';

const BROWSER_STORAGE_KEY = 'zenlist.memo';
const BROWSER_PIN_KEY = 'zenlist.pinned';

function isTauriRuntime() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function formatDate(value) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(value);
}

function createBlankMemo() {
  return {
    date: formatDate(new Date()),
    tasks: Array.from({ length: 5 }, () => ({ text: '', completed: false, details: '' })),
  };
}

function readBrowserMemo() {
  try {
    const raw = localStorage.getItem(BROWSER_STORAGE_KEY);
    if (!raw) {
      const blank = createBlankMemo();
      localStorage.setItem(BROWSER_STORAGE_KEY, JSON.stringify(blank));
      return blank;
    }

    const parsed = JSON.parse(raw);
    return parsed;
  } catch (error) {
    console.error('Failed to read browser memo state', error);
    return createBlankMemo();
  }
}

function writeBrowserMemo(memo) {
  localStorage.setItem(BROWSER_STORAGE_KEY, JSON.stringify(memo));
  return memo;
}

export function loadMemo() {
  if (!isTauriRuntime()) {
    return Promise.resolve(readBrowserMemo());
  }

  return invoke('load_memo');
}

export function saveMemo(memo) {
  if (!isTauriRuntime()) {
    return Promise.resolve(writeBrowserMemo(memo));
  }

  return invoke('save_memo', { memo });
}

export function resetMemo() {
  if (!isTauriRuntime()) {
    return Promise.resolve(writeBrowserMemo(createBlankMemo()));
  }

  return invoke('reset_memo');
}

export function confirmClear() {
  if (!isTauriRuntime()) {
    return Promise.resolve(window.confirm('Clear all five tasks?'));
  }

  return invoke('confirm_clear');
}

export function showMainWindow() {
  if (!isTauriRuntime()) {
    return Promise.resolve();
  }

  return invoke('show_main_window');
}

export function isWindowPinned() {
  if (!isTauriRuntime()) {
    return Promise.resolve(localStorage.getItem(BROWSER_PIN_KEY) === 'true');
  }

  return invoke('is_window_pinned');
}

export function setWindowPinned(pinned) {
  if (!isTauriRuntime()) {
    localStorage.setItem(BROWSER_PIN_KEY, String(Boolean(pinned)));
    return Promise.resolve(Boolean(pinned));
  }

  return invoke('set_window_pinned', { pinned: Boolean(pinned) });
}

export function quitApp() {
  if (!isTauriRuntime()) {
    return Promise.resolve();
  }

  return invoke('quit_app');
}