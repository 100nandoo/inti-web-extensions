<script lang="ts">
  import type { Settings } from '../shared/types.js';
  import { getStorage, setStorage } from '../shared/storage.js';
  import { STORAGE_KEY_SETTINGS } from '../shared/constants.js';

  let apiUrl = $state('');
  let instruction = $state('');
  let saveStatus = $state<'idle' | 'saved' | 'error'>('idle');
  let statusTimeout: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    getStorage<Settings>(STORAGE_KEY_SETTINGS).then((stored) => {
      if (stored?.apiUrl) apiUrl = stored.apiUrl;
      if (stored?.instruction) instruction = stored.instruction;
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

    const settings: Settings = { apiUrl: trimmed };
    if (instruction.trim()) {
      settings.instruction = instruction.trim();
    }
    await setStorage<Settings>(STORAGE_KEY_SETTINGS, settings);
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

<div class="page">
  <header>
    <span class="brand">Inti</span>
    <span class="subtitle">Settings</span>
  </header>

  <main>
    <section>
      <label for="api-url">Inti Server URL</label>
      <p class="description">
        The base URL of your Inti server. The extension will POST to
        <code>/api/summarize</code> on this server.
      </p>
      <div class="input-row">
        <input
          id="api-url"
          type="url"
          placeholder="http://127.0.0.1:8080"
          bind:value={apiUrl}
          onkeydown={(e) => e.key === 'Enter' && save()}
          class:invalid={saveStatus === 'error'}
        />
        <button onclick={save}>Save</button>
      </div>
      {#if saveStatus === 'saved'}
        <p class="status success">Saved.</p>
      {:else if saveStatus === 'error'}
        <p class="status error">Enter a valid URL.</p>
      {/if}
    </section>

    <section>
      <label for="instruction">Summarization Instruction</label>
      <p class="description">
        Optional: provide custom instructions for how the API should summarize articles.
        If left empty, the API will use its default summarization prompt.
      </p>
      <textarea
        id="instruction"
        placeholder="e.g., Summarize in 2-3 sentences, focusing on key facts..."
        bind:value={instruction}
        onkeydown={(e) => (e.ctrlKey || e.metaKey) && e.key === 'Enter' && save()}
      ></textarea>
      <button onclick={save}>Save</button>
    </section>
  </main>
</div>

<style>
  :global(*, *::before, *::after) { box-sizing: border-box; }

  :global(body) {
    margin: 0;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 14px;
    color: #111827;
    background: #f9fafb;
  }

  .page {
    max-width: 560px;
    margin: 0 auto;
    padding: 0 1.5rem 3rem;
  }

  header {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    padding: 1.75rem 0 1.5rem;
    border-bottom: 1px solid #e5e7eb;
    margin-bottom: 2rem;
  }

  .brand {
    font-weight: 700;
    font-size: 1rem;
    color: #3b82f6;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .subtitle {
    font-size: 0.875rem;
    color: #6b7280;
  }

  section {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  label {
    font-weight: 500;
    font-size: 0.875rem;
  }

  .description {
    margin: 0 0 0.6rem;
    font-size: 0.8rem;
    color: #6b7280;
    line-height: 1.55;
  }

  code {
    font-family: ui-monospace, monospace;
    font-size: 0.8em;
    background: #f3f4f6;
    padding: 0.1em 0.35em;
    border-radius: 3px;
  }

  .input-row {
    display: flex;
    gap: 0.5rem;
  }

  input[type="url"] {
    flex: 1;
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.875rem;
    font-family: ui-monospace, monospace;
    background: #fff;
    transition: border-color 0.15s;
  }

  input[type="url"]:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
  }

  input[type="url"].invalid {
    border-color: #ef4444;
  }

  textarea {
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.875rem;
    font-family: ui-monospace, monospace;
    background: #fff;
    transition: border-color 0.15s;
    resize: vertical;
    min-height: 6rem;
  }

  textarea:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
  }

  button {
    padding: 0.5rem 1rem;
    background: #3b82f6;
    color: #fff;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s;
  }

  button:hover { background: #2563eb; }

  .status {
    margin: 0.25rem 0 0;
    font-size: 0.8rem;
  }

  .status.success { color: #10b981; }
  .status.error   { color: #ef4444; }
</style>
