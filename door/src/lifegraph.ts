// LifeGraph operations, independent of MCP so the door, the mailbox and the CLI share them.
import { promises as fs } from "node:fs";
import path from "node:path";
import { extractRules, Note, setFrontmatter, splitFrontmatter, today, Vault } from "./vault.js";
import { search, Hit } from "./search.js";

export interface Options {
  /** Clock, for tests. */
  now?: () => Date;
  /** How long a claim on a note lasts without being renewed. Default 30 minutes. */
  claimMinutes?: number;
}

interface Claim {
  by: string;
  task?: string;
  until: number;
}

/** Turn an MCP client name into a short label people recognise. */
export function label(client: string | undefined): string {
  const c = (client ?? "").trim();
  if (!c) return "an AI";
  if (/claude-code|claude code/i.test(c)) return "Claude Code";
  if (/claude/i.test(c)) return "Claude";
  if (/codex/i.test(c)) return "Codex";
  if (/cursor/i.test(c)) return "Cursor";
  if (/chatgpt|openai/i.test(c)) return "ChatGPT";
  if (/gemini/i.test(c)) return "Gemini";
  if (/lm ?studio/i.test(c)) return "LM Studio";
  return c.slice(0, 40);
}

export class LifeGraph {
  readonly vault: Vault;
  private now: () => Date;
  private claimMs: number;

  constructor(root: string, opts: Options = {}) {
    this.vault = new Vault(root);
    this.now = opts.now ?? (() => new Date());
    this.claimMs = (opts.claimMinutes ?? 30) * 60_000;
  }

  private locked(note: Note): string {
    return `${note.rel} is locked. The door never shares or edits locked notes. The user can open it themselves.`;
  }

  async rules(): Promise<string | undefined> {
    try {
      return extractRules((await this.vault.read("index.md")).body);
    } catch {
      return undefined;
    }
  }

