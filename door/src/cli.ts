#!/usr/bin/env node
// lifegraph: the door's command line. Runs the MCP server, the mailbox, and setup helpers.
import { promises as fs, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serveStdio, VERSION } from "./server.js";
import { LifeGraph } from "./lifegraph.js";
import { watchMailbox } from "./mailbox.js";
import { setFrontmatter } from "./vault.js";

const HELP = `lifegraph ${VERSION}: one folder about you that every AI reads and writes through

Usage:
  lifegraph                   Run the door (MCP server on stdio). Apps start this themselves.
  lifegraph mailbox           Answer ask files in mailbox/ for file-only apps (runs in the background after install)
  lifegraph init [folder]     Create a starter LifeGraph (default ~/LifeGraph)
  lifegraph connect           Add the door to Claude Desktop, Claude Code, Codex, Cursor, Gemini CLI and LM Studio
  lifegraph lock <note>       Lock a note: the door never shares or edits it
  lifegraph unlock <note>     Unlock it again
  lifegraph card              Print a short identity card to paste into apps with no connection
  lifegraph status            Show the folder, inbox, open handoffs and locked notes

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
const positional = process.argv.slice(2).filter((a, i, all) => !a.startsWith("--") && all[i - 1] !== "--vault");

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
  const args = [fileURLToPath(import.meta.url), "--vault", vault];
  const home = os.homedir();
  const claudeDir =
    process.platform === "darwin"
      ? path.join(home, "Library/Application Support/Claude")
      : process.platform === "win32"
        ? path.join(process.env.APPDATA ?? path.join(home, "AppData/Roaming"), "Claude")
        : path.join(home, ".config/Claude");
  const jsonApps = [
    { app: "Claude Desktop", file: path.join(claudeDir, "claude_desktop_config.json") },
    { app: "Cursor", file: path.join(home, ".cursor/mcp.json") },
    { app: "Gemini CLI", file: path.join(home, ".gemini/settings.json") },
    { app: "LM Studio", file: path.join(home, ".lmstudio/mcp.json") },
  ];
  const done: string[] = [];

  for (const { app, file } of jsonApps) {
    if (!existsSync(path.dirname(file))) continue; // app not installed
    let cfg: { mcpServers?: Record<string, unknown> } = {};
    if (existsSync(file)) {
      const raw = await fs.readFile(file, "utf8");
      try {
        cfg = raw.trim() ? JSON.parse(raw) : {};
      } catch {
        console.log(`- ${app}: ${file} is not valid JSON, skipped. Add the door by hand (see below).`);
        continue;
      }
    }
    cfg.mcpServers = { ...(cfg.mcpServers ?? {}), lifegraph: { command, args } };
    await backupAndWrite(file, JSON.stringify(cfg, null, 2) + "\n");
    done.push(app);
  }

  // Codex keeps its settings in TOML.
  const codex = path.join(home, ".codex/config.toml");
  if (existsSync(path.dirname(codex))) {
    const raw = existsSync(codex) ? await fs.readFile(codex, "utf8") : "";
    const block = `[mcp_servers.lifegraph]\ncommand = ${JSON.stringify(command)}\nargs = [${args.map((a) => JSON.stringify(a)).join(", ")}]\n`;
    const without = raw.replace(/\n?\[mcp_servers\.lifegraph\]\n(?:(?!\[)[^\n]*\n?)*/g, "\n").replace(/\s*$/, "");
    await backupAndWrite(codex, (without ? without + "\n\n" : "") + block);
    done.push("Codex");
  }

  // Claude Code has its own command for this.
  try {
    execFileSync("claude", ["mcp", "remove", "--scope", "user", "lifegraph"], { stdio: "ignore" });
  } catch {
    /* not there yet, or no Claude Code */
  }
  try {
    execFileSync("claude", ["mcp", "add", "--scope", "user", "lifegraph", "--", command, ...args], { stdio: "ignore" });
    done.push("Claude Code");
  } catch {
    /* Claude Code not installed */
  }

  console.log(done.length ? `Connected: ${done.join(", ")}. Restart those apps.` : "No supported apps found.");
  console.log(`\nFor any other app that takes a local MCP server (ChatGPT's Mac app, if yours offers it), use:\n  command: ${command}\n  args:    ${args.join(" ")}`);
  console.log(`\nApps that can only read files (like Muse): tell them to read ${path.join(vault, "index.md")}. It explains the mailbox.`);
}

async function setLock(ref: string | undefined, locked: boolean) {
  if (!ref) throw new Error(`Which note? e.g. lifegraph ${locked ? "lock" : "unlock"} Money`);
  const lg = new LifeGraph(vault);
  const note = await lg.vault.find(ref);
  if (!note) throw new Error(`No note named "${ref}".`);
  let raw = setFrontmatter(note.raw, "locked", locked ? "true" : "false");
  if (!locked) raw = raw.replace(/^privacy:\s*private\s*$/m, "privacy: personal");
  await lg.vault.write(note.rel, raw);
  console.log(`${locked ? "Locked" : "Unlocked"} ${note.rel}.`);
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

async function main() {
  const cmd = positional[0];
  if (cmd === "help" || process.argv.includes("--help") || process.argv.includes("-h")) return console.log(HELP);
  if (cmd === "version" || process.argv.includes("--version")) return console.log(VERSION);
  if (cmd === "init") return init(path.resolve(expand(positional[1] ?? vault)));
  if (!existsSync(vault)) {
    // stdout is the MCP channel when an app runs us, so errors go to stderr
    console.error(`No LifeGraph folder at ${vault}. Create one with: lifegraph init`);
    process.exit(1);
  }
  if (cmd === "connect") return connect();
  if (cmd === "lock" || cmd === "unlock") return setLock(positional[1], cmd === "lock");
  if (cmd === "card") return console.log(await new LifeGraph(vault).card());
  if (cmd === "status") return status();
  if (cmd === "mailbox") {
    const lg = new LifeGraph(vault);
    await fs.mkdir(lg.vault.resolve("mailbox"), { recursive: true });
    console.log(`Mailbox open at ${lg.vault.resolve("mailbox")}`);
    watchMailbox(lg, (m) => console.log(`${new Date().toISOString()} ${m}`));
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
