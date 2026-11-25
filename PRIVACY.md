# Privacy

LifeGraph has no servers. There is nothing to sign up for, nothing that phones home, and nothing for us to leak, because we never receive anything.

- **No accounts, no telemetry, no update checks.** The LifeGraph server makes no network calls; CI fails the build if network code appears in `server/`.
- **Your files stay on your computer.** The vault is a normal folder. Sync it however you like (iCloud Drive, Syncthing, a private git repo), or not at all.
- **The one real exception:** when an AI assistant reads a file from your LifeGraph, that text is sent to that assistant's company, like anything else you type to it. Use `privacy: private` on files you never want sent to a cloud model, and give each app a privacy ceiling.
- **The website** is static, with no analytics, no cookies and no third-party requests. The demo runs entirely in your browser.

Found a privacy problem? Open an issue, or for something sensitive use GitHub's private vulnerability reporting on this repo.
