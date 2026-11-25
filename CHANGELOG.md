# Changelog

## Unreleased
- The door: a local MCP server for Claude Desktop, Claude Code, Codex, Cursor, Gemini CLI and LM Studio, with index-first reads, line search, locked notes, labelled changes, inbox filing, handoff notes and note claims.
- The mailbox, so file-only apps (Muse on the Mac) can ask through `mailbox/ask-*.md`.
- One-command Mac installer: iCloud Drive folder, app connections, background mailbox. Uninstaller keeps your notes.
- Starter LifeGraph, prompts and format spec.
- Safe concurrent writes: several apps' doors and the mailbox share a write lock (stale locks from crashes are taken over).
- Locking a hub locks its whole branch.
- Mailbox skips asks that are still being written and refuses ones over 64 KB.
- `lifegraph doctor`, run at the end of install: Node, folder, iCloud placeholders, write access, app connections, and a live mailbox round trip.
- Token benchmark (`bench/`) and a demo folder (`demo/`).
