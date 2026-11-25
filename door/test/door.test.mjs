import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, cpSync, writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { LifeGraph, label } from "../dist/lifegraph.js";
import { processMailbox } from "../dist/mailbox.js";
import { createServer } from "../dist/server.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

const NOW = () => new Date("2026-11-25T10:00:00");

function vault() {
  const dir = mkdtempSync(path.join(tmpdir(), "lg-"));
  cpSync(new URL("../../template", import.meta.url).pathname, dir, { recursive: true });
  writeFileSync(path.join(dir, "Interests/books.md"), "---\nupdated: 2026-11-01\n---\n# Books\nPart of [[Interests]].\n\n- 2026-11-01: Reading Middlemarch, halfway through.\n");
  writeFileSync(path.join(dir, "Interests/Interests.md"), "# Interests\nBack to [[index]].\n\n- [[books]] — what I am reading now.\n");
  writeFileSync(path.join(dir, "Money/budget.md"), "---\nlocked: true\n---\n# Budget\n\n- Savings goal is secret.\n");
  return dir;
}

test("start returns the index and its rules, never the whole folder", async () => {
  const lg = new LifeGraph(vault(), { now: NOW });
  const out = await lg.start("claude-ai");
  assert.match(out, /Rules for AI assistants/);
  assert.doesNotMatch(out, /Middlemarch/);
});

test("open finds a note by link name; locked notes are never returned", async () => {
  const lg = new LifeGraph(vault(), { now: NOW });
  assert.match(await lg.open("books"), /Middlemarch/);
  assert.match(await lg.open("[[Books]]"), /Middlemarch/);
  const locked = await lg.open("budget");
  assert.match(locked, /locked/);
  assert.doesNotMatch(locked, /secret/);
});

test("search returns lines and skips locked notes", async () => {
  const lg = new LifeGraph(vault(), { now: NOW });
  const hits = await lg.search("what book am I reading");
  assert.equal(hits[0].file, "Interests/books.md");
  assert.equal((await lg.search("savings secret")).length, 0);
});

test("remember labels the change with the app that made it", async () => {
  const dir = vault();
  const lg = new LifeGraph(dir, { now: NOW });
  await lg.remember({ fact: "Finished Middlemarch.", leaf: "books", replaces: "Reading Middlemarch" }, "claude-ai");
  const raw = readFileSync(path.join(dir, "Interests/books.md"), "utf8");
  assert.match(raw, /- 2026-11-25: Finished Middlemarch\. \(via Claude\)/);
  assert.doesNotMatch(raw, /halfway/);
  assert.match(raw, /updated_by: Claude/);
});

test("remember with no leaf goes to the inbox; a new leaf is linked from its hub", async () => {
  const dir = vault();
  const lg = new LifeGraph(dir, { now: NOW });
  await lg.remember({ fact: "Wants to learn Italian." }, "codex-mcp-client");
  assert.match(readFileSync(path.join(dir, "inbox/inbox.md"), "utf8"), /Wants to learn Italian\. \(via Codex\)/);
  await lg.remember({ fact: "Best friend since school.", leaf: "Sam", branch: "People", description: "old friend" }, "cursor-vscode");
  assert.match(readFileSync(path.join(dir, "People/sam.md"), "utf8"), /Best friend since school\. \(via Cursor\)/);
  assert.match(readFileSync(path.join(dir, "People/People.md"), "utf8"), /\[\[sam\]\] — old friend/);
});

