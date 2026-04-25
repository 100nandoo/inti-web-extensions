<script lang="ts">
  import type { Settings } from '../shared/types.js';
  import { getStorage, setStorage } from '../shared/storage.js';
  import { STORAGE_KEY_SETTINGS } from '../shared/constants.js';

  let apiUrl = $state('');
  let instruction = $state('');
  let theme = $state<'light' | 'dark'>('light');
  let saveStatus = $state<'idle' | 'saved' | 'error'>('idle');
  let statusTimeout: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    getStorage<Settings>(STORAGE_KEY_SETTINGS).then((stored) => {
      if (stored?.apiUrl) apiUrl = stored.apiUrl;
      if (stored?.instruction) instruction = stored.instruction;
      if (stored?.theme) {
        theme = stored.theme;
        document.documentElement.setAttribute('data-theme', stored.theme);
      }
    });
  });

  async function toggleTheme() {
    theme = theme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    const stored = await getStorage<Settings>(STORAGE_KEY_SETTINGS);
    await setStorage<Settings>(STORAGE_KEY_SETTINGS, { ...(stored ?? { apiUrl }), theme });
  }

  async function save() {
    const trimmed = apiUrl.trim();
    try {
      new URL(trimmed);
    } catch {
      saveStatus = 'error';
      scheduleReset();
      return;
    }

    const stored = await getStorage<Settings>(STORAGE_KEY_SETTINGS);
    const settings: Settings = { ...(stored ?? {}), apiUrl: trimmed };
    if (instruction.trim()) {
      settings.instruction = instruction.trim();
    } else {
      delete settings.instruction;
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
    <div class="header-spacer"></div>
    <button
      class="theme-toggle"
      onclick={toggleTheme}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {#if theme === 'dark'}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
          <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
        </svg>
        <span>Light mode</span>
      {:else}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
          <path fill-rule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clip-rule="evenodd" />
        </svg>
        <span>Dark mode</span>
      {/if}
    </button>
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
  /* ─── Theme tokens ─── */
  :global(:root), :global([data-theme="light"]) {
    --bg:          #f9fafb;
    --bg-surface:  #ffffff;
    --bg-hover:    #f3f4f6;
    --text:        #111827;
    --text-secondary: #374151;
    --text-muted:  #6b7280;
    --border:      #e5e7eb;
    --border-input:#d1d5db;
    --accent:      #3b82f6;
    --accent-hover:#2563eb;
    --accent-shadow: rgba(59,130,246,0.15);
    --code-bg:     #f3f4f6;
  }

  :global([data-theme="dark"]) {
    --bg:          #0f1117;
    --bg-surface:  #1a1d27;
    --bg-hover:    #252836;
    --text:        #e2e8f0;
    --text-secondary: #cbd5e1;
    --text-muted:  #64748b;
    --border:      #252836;
    --border-input:#334155;
    --accent:      #60a5fa;
    --accent-hover:#3b82f6;
    --accent-shadow: rgba(96,165,250,0.2);
    --code-bg:     #1e2130;
  }

  :global(*, *::before, *::after) { box-sizing: border-box; }

  :global(body) {
    margin: 0;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 14px;
    color: var(--text);
    background: var(--bg);
    transition: background 0.2s, color 0.2s;
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
    border-bottom: 1px solid var(--border);
    margin-bottom: 2rem;
    transition: border-color 0.2s;
  }

  .header-spacer {
    flex: 1;
  }

  .brand {
    font-weight: 700;
    font-size: 1rem;
    color: var(--accent);
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .subtitle {
    font-size: 0.875rem;
    color: var(--text-muted);
  }

  .theme-toggle {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    background: var(--bg-surface);
    border: 1px solid var(--border-input);
    border-radius: 6px;
    padding: 0.35rem 0.7rem;
    font-size: 0.8rem;
    color: var(--text-secondary);
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }

  .theme-toggle:hover {
    background: var(--bg-hover);
    color: var(--accent);
    border-color: var(--accent);
  }

  section {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    margin-bottom: 2rem;
  }

  label {
    font-weight: 500;
    font-size: 0.875rem;
    color: var(--text);
  }

  .description {
    margin: 0 0 0.6rem;
    font-size: 0.8rem;
    color: var(--text-muted);
    line-height: 1.55;
  }

  code {
    font-family: ui-monospace, monospace;
    font-size: 0.8em;
    background: var(--code-bg);
    padding: 0.1em 0.35em;
    border-radius: 3px;
    color: var(--accent);
  }

  .input-row {
    display: flex;
    gap: 0.5rem;
  }

  input[type="url"] {
    flex: 1;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border-input);
    border-radius: 6px;
    font-size: 0.875rem;
    font-family: ui-monospace, monospace;
    background: var(--bg-surface);
    color: var(--text);
    transition: border-color 0.15s, background 0.2s;
  }

  input[type="url"]:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-shadow);
  }

  input[type="url"].invalid {
    border-color: #ef4444;
  }

  textarea {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border-input);
    border-radius: 6px;
    font-size: 0.875rem;
    font-family: ui-monospace, monospace;
    background: var(--bg-surface);
    color: var(--text);
    transition: border-color 0.15s, background 0.2s;
    resize: vertical;
    min-height: 6rem;
  }

  textarea:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-shadow);
  }

  button {
    padding: 0.5rem 1rem;
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s;
  }

  button:hover { background: var(--accent-hover); }

  .status {
    margin: 0.25rem 0 0;
    font-size: 0.8rem;
  }

  .status.success { color: #10b981; }
  .status.error   { color: #ef4444; }
</style>