  // ---------- start ----------
  async start(client = "unknown"): Promise<string> {
    const notes = await this.vault.list();
    const index = notes.find((n) => n.rel === "index.md");
    const seen = await this.readState<Record<string, number>>("seen.json", {});
    const since = seen[client] ?? 0;

    const changed = notes
      .filter((n) => n.rel !== "index.md" && n.mtimeMs > since && !n.locked && !/^(handoff|inbox)\//.test(n.rel))
      .sort((a, b) => b.mtimeMs - a.mtimeMs)
      .slice(0, 15);
    const cards = (await this.handoffList()).filter((c) => c.status !== "done");
    const inbox = await this.inboxLines();
    const claims = Object.entries(await this.claims()).filter(([, c]) => c.by !== label(client));

    seen[client] = this.now().getTime();
    await this.writeState("seen.json", seen);

    const parts = [index ? index.body.trim() : "(No index.md found in the LifeGraph folder.)"];
    if (since && changed.length) {
      parts.push("## Changed since you last looked\n" + changed.map((n) => `- ${n.rel}${n.frontmatter.updated_by ? ` (by ${n.frontmatter.updated_by})` : ""}`).join("\n"));
    }
    if (cards.length) parts.push("## Open handoff notes\n" + cards.map((c) => `- ${c.name}: ${c.goal}${c.from ? ` (from ${c.from})` : ""}`).join("\n"));
    if (claims.length) parts.push("## Being edited right now by another AI (don't edit these)\n" + claims.map(([rel, c]) => `- ${rel}: ${c.by}${c.task ? `, ${c.task}` : ""}`).join("\n"));
    if (inbox.length) parts.push(`## Inbox\n${inbox.length} line(s) waiting to be filed. Call lg_inbox to see them.`);
    return parts.join("\n\n");
  }

  // ---------- open ----------
  async open(ref: string): Promise<string> {
    const note = await this.vault.find(ref);
    if (!note) {
      const names = (await this.vault.list()).filter((n) => !n.locked).map((n) => n.name);
      const close = names.filter((n) => n.toLowerCase().includes(ref.toLowerCase().replace(/\.md$/, ""))).slice(0, 5);
      return `No note named "${ref}".${close.length ? ` Did you mean: ${close.join(", ")}?` : ""}`;
    }
    if (note.locked) return this.locked(note);
    return `# file: ${note.rel}\n\n${note.body.trim()}`;
  }

  // ---------- search ----------
  async search(query: string, limit = 8): Promise<Hit[]> {
    const notes = (await this.vault.list()).filter((n) => !n.locked);
    return search(notes, query, limit);
  }

  // ---------- remember ----------
  async remember(
    args: { fact: string; leaf?: string; replaces?: string; branch?: string; description?: string },
    client = "unknown",
  ): Promise<string> {
    const who = label(client);
    const fact = args.fact.replace(/\s*\n\s*/g, " ").trim();
    if (!fact) throw new Error("fact is empty");
    const line = `- ${today(this.now())}: ${fact} (via ${who})`;

    if (!args.leaf) {
      await this.appendLine("inbox/inbox.md", line, who, "# Inbox\nBack to [[index]].\n");
      return `Added to inbox/inbox.md: ${line}`;
    }

    const note = await this.vault.find(args.leaf);
    if (!note) {
      if (!args.branch) {
        return `No note named "${args.leaf}". To create it, call again with branch (the hub it belongs under, e.g. "People") and a one-line description. Or leave out leaf to put the fact in the inbox.`;
      }
      return this.createLeaf(args.leaf, args.branch, args.description ?? "", line, who);
    }
    if (note.locked) return this.locked(note);

    const claim = (await this.claims())[note.rel];
    if (claim && claim.by !== who) {
      await this.appendLine("inbox/inbox.md", `${line} [for ${note.rel}]`, who, "# Inbox\nBack to [[index]].\n");
      return `${note.rel} is being edited by ${claim.by}${claim.task ? ` (${claim.task})` : ""}, so the fact went to the inbox instead and will be filed later: ${line}`;
    }

    let raw = note.raw;
    let result: string;
    if (args.replaces) {
      const lines = raw.split("\n");
      const matches = lines.map((l, i) => (l.includes(args.replaces!) ? i : -1)).filter((i) => i >= 0);
      if (matches.length === 0) return `Nothing in ${note.rel} contains "${args.replaces}". Nothing was changed.`;
      if (matches.length > 1) return `"${args.replaces}" matches ${matches.length} lines in ${note.rel}; give more of the line. Nothing was changed.`;
      const old = lines[matches[0]];
      lines[matches[0]] = line;
      raw = lines.join("\n");
      result = `Replaced in ${note.rel}:\n  was: ${old.trim()}\n  now: ${line}`;
    } else {
      raw = raw.replace(/\s*$/, "\n") + line + "\n";
      result = `Added to ${note.rel}: ${line}`;
    }
    raw = setFrontmatter(setFrontmatter(raw, "updated", today(this.now())), "updated_by", who);
    await this.vault.write(note.rel, raw);
    return result;
  }

  private async createLeaf(leaf: string, branch: string, description: string, line: string, who: string): Promise<string> {
    const hub = await this.vault.find(branch);
    if (!hub) return `No branch hub named "${branch}". Branches are listed in index.md.`;
    if (hub.locked) return this.locked(hub);
    const slug = slugify(leaf);
    if (!slug) throw new Error("leaf name is empty");
    const rel = path.posix.join(path.posix.dirname(hub.rel), `${slug}.md`);
    const body = `---\nupdated: ${today(this.now())}\nupdated_by: ${who}\n---\n# ${leaf.replace(/\.md$/, "")}\nPart of [[${hub.name}]].\n\n${line}\n`;
    await this.vault.write(rel, body);
    await this.appendLine(hub.rel, `- [[${slug}]]${description ? ` — ${description}` : ""}`, who);
    return `Created ${rel} (linked from ${hub.rel}) with: ${line}`;
  }

  private async appendLine(rel: string, line: string, who: string, header = ""): Promise<void> {
    let raw = (await this.vault.exists(rel)) ? (await this.vault.read(rel)).raw : header;
    raw = raw.replace(/\s*$/, "\n") + line + "\n";
    if (splitFrontmatter(raw).frontmatter.updated) raw = setFrontmatter(setFrontmatter(raw, "updated", today(this.now())), "updated_by", who);
    await this.vault.write(rel, raw);
  }

  // ---------- inbox ----------
  /** Lines waiting in inbox/inbox.md and inbox/phone.md (including iCloud conflict copies like "phone 2.md"). */
  async inboxLines(): Promise<{ file: string; text: string }[]> {
    let files: string[] = [];
    try {
      files = (await fs.readdir(this.vault.resolve("inbox"))).filter((f) => f.endsWith(".md") && (f === "inbox.md" || f.startsWith("phone")));
    } catch {
      return [];
    }
    const out: { file: string; text: string }[] = [];
    for (const f of files.sort()) {
      const note = await this.vault.read(`inbox/${f}`);
      for (const l of note.body.split("\n")) {
        if (/^\s*-\s+\S/.test(l) && !/^\s*-\s+\[\[/.test(l)) out.push({ file: note.rel, text: l.trim() });
      }
    }
    return out;
  }

  /** Remove lines that have been filed. Matches whole lines exactly; deletes emptied conflict copies. */
  async inboxDone(lines: string[]): Promise<string> {
    const wanted = new Set(lines.map((l) => l.trim()));
    const removed = new Set<string>();
    const files = new Set((await this.inboxLines()).filter((l) => wanted.has(l.text)).map((l) => l.file));
    for (const file of files) {
      const note = await this.vault.read(file);
      const kept = note.raw.split("\n").filter((l) => {
        if (wanted.has(l.trim())) {
          removed.add(l.trim());
          return false;
        }
        return true;
      });
      const remaining = kept.join("\n");
      const isConflictCopy = /^inbox\/phone .+\.md$/.test(file);
      if (isConflictCopy && !/^\s*-\s+\S/m.test(splitFrontmatter(remaining).body)) await this.vault.remove(file);
      else await this.vault.write(file, remaining);
    }
    const missing = [...wanted].filter((w) => !removed.has(w));
    return `Removed ${removed.size} line(s) from the inbox.${missing.length ? ` Not found (already removed?): ${missing.join(" | ")}` : ""}`;
  }

  // ---------- handoff and claims ----------
  async handoffList(): Promise<{ name: string; goal: string; status: string; from: string }[]> {
    const notes = (await this.vault.list()).filter((n) => n.rel.startsWith("handoff/") && n.name !== "handoff");
    return notes.map((n) => ({
      name: n.name,
      goal: section(n.body, "Goal").split("\n")[0] || "(no goal)",
      status: (section(n.body, "Status") || "open").toLowerCase().split(/\s/)[0],
      from: section(n.body, "From"),
    }));
  }

  async handoffWrite(
    card: { name: string; goal: string; done?: string; next: string; questions?: string; notes?: string[] },
    client = "unknown",
  ): Promise<string> {
    const who = label(client);
    const slug = slugify(card.name);
    if (!slug) throw new Error("name is empty");
    const rel = `handoff/${slug}.md`;
    const body = [
      `---\nupdated: ${today(this.now())}\nupdated_by: ${who}\n---`,
      `# ${card.name}\nPart of [[handoff]].`,
      `## Goal\n${card.goal}`,
      `## Done so far\n${card.done || "Nothing yet."}`,
      `## Next step\n${card.next}`,
      `## Open questions\n${card.questions || "None."}`,
      `## Notes it touches\n${card.notes?.length ? card.notes.map((n) => `- ${n}`).join("\n") : "None listed."}`,
      `## From\n${who}, ${today(this.now())}`,
      `## Status\nopen`,
    ].join("\n\n");
    const existed = await this.vault.exists(rel);
    await this.vault.write(rel, body + "\n");
    if (!existed && (await this.vault.exists("handoff/handoff.md"))) await this.appendLine("handoff/handoff.md", `- [[${slug}]] — ${card.goal.split("\n")[0]}`, who);
    return `${existed ? "Updated" : "Wrote"} ${rel}. Another AI can pick it up with lg_handoff read "${slug}".`;
  }

  async handoffClose(name: string, client = "unknown"): Promise<string> {
    const note = await this.vault.find(name.startsWith("handoff/") ? name : `handoff/${slugify(name)}`);
    if (!note || !note.rel.startsWith("handoff/")) return `No handoff note named "${name}".`;
    const raw = note.raw.replace(/## Status\n[^\n]*/, "## Status\ndone");
    await this.vault.write(note.rel, setFrontmatter(setFrontmatter(raw, "updated", today(this.now())), "updated_by", label(client)));
    return `Marked ${note.rel} as done.`;
  }

  /** Active claims by note path. Expired claims are dropped. */
  async claims(): Promise<Record<string, Claim>> {
    const all = await this.readState<Record<string, Claim>>("claims.json", {});
    const now = this.now().getTime();
    return Object.fromEntries(Object.entries(all).filter(([, c]) => c.until > now));
  }

  /** Say "I am editing these notes" so other AIs write to the inbox instead of the same note. */
  async claim(refs: string[], client = "unknown", task?: string): Promise<string> {
    const who = label(client);
    const all = await this.claims();
    const got: string[] = [];
    const busy: string[] = [];
    for (const ref of refs) {
      const note = await this.vault.find(ref);
      if (!note) {
        busy.push(`${ref} (no such note)`);
        continue;
      }
      if (note.locked) {
        busy.push(`${note.rel} (locked)`);
        continue;
      }
      const c = all[note.rel];
      if (c && c.by !== who) {
        busy.push(`${note.rel} (${c.by} is editing it)`);
        continue;
      }
      all[note.rel] = { by: who, task, until: this.now().getTime() + this.claimMs };
      got.push(note.rel);
    }
    await this.writeState("claims.json", all);
    return [
      got.length ? `You are now editing: ${got.join(", ")} (for ${this.claimMs / 60_000} minutes; claim again to extend, release when done).` : "",
      busy.length ? `Not available: ${busy.join(", ")}.` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  async release(client = "unknown", refs?: string[]): Promise<string> {
    const who = label(client);
    const all = await this.claims();
    const targets = refs?.length ? await Promise.all(refs.map(async (r) => (await this.vault.find(r))?.rel)) : undefined;
    let n = 0;
    for (const [rel, c] of Object.entries(all)) {
      if (c.by === who && (!targets || targets.includes(rel))) {
        delete all[rel];
        n++;
      }
    }
    await this.writeState("claims.json", all);
    return `Released ${n} note(s).`;
  }

  // ---------- identity card ----------
  /** A short identity card for apps with no connector: Me plus each hub's leaf list. */
  async card(maxWords = 600): Promise<string> {
    const notes = (await this.vault.list()).filter((n) => !n.locked);
    const me = notes.find((n) => n.name === "Me");
    const parts: string[] = [];
    if (me) parts.push(clean(me.body));
    for (const hub of notes.filter((n) => n.rel.split("/").length === 2 && n.rel.split("/")[0] === n.name && n.name !== "Me")) {
      const items = clean(hub.body).split("\n").filter((l) => l.startsWith("- "));
      if (items.length) parts.push(`${hub.name}:\n${items.join("\n")}`);
    }
    return parts.join("\n\n").split(/(?<=\s)/).slice(0, maxWords).join("").trim();
  }

  // ---------- state ----------
  async readState<T>(file: string, fallback: T): Promise<T> {
    try {
      return JSON.parse(await fs.readFile(path.join(this.vault.stateDir(), file), "utf8")) as T;
    } catch {
      return fallback;
    }
  }

  async writeState(file: string, value: unknown): Promise<void> {
    await fs.mkdir(this.vault.stateDir(), { recursive: true });
    await fs.writeFile(path.join(this.vault.stateDir(), file), JSON.stringify(value, null, 2));
  }
}

export function slugify(s: string): string {
  return s
    .replace(/\.md$/, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "");
}

function section(body: string, name: string): string {
  const m = body.match(new RegExp(`^##\\s+${name}\\s*\\n([\\s\\S]*?)(?=^##\\s|(?![\\s\\S]))`, "m"));
  return m ? m[1].trim() : "";
}

function clean(body: string): string {
  return body
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/^(Back to|Part of) \[\[[^\]]+\]\]\.?\s*$/gm, "")
    .replace(/\[\[([^\]|]+)(\|[^\]]+)?\]\]/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
