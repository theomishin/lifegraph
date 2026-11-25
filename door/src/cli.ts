#!/usr/bin/env node
// lifegraph: the door's command line. Runs the MCP server, the mailbox, and setup helpers.
import { promises as fs, appendFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serveStdio, VERSION } from "./server.js";
import { LifeGraph } from "./lifegraph.js";
import { watchMailbox } from "./mailbox.js";
import { setFrontmatter } from "./vault.js";
import { appConfigs, installService, isInstalled, logFile, readEntry, runClaude, serviceHelp, serviceStatus, uninstallService, withEntry, withoutEntry } from "./platform.js";

const HELP = `lifegraph ${VERSION}: one folder about you that every AI reads and writes through

Usage:
  lifegraph                   Run the door (MCP server on stdio). Apps start this themselves.
  lifegraph mailbox           Answer ask files in mailbox/ for file-only apps (runs in the background after install)
  lifegraph init [folder]     Create a starter LifeGraph (default ~/LifeGraph)
  lifegraph connect           Add the door to Claude Desktop, Claude Code, Codex, Cursor, Gemini CLI and LM Studio
  lifegraph disconnect        Remove the door from those apps again (your notes stay)
  lifegraph service install   Run the mailbox in the background at login (also: uninstall, status)
  lifegraph lock <note>       Lock a note: the door never shares or edits it
  lifegraph unlock <note>     Unlock it again
  lifegraph card              Print a short identity card to paste into apps with no connection
  lifegraph status            Show the folder, inbox, open handoffs and locked notes
  lifegraph doctor            Check that everything works, and say how to fix what doesn't

Options:
  --vault <folder>   LifeGraph folder (default: $LIFEGRAPH_DIR or ~/LifeGraph)

The door makes no network calls. https://github.com/theomishin/lifegraph`;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const expand = (p: string) => (p.startsWith("~") ? path.join(os.homedir(), p.slice(1)) : p);
const vault = path.resolve(expand(arg("--vault") ?? process.env.LIFEGRAPH_DIR ?? "~/LifeGraph"));
const here = path.dirname(fileURLToPath(import.meta.url));
const templateDir = path.resolve(here, "..", "template");
const cliPath = fileURLToPath(import.meta.url);
const VALUE_FLAGS = ["--vault", "--log"];
const positional = process.argv.slice(2).filter((a, i, all) => !a.startsWith("--") && !VALUE_FLAGS.includes(all[i - 1]));

async function init(target: string) {
  if (existsSync(target)) return console.log(`${target} already exists; leaving it as it is.`);
  if (!existsSync(templateDir)) throw new Error(`Starter LifeGraph not found at ${templateDir}`);
  await fs.cp(templateDir, target, { recursive: true });
  console.log(`Created your LifeGraph at ${target}`);
}

async function backupAndWrite(file: string, content: string) {
  if (existsSync(file)) await fs.copyFile(file, `${file}.bak-lifegraph`);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content);
}

async function connect() {
  const command = process.execPath;
  const args = [cliPath, "--vault", vault];
  const done: string[] = [];

  for (const cfg of appConfigs()) {
    const { app, file, format } = cfg;
    if (!isInstalled(cfg)) continue;
    const raw = existsSync(file) ? await fs.readFile(file, "utf8") : "";
    let next: string;
    try {
      next = withEntry(raw, format, command, args);
    } catch {
      console.log(`- ${app}: ${file} is not valid ${format.toUpperCase()}, skipped. Add the door by hand (see below).`);
      continue;
    }
    await backupAndWrite(file, next);
    if (!done.includes(app)) done.push(app);
  }

  // Claude Code has its own command for this.
  try {
    runClaude(["mcp", "remove", "--scope", "user", "lifegraph"]);
  } catch {
    /* not there yet, or no Claude Code */
  }
  try {
    runClaude(["mcp", "add", "--scope", "user", "lifegraph", "--", command, ...args]);
    done.push("Claude Code");
  } catch {
    /* Claude Code not installed */
  }

  console.log(done.length ? `Connected: ${done.join(", ")}. Restart those apps.` : "No supported apps found.");
  console.log(`\nFor any other app that takes a local MCP server, use:\n  command: ${command}\n  args:    ${args.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(" ")}`);
  console.log(`\nApps that can only read files (like Muse): tell them to read ${path.join(vault, "index.md")}. It explains the mailbox.`);
}

