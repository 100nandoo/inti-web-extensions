<script lang="ts">
  import type { Settings } from './types.js';
  import { getStorage, setStorage } from './storage.js';
  import { STORAGE_KEY_SETTINGS } from './constants.js';

  let { onclose }: { onclose?: () => void } = $props();

  let apiUrl = $state('');
  let saveStatus = $state<'idle' | 'saved' | 'error'>('idle');
  let statusTimeout: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    getStorage<Settings>(STORAGE_KEY_SETTINGS).then((stored) => {
      if (stored?.apiUrl) apiUrl = stored.apiUrl;
    });
  });

  async function save() {
    const trimmed = apiUrl.trim();
    try {
      new URL(trimmed);
    } catch {
      saveStatus = 'error';
      scheduleReset();
      return;
    }
    await setStorage<Settings>(STORAGE_KEY_SETTINGS, { apiUrl: trimmed });
    saveStatus = 'saved';
    scheduleReset();
  }

  function scheduleReset() {
    if (statusTimeout) clearTimeout(statusTimeout);
    statusTimeout = setTimeout(() => {
      saveStatus = 'idle';
      statusTimeout = null;
    }, 2500);
  }
</script>

<div class="panel">
  <div class="panel-header">
    <span class="panel-title">Settings</span>
    {#if onclose}
      <button class="close-btn" onclick={onclose} aria-label="Close settings">✕</button>
    {/if}
  </div>

  <div class="field">
    <label for="sp-api-url">API URL</label>
    <div class="input-row">
      <input
        id="sp-api-url"
        type="url"
        placeholder="https://your-api.com/summarize"
        bind:value={apiUrl}
        onkeydown={(e) => e.key === 'Enter' && save()}
        class:invalid={saveStatus === 'error'}
      />
      <button onclick={save}>Save</button>
    </div>
    {#if saveStatus === 'saved'}
      <span class="status success">Saved.</span>
    {:else if saveStatus === 'error'}
      <span class="status error">Enter a valid URL.</span>
    {/if}
  </div>
</div>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.875rem 1rem 1rem;
    border-top: 1px solid #f3f4f6;
    background: #fafafa;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .panel-title {
    font-size: 0.8rem;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .close-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: #9ca3af;
    font-size: 0.75rem;
    padding: 0.2rem 0.4rem;
    border-radius: 4px;
    line-height: 1;
  }

  .close-btn:hover { color: #111827; background: #f3f4f6; }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  label {
    font-size: 0.75rem;
    font-weight: 500;
    color: #374151;
  }

  .input-row {
    display: flex;
    gap: 0.4rem;
  }

  input[type="url"] {
    flex: 1;
    padding: 0.4rem 0.6rem;
    border: 1px solid #d1d5db;
    border-radius: 5px;
    font-size: 0.8rem;
    font-family: ui-monospace, monospace;
    background: #fff;
    transition: border-color 0.15s;
  }

  input[type="url"]:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
  }

  input.invalid { border-color: #ef4444; }

  button {
    padding: 0.4rem 0.9rem;
    background: #3b82f6;
    color: #fff;
    border: none;
    border-radius: 5px;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s;
  }

  button:hover { background: #2563eb; }

  .status {
    font-size: 0.75rem;
  }

  .status.success { color: #10b981; }
  .status.error   { color: #ef4444; }
</style>
