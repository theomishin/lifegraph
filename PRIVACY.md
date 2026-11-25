# Privacy

LifeGraph has no servers. There is nothing to sign up for, nothing that phones home, and nothing for us to leak, because we never receive anything.

- **No accounts, no telemetry, no update checks.** The door makes no network calls; CI fails the build if network code appears in `door/`. The installer downloads the code from GitHub once, and npm packages once.
- **Your files stay on your devices.** LifeGraph is a normal folder. The installer puts it in iCloud Drive when that is on, so it syncs to your iPhone through your own Apple account; otherwise it stays on the Mac.
- **The one real exception:** when an AI assistant reads a file from your LifeGraph, that text is sent to that assistant's company, like anything else you type to it. Lock notes you never want sent to any AI (`lifegraph lock <note>`): the door never shows, searches or edits them. They still sync through iCloud like any other file.
- **The website** is static, with no analytics, no cookies and no third-party requests. The demo runs entirely in your browser.

Found a privacy problem? Open an issue, or for something sensitive use GitHub's private vulnerability reporting on this repo.
