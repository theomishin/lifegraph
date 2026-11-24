#!/bin/bash
# LifeGraph starter installer for macOS.
# 1. Copies the empty starter vault to ~/LifeGraph (never overwrites an existing one).
# 2. Adds a "lifegraph" connector to Claude Desktop, using the official
#    MCP filesystem server limited to that one folder.
# Makes no network calls of its own; npx downloads the filesystem server the
# first time Claude Desktop starts it.
set -euo pipefail

VAULT="${LIFEGRAPH_DIR:-$HOME/LifeGraph}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG="$HOME/Library/Application Support/Claude/claude_desktop_config.json"

if [ -e "$VAULT" ]; then
  echo "• $VAULT already exists, leaving it as it is."
else
  cp -R "$HERE/template" "$VAULT"
  echo "• Created your LifeGraph at $VAULT"
fi

if ! command -v node >/dev/null 2>&1; then
  echo "• Node.js is not installed. Install it from https://nodejs.org (LTS), then run this again to add the Claude connector."
  exit 1
fi

mkdir -p "$(dirname "$CONFIG")"
[ -f "$CONFIG" ] && cp "$CONFIG" "$CONFIG.bak-lifegraph"
VAULT="$VAULT" CONFIG="$CONFIG" node -e '
const fs = require("fs");
const { CONFIG, VAULT } = process.env;
let cfg = {};
if (fs.existsSync(CONFIG)) cfg = JSON.parse(fs.readFileSync(CONFIG, "utf8") || "{}");
cfg.mcpServers = cfg.mcpServers || {};
cfg.mcpServers.lifegraph = {
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-filesystem", VAULT],
};
fs.writeFileSync(CONFIG, JSON.stringify(cfg, null, 2) + "\n");
'
echo "• Added the \"lifegraph\" connector to Claude Desktop."
[ -f "$CONFIG.bak-lifegraph" ] && echo "  Your previous config is saved as claude_desktop_config.json.bak-lifegraph."
echo
echo "Next: quit and reopen Claude Desktop, then paste prompts/fill-from-memory.md into a new chat."
