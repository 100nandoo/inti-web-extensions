<script lang="ts">
  import type { SummaryData, UIState, Message } from '../shared/types.js';
  import { getStorage } from '../shared/storage.js';
  import { STORAGE_KEY_LAST_SUMMARY } from '../shared/constants.js';
  import SummaryView from '../content/overlay/SummaryView.svelte';
  import LoadingState from '../content/overlay/LoadingState.svelte';
  import ErrorState from '../content/overlay/ErrorState.svelte';

  const isAndroid = navigator.userAgent.includes('Android');

  let uiState = $state<UIState>('idle');
  let summary = $state<SummaryData | null>(null);
  let errorMessage = $state('');

  $effect(() => {
    // Restore last summary from storage on open
    getStorage<SummaryData>(STORAGE_KEY_LAST_SUMMARY).then((stored) => {
      if (stored) {
        summary = stored;
        uiState = 'done';
      }
    });

    // Listen for real-time updates from the service worker
    function onMessage(message: Message) {
      if (message.action === 'SUMMARY_READY') {
        summary = message.payload as SummaryData;
        uiState = 'done';
      } else if (message.action === 'ERROR') {
        errorMessage = message.payload as string;
        uiState = 'error';
      }
    }
    chrome.runtime.onMessage.addListener(onMessage);
    return () => chrome.runtime.onMessage.removeListener(onMessage);
  });

  async function triggerSummary() {
    uiState = 'loading';
    errorMessage = '';
    chrome.runtime.sendMessage({ action: 'TRIGGER_SUMMARY' } satisfies Message).catch(() => {});

    // On Chrome desktop, open the side panel
    if (!isAndroid && chrome.sidePanel) {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab.id) await chrome.sidePanel.open({ tabId: tab.id });
      } catch {
        // sidePanel.open may fail on restricted pages — ignore
      }
    }
  }
</script>

<div class="root">
  <header>
    <span class="brand">Inti</span>
  </header>

  {#if !isAndroid}
    <!-- Desktop: launcher only — results appear in the sidebar -->
    <div class="launcher">
      <button
        class="summarize-btn"
        onclick={triggerSummary}
        disabled={uiState === 'loading'}
      >
        {uiState === 'loading' ? 'Summarizing…' : 'Summarize Article'}
      </button>
      {#if uiState === 'loading'}
        <p class="hint">Opening sidebar…</p>
      {:else}
        <p class="hint">Results appear in the sidebar</p>
      {/if}
    </div>
  {:else}
    <!-- Android: full UI in popup -->
    <div class="full-ui">
      <button
        class="summarize-btn"
        onclick={triggerSummary}
        disabled={uiState === 'loading'}
      >
        {uiState === 'loading' ? 'Summarizing…' : 'Summarize Article'}
      </button>

      {#if uiState === 'loading'}
        <LoadingState />
      {:else if uiState === 'done' && summary}
        <SummaryView {summary} />
      {:else if uiState === 'error'}
        <ErrorState message={errorMessage} />
      {/if}
    </div>
  {/if}
</div>

<style>
  :global(*, *::before, *::after) {
    box-sizing: border-box;
  }

  :global(body) {
    margin: 0;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 14px;
    color: #111827;
    background: #ffffff;
  }

  .root {
    display: flex;
    flex-direction: column;
    min-width: 260px;
  }

  header {
    display: flex;
    align-items: center;
    padding: 0.75rem 1rem 0.5rem;
    border-bottom: 1px solid #f3f4f6;
  }

  .brand {
    font-weight: 700;
    font-size: 0.875rem;
    color: #3b82f6;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .launcher,
  .full-ui {
    padding: 0.875rem 1rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .full-ui {
    max-width: 340px;
  }

  .summarize-btn {
    width: 100%;
    padding: 0.55rem 1rem;
    background: #3b82f6;
    color: #ffffff;
    border: none;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
  }

  .summarize-btn:hover:not(:disabled) {
    background: #2563eb;
  }

  .summarize-btn:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }

  .hint {
    margin: 0;
    font-size: 0.75rem;
    color: #9ca3af;
    text-align: center;
  }
</style>
