// The LifeGraph MCP server. Speaks MCP over stdio only: no ports, no network.
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
    "How the rules map to tools: reading is lg_start / lg_open / lg_search; writing a fact is lg_remember; the phone inbox is lg_inbox; task cards are lg_handoff.",
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
    async (args) => text(await lg.remember(args)),
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
        "Task cards in handoff/ let another model pick up where this one stopped. action 'list' shows cards; 'read' opens one; 'write' creates or updates one (needs name, goal, next, from); 'close' marks it done.",
      inputSchema: {
        action: z.enum(["list", "read", "write", "close"]),
        name: z.string().optional().describe("Card name, e.g. 'trip-planning'"),
        goal: z.string().optional(),
        done: z.string().optional().describe("Decisions made and work finished so far"),
        next: z.string().optional().describe("The single next action"),
        questions: z.string().optional().describe("Open questions for the user"),
        from: z.string().optional().describe("Your model or app name"),
      },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async ({ action, name, goal, done, next, questions, from }) => {
      if (action === "list") {
        const cards = await lg.handoffList();
        return text(cards.length ? cards.map((c) => `- ${c.name} [${c.status}] ${c.goal}${c.from ? ` (from ${c.from})` : ""}`).join("\n") : "No handoff cards.");
      }
      if (!name) return text("name is required for this action.");
      if (action === "read") return text(await lg.open(`handoff/${name.replace(/^handoff\//, "")}`));
      if (action === "close") return text(await lg.handoffClose(name));
      if (!goal || !next) return text("write needs goal and next (and ideally done, questions and from).");
      return text(await lg.handoffWrite({ name, goal, done, next, questions, from: from ?? clientName() }));
    },
  );

  return server;
}

export async function serveStdio(root: string, opts: Options = {}): Promise<void> {
  const server = await createServer(root, opts);
  await server.connect(new StdioServerTransport());
}