/** Remove the door from every app. Used by the uninstallers; notes are not touched. */
async function disconnect() {
  for (const { app, file, format } of appConfigs()) {
    if (!existsSync(file)) continue;
    try {
      const next = withoutEntry(await fs.readFile(file, "utf8"), format);
      if (next === undefined) continue;
      await backupAndWrite(file, next);
      console.log(`Disconnected ${app} (${file})`);
    } catch {
      console.log(`- ${app}: couldn't read ${file}; remove the "lifegraph" entry by hand.`);
    }
  }
  try {
    runClaude(["mcp", "remove", "--scope", "user", "lifegraph"]);
    console.log("Disconnected Claude Code");
  } catch {
    /* not connected, or no Claude Code */
  }
}

async function service(action: string | undefined) {
  if (action === "install") {
    try {
      console.log(await installService(process.execPath, cliPath, vault));
    } catch (e) {
      console.log(`The mailbox could not start in the background: ${e instanceof Error ? e.message : e}.`);
      console.log(`Everything else works. To use the mailbox, keep this running in a terminal: lifegraph mailbox`);
      process.exitCode = 1;
    }
  } else if (action === "uninstall") console.log(await uninstallService());
  else if (action === "status" || !action) {
    const st = serviceStatus();
    console.log(!st.installed ? "The background mailbox is not set up. Run: lifegraph service install" : `The background mailbox is set up (${st.detail}) and ${st.running ? "running" : "not running"}. Log: ${logFile()}`);
  } else throw new Error(`Unknown action "${action}". Use: lifegraph service install | uninstall | status`);
}

async function setLock(ref: string | undefined, locked: boolean) {
  if (!ref) throw new Error(`Which note? e.g. lifegraph ${locked ? "lock" : "unlock"} Money`);
  const lg = new LifeGraph(vault);
  const note = await lg.vault.find(ref);
  if (!note) throw new Error(`No note named "${ref}".`);
  await lg.vault.withLock(async () => {
    const fresh = await lg.vault.read(note.rel);
    let raw = setFrontmatter(fresh.raw, "locked", locked ? "true" : "false");
    if (!locked) raw = raw.replace(/^privacy:\s*private\s*$/m, "privacy: personal");
    await lg.vault.write(note.rel, raw);
  });
  const hub = note.rel.split("/").length === 2 && note.rel.split("/")[1] === `${note.rel.split("/")[0]}.md`;
  console.log(`${locked ? "Locked" : "Unlocked"} ${note.rel}${hub ? ` and everything in ${note.rel.split("/")[0]}/` : ""}.`);
}

async function status() {
  const lg = new LifeGraph(vault);
  const notes = await lg.vault.list();
  const inbox = await lg.inboxLines();
  const cards = (await lg.handoffList()).filter((c) => c.status !== "done");
  const locked = notes.filter((n) => n.locked);
  console.log(`LifeGraph: ${vault}${vault !== lg.vault.root ? ` (really ${lg.vault.root})` : ""}`);
  console.log(`${notes.length} notes, ${inbox.length} inbox line(s), ${cards.length} open handoff(s), ${locked.length} locked`);
  for (const n of locked) console.log(`  locked: ${n.rel}`);
  for (const c of cards) console.log(`  handoff: ${c.name}: ${c.goal}`);
}

