// Where things live on macOS, Windows and Linux: app settings files, logs, and the
// background mailbox service. Used by `lifegraph connect`, `disconnect`, `service` and `doctor`.
// Everything here is local: settings files and the system's own service manager. No network.
import { promises as fs, existsSync, readdirSync } from "node:fs";
import { execFileSync, spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";

export type Format = "json" | "toml";
export interface AppConfig {
  app: string;
  file: string;
  format: Format;
  /** Other signs the app is installed, besides its settings folder existing. */
  installedIf?: string[];
}

const home = () => os.homedir();
const isMac = process.platform === "darwin";
const isWin = process.platform === "win32";

/** Settings files of the apps the door can connect to, for this system. */
export function appConfigs(): AppConfig[] {
  const h = home();
  const appData = process.env.APPDATA ?? path.join(h, "AppData", "Roaming");
  const xdg = process.env.XDG_CONFIG_HOME ?? path.join(h, ".config");
  const claudeDirs = isMac
    ? [path.join(h, "Library", "Application Support", "Claude")]
    : isWin
      ? [path.join(appData, "Claude"), ...microsoftStoreClaudeDirs()]
      : [path.join(xdg, "Claude")];
  return [
    ...claudeDirs.map((d) => ({ app: "Claude Desktop", file: path.join(d, "claude_desktop_config.json"), format: "json" as const })),
    { app: "Cursor", file: path.join(h, ".cursor", "mcp.json"), format: "json" },
    { app: "Gemini CLI", file: path.join(h, ".gemini", "settings.json"), format: "json" },
    { app: "LM Studio", file: path.join(h, ".lmstudio", "mcp.json"), format: "json" },
    // The ChatGPT desktop app shares Codex's settings file for local MCP servers.
    {
      app: "Codex / ChatGPT app",
      file: path.join(process.env.CODEX_HOME ?? path.join(h, ".codex"), "config.toml"),
      format: "toml",
      installedIf: isMac ? ["/Applications/ChatGPT.app", "/Applications/Codex.app", path.join(h, "Applications", "ChatGPT.app")] : [],
    },
  ];
}

/** Is this app on the computer? */
export function isInstalled(c: AppConfig): boolean {
  return existsSync(path.dirname(c.file)) || (c.installedIf ?? []).some((p) => existsSync(p));
}

/** Claude Desktop from the Microsoft Store keeps its settings inside its package folder. */
function microsoftStoreClaudeDirs(): string[] {
  const packages = path.join(process.env.LOCALAPPDATA ?? path.join(home(), "AppData", "Local"), "Packages");
  try {
    return readdirSync(packages)
      .filter((d) => /^Claude_/i.test(d))
      .map((d) => path.join(packages, d, "LocalCache", "Roaming", "Claude"))
      .filter((d) => existsSync(d));
  } catch {
    return [];
  }
}

const TOML_BLOCK = /\n?\[mcp_servers\.lifegraph\]\n(?:(?!\[)[^\n]*\n?)*/g;

/** Add or replace the door's entry in one settings file. */
export function withEntry(raw: string, format: Format, command: string, args: string[]): string {
  if (format === "toml") {
    const block = `[mcp_servers.lifegraph]\ncommand = ${JSON.stringify(command)}\nargs = [${args.map((a) => JSON.stringify(a)).join(", ")}]\n`;
    const without = raw.replace(/\r\n/g, "\n").replace(TOML_BLOCK, "\n").replace(/\s*$/, "");
    return (without ? without + "\n\n" : "") + block;
  }
  const cfg = raw.trim() ? JSON.parse(raw) : {};
  cfg.mcpServers = { ...(cfg.mcpServers ?? {}), lifegraph: { command, args } };
  return JSON.stringify(cfg, null, 2) + "\n";
}

/** Remove the door's entry. Returns undefined when there was none. */
export function withoutEntry(raw: string, format: Format): string | undefined {
  if (format === "toml") {
    const n = raw.replace(/\r\n/g, "\n").replace(TOML_BLOCK, "\n");
    return n === raw.replace(/\r\n/g, "\n") ? undefined : n.replace(/\s*$/, "\n");
  }
  const cfg = JSON.parse(raw);
  if (!cfg?.mcpServers?.lifegraph) return undefined;
  delete cfg.mcpServers.lifegraph;
  return JSON.stringify(cfg, null, 2) + "\n";
}

/** The command and args of the door's entry in a settings file, if there is one. */
export function readEntry(raw: string, format: Format): { command: string; args: string[] } | undefined {
  try {
    if (format === "json") {
      const e = JSON.parse(raw)?.mcpServers?.lifegraph;
      return e ? { command: String(e.command ?? ""), args: Array.isArray(e.args) ? e.args.map(String) : [] } : undefined;
    }
    const block = raw.replace(/\r\n/g, "\n").match(/\[mcp_servers\.lifegraph\]\n((?:(?!\[)[^\n]*\n?)*)/);
    if (!block) return undefined;
    const command = block[1].match(/^command\s*=\s*(".*")\s*$/m);
    const args = block[1].match(/^args\s*=\s*(\[.*\])\s*$/m);
    return { command: command ? JSON.parse(command[1]) : "", args: args ? JSON.parse(args[1]) : [] };
  } catch {
    return undefined;
  }
}

/**
 * Run the `claude` command (Claude Code). On Windows it is a .cmd file, which Node only runs
 * through the shell, so quote every argument ourselves.
 */
export function runClaude(args: string[]): string {
  if (!isWin) return execFileSync("claude", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const q = (a: string) => `"${a.replace(/"/g, '""')}"`;
  return execFileSync(["claude", ...args.map(q)].join(" "), { encoding: "utf8", shell: "cmd.exe", stdio: ["ignore", "pipe", "ignore"], windowsHide: true });
}

// ---------- the background mailbox ----------

export const SERVICE_NAME = isMac ? "com.lifegraph.mailbox" : isWin ? "LifeGraphMailbox" : "lifegraph-mailbox";

export function logFile(): string {
  if (isMac) return path.join(home(), "Library", "Logs", "LifeGraph", "mailbox.log");
  if (isWin) return path.join(process.env.LOCALAPPDATA ?? path.join(home(), "AppData", "Local"), "LifeGraph", "mailbox.log");
  return path.join(process.env.XDG_STATE_HOME ?? path.join(home(), ".local", "state"), "lifegraph", "mailbox.log");
}

const plistPath = () => path.join(home(), "Library", "LaunchAgents", `${SERVICE_NAME}.plist`);
const unitPath = () => path.join(process.env.XDG_CONFIG_HOME ?? path.join(home(), ".config"), "systemd", "user", `${SERVICE_NAME}.service`);
const winDir = () => path.join(process.env.LOCALAPPDATA ?? path.join(home(), "AppData", "Local"), "LifeGraph");
const launcherPath = () => path.join(winDir(), "mailbox.vbs");
const startupPath = () =>
  path.join(process.env.APPDATA ?? path.join(home(), "AppData", "Roaming"), "Microsoft", "Windows", "Start Menu", "Programs", "Startup", "LifeGraph mailbox.vbs");

function run(cmd: string, args: string[]): { ok: boolean; out: string } {
  try {
    return { ok: true, out: execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], windowsHide: true }) };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    return { ok: false, out: `${err.stdout ?? ""}${err.stderr ?? ""}` || (err.message ?? "") };
  }
}

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const sysd = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/%/g, "%%")}"`;
const vbs = (s: string) => s.replace(/"/g, '""');

/**
 * Start the mailbox in the background, now and at every login. Returns a sentence for the user.
 * Throws with a plain explanation when the system has no way to do it.
 */
export async function installService(node: string, cli: string, vault: string): Promise<string> {
  const log = logFile();
  await fs.mkdir(path.dirname(log), { recursive: true });
  const args = [cli, "mailbox", "--vault", vault, "--log", log];

  if (isMac) {
    await fs.mkdir(path.dirname(plistPath()), { recursive: true });
    await fs.writeFile(
      plistPath(),
      `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${SERVICE_NAME}</string>
  <key>ProgramArguments</key>
  <array>
${[node, cli, "mailbox", "--vault", vault].map((a) => `    <string>${xml(a)}</string>`).join("\n")}
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ProcessType</key><string>Background</string>
  <key>StandardOutPath</key><string>${xml(log)}</string>
  <key>StandardErrorPath</key><string>${xml(log)}</string>
</dict>
</plist>
`,
    );
    const uid = process.getuid?.();
    run("launchctl", ["bootout", `gui/${uid}/${SERVICE_NAME}`]);
    const r = run("launchctl", ["bootstrap", `gui/${uid}`, plistPath()]);
    if (!r.ok) throw new Error(`launchctl could not start it: ${r.out.trim()}`);
    return `Running in the background (launchd). Log: ${log}`;
  }

  if (isWin) {
    // A tiny hidden launcher: no console window, restarts the mailbox if it stops,
    // and ends by itself once the launcher file is removed (uninstall).
    await fs.mkdir(winDir(), { recursive: true });
    const cmdLine = [node, ...args].map((a) => `""${vbs(a)}""`).join(" ");
    await fs.writeFile(
      launcherPath(),
      [
        "' LifeGraph mailbox: runs the door's mailbox with no window. Remove with: lifegraph service uninstall",
        'Set sh = CreateObject("WScript.Shell")',
        'Set fso = CreateObject("Scripting.FileSystemObject")',
        "Do While fso.FileExists(WScript.ScriptFullName)",
        `  sh.Run "${cmdLine}", 0, True`,
        "  WScript.Sleep 10000",
        "Loop",
        "",
      ].join("\r\n"),
    );
    stopRunning();
    const wscript = path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "wscript.exe");
    const task = run("schtasks", ["/Create", "/F", "/TN", SERVICE_NAME, "/SC", "ONLOGON", "/RL", "LIMITED", "/TR", `"${wscript}" "${launcherPath()}"`]);
    let how = "Task Scheduler";
    if (task.ok) await fs.rm(startupPath(), { force: true });
    else {
      // Some Windows setups only let administrators add logon tasks. The Startup folder works for everyone.
      await fs.mkdir(path.dirname(startupPath()), { recursive: true });
      await fs.writeFile(startupPath(), `CreateObject("WScript.Shell").Run """${vbs(wscript)}"" ""${vbs(launcherPath())}""", 0, False\r\n`);
      how = "your Startup folder";
    }
    spawn(wscript, [launcherPath()], { detached: true, stdio: "ignore", windowsHide: true }).unref();
    return `Running in the background (${how}). Log: ${log}`;
  }

  // Linux and other systems with systemd.
  if (!systemdUser()) {
    throw new Error("this system has no systemd user services, so the mailbox can't start by itself");
  }
  await fs.mkdir(path.dirname(unitPath()), { recursive: true });
  await fs.writeFile(
    unitPath(),
    `[Unit]
Description=LifeGraph mailbox (answers ask files for apps that can only read and write files)

[Service]
ExecStart=${[node, ...args].map(sysd).join(" ")}
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
`,
  );
  run("systemctl", ["--user", "daemon-reload"]);
  const r = run("systemctl", ["--user", "enable", "--now", SERVICE_NAME]);
  if (!r.ok) {
    await uninstallService();
    throw new Error(`systemd could not start it: ${r.out.trim().split("\n").pop()}`);
  }
  run("systemctl", ["--user", "restart", SERVICE_NAME]); // pick up a changed unit on re-install
  return `Running in the background (systemd user service). Log: ${log}`;
}

