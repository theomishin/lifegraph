#!/bin/bash
# LifeGraph for Mac: one-command install.
#   curl -fsSL https://raw.githubusercontent.com/theomishin/lifegraph/main/install.sh | bash
# Options (after "bash -s --" when piped):
#   --icloud   move an existing ~/LifeGraph into iCloud Drive (a link stays at ~/LifeGraph)
#
# What it does, all on this Mac:
#   1. Puts the LifeGraph door in ~/.lifegraph-app
#   2. Creates your LifeGraph folder (in iCloud Drive when available), linked at ~/LifeGraph
#   3. Connects the door to Claude Desktop, Claude Code, Codex, Cursor, Gemini CLI and LM Studio
#   4. Starts the mailbox in the background (no window) so file-only apps like Muse can ask too
# No accounts, no servers. Your notes never leave the Mac except through iCloud Drive, if you use it.
set -euo pipefail
export NPM_CONFIG_UPDATE_NOTIFIER=false

APP="$HOME/.lifegraph-app"
LINK="$HOME/LifeGraph"
ICLOUD="$HOME/Library/Mobile Documents/com~apple~CloudDocs"
AGENT="$HOME/Library/LaunchAgents/com.lifegraph.mailbox.plist"
MOVE_TO_ICLOUD=0
for a in "$@"; do [ "$a" = "--icloud" ] && MOVE_TO_ICLOUD=1; done

say() { printf '\033[1m%s\033[0m\n' "$*"; STEP="$*"; }
STEP="starting"
trap 'echo; echo "Install stopped during: $STEP"; echo "Your notes were not changed. Fix the error above and run the installer again; it is safe to re-run."' ERR

[ "$(uname)" = "Darwin" ] || { echo "This installer is for macOS."; exit 1; }
if ! command -v node >/dev/null 2>&1 || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  echo "LifeGraph needs Node.js 20 or newer. Install it from https://nodejs.org (the LTS button), then run this again."
  exit 1
fi
NODE="$(command -v node)"
command -v npm >/dev/null 2>&1 || { echo "npm is missing (it normally comes with Node.js). Reinstall Node.js from https://nodejs.org."; exit 1; }
if [ -e "$LINK" ] && [ ! -d "$LINK" ]; then
  echo "$LINK exists but is not a folder. Rename it, then run this again."; exit 1
fi

say "1/4 Installing the door"
SRC="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || true)"
mkdir -p "$APP"
if [ -n "$SRC" ] && [ -f "$SRC/door/package.json" ]; then
  rm -rf "$APP/src" && mkdir -p "$APP/src"
  (cd "$SRC" && tar cf - --exclude node_modules --exclude dist --exclude .git .) | (cd "$APP/src" && tar xf -)
else
  rm -rf "$APP/src.new" && mkdir -p "$APP/src.new"
  curl -fsSL https://codeload.github.com/theomishin/lifegraph/tar.gz/refs/heads/main | tar xz -C "$APP/src.new" --strip-components 1
  rm -rf "$APP/src" && mv "$APP/src.new" "$APP/src"
fi
(cd "$APP/src/door" && npm ci --no-audit --no-fund --loglevel=error && npm run build --silent && npm prune --omit=dev --no-audit --no-fund --loglevel=error)
mkdir -p "$APP/bin"
cat > "$APP/bin/lifegraph" <<WRAP
#!/bin/bash
exec "$NODE" "$APP/src/door/dist/cli.js" "\$@"
WRAP
chmod +x "$APP/bin/lifegraph"
LG="$APP/bin/lifegraph"
# Put `lifegraph` on the PATH for new Terminal windows (once; uninstall.sh removes it).
PATH_LINE='export PATH="$HOME/.lifegraph-app/bin:$PATH" # added by LifeGraph'
for rc in "$HOME/.zshrc" "$HOME/.bash_profile"; do
  case "$rc" in *.bash_profile) [ -f "$rc" ] || continue ;; esac  # zsh is the macOS default; bash only if already used
  grep -qF "# added by LifeGraph" "$rc" 2>/dev/null || printf '\n%s\n' "$PATH_LINE" >> "$rc"
done

say "2/4 Setting up your LifeGraph folder"
if [ -e "$LINK" ]; then
  if [ "$MOVE_TO_ICLOUD" = 1 ] && [ ! -L "$LINK" ] && [ -d "$ICLOUD" ]; then
    if [ -e "$ICLOUD/LifeGraph" ]; then echo "  iCloud Drive already has a LifeGraph folder; not moving."; else
      mv "$LINK" "$ICLOUD/LifeGraph" && ln -s "$ICLOUD/LifeGraph" "$LINK"
      echo "  Moved ~/LifeGraph into iCloud Drive (a link stays at ~/LifeGraph)."
    fi
  else
    echo "  Using your existing $LINK"
    [ ! -L "$LINK" ] && [ -d "$ICLOUD" ] && echo "  (To sync it with your iPhone, run the installer again with --icloud.)"
  fi
elif [ -d "$ICLOUD" ]; then
  "$LG" init "$ICLOUD/LifeGraph" >/dev/null
  ln -s "$ICLOUD/LifeGraph" "$LINK"
  echo "  Created LifeGraph in iCloud Drive, linked at ~/LifeGraph"
else
  "$LG" init "$LINK" >/dev/null
  echo "  Created ~/LifeGraph (iCloud Drive is off, so it stays on this Mac)"
fi
mkdir -p "$LINK/mailbox" "$LINK/inbox"

say "3/4 Connecting your AI apps"
"$LG" connect --vault "$LINK" | sed 's/^/  /'

say "4/4 Starting the mailbox in the background"
mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs/LifeGraph"
cat > "$AGENT" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.lifegraph.mailbox</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE</string>
    <string>$APP/src/door/dist/cli.js</string>
    <string>mailbox</string>
    <string>--vault</string>
    <string>$LINK</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ProcessType</key><string>Background</string>
  <key>StandardOutPath</key><string>$HOME/Library/Logs/LifeGraph/mailbox.log</string>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/LifeGraph/mailbox.log</string>
</dict>
</plist>
PLIST
launchctl bootout "gui/$(id -u)/com.lifegraph.mailbox" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$AGENT"
echo "  Running. Log: ~/Library/Logs/LifeGraph/mailbox.log"

echo
say "Checking everything works"
"$LG" doctor --vault "$LINK" | sed 's/^/  /' || true

echo
say "Done."
echo "Restart your AI apps, then say to each one: \"Read my LifeGraph and fill it from what you remember about me.\""
echo "The full prompt is in $APP/src/prompts/fill-from-memory.md"
echo "Command line: open a new Terminal window and type: lifegraph help"