async function doctor(): Promise<boolean> {
  let ok = true;
  const pass = (m: string) => console.log(`  ✓ ${m}`);
  const fail = (m: string, fix: string) => {
    ok = false;
    console.log(`  ✗ ${m}\n      Fix: ${fix}`);
  };
  const warn = (m: string, fix: string) => console.log(`  ! ${m}\n      ${fix}`);
  console.log("LifeGraph doctor\n");

  const major = Number(process.versions.node.split(".")[0]);
  if (major >= 20) pass(`Node.js ${process.versions.node}`);
  else fail(`Node.js ${process.versions.node} is too old`, "install Node.js 20 or newer from https://nodejs.org, then run the installer again.");

  if (!existsSync(vault)) {
    fail(`No LifeGraph folder at ${vault}`, "run the installer again, or: lifegraph init");
    return false;
  }
  const lg = new LifeGraph(vault);
  const real = lg.vault.root;
  pass(`Folder: ${vault}${real !== vault ? ` -> ${real}` : ""}${/Mobile Documents/.test(real) ? " (iCloud Drive)" : ""}`);

  if (!existsSync(path.join(real, "index.md"))) fail("index.md is missing", `copy index.md from ${path.join(templateDir, "index.md")} into your LifeGraph folder.`);
  else if (!(await lg.rules())) warn("index.md has no \"## Rules for ...\" section", "AIs will use the door's default rules. See template/index.md for the section to add.");
  else pass("index.md with rules for AIs");

  // iCloud "Optimize Mac Storage" can leave notes as placeholders the door can't read.
  const placeholders: string[] = [];
  const walk = async (dir: string) => {
    for (const e of await fs.readdir(dir, { withFileTypes: true })) {
      if (e.isDirectory() && !e.name.startsWith(".")) await walk(path.join(dir, e.name));
      else if (e.name.startsWith(".") && e.name.endsWith(".icloud")) placeholders.push(path.relative(real, path.join(dir, e.name)));
    }
  };
  await walk(real);
  if (placeholders.length)
    fail(`${placeholders.length} note(s) are in iCloud but not downloaded to this Mac, so AIs can't read them`, "in Finder, right-click the LifeGraph folder in iCloud Drive and choose Keep Downloaded.");
  else pass(`All notes are on this ${process.platform === "darwin" ? "Mac" : "computer"}`);

  try {
    await lg.vault.withLock(async () => {
      await lg.writeState("doctor.json", { at: new Date().toISOString() });
    });
    pass("The door can write to the folder");
  } catch (e) {
    fail(`The door can't write to the folder: ${e instanceof Error ? e.message : e}`, process.platform === "darwin"
        ? "check the folder's permissions in Finder (Get Info, Sharing & Permissions)."
        : process.platform === "win32"
          ? "check the folder's permissions (right-click it, Properties, Security), and that it isn't marked read-only."
          : `check the folder's permissions: ls -ld "${real}"`);
  }

  const notes = await lg.vault.list();
  pass(`${notes.length} notes, ${notes.filter((n) => n.locked).length} locked, ${(await lg.inboxLines()).length} inbox line(s)`);

  // App connections
  let connected = 0;
  const seen = new Set<string>();
  for (const { app, file, format } of appConfigs()) {
    if (!existsSync(file)) continue;
    const entry = readEntry(await fs.readFile(file, "utf8"), format);
    if (!entry) {
      if (!seen.has(app)) warn(`${app} is installed but not connected`, "run: lifegraph connect");
      continue;
    }
    seen.add(app);
    const door = entry.args.find((a) => /cli\.js$/.test(a));
    if (!existsSync(entry.command) || (door && !existsSync(door))) fail(`${app} points at a door that no longer exists`, "run: lifegraph connect");
    else {
      pass(`${app} connected`);
      connected++;
    }
  }
  // Claude Code keeps user-scope servers in ~/.claude.json.
  const home = os.homedir();
  let hasClaudeCode = existsSync(path.join(home, ".claude.json"));
  try {
    runClaude(["--version"]);
    hasClaudeCode = true;
  } catch {
    /* not on PATH */
  }
  if (hasClaudeCode) {
    let listed = false;
    try {
      const cfg = JSON.parse(await fs.readFile(path.join(home, ".claude.json"), "utf8"));
      listed = Boolean(cfg?.mcpServers?.lifegraph);
    } catch {
      /* unreadable */
    }
    if (listed) {
      pass("Claude Code connected");
      connected++;
    } else warn("Claude Code is installed but not connected", "run: lifegraph connect   (or: claude mcp add --scope user lifegraph -- lifegraph)");
  }
  if (!connected) warn("No AI apps connected yet", "install Claude Desktop, Codex or Cursor, then run: lifegraph connect");

  // Mailbox: a real round trip through the background service.
  const svc = serviceStatus();
  if (!svc.installed && !svc.supported)
    warn("The mailbox can't run in the background here (no systemd user services)", "file-only apps get answers only while you keep this open: lifegraph mailbox");
  else if (!svc.installed) fail("The mailbox isn't set up to run in the background", "run: lifegraph service install");
  else if (!svc.running) fail(`The mailbox is set up (${svc.detail}) but not running`, `run: lifegraph service install   (${serviceHelp()})`);
  else {
    const ask = path.join(real, "mailbox", "ask-doctor.md");
    const reply = path.join(real, "mailbox", "reply-doctor.md");
    await fs.mkdir(path.dirname(ask), { recursive: true });
    await fs.rm(reply, { force: true });
    await fs.writeFile(ask, "from: doctor\ninbox\n");
    let answered = false;
    for (let i = 0; i < 20 && !answered; i++) {
      await new Promise((r) => setTimeout(r, 500));
      answered = existsSync(reply);
    }
    await fs.rm(ask, { force: true });
    await fs.rm(reply, { force: true });
    if (answered) pass("Mailbox answered a test question");
    else
      fail(
        "The mailbox is running but didn't answer within 10 seconds",
        process.platform === "darwin"
          ? `macOS may be blocking it from your iCloud folder. Open ${logFile()}; if it says 'Operation not permitted', give Node Full Disk Access in System Settings > Privacy & Security, then run the installer again.`
          : `open ${logFile()} to see why, then run: lifegraph service install`,
      );
  }

  console.log(ok ? "\nEverything looks good." : "\nSome things need fixing (see above).");
  return ok;
}

