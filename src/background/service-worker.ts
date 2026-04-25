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
  } catch (e) {
    await setBadge(BADGE_ERROR);
    broadcastError(String(e));
    return;
  }

  // 6. Persist result
  const summaryData: SummaryData = {
    summary,
    articleTitle: articleData.title,
    timestamp: Date.now(),
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
