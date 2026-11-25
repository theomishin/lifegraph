# Changelog

## Unreleased
- Windows and Linux. `install.ps1` is a one-command Windows installer (no administrator rights), and `install.sh` now works on Linux too. On both, LifeGraph is a plain folder you sync however you like.
- `lifegraph service install|uninstall|status` runs the mailbox in the background with the system's own tool: launchd (Mac), a systemd user service (Linux), Task Scheduler with a Startup-folder fallback (Windows).
- `lifegraph disconnect` removes the door from every app; both uninstallers use it.
- App settings paths for each system, including Claude Desktop from the Microsoft Store. The doctor checks the background mailbox on all three systems.
- CI runs the tests and the real installers on Mac, Linux and Windows.
- The door: a local MCP server for Claude Desktop, Claude Code, Codex, Cursor, Gemini CLI and LM Studio, with index-first reads, line search, locked notes, labelled changes, inbox filing, handoff notes and note claims.
- The mailbox, so file-only apps (Muse on the Mac) can ask through `mailbox/ask-*.md`.
- One-command Mac installer: iCloud Drive folder, app connections, background mailbox. Uninstaller keeps your notes.
- Starter LifeGraph, prompts and format spec.
- Safe concurrent writes: several apps' doors and the mailbox share a write lock (stale locks from crashes are taken over).
- Locking a hub locks its whole branch.
- Mailbox skips asks that are still being written and refuses ones over 64 KB.
- `lifegraph doctor`, run at the end of install: Node, folder, iCloud placeholders, write access, app connections, and a live mailbox round trip.
- Token benchmark (`bench/`) and a demo folder (`demo/`).
