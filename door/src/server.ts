// The door: LifeGraph's MCP server. Speaks MCP over stdio only: no ports, no network.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { LifeGraph, Options } from "./lifegraph.js";

export const VERSION = "0.1.0";

const DEFAULT_RULES = `- Call lg_start at the start of every chat, then open only the hub and leaf the chat needs with lg_open.
- When the user asks something that needs memory about them, check LifeGraph first (lg_search or lg_open).
- When lasting new information comes up, save it with lg_remember and tell the user what was added.
- Leaves hold the current state: replace a stale line (lg_remember with replaces) instead of adding a second one.
- Only write what the user said or decided. No guesses, no advice.`;

const HOW = `How the rules map to tools: read with lg_start, lg_open and lg_search; save a fact with lg_remember (it is labelled with your app's name automatically); file phone and inbox lines with lg_inbox; pass work to another AI with lg_handoff.
Before rewriting a note over several steps, call lg_claim so other AIs write to the inbox instead of the same note, and release it when done.
Locked notes are never shown to you. Don't ask the user to unlock them.`;

export async function createServer(root: string, opts: Options = {}): Promise<McpServer> {
  const lg = new LifeGraph(root, opts);
  const vaultRules = await lg.rules();
  const instructions = [
    "LifeGraph is the user's memory across AI assistants: a folder of Markdown files (index.md -> branch hubs -> leaves).",
    "Use these tools instead of guessing about the user. Load as little as possible: start with lg_start, then open one hub, then one leaf.",
    "",
    "The user's own rules (from index.md):",
    vaultRules ?? DEFAULT_RULES,
    "",
    HOW,
  ].join("\n");

  const server = new McpServer({ name: "lifegraph", version: VERSION }, { instructions });
  const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });
  const clientName = () => server.server.getClientVersion()?.name ?? "unknown";

  server.registerTool(
    "lg_start",
    {
      title: "Start: read the LifeGraph index",
      description:
        "Call once at the start of every chat. Returns index.md (the branches and the user's rules), leaves changed since this app last looked, open handoff cards and the inbox count. Small: a few hundred tokens.",
      inputSchema: {},
      annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => text(await lg.start(clientName())),
  );

  server.registerTool(
    "lg_open",
    {
      title: "Open one hub or leaf",
      description:
        "Open one note by its [[link]] name (e.g. 'People', 'books') or path ('Interests/books.md'). Open a branch hub first to see its leaves, then only the leaf you need. Never open everything.",
      inputSchema: { name: z.string().describe("Link name or vault-relative path of the note") },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ name }) => text(await lg.open(name)),
  );

  server.registerTool(
    "lg_search",
    {
      title: "Search LifeGraph",
      description: "Full-text search across the vault. Returns the best matching lines with their file and heading, not whole files.",
      inputSchema: {
        query: z.string().describe("Words to look for"),
        limit: z.number().int().min(1).max(30).optional().describe("Max lines to return (default 8)"),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ query, limit }) => {
      const hits = await lg.search(query, limit ?? 8);
      if (!hits.length) return text(`No lines match "${query}". Try lg_open on the hub that should hold it.`);
      return text(hits.map((h) => `${h.file}:${h.line}${h.heading ? ` (${h.heading})` : ""}  ${h.text}`).join("\n"));
    },
  );

  server.registerTool(
    "lg_remember",
    {
      title: "Remember a fact",
      description:
        "Save one lasting fact the user told you or decided, as a dated line in the right leaf. Use 'replaces' to swap out a line that is now stale. Leave out 'leaf' when unsure where it belongs: it goes to the inbox. To create a new leaf, give 'leaf', 'branch' and 'description'. Tell the user what you saved.",
      inputSchema: {
        fact: z.string().describe("The fact, one short line, in the user's terms. No date: it is added."),
        leaf: z.string().optional().describe("Leaf name or path, e.g. 'books' or 'People/sam.md'"),
        replaces: z.string().optional().describe("Part of the existing line this fact replaces (must match exactly one line)"),
        branch: z.string().optional().describe("Hub to create a new leaf under, e.g. 'People'"),
        description: z.string().optional().describe("One-line description for the hub when creating a new leaf"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async (args) => text(await lg.remember(args, clientName())),
  );

  server.registerTool(
    "lg_inbox",
    {
      title: "Phone and inbox lines",
      description:
        "action 'list': lines waiting in inbox/inbox.md and inbox/phone.md (added from the phone). File each one into the right leaf with lg_remember, then call action 'done' with the exact lines you filed to remove them.",
      inputSchema: {
        action: z.enum(["list", "done"]),
        lines: z.array(z.string()).optional().describe("For 'done': the exact lines, as listed, that you filed"),
      },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async ({ action, lines }) => {
      if (action === "done") return text(await lg.inboxDone(lines ?? []));
      const all = await lg.inboxLines();
      return text(all.length ? all.map((l) => `[${l.file}] ${l.text}`).join("\n") : "The inbox is empty.");
    },
  );

  server.registerTool(
    "lg_handoff",
    {
      title: "Hand a task to another model",
      description:
        "Handoff notes in handoff/ let another AI pick up where you stopped. action 'list' shows them; 'read' opens one; 'write' creates or updates one (needs name, goal, next); 'close' marks it done.",
      inputSchema: {
        action: z.enum(["list", "read", "write", "close"]),
        name: z.string().optional().describe("Card name, e.g. 'trip-planning'"),
        goal: z.string().optional(),
        done: z.string().optional().describe("Decisions made and work finished so far"),
        next: z.string().optional().describe("The single next action"),
        questions: z.string().optional().describe("Open questions for the user"),
        notes: z.array(z.string()).optional().describe("Notes this task will change"),
      },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async ({ action, name, goal, done, next, questions, notes }) => {
      if (action === "list") {
        const cards = await lg.handoffList();
        return text(cards.length ? cards.map((c) => `- ${c.name} [${c.status}] ${c.goal}${c.from ? ` (from ${c.from})` : ""}`).join("\n") : "No handoff notes.");
      }
      if (!name) return text("name is required for this action.");
      if (action === "read") return text(await lg.open(`handoff/${name.replace(/^handoff\//, "")}`));
      if (action === "close") return text(await lg.handoffClose(name, clientName()));
      if (!goal || !next) return text("write needs goal and next (and ideally done, questions and notes).");
      return text(await lg.handoffWrite({ name, goal, done, next, questions, notes }, clientName()));
    },
  );

  server.registerTool(
    "lg_claim",
    {
      title: "Claim notes while editing",
      description:
        "action 'claim': say you are editing these notes for the next 30 minutes, so other AIs send their changes to the inbox instead. action 'release': give them back (all of yours if notes is empty). Use it for multi-step rewrites, not for a single lg_remember.",
      inputSchema: {
        action: z.enum(["claim", "release"]),
        notes: z.array(z.string()).optional().describe("Note names or paths"),
        task: z.string().optional().describe("What you are doing, shown to other AIs"),
      },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async ({ action, notes, task }) =>
      text(action === "claim" ? await lg.claim(notes ?? [], clientName(), task) : await lg.release(clientName(), notes)),
  );

  return server;
}

export async function serveStdio(root: string, opts: Options = {}): Promise<void> {
  const server = await createServer(root, opts);
  await server.connect(new StdioServerTransport());
}
