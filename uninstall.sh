#!/bin/bash
# Removes the LifeGraph door, the background mailbox and the app connections (Mac and Linux).
# Your LifeGraph folder and its notes are left exactly where they are.
set -uo pipefail
APP="$HOME/.lifegraph-app"
CLI="$APP/src/door/dist/cli.js"
if command -v node >/dev/null && [ -f "$CLI" ]; then
  node "$CLI" service uninstall
  node "$CLI" disconnect
else
  # The door is already gone; clean up what it may have left behind.
  if [ "$(uname)" = "Darwin" ]; then
    launchctl bootout "gui/$(id -u)/com.lifegraph.mailbox" 2>/dev/null
    rm -f "$HOME/Library/LaunchAgents/com.lifegraph.mailbox.plist"
  elif command -v systemctl >/dev/null; then
    systemctl --user disable --now lifegraph-mailbox 2>/dev/null
    rm -f "${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user/lifegraph-mailbox.service"
  fi
  command -v claude >/dev/null && claude mcp remove --scope user lifegraph >/dev/null 2>&1
fi
for rc in "$HOME/.zshrc" "$HOME/.bash_profile" "$HOME/.bashrc"; do
  # -i.bak works with both the Mac (BSD) and Linux (GNU) sed.
  [ -f "$rc" ] && grep -qF "# added by LifeGraph" "$rc" && sed -i.bak '/# added by LifeGraph/d' "$rc" && rm -f "$rc.bak"
done
rm -rf "$APP"
echo "LifeGraph is uninstalled. Your notes are still in ~/LifeGraph."
