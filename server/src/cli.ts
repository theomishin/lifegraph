#!/usr/bin/env node
// lifegraph-mcp: run the server, create a vault, connect apps, print an identity card.
import { promises as fs, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serveStdio, VERSION } from "./server.js";
import { LifeGraph } from "./lifegraph.js";
import { parsePrivacy } from "./vault.js";

const HELP = `lifegraph-mcp ${VERSION} — your AI identity as plain Markdown files

Usage:
  lifegraph-mcp                 Run the MCP server on stdio (what apps call)
  lifegraph-mcp init [folder]   Create a starter vault (default ~/LifeGraph)
  lifegraph-mcp install         Add the server to Claude Desktop, Cursor, Gemini CLI and LM Studio
                                (only apps that are installed; backs up each config first)
  lifegraph-mcp card            Print an identity card to paste into apps without a connector

Options:
  --vault <folder>    LifeGraph folder (default: $LIFEGRAPH_DIR or ~/LifeGraph)
  --ceiling <level>   Highest privacy level this app may read: open, personal (default) or private
  --npx               With install: write "npx -y lifegraph-mcp" instead of this copy's path

LifeGraph makes no network calls. https://github.com/theomishin/lifegraph`;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function expand(p: string): string {
  return p.startsWith("~") ? path.join(os.homedir(), p.slice(1)) : p;
}

const vault = path.resolve(expand(arg("--vault") ?? process.env.LIFEGRAPH_DIR ?? "~/LifeGraph"));
const ceiling = parsePrivacy(arg("--ceiling") ?? process.env.LIFEGRAPH_CEILING, "personal");
const here = path.dirname(fileURLToPath(import.meta.url));
const templateDir = path.resolve(here, "..", "template");

async function init(target: string) {
  if (existsSync(target)) {
    console.log(`${target} already exists; leaving it as it is.`);
    return;
  }
  if (!existsSync(templateDir)) throw new Error(`Starter vault not found at ${templateDir}`);
  await fs.cp(templateDir, target, { recursive: true });
  console.log(`Created your LifeGraph at ${target}`);
}

function appConfigs(): { app: string; file: string }[] {
  const home = os.homedir();
  const claude =
    process.platform === "darwin"
      ? path.join(home, "Library/Application Support/Claude")
      : process.platform === "win32"
        ? path.join(process.env.APPDATA ?? path.join(home, "AppData/Roaming"), "Claude")
        : path.join(home, ".config/Claude");
  return [
    { app: "Claude Desktop", file: path.join(claude, "claude_desktop_config.json") },
    { app: "Cursor", file: path.join(home, ".cursor/mcp.json") },
    { app: "Gemini CLI", file: path.join(home, ".gemini/settings.json") },
    { app: "LM Studio", file: path.join(home, ".lmstudio/mcp.json") },
  ];
}

async function install() {
  const entry = process.argv.includes("--npx")
    ? { command: "npx", args: ["-y", "lifegraph-mcp", "--vault", vault] }
    : { command: process.execPath, args: [fileURLToPath(import.meta.url), "--vault", vault] };
  if (ceiling !== "personal") entry.args.push("--ceiling", ceiling);

  let done = 0;
  for (const { app, file } of appConfigs()) {
    if (!existsSync(path.dirname(file))) continue; // app not installed
    let cfg: { mcpServers?: Record<string, unknown> } = {};
    if (existsSync(file)) {
      const raw = await fs.readFile(file, "utf8");
      try {
        cfg = raw.trim() ? JSON.parse(raw) : {};
      } catch {
        console.log(`- ${app}: ${file} is not valid JSON, skipped.`);
        continue;
      }
      await fs.writeFile(`${file}.bak-lifegraph`, raw);
    }
    cfg.mcpServers = { ...(cfg.mcpServers ?? {}), lifegraph: entry };
    await fs.writeFile(file, JSON.stringify(cfg, null, 2) + "\n");
    console.log(`- ${app}: added "lifegraph" (${file})`);
    done++;
  }
  console.log(`\nClaude Code: run  claude mcp add --scope user lifegraph -- ${[entry.command, ...entry.args].map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(" ")}`);
  console.log(done ? "\nRestart those apps to load LifeGraph." : "\nNo supported apps found. Add the command above to your app's MCP settings.");
}

async function main() {
  const cmd = process.argv[2];
  if (cmd === "--help" || cmd === "-h" || cmd === "help") return console.log(HELP);
  if (cmd === "--version" || cmd === "-v") return console.log(VERSION);
  if (cmd === "init") return init(path.resolve(expand(process.argv[3] && !process.argv[3].startsWith("--") ? process.argv[3] : vault)));
  if (!existsSync(vault)) {
    const msg = `No LifeGraph folder at ${vault}. Create one with: lifegraph-mcp init`;
    if (cmd === "install" || cmd === "card") throw new Error(msg);
    console.error(msg); // stdout is the MCP channel, so errors go to stderr
    process.exit(1);
  }
  if (cmd === "install") return install();
  if (cmd === "card") return console.log(await new LifeGraph(vault, { ceiling: arg("--ceiling") ? ceiling : "personal" }).card());
  return serveStdio(vault, { ceiling });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
