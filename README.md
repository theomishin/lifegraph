# LifeGraph

**Your AI identity as plain Markdown files you own.** Every assistant you use reads the same small folder about you, in a few hundred tokens, and keeps it up to date by writing back what it learns.

Free and MIT-licensed. No accounts, no telemetry, no LifeGraph servers.

## Why

If you use Claude, ChatGPT, Muse and others, each one knows a different slice of you, and none of them can see the rest. LifeGraph is one folder they all share:

- **Hub and leaf.** `index.md` lists a few branches, each branch hub lists short leaves. A question loads the index, one hub and one leaf, not your whole life.
- **Write-back, not rebuilds.** Assistants add a dated line to the right leaf the moment they learn something, so the vault stays current without re-running anything.
- **Handoff.** Start a task in one model, hand it to another with a task card in `handoff/`.
- **Yours.** Plain Markdown that opens in any editor and in [Obsidian](https://obsidian.md), with a graph view for free.

## Get started (macOS, about five minutes)

1. Download this repo (Code, Download ZIP) and unzip it.
2. In Terminal, run `bash ~/Downloads/lifegraph-main/install/install-macos.sh`. It copies the empty starter vault to `~/LifeGraph` and adds a `lifegraph` connector to Claude Desktop. It needs [Node.js](https://nodejs.org).
3. Restart Claude Desktop and paste [prompts/fill-from-memory.md](prompts/fill-from-memory.md) into a new chat. Do the same in every other AI you use.

Not on a Mac, or not using Claude Desktop? Copy `template/` anywhere and point any MCP-capable app's filesystem connector at it.

## What's in the repo

| Folder | What it holds |
| --- | --- |
| [`template/`](template/) | The empty starter vault: `index.md` with the rules for assistants, branch hubs, inbox, handoff |
| [`prompts/`](prompts/) | Fill from memory, handoff, identity card, catch-up |
| [`spec/`](spec/FORMAT.md) | The file format, so other tools can read and write a LifeGraph |
| [`install/`](install/) | The macOS installer |

Coming next: a dedicated LifeGraph MCP server (search, write-back, privacy levels, handoff), a phone setup through iCloud Drive and Shortcuts, and a website with a live demo vault.

## Privacy

See [PRIVACY.md](PRIVACY.md). In short: nothing leaves your computer except what an assistant reads when you ask it something.

## License

Code: [MIT](LICENSE). Starter vault, prompts and spec: [CC0](template/LICENSE.md), copy them freely.
