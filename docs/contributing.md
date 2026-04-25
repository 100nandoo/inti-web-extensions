# Contributing to Inti

## Table of Contents

- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Development](#development)
- [Building](#building)
- [Packaging for release](#packaging-for-release)
- [Project structure](#project-structure)
- [Architecture](#architecture)
- [Message types](#message-types)
- [Tech stack](#tech-stack)

---

## Prerequisites

- Node.js 18+
- [pnpm](https://pnpm.io/installation)

## Setup

```bash
pnpm install
pnpm run icons   # generate placeholder icons (first time only)
```

## Development

```bash
pnpm run dev
```

Vite watches `src/` and rebuilds to `build/` on every change. To load the extension during development, run a full build first (see below) then reload the unpacked extension in your browser.

## Building

```bash
# All three targets at once
pnpm run build

# Individual targets
pnpm run build:chrome
pnpm run build:firefox-desktop
pnpm run build:firefox-android
```

Output lands in `dist/{target}/` — load this folder as an unpacked extension in your browser.

## Packaging for release

```bash
pnpm run package:chrome           # → dist/chrome.zip
pnpm run package:firefox-desktop  # → dist/firefox-desktop.zip
pnpm run package:firefox-android  # → dist/firefox-android.zip
```

## Project structure

```
src/
├── background/
│   └── service-worker.ts      # Message hub, API call, badge updates
├── content/
│   ├── content-script.ts      # Readability extraction + Shadow DOM mount
│   └── overlay/
│       ├── Overlay.svelte     # Root overlay (injected into closed Shadow DOM)
│       ├── SummaryView.svelte
│       ├── LoadingState.svelte
│       └── ErrorState.svelte
├── sidebar/
│   ├── sidebar.html
│   ├── sidebar.ts
│   └── Sidebar.svelte
├── popup/
│   ├── popup.html
│   ├── popup.ts
│   └── Popup.svelte           # Desktop launcher / Android full UI
├── options/
│   ├── options.html
│   ├── options.ts
│   └── Options.svelte         # Settings page (API URL)
└── shared/
    ├── types.ts               # Shared TypeScript types
    ├── constants.ts           # Storage keys and badge config
    └── storage.ts             # chrome.storage.local typed wrappers

manifests/
├── base.json                  # Shared MV3 manifest
├── chrome.json                # Adds sidePanel
├── firefox-desktop.json       # Adds sidebar_action
└── firefox-android.json       # Adds gecko_android settings

scripts/
├── build-manifests.ts         # Deep-merges base + target overlay → dist/{target}/
└── generate-icons.ts          # Generates placeholder PNG icons
```

## Architecture

```
User click
    │
    ▼
Popup / Sidebar
    │  TRIGGER_SUMMARY
    ▼
Service Worker ──── badge: …
    │  reads apiUrl from storage
    │  EXTRACT
    ▼
Content Script (Readability)
    │  ArticleData
    ▼
Service Worker ──── POST apiUrl ──── { summary }
    │                                     │
    │  save to chrome.storage.local ◄─────┘
    │
    ├── badge: ✓ / !
    ├── SUMMARY_READY → Sidebar / Popup
    └── SHOW_OVERLAY → Content Script
                           │
                           ▼
                    Shadow DOM (closed)
                    Overlay.svelte
```

**Platform routing:**

| Platform | Primary UI | SUMMARY_READY | SHOW_OVERLAY |
|---|---|---|---|
| Chrome desktop | Side panel | ✓ | ✓ |
| Firefox desktop | Sidebar | ✓ | ✓ |
| Firefox Android | Page overlay | — | ✓ |

## Message types

Defined in `src/shared/types.ts`:

| Action | Direction | Payload |
|---|---|---|
| `TRIGGER_SUMMARY` | Popup/Sidebar → SW | — |
| `EXTRACT` | SW → Content Script | — |
| `SHOW_OVERLAY` | SW → Content Script | `SummaryData` |
| `SUMMARY_READY` | SW → Popup/Sidebar | `SummaryData` |
| `ERROR` | SW → Popup/Sidebar | `string` |

## Tech stack

| Concern | Choice |
|---|---|
| Build | Vite 5 + Rollup |
| Language | TypeScript (strict) |
| UI | Svelte 5 (runes API) |
| Styling | Scoped CSS in `<style>` blocks |
| Extraction | `@mozilla/readability` |
| State | `chrome.storage.local` |
| Overlay isolation | Closed Shadow DOM |
| Manifest | MV3 unified base + per-target overlays |
