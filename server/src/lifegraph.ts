// LifeGraph operations, independent of MCP so they can be tested and reused by the CLI.
import { promises as fs } from "node:fs";
import path from "node:path";
import { allowed, extractRules, Note, Privacy, setFrontmatter, splitFrontmatter, today, Vault } from "./vault.js";
import { search, Hit } from "./search.js";

export interface Options {
  /** Highest privacy level this app may read. Default: personal. */
  ceiling?: Privacy;
  /** Clock, for tests. */
  now?: () => Date;
}

export class LifeGraph {
  readonly vault: Vault;
  readonly ceiling: Privacy;
  private now: () => Date;

  constructor(root: string, opts: Options = {}) {
    this.vault = new Vault(root);
    this.ceiling = opts.ceiling ?? "personal";
    this.now = opts.now ?? (() => new Date());
  }

  private visible(note: Note): boolean {
    return allowed(note.privacy, this.ceiling);
  }

  private hidden(note: Note): string {
    return `${note.rel} is marked privacy: ${note.privacy}, above this app's ceiling (${this.ceiling}). Ask the user to open it themselves or raise the ceiling for this app.`;
  }

  async rules(): Promise<string | undefined> {
    try {
      return extractRules((await this.vault.read("index.md")).body);
    } catch {
      return undefined;
    }
  }

  // ---------- lg_start ----------
  async start(client = "unknown"): Promise<string> {
    const notes = await this.vault.list();
    const index = notes.find((n) => n.rel === "index.md");
    const seen = await this.readState<Record<string, number>>("seen.json", {});
    const since = seen[client] ?? 0;

    const changed = notes
      .filter((n) => n.rel !== "index.md" && n.mtimeMs > since && this.visible(n) && !n.rel.startsWith("handoff/") && !n.rel.startsWith("inbox/"))
      .sort((a, b) => b.mtimeMs - a.mtimeMs)
      .slice(0, 15);
    const cards = await this.handoffList();
    const inbox = await this.inboxLines();

    seen[client] = Date.now();
    await this.writeState("seen.json", seen);

    const parts = [index ? index.body.trim() : "(No index.md found in the LifeGraph folder.)"];
    if (since && changed.length) {
      parts.push("## Changed since this app last looked\n" + changed.map((n) => `- ${n.rel}`).join("\n"));
    }
    const open = cards.filter((c) => c.status !== "done");
    if (open.length) parts.push("## Open handoff cards\n" + open.map((c) => `- ${c.name}: ${c.goal}`).join("\n"));
    if (inbox.length) parts.push(`## Inbox\n${inbox.length} line(s) waiting to be filed. Call lg_inbox to see them.`);
    return parts.join("\n\n");
  }

  // ---------- lg_open ----------
  async open(ref: string): Promise<string> {
    const note = await this.vault.find(ref);
    if (!note) {
      const all = await this.vault.list();
      const names = all.filter((n) => this.visible(n)).map((n) => n.name);
      const close = names.filter((n) => n.toLowerCase().includes(ref.toLowerCase().replace(/\.md$/, ""))).slice(0, 5);
      return `No note named "${ref}".${close.length ? ` Did you mean: ${close.join(", ")}?` : ""}`;
    }
    if (!this.visible(note)) return this.hidden(note);
    return `# file: ${note.rel} (privacy: ${note.privacy})\n\n${note.body.trim()}`;
  }

  // ---------- lg_search ----------
  async search(query: string, limit = 8): Promise<Hit[]> {
    const notes = (await this.vault.list()).filter((n) => this.visible(n));
    return search(notes, query, limit);
  }

