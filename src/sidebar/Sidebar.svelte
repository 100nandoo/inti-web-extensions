<script lang="ts">
  import type { SummaryData, UIState, Message } from '../shared/types.js';
  import { getStorage } from '../shared/storage.js';
  import { STORAGE_KEY_LAST_SUMMARY } from '../shared/constants.js';
  import SummaryView from '../content/overlay/SummaryView.svelte';
  import LoadingState from '../content/overlay/LoadingState.svelte';
  import ErrorState from '../content/overlay/ErrorState.svelte';
  import SettingsPanel from '../shared/SettingsPanel.svelte';

  let showSettings = $state(false);
  let uiState = $state<UIState>('idle');
  let summary = $state<SummaryData | null>(null);
  let errorMessage = $state('');

  $effect(() => {
    // Restore last summary from storage when sidebar opens
    getStorage<SummaryData>(STORAGE_KEY_LAST_SUMMARY).then((stored) => {
      if (stored) {
        summary = stored;
        uiState = 'done';
      }
    });

    // Listen for updates from the service worker
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

  function triggerSummary() {
    uiState = 'loading';
    errorMessage = '';
    chrome.runtime.sendMessage({ action: 'TRIGGER_SUMMARY' } satisfies Message).catch(() => {});
  }
</script>

<div class="root">
  <header>
    <span class="brand">Inti</span>
    <div class="header-actions">
      <button
        class="summarize-btn"
        onclick={triggerSummary}
        disabled={uiState === 'loading'}
      >
        {uiState === 'loading' ? 'Summarizing…' : 'Summarize'}
      </button>
      <button
        class="icon-btn"
        onclick={() => (showSettings = !showSettings)}
        aria-label="Settings"
        aria-pressed={showSettings}
      >⚙</button>
    </div>
  </header>

  {#if showSettings}
    <SettingsPanel onclose={() => (showSettings = false)} />
  {/if}

  <div class="body">
    {#if uiState === 'loading'}
      <LoadingState />
    {:else if uiState === 'done' && summary}
      <SummaryView {summary} />
    {:else if uiState === 'error'}
      <ErrorState message={errorMessage} />
    {:else}
      <div class="empty">
        <p>Open an article and click <strong>Summarize</strong> to get started.</p>
      </div>
    {/if}
  </div>
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
    height: 100vh;
    overflow: hidden;
  }

  .root {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.875rem 1rem;
    border-bottom: 1px solid #f3f4f6;
    flex-shrink: 0;
  }

  .brand {
    font-weight: 700;
    font-size: 0.875rem;
    color: #3b82f6;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .icon-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: #9ca3af;
    font-size: 1rem;
    padding: 0.2rem;
    border-radius: 4px;
    line-height: 1;
    transition: color 0.15s;
  }

  .icon-btn:hover,
  .icon-btn[aria-pressed="true"] { color: #3b82f6; }

  .summarize-btn {
    padding: 0.4rem 0.9rem;
    background: #3b82f6;
    color: #ffffff;
    border: none;
    border-radius: 6px;
    font-size: 0.8rem;
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

  .body {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
  }

  .empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
  }

  .empty p {
    margin: 0;
    color: #9ca3af;
    font-size: 0.875rem;
    line-height: 1.6;
    max-width: 200px;
  }
</style>