export async function uninstallService(): Promise<string> {
  if (isMac) {
    run("launchctl", ["bootout", `gui/${process.getuid?.()}/${SERVICE_NAME}`]);
    await fs.rm(plistPath(), { force: true });
  } else if (isWin) {
    run("schtasks", ["/Delete", "/F", "/TN", SERVICE_NAME]);
    await fs.rm(startupPath(), { force: true });
    await fs.rm(launcherPath(), { force: true }); // the launcher loop ends when its file is gone
    stopRunning();
  } else {
    run("systemctl", ["--user", "disable", "--now", SERVICE_NAME]);
    await fs.rm(unitPath(), { force: true });
    run("systemctl", ["--user", "daemon-reload"]);
  }
  return "The background mailbox is stopped and removed.";
}

/** Windows: stop any running launcher and mailbox. Only touches LifeGraph's own processes. */
function stopRunning() {
  if (!isWin) return;
  run("powershell.exe", [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    "Get-CimInstance Win32_Process | Where-Object { ($_.Name -eq 'wscript.exe' -and $_.CommandLine -like '*LifeGraph*mailbox.vbs*') -or ($_.Name -eq 'node.exe' -and $_.CommandLine -like '*cli.js*mailbox*--vault*') } | ForEach-Object { Invoke-CimMethod -InputObject $_ -MethodName Terminate | Out-Null }",
  ]);
}