  // ---------- lg_remember ----------
  async remember(args: {
    fact: string;
    leaf?: string;
    replaces?: string;
    branch?: string;
    description?: string;
  }): Promise<string> {
    const fact = args.fact.replace(/\s*\n\s*/g, " ").trim();
    if (!fact) throw new Error("fact is empty");
    const line = `- ${today(this.now())}: ${fact}`;

    // No leaf: the inbox, to be filed later.
    if (!args.leaf) {
      await this.appendLine("inbox/inbox.md", line, "# Inbox\nBack to [[index]].\n");
      return `Added to inbox/inbox.md: ${line}`;
    }

    let note = await this.vault.find(args.leaf);
    if (!note) {
      if (!args.branch) {
        return `No leaf named "${args.leaf}". To create it, call again with branch (the hub it belongs under, e.g. "People") and a one-line description. Or leave out leaf to put the fact in the inbox.`;
      }
      return this.createLeaf(args.leaf, args.branch, args.description ?? "", line);
    }
    if (!this.visible(note)) return this.hidden(note);

    let raw = note.raw;
    if (args.replaces) {
      const lines = raw.split("\n");
      const matches = lines.map((l, i) => (l.includes(args.replaces!) ? i : -1)).filter((i) => i >= 0);
      if (matches.length === 0) return `Nothing in ${note.rel} contains "${args.replaces}". Nothing was changed.`;
      if (matches.length > 1) return `"${args.replaces}" matches ${matches.length} lines in ${note.rel}; give more of the line. Nothing was changed.`;
      const old = lines[matches[0]];
      lines[matches[0]] = line;
      raw = lines.join("\n");
      raw = setFrontmatter(raw, "updated", today(this.now()));
      await this.vault.write(note.rel, raw);
      return `Replaced in ${note.rel}:\n  was: ${old.trim()}\n  now: ${line}`;
    }
    raw = raw.replace(/\s*$/, "\n") + line + "\n";
    raw = setFrontmatter(raw, "updated", today(this.now()));
    await this.vault.write(note.rel, raw);
    return `Added to ${note.rel}: ${line}`;
  }

