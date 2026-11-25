#!/usr/bin/env node
// LifeGraph token benchmark.
// For each question, compares what an AI has to read:
//   A. "whole folder": every note pasted into the chat
//   B. "through the door": the door's tool list and rules (once per chat), lg_start, lg_search
//      for the question, and lg_open on the best matching note
// It also checks that the door's answer contains the note that holds the answer.
//
//   node bench/run.mjs [--vault demo] [--exact]
// --exact counts real Claude tokens with Anthropic's free token-counting endpoint
// (needs ANTHROPIC_API_KEY; sends the demo notes to Anthropic). Without it, tokens are
// estimated as characters / 3.5, which is close for English prose but not exact.
import { readFileSync, mkdtempSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const door = path.join(here, "..", "door", "dist");
const { LifeGraph } = await import(path.join(door, "lifegraph.js"));
const { createServer } = await import(path.join(door, "server.js"));
const { Client } = await import(path.join(here, "..", "door", "node_modules", "@modelcontextprotocol", "sdk", "dist", "esm", "client", "index.js"));
const { InMemoryTransport } = await import(path.join(here, "..", "door", "node_modules", "@modelcontextprotocol", "sdk", "dist", "esm", "inMemory.js"));

const arg = (n, d) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : d);
const sourceDir = path.resolve(arg("--vault", path.join(here, "..", "demo")));
// Work on a copy: lg_start records "last looked" state, and the benchmark must not touch the real folder.
const vaultDir = mkdtempSync(path.join(tmpdir(), "lifegraph-bench-"));
cpSync(sourceDir, vaultDir, { recursive: true });
const exact = process.argv.includes("--exact");
const questions = JSON.parse(readFileSync(path.join(here, "questions.json"), "utf8"));

// ---------- token counting ----------
let count;
if (exact) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();
  const model = arg("--model", "claude-opus-5-5");
  const base = (await client.messages.countTokens({ model, messages: [{ role: "user", content: "x" }] })).input_tokens;
  count = async (text, tools) =>
    (await client.messages.countTokens({ model, messages: [{ role: "user", content: text || "x" }], ...(tools ? { tools } : {}) })).input_tokens - (text || tools ? base : 0);
} else {
  count = async (text, tools) => Math.round(((text ?? "").length + (tools ? JSON.stringify(tools).length : 0)) / 3.5);
}

// ---------- the door, through MCP ----------
const server = await createServer(vaultDir);
const [a, b] = InMemoryTransport.createLinkedPair();
const mcp = new Client({ name: "lifegraph-bench", version: "1" });
await Promise.all([server.connect(a), mcp.connect(b)]);
const tools = (await mcp.listTools()).tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.inputSchema }));
const instructions = mcp.getInstructions() ?? "";
const call = async (name, args) => (await mcp.callTool({ name, arguments: args })).content.map((c) => c.text).join("\n");

const lg = new LifeGraph(vaultDir);
const notes = (await lg.vault.list()).filter((n) => !n.locked);
const wholeFolder = notes.map((n) => `# file: ${n.rel}\n${n.body}`).join("\n\n");

const toolTokens = (await count("", tools)) + (await count(instructions));
const wholeTokens = await count(wholeFolder);
const startText = await call("lg_start", {});
const startTokens = await count(startText);

let found = 0;
const rows = [];
for (const { q, file } of questions) {
  const hits = await lg.search(q, 8);
  const searchText = await call("lg_search", { query: q });
  const best = hits[0]?.file;
  const openText = best ? await call("lg_open", { name: best }) : "";
  const perQuestion = (await count(searchText)) + (await count(openText));
  const ok = openText.includes(`file: ${file}`) || searchText.includes(file);
  if (ok) found++;
  rows.push({ q, perQuestion, ok, opened: best });
}

const perQ = rows.reduce((s, r) => s + r.perQuestion, 0) / rows.length;
const firstQuestion = toolTokens + startTokens + perQ;
const tenQuestions = toolTokens + startTokens + 10 * perQ;
const pct = (x, y) => `${Math.round((1 - x / y) * 100)}%`;
const fmt = (n) => Math.round(n).toLocaleString("en-US");

console.log(`LifeGraph token benchmark (${exact ? "exact Claude tokens" : "estimated tokens: characters / 3.5"})`);
console.log(`Folder: ${path.relative(process.cwd(), sourceDir) || "."} (${notes.length} notes)\n`);
console.log(`Whole folder pasted:          ${fmt(wholeTokens)} tokens per chat`);
console.log(`Door, one-time per chat:      ${fmt(toolTokens)} (tool list and rules) + ${fmt(startTokens)} (lg_start)`);
console.log(`Door, per question:           ${fmt(perQ)} on average (lg_search + lg_open)`);
console.log(`Door, chat with 1 question:   ${fmt(firstQuestion)}  (saves ${pct(firstQuestion, wholeTokens)})`);
console.log(`Door, chat with 10 questions: ${fmt(tenQuestions)}  (whole folder: ${fmt(wholeTokens)})`);
console.log(`Answer found through the door: ${found} of ${rows.length} questions`);
console.log(`\nThe door's cost barely grows with the folder; pasting grows with every note.`);
console.log(`Break-even folder size: ${fmt(firstQuestion)} tokens for a 1-question chat, ${fmt(tenQuestions)} for a 10-question chat.`);
console.log(`(Per question assumes the AI always opens the top note; often the search lines alone answer it.)\n`);
for (const r of rows) console.log(`${r.ok ? "ok  " : "MISS"} ${String(r.perQuestion).padStart(5)}  ${r.q}${r.ok ? "" : `  (opened ${r.opened})`}`);
await mcp.close();
