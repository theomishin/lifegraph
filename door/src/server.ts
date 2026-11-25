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

const HOW = `Save lasting facts with lg_remember (labelled with your app's name automatically). Before rewriting a note over several steps, lg_claim it. Locked notes are never shown; don't ask to unlock them.`;

export async function createServer(root: string, opts: Options = {}): Promise<McpServer> {
  const lg = new LifeGraph(root, opts);
  // Keep this short: it is sent in every chat. The user's own rules come with lg_start (from index.md),
  // so they are not repeated here.
  const vaultRules = await lg.rules();
  const instructions = [
    "LifeGraph is the user's memory, shared by all their AI apps. Call lg_start at the start of a chat and follow the rules it returns. Then load as little as possible: lg_search, or one note with lg_open.",
    vaultRules ? "" : `Rules:\n${DEFAULT_RULES}\n`,
    HOW,
  ].filter(Boolean).join("\n");

  const server = new McpServer({ name: "lifegraph", version: VERSION }, { instructions });
  const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });
  const clientName = () => server.server.getClientVersion()?.name ?? "unknown";

  server.registerTool(
    "lg_start",
    {
      title: "Start: read the LifeGraph index",
      description:
        "Call once at the start of a chat: the index, the user's rules, what changed, open handoffs.",
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
        "Open one note by link name ('books') or path ('Interests/books.md'). Open a hub to see its notes.",
      inputSchema: { name: z.string().describe("Link name or vault-relative path of the note") },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ name }) => text(await lg.open(name)),
  );

  server.registerTool(
    "lg_search",
    {
      title: "Search LifeGraph",
      description: "Search all notes. Returns matching lines with their file, not whole files.",
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
        "Save one lasting fact as a dated line in a note. 'replaces' swaps out a stale line. No 'leaf' = inbox. New note: give leaf, branch and description. Tell the user what you saved.",
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
