<script lang="ts">
  import type { SummaryData } from '../../shared/types.js';

  let { summary }: { summary: SummaryData } = $props();

  let copied = $state(false);
  let copyTimeout: ReturnType<typeof setTimeout> | null = null;

  const formattedDate = $derived(
    new Date(summary.timestamp).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  );

  async function copyToClipboard() {
    await navigator.clipboard.writeText(summary.summary);
    copied = true;
    if (copyTimeout) clearTimeout(copyTimeout);
    copyTimeout = setTimeout(() => {
      copied = false;
      copyTimeout = null;
    }, 2000);
  }
</script>

<div class="summary">
  <h2 class="title">{summary.articleTitle}</h2>
  <p class="meta">Summarized {formattedDate}</p>
  <p class="text">{summary.summary}</p>
  <button class="copy-btn" onclick={copyToClipboard}>
    {copied ? '✓ Copied!' : 'Copy to clipboard'}
  </button>
</div>

<style>
  .summary {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .title {
    font-size: 0.95rem;
    font-weight: 600;
    margin: 0;
    color: #111827;
    line-height: 1.4;
  }

  .meta {
    font-size: 0.75rem;
    color: #9ca3af;
    margin: 0;
  }

  .text {
    font-size: 0.875rem;
    line-height: 1.65;
    color: #374151;
    margin: 0.25rem 0 0;
    white-space: pre-wrap;
  }

  .copy-btn {
    align-self: flex-start;
    margin-top: 0.5rem;
    padding: 0.35rem 0.8rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    background: #f9fafb;
    color: #374151;
    font-size: 0.8rem;
    cursor: pointer;
    transition: background 0.15s;
  }

  .copy-btn:hover {
    background: #f3f4f6;
  }
</style>
