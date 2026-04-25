/// <reference lib="webworker" />

import type { Message, ArticleData, SummaryData, Settings, SummaryResponse } from '../shared/types.js';
import { getStorage, setStorage } from '../shared/storage.js';
import {
  STORAGE_KEY_LAST_SUMMARY,
  STORAGE_KEY_SETTINGS,
  BADGE_LOADING,
  BADGE_SUCCESS,
  BADGE_ERROR,
} from '../shared/constants.js';

const isAndroid = navigator.userAgent.includes('Android');

// Create context menu on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'summarize-page',
    title: 'Summarize Page with Inti',
    contexts: ['page', 'link']
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'summarize-page' && tab?.id) {
    triggerFlow(tab);
  }
});

chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  if (message.action === 'TRIGGER_SUMMARY') {
    handleTriggerSummary().catch((err: unknown) => {
      broadcastError(String(err));
    });
    sendResponse({ ok: true });
    return false;
  }
  return false;
});

// Toolbar icon click → trigger summary directly (no popup)
chrome.action.onClicked.addListener((tab) => {
  triggerFlow(tab);
});

async function triggerFlow(tab: chrome.tabs.Tab) {
  if (!tab.id) return;
  const tabId = tab.id;

  if (!isAndroid && chrome.sidePanel) {
    // Chrome desktop: open side panel first; it shows its own loading state
    chrome.sidePanel.open({ tabId }).catch(() => {});
    handleTriggerSummary().catch((err: unknown) => {
      broadcastError(String(err));
    });
  } else if (!isAndroid) {
    // Firefox desktop: open sidebar IMMEDIATELY to preserve user gesture
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (chrome as any).sidebarAction?.open?.().catch?.(() => {});

    // Show loading overlay immediately for instant feedback
    chrome.tabs.sendMessage(tabId, { action: 'SHOW_LOADING' } satisfies Message).catch(() => {});

    try {
      await handleTriggerSummary();
    } catch (err: unknown) {
      broadcastError(String(err));
    }

    // Dismiss the loading overlay once summary is ready (sidebar will show result)
    chrome.tabs.sendMessage(tabId, { action: 'HIDE_OVERLAY' } satisfies Message).catch(() => {});
  } else {
    // Android: overlay shows full result inline
    handleTriggerSummary().catch((err: unknown) => {
      broadcastError(String(err));
    });
  }
}

async function handleTriggerSummary(): Promise<void> {
  // 1. Show loading badge
  await setBadge(BADGE_LOADING);

  // 2. Read API URL from settings
  const settings = await getStorage<Settings>(STORAGE_KEY_SETTINGS);
  const baseUrl = settings?.apiUrl?.trim();
  if (!baseUrl) {
    await setBadge(BADGE_ERROR);
    broadcastError('API URL not configured. Open Inti settings to set it up.');
    return;
  }
  const apiUrl = baseUrl.replace(/\/$/, '') + '/api/summarize';

  // 3. Get active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab.id) {
    await setBadge(BADGE_ERROR);
    broadcastError('No active tab found.');
    return;
  }
  const tabId = tab.id;

  // 4. Extract article content via content script
  let articleData: ArticleData;
  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      action: 'EXTRACT',
    } satisfies Message) as ArticleData | { error: string };

    if ('error' in response) {
      throw new Error(response.error);
    }
    articleData = response;
  } catch (e) {
    await setBadge(BADGE_ERROR);
    broadcastError(String(e));
    return;
  }

  // 5. Call summarization API
  let summary: string;
  try {
    const requestBody: { text: string; instruction?: string } = {
      text: articleData.textContent,
    };
    if (settings?.instruction?.trim()) {
      requestBody.instruction = settings.instruction.trim();
    }

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      throw new Error(`API responded with status ${res.status}`);
    }

    const json = await res.json() as SummaryResponse;
    summary = json.summary;
    const provider = json.provider;
    const model = json.model;

    // 6. Persist result
    const summaryData: SummaryData = {
      summary,
      articleTitle: articleData.title,
      timestamp: Date.now(),
      provider,
      model,
    };
    await setStorage(STORAGE_KEY_LAST_SUMMARY, summaryData);

    // 7. Success badge
    await setBadge(BADGE_SUCCESS);

    // 8. Route to UI surfaces
    if (!isAndroid) {
      chrome.runtime.sendMessage({
        action: 'SUMMARY_READY',
        payload: summaryData,
      } satisfies Message).catch(() => {});
    }

    chrome.tabs.sendMessage(tabId, {
      action: 'SHOW_OVERLAY',
      payload: summaryData,
    } satisfies Message).catch(() => {});
  } catch (e) {
    await setBadge(BADGE_ERROR);
    broadcastError(String(e));
    return;
  }
}

async function setBadge(badge: { text: string; color: string }): Promise<void> {
  await Promise.all([
    chrome.action.setBadgeText({ text: badge.text }),
    chrome.action.setBadgeBackgroundColor({ color: badge.color }),
  ]);
}

function broadcastError(message: string): void {
  chrome.runtime.sendMessage({
    action: 'ERROR',
    payload: message,
  } satisfies Message).catch(() => {});
}