async function main() {
  const cmd = positional[0];
  if (cmd === "help" || process.argv.includes("--help") || process.argv.includes("-h")) return console.log(HELP);
  if (cmd === "version" || process.argv.includes("--version")) return console.log(VERSION);
  if (cmd === "init") return init(path.resolve(expand(positional[1] ?? vault)));
  if (cmd === "doctor" && !existsSync(vault)) {
    await doctor();
    process.exitCode = 1;
    return;
  }
  if (cmd === "disconnect") return disconnect();
  if (cmd === "service" && positional[1] !== "install") return service(positional[1]);
  if (!existsSync(vault)) {
    // stdout is the MCP channel when an app runs us, so errors go to stderr
    console.error(`No LifeGraph folder at ${vault}. Create one with: lifegraph init`);
    process.exit(1);
  }
  if (cmd === "connect") return connect();
  if (cmd === "service") return service(positional[1]);
  if (cmd === "lock" || cmd === "unlock") return setLock(positional[1], cmd === "lock");
  if (cmd === "card") return console.log(await new LifeGraph(vault).card());
  if (cmd === "status") return status();
  if (cmd === "doctor") {
    if (!(await doctor())) process.exitCode = 1;
    return;
  }
  if (cmd === "mailbox") {
    const lg = new LifeGraph(vault);
    const logTo = arg("--log");
    if (logTo && existsSync(logTo) && (await fs.stat(logTo)).size > 1_000_000) await fs.rename(logTo, `${logTo}.old`).catch(() => undefined);
    const log = (m: string) => {
      const line = `${new Date().toISOString()} ${m}`;
      if (logTo) appendFileSync(logTo, line + "\n");
      else console.log(line);
    };
    await fs.mkdir(lg.vault.resolve("mailbox"), { recursive: true });
    log(`Mailbox open at ${lg.vault.resolve("mailbox")}`);
    watchMailbox(lg, log);
    return;
  }
  if (cmd && cmd !== "serve") {
    console.error(`Unknown command "${cmd}".\n\n${HELP}`);
    process.exit(1);
  }
  return serveStdio(vault);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