test("remember refuses locked notes", async () => {
  const dir = vault();
  const lg = new LifeGraph(dir, { now: NOW });
  const out = await lg.remember({ fact: "x", leaf: "budget" }, "claude-ai");
  assert.match(out, /locked/);
  assert.doesNotMatch(readFileSync(path.join(dir, "Money/budget.md"), "utf8"), /- .*x \(via/);
});

test("a claimed note sends other AIs' changes to the inbox", async () => {
  const dir = vault();
  const lg = new LifeGraph(dir, { now: NOW });
  assert.match(await lg.claim(["books"], "claude-ai", "reorganising"), /now editing/);
  const out = await lg.remember({ fact: "Started Dune.", leaf: "books" }, "codex-mcp-client");
  assert.match(out, /being edited by Claude/);
  assert.doesNotMatch(readFileSync(path.join(dir, "Interests/books.md"), "utf8"), /Dune/);
  assert.match(readFileSync(path.join(dir, "inbox/inbox.md"), "utf8"), /Started Dune\. \(via Codex\) \[for Interests\/books\.md\]/);
  // The claimer itself can still write, and release frees the note.
  assert.match(await lg.remember({ fact: "Loved it.", leaf: "books" }, "claude-ai"), /Added/);
  await lg.release("claude-ai");
  assert.match(await lg.remember({ fact: "Started Dune.", leaf: "books" }, "codex-mcp-client"), /Added/);
});

test("claims expire", async () => {
  let t = new Date("2026-11-25T10:00:00");
  const lg = new LifeGraph(vault(), { now: () => t, claimMinutes: 30 });
  await lg.claim(["books"], "claude-ai");
  t = new Date("2026-11-25T10:31:00");
  assert.match(await lg.remember({ fact: "x", leaf: "books" }, "codex"), /Added/);
});

test("inbox: phone lines and iCloud conflict copies are listed and removed once filed", async () => {
  const dir = vault();
  writeFileSync(path.join(dir, "inbox/phone.md"), "# Phone inbox\n\n- 2026-11-25 09:00: Dentist moved to Friday\n- 2026-11-25 09:05: Try the new ramen place\n");
  writeFileSync(path.join(dir, "inbox/phone 2.md"), "# Phone inbox\n\n- 2026-11-25 09:10: Call mum\n");
  const lg = new LifeGraph(dir, { now: NOW });
  const lines = (await lg.inboxLines()).map((l) => l.text);
  assert.equal(lines.length, 3);
  await lg.inboxDone(["- 2026-11-25 09:00: Dentist moved to Friday", "- 2026-11-25 09:10: Call mum"]);
  assert.deepEqual((await lg.inboxLines()).map((l) => l.text), ["- 2026-11-25 09:05: Try the new ramen place"]);
  assert.equal(existsSync(path.join(dir, "inbox/phone 2.md")), false);
});

test("handoff notes can be written, listed, read and closed", async () => {
  const lg = new LifeGraph(vault(), { now: NOW });
  await lg.handoffWrite({ name: "Trip plan", goal: "Plan a weekend in Lisbon", next: "Compare flights", notes: ["Life/travel.md"] }, "claude-ai");
  const [card] = await lg.handoffList();
  assert.equal(card.name, "trip-plan");
  assert.equal(card.status, "open");
  assert.match(card.from, /Claude/);
  assert.match(await lg.start("codex"), /trip-plan: Plan a weekend in Lisbon/);
  await lg.handoffClose("trip-plan", "codex");
  assert.equal((await lg.handoffList())[0].status, "done");
});

test("mailbox: an ask file gets a reply file, with no locked content", async () => {
  const dir = vault();
  mkdirSync(path.join(dir, "mailbox"), { recursive: true });
  writeFileSync(path.join(dir, "mailbox/ask-muse.md"), "from: Muse\nWhat book am I reading?\nremember: Likes long novels\n");
  writeFileSync(path.join(dir, "mailbox/ask-2.md"), "open: budget\n");
  const lg = new LifeGraph(dir, { now: NOW });
  assert.equal(await processMailbox(lg), 2);
  const reply = readFileSync(path.join(dir, "mailbox/reply-muse.md"), "utf8");
  assert.match(reply, /Middlemarch/);
  assert.match(reply, /Likes long novels \(via Muse\)/);
  assert.doesNotMatch(readFileSync(path.join(dir, "mailbox/reply-2.md"), "utf8"), /secret/);
  assert.deepEqual(readdirSync(path.join(dir, "mailbox")).filter((f) => f.startsWith("ask")), []);
});

test("mailbox replies never leak into search or start", async () => {
  const dir = vault();
  mkdirSync(path.join(dir, "mailbox"), { recursive: true });
  writeFileSync(path.join(dir, "mailbox/reply-x.md"), "unique-zebra-word");
  assert.equal((await new LifeGraph(dir).search("unique zebra word")).length, 0);
});

test("paths outside the folder are refused", async () => {
  const lg = new LifeGraph(vault());
  assert.throws(() => lg.vault.resolve("../../etc/passwd"), /outside/);
});

test("labels", () => {
  assert.equal(label("claude-ai"), "Claude");
  assert.equal(label("claude-code"), "Claude Code");
  assert.equal(label("codex-mcp-client"), "Codex");
  assert.equal(label("cursor-vscode"), "Cursor");
  assert.equal(label("openai-mcp"), "ChatGPT");
});

test("MCP: the door lists its tools and answers through the protocol", async () => {
  const dir = vault();
  const server = await createServer(dir, { now: NOW });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "claude-ai", version: "1.0.0" });
  await Promise.all([server.connect(a), client.connect(b)]);
  const tools = (await client.listTools()).tools.map((t) => t.name).sort();
  assert.deepEqual(tools, ["lg_claim", "lg_handoff", "lg_inbox", "lg_open", "lg_remember", "lg_search", "lg_start"]);
  assert.match(client.getInstructions() ?? "", /Call lg_start/);
  const start = await client.callTool({ name: "lg_start", arguments: {} });
  assert.match(start.content[0].text, /Read this file at the start of every chat/);
  assert.doesNotMatch(start.content[0].text, /mailbox/);
  const res = await client.callTool({ name: "lg_remember", arguments: { fact: "Prefers short answers", leaf: "Me" } });
  assert.match(res.content[0].text, /via Claude/);
  const search = await client.callTool({ name: "lg_search", arguments: { query: "short answers" } });
  assert.match(search.content[0].text, /Me\/Me\.md/);
  await client.close();
});
