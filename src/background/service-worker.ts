/// <reference lib="webworker" />

import type { Message, ArticleData, SummaryData, Settings, SummaryResponse } from '../shared/types.js';
import { getStorage, setStorage } from '../shared/storage.js';
import { ignoreAsyncResult, runtimeSendMessage, tabsQuery, tabsSendMessage } from '../shared/webext.js';
import {
  STORAGE_KEY_LAST_SUMMARY,
  STORAGE_KEY_SETTINGS,
  STORAGE_KEY_UI_STATE,
  BADGE_LOADING,
  BADGE_SUCCESS,
  BADGE_ERROR,
} from '../shared/constants.js';

type ToolbarActionApi = {
  onClicked?: {
    addListener: (callback: (tab: chrome.tabs.Tab) => void) => void;
  };
  setBadgeText?: (details: { text: string }) => Promise<void> | void;
  setBadgeBackgroundColor?: (details: { color: string }) => Promise<void> | void;
};

function getToolbarAction(): ToolbarActionApi | undefined {
  return (chrome.action ?? chrome.browserAction) as ToolbarActionApi | undefined;
}

export function initBackground(): void {
  console.log('Inti background script loading...');

  const isAndroid = navigator.userAgent.includes('Android');
  const toolbarAction = getToolbarAction();

  // Create context menu on install
  chrome.runtime.onInstalled.addListener(() => {
    if (chrome.contextMenus) {
      chrome.contextMenus.create({
        id: 'summarize-page',
        title: 'Summarize Page with Inti',
        contexts: ['page', 'link']
      });
    }
  });

  // Handle context menu clicks
  if (chrome.contextMenus) {
    chrome.contextMenus.onClicked.addListener((info, tab) => {
      if (info.menuItemId === 'summarize-page' && tab?.id) {
        triggerFlow(tab, isAndroid);
      }
    });
  }

  chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
    if (message.action === 'TRIGGER_SUMMARY') {
      handleTriggerSummary(isAndroid).catch((err: unknown) => {
        broadcastError(String(err));
      });
      sendResponse({ ok: true });
      return false;
    }
    return false;
  });

  // Toolbar icon click → trigger summary directly (no popup)
  toolbarAction?.onClicked?.addListener((tab) => {
    console.log('Action clicked', tab.id);
    triggerFlow(tab, isAndroid);
  });
}

async function triggerFlow(tab: chrome.tabs.Tab, isAndroid: boolean) {
  if (!tab.id) {
    console.error('No tab ID in triggerFlow');
    return;
  }
  const tabId = tab.id;

  if (!isAndroid && chrome.sidePanel) {
    // Chrome desktop: open side panel first; it shows its own loading state
    ignoreAsyncResult(chrome.sidePanel.open({ tabId }));
    handleTriggerSummary(isAndroid, tabId).catch((err: unknown) => {
      broadcastError(String(err));
    });
  } else if (!isAndroid) {
    // Firefox desktop: open sidebar IMMEDIATELY to preserve user gesture
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ignoreAsyncResult((chrome as any).sidebarAction?.open?.());

    // Show loading overlay immediately for instant feedback
    ignoreAsyncResult(tabsSendMessage(tabId, { action: 'SHOW_LOADING' } satisfies Message));

    try {
      await handleTriggerSummary(isAndroid, tabId);
    } catch (err: unknown) {
      broadcastError(String(err));
    }

    // Dismiss the loading overlay once summary is ready (sidebar will show result)
    ignoreAsyncResult(tabsSendMessage(tabId, { action: 'HIDE_OVERLAY' } satisfies Message));
  } else {
    // Android: overlay shows full result inline
    console.log('Android flow started for tab', tabId);
    handleTriggerSummary(isAndroid, tabId).catch((err: unknown) => {
      console.error('Android flow error', err);
      broadcastError(String(err));
    });
  }
}

async function handleTriggerSummary(isAndroid: boolean, tabId?: number): Promise<void> {
  // 1. Show loading badge and broadcast loading state
  await setBadge(BADGE_LOADING);
  await setStorage(STORAGE_KEY_UI_STATE, 'loading');
  ignoreAsyncResult(runtimeSendMessage({ action: 'SHOW_LOADING' } satisfies Message));

  // 2. Read API URL from settings
  const settings = await getStorage<Settings>(STORAGE_KEY_SETTINGS);
  const baseUrl = settings?.apiUrl?.trim();
  if (!baseUrl) {
    await setBadge(BADGE_ERROR);
    broadcastError('API URL not configured. Open Inti settings to set it up.');
    return;
  }
  const apiUrl = baseUrl.replace(/\/$/, '') + '/api/summarize';

  // 3. Get active tab if not provided
  let targetTabId = tabId;
  if (!targetTabId) {
    const [tab] = await tabsQuery({ active: true, lastFocusedWindow: true });
    targetTabId = tab?.id;
  }

  if (!targetTabId) {
    await setBadge(BADGE_ERROR);
    broadcastError('No active tab found.');
    return;
  }

  // 4. Extract article content via content script
  let articleData: ArticleData;
  try {
    console.log('Sending EXTRACT message to tab', targetTabId);
    const response = await tabsSendMessage<ArticleData | { error: string }>(targetTabId, {
      action: 'EXTRACT',
    } satisfies Message);

    if ('error' in response) {
      throw new Error(response.error);
    }
    articleData = response;
  } catch (e) {
    console.error('Extraction failed', e);
    await setBadge(BADGE_ERROR);
    broadcastError('Could not extract content from this page. Make sure the page is fully loaded.');
    return;
  }

  // 5. Call summarization API
  let summary: string;
  try {
    console.log('Calling API', apiUrl);
    const requestBody: { text: string; instruction?: string } = {
      text: articleData.textContent,
    };
    if (settings?.instruction?.trim()) {
      requestBody.instruction = settings.instruction.trim();
    }
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (settings?.apiKey?.trim()) {
      headers['X-API-Key'] = settings.apiKey.trim();
    }

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers,
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
      ignoreAsyncResult(runtimeSendMessage({
        action: 'SUMMARY_READY',
        payload: summaryData,
      } satisfies Message));
    }

    ignoreAsyncResult(tabsSendMessage(targetTabId, {
      action: 'SHOW_OVERLAY',
      payload: summaryData,
    } satisfies Message));
    
    await setStorage(STORAGE_KEY_UI_STATE, 'idle');
  } catch (e) {
    console.error('API call failed', e);
    await setBadge(BADGE_ERROR);
    await setStorage(STORAGE_KEY_UI_STATE, 'error');
    broadcastError(String(e));
    return;
  }
}

async function setBadge(badge: { text: string; color: string }): Promise<void> {
  const toolbarAction = getToolbarAction();
  if (!toolbarAction?.setBadgeText || !toolbarAction?.setBadgeBackgroundColor) {
    return;
  }

  await Promise.all([
    Promise.resolve(toolbarAction.setBadgeText({ text: badge.text })),
    Promise.resolve(toolbarAction.setBadgeBackgroundColor({ color: badge.color })),
  ]);
}

function broadcastError(message: string): void {
  ignoreAsyncResult(runtimeSendMessage({
    action: 'ERROR',
    payload: message,
  } satisfies Message));
}