/** Linux: can this user run systemd services? (Not in most containers, or WSL without systemd.) */
const systemdUser = () => run("systemctl", ["--user", "show-environment"]).ok;

/** Is the background mailbox set up and running? `supported` is false when the system can't run it. */
export function serviceStatus(): { installed: boolean; running: boolean; supported: boolean; detail: string } {
  if (isMac) {
    const r = run("launchctl", ["print", `gui/${process.getuid?.()}/${SERVICE_NAME}`]);
    return { installed: existsSync(plistPath()), running: r.ok && /state = running/.test(r.out), supported: true, detail: "launchd" };
  }
  if (isWin) {
    const task = run("schtasks", ["/Query", "/TN", SERVICE_NAME]);
    const installed = task.ok || existsSync(startupPath());
    const procs = run("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "@(Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -like '*cli.js*mailbox*--vault*' }).Count",
    ]);
    return { installed, running: procs.ok && Number(procs.out.trim()) > 0, supported: true, detail: task.ok ? "Task Scheduler" : "Startup folder" };
  }
  const active = run("systemctl", ["--user", "is-active", SERVICE_NAME]);
  return { installed: existsSync(unitPath()), running: active.out.trim() === "active", supported: systemdUser(), detail: "systemd" };
}

/** How to see what went wrong, in words for this system. */
export function serviceHelp(): string {
  if (isMac) return `details in ${logFile()}`;
  if (isWin) return `details in ${logFile()}`;
  return `details in ${logFile()} or: journalctl --user -u ${SERVICE_NAME}`;
}