  private async createLeaf(leaf: string, branch: string, description: string, line: string): Promise<string> {
    const hub = await this.vault.find(branch);
    if (!hub) return `No branch hub named "${branch}". Branches are listed in index.md.`;
    const slug = leaf
      .replace(/\.md$/, "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-|-$/g, "");
    if (!slug) throw new Error("leaf name is empty");
    const rel = path.posix.join(path.posix.dirname(hub.rel), `${slug}.md`);
    const body = `---\nupdated: ${today(this.now())}\nprivacy: personal\n---\n# ${leaf.replace(/\.md$/, "")}\nPart of [[${hub.name}]].\n\n${line}\n`;
    await this.vault.write(rel, body);
    await this.appendLine(hub.rel, `- [[${slug}]]${description ? ` — ${description}` : ""}`);
    return `Created ${rel} (linked from ${hub.rel}) with: ${line}`;
  }

  private async appendLine(rel: string, line: string, header = ""): Promise<void> {
    let raw = (await this.vault.exists(rel)) ? (await this.vault.read(rel)).raw : header;
    raw = raw.replace(/\s*$/, "\n") + line + "\n";
    if (splitFrontmatter(raw).frontmatter.updated) raw = setFrontmatter(raw, "updated", today(this.now()));
    await this.vault.write(rel, raw);
  }

  // ---------- lg_inbox ----------
  /** Lines waiting in inbox/inbox.md and the phone inbox (including sync conflict copies). */
  async inboxLines(): Promise<{ file: string; text: string }[]> {
    const dir = this.vault.resolve("inbox");
    let files: string[] = [];
    try {
      files = (await fs.readdir(dir)).filter((f) => f.endsWith(".md") && (f === "inbox.md" || f.startsWith("phone")));
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

  /** Remove lines that have been filed. Matches whole lines exactly; deletes empty conflict copies. */
  async inboxDone(lines: string[]): Promise<string> {
    const wanted = new Set(lines.map((l) => l.trim()));
    const removed: string[] = [];
    const byFile = new Map<string, true>();
    for (const l of await this.inboxLines()) if (wanted.has(l.text)) byFile.set(l.file, true);
    for (const file of byFile.keys()) {
      const note = await this.vault.read(file);
      const kept = note.raw.split("\n").filter((l) => {
        if (wanted.has(l.trim())) {
          removed.push(l.trim());
          return false;
        }
        return true;
      });
      const isConflictCopy = /^inbox\/phone .+\.md$/.test(file);
      const remaining = kept.join("\n");
      if (isConflictCopy && !/^\s*-\s+\S/m.test(splitFrontmatter(remaining).body)) await this.vault.remove(file);
      else await this.vault.write(file, remaining);
    }
    const missing = [...wanted].filter((w) => !removed.includes(w));
    return `Removed ${removed.length} line(s) from the inbox.${missing.length ? ` Not found (already removed?): ${missing.join(" | ")}` : ""}`;
  }

  // ---------- lg_handoff ----------
  async handoffList(): Promise<{ name: string; goal: string; status: string; from: string }[]> {
    const notes = (await this.vault.list()).filter((n) => n.rel.startsWith("handoff/") && n.name !== "handoff");
    return notes.map((n) => ({
      name: n.name,
      goal: section(n.body, "Goal").split("\n")[0] || "(no goal)",
      status: (section(n.body, "Status") || n.frontmatter.status || "open").toLowerCase().split(/\s/)[0],
      from: section(n.body, "From"),
    }));
  }

  async handoffWrite(card: { name: string; goal: string; done?: string; next: string; questions?: string; from: string }): Promise<string> {
    const slug = card.name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
    const rel = `handoff/${slug}.md`;
    const body = [
      `---\nupdated: ${today(this.now())}\nprivacy: personal\n---`,
      `# ${card.name}\nPart of [[handoff]].`,
      `## Goal\n${card.goal}`,
      `## Done so far\n${card.done || "Nothing yet."}`,
      `## Next step\n${card.next}`,
      `## Open questions\n${card.questions || "None."}`,
      `## From\n${card.from}, ${today(this.now())}`,
      `## Status\nopen`,
    ].join("\n\n");
    const existed = await this.vault.exists(rel);
    await this.vault.write(rel, body + "\n");
    if (!existed && (await this.vault.exists("handoff/handoff.md"))) await this.appendLine("handoff/handoff.md", `- [[${slug}]] — ${card.goal.split("\n")[0]}`);
    return `${existed ? "Updated" : "Wrote"} ${rel}. Another model can pick it up with lg_handoff read "${slug}".`;
  }

  async handoffClose(name: string): Promise<string> {
    const note = await this.vault.find(name);
    if (!note || !note.rel.startsWith("handoff/")) return `No handoff card named "${name}".`;
    const raw = note.raw.replace(/## Status\n[^\n]*/, "## Status\ndone");
    await this.vault.write(note.rel, setFrontmatter(raw, "updated", today(this.now())));
    return `Marked ${note.rel} as done.`;
  }

  // ---------- identity card ----------
  /** A deterministic identity card for apps with no connector: Me plus each hub's leaf list. */
  async card(maxWords = 600): Promise<string> {
    const notes = (await this.vault.list()).filter((n) => allowed(n.privacy, this.ceiling));
    const me = notes.find((n) => n.name === "Me");
    const parts: string[] = [];
    if (me) parts.push(clean(me.body));
    for (const hub of notes.filter((n) => n.rel.split("/").length === 2 && n.rel.split("/")[0] === n.name && n.name !== "Me")) {
      const items = clean(hub.body).split("\n").filter((l) => l.startsWith("- "));
      if (items.length) parts.push(`${hub.name}:\n${items.join("\n")}`);
    }
    const words = parts.join("\n\n").split(/(?<=\s)/);
    return words.slice(0, maxWords).join("").trim();
  }

  // ---------- state ----------
  private async readState<T>(file: string, fallback: T): Promise<T> {
    try {
      return JSON.parse(await fs.readFile(path.join(this.vault.stateDir(), file), "utf8")) as T;
    } catch {
      return fallback;
    }
  }

  private async writeState(file: string, value: unknown): Promise<void> {
    await fs.mkdir(this.vault.stateDir(), { recursive: true });
    await fs.writeFile(path.join(this.vault.stateDir(), file), JSON.stringify(value, null, 2));
  }
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
