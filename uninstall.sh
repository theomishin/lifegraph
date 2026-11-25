#!/bin/bash
# Removes the LifeGraph door, the background mailbox and the app connections.
# Your LifeGraph folder and its notes are left exactly where they are.
set -uo pipefail
APP="$HOME/.lifegraph-app"
launchctl bootout "gui/$(id -u)/com.lifegraph.mailbox" 2>/dev/null
rm -f "$HOME/Library/LaunchAgents/com.lifegraph.mailbox.plist"
if command -v node >/dev/null; then
  node -e '
const fs = require("fs"), os = require("os"), path = require("path");
const h = os.homedir();
for (const f of ["Library/Application Support/Claude/claude_desktop_config.json", ".cursor/mcp.json", ".gemini/settings.json", ".lmstudio/mcp.json"].map(p => path.join(h, p))) {
  try { const c = JSON.parse(fs.readFileSync(f, "utf8")); if (c.mcpServers && c.mcpServers.lifegraph) { delete c.mcpServers.lifegraph; fs.writeFileSync(f, JSON.stringify(c, null, 2) + "\n"); console.log("Disconnected " + f); } } catch {}
}
const t = path.join(h, ".codex/config.toml");
try { const s = fs.readFileSync(t, "utf8"); const n = s.replace(/\n?\[mcp_servers\.lifegraph\]\n(?:(?!\[)[^\n]*\n?)*/g, "\n"); if (n !== s) { fs.writeFileSync(t, n); console.log("Disconnected " + t); } } catch {}
'
fi
command -v claude >/dev/null && claude mcp remove --scope user lifegraph >/dev/null 2>&1
rm -rf "$APP"
echo "LifeGraph is uninstalled. Your notes are still in ~/LifeGraph."
