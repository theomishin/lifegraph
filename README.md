# LifeGraph

**One folder about you that every AI on your computer reads and writes through.** Mac, Windows and Linux.

LifeGraph is a plain Markdown folder you can open and edit yourself. A small program on your computer, the *door*, lets Claude, Codex, Cursor and other apps read it and add to it. Each app gets only the notes a question needs, never the whole folder. Free, MIT-licensed, no accounts, no servers.

## Install

You need [Node.js](https://nodejs.org) 20 or newer. Then run one command.

**Mac or Linux**, in Terminal:

```bash
curl -fsSL https://raw.githubusercontent.com/theomishin/lifegraph/main/install.sh | bash
```

**Windows**, in PowerShell (no administrator rights needed):

```powershell
irm https://raw.githubusercontent.com/theomishin/lifegraph/main/install.ps1 | iex
```

This sets up everything, on your computer only:

1. Creates your LifeGraph folder at `~/LifeGraph` (on Windows, `%USERPROFILE%\LifeGraph`). On a Mac it lives in iCloud Drive when that is on, so your iPhone has a copy. On Windows and Linux it is a plain folder: sync it with OneDrive, Syncthing, Dropbox or git, or not at all.
2. Connects the door to Claude Desktop, Claude Code, Codex, Cursor, Gemini CLI and LM Studio, whichever you have.
3. Starts the mailbox in the background, with no window, so apps that can only use files can ask too. It uses the system's own service manager: launchd on Mac, a systemd user service on Linux, Task Scheduler on Windows.

Restart your AI apps and tell each one: *"Read my LifeGraph and fill it from what you remember about me."* ([full prompt](prompts/fill-from-memory.md))

Already have a `~/LifeGraph` folder? The installer uses it as is. On a Mac, add `--icloud` to move it into iCloud Drive: `curl -fsSL .../install.sh | bash -s -- --icloud`.

If something doesn't work, run `lifegraph doctor` in a new terminal window. To remove LifeGraph (your notes stay):

- Mac or Linux: `bash ~/.lifegraph-app/src/uninstall.sh`
- Windows: `& "$HOME\.lifegraph-app\src\uninstall.ps1"`

## How it works

- **The folder.** `index.md` lists a few branches and the rules every AI follows. Each branch has a hub listing short notes. An AI reads the index, then one hub, then one note: a few hundred words instead of your whole life.
- **The door** (`door/`) is a local MCP server. Apps start it themselves; it makes no network calls. Its tools: `lg_start`, `lg_open`, `lg_search`, `lg_remember`, `lg_inbox`, `lg_handoff`, `lg_claim`.
- **Locked notes.** `lifegraph lock <note>` and the door never shows, searches or edits that note. Locking a hub (`lifegraph lock Money`) locks its whole branch.
- **Labels.** Every change ends with which AI made it, like `(via Claude)`, so you can see who wrote what.
- **Inbox.** `inbox/` takes anything that isn't filed yet, including lines you add from your phone in `inbox/phone.md`. The next AI on your computer files them away.
- **Handoff.** One AI writes a handoff note in `handoff/` (goal, what's done, next step); another picks it up. While an AI is rewriting a note it claims it, and other AIs' changes go to the inbox instead, so two AIs never edit one note at once.
- **Mailbox** for file-only apps like Muse on the Mac: the app writes `mailbox/ask-muse.md`, the door answers in `mailbox/reply-muse.md`. Same rules, same locks.

## Command line

```
lifegraph status          what's in your LifeGraph, what's locked, open handoffs
lifegraph lock <note>     lock a note (unlock to undo)
lifegraph card            a short summary of you to paste into apps with no connection
lifegraph connect         reconnect your apps (after installing a new one)
lifegraph disconnect      remove the door from your apps (notes stay)
lifegraph service status  is the background mailbox running? (also: install, uninstall)
lifegraph doctor          check everything works and say how to fix what doesn't
```

It lives at `~/.lifegraph-app/bin/lifegraph` (`lifegraph.cmd` on Windows), and the installer puts it on your PATH.

## What's in the repo

| Folder | What it holds |
| --- | --- |
| [`door/`](door/) | The door: MCP server, mailbox and command line (TypeScript) |
| [`template/`](template/) | The empty starter LifeGraph |
| [`prompts/`](prompts/) | Fill from memory, handoff, identity card, catch-up |
| [`spec/`](spec/FORMAT.md) | The file format, so other tools can read and write a LifeGraph |

Not yet: a phone app, and signed desktop apps. Until then the door runs on Node.js, so it needs no signing.

## Privacy

See [PRIVACY.md](PRIVACY.md). Nothing leaves your computer except the sync you choose (like iCloud Drive) and what an AI reads when you ask it something.

## License

Code: [MIT](LICENSE). Starter folder, prompts and spec: [CC0](template/LICENSE.md).
