# Inti

> **Inti** (Bahasa Indonesia: *core, essence*) — a browser extension that summarizes any article using AI.

Works on Chrome, Firefox, and Firefox Android. Requires a self-hosted API — see [inti-api](https://github.com/your-org/inti-api) to set one up.

---

## Install

Download the latest release for your browser from the [Releases](../../releases) page, then follow the steps for your browser below.

### Chrome

1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the `chrome/` folder from the release zip

### Firefox Desktop

1. Go to `about:debugging` → **This Firefox**
2. Click **Load Temporary Add-on**
3. Select `manifest.json` from the `firefox-desktop/` folder

### Firefox Android

1. Install [Firefox for Android](https://www.mozilla.org/firefox/android/)
2. Go to **Settings → About Firefox** and tap the version number 5 times to enable debug mode
3. On your desktop, go to `about:debugging` → **Setup** and connect your device via USB
4. Once connected, select your device and click **Load Temporary Add-on**
5. Select `manifest.json` from the `firefox-android/` folder

---

## Setup

### 1. Deploy the API

Set up your own instance of [inti-api](https://github.com/your-org/inti-api) and note the URL of your `/summarize` endpoint.

### 2. Configure the extension

After installing Inti, open its settings (right-click the extension icon → **Options**, or find it in your browser's extension manager) and paste in your API URL.

---

## How it works

Click the Inti icon on any article page and hit **Summarize Article**. Inti extracts the article text, sends it to your API, and shows the summary:

- **Chrome** — in the side panel
- **Firefox desktop** — in the sidebar
- **Firefox Android** — as an overlay on the page

The last summary is saved locally and restored the next time you open the extension.

---

## Contributing

See [docs/contributing.md](docs/contributing.md) for the development setup, build commands, and project architecture.
