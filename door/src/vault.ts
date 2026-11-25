// The vault: a folder of Markdown files. Everything here is plain filesystem
// work. This module (and the whole server) never touches the network.
import { promises as fs, realpathSync } from "node:fs";
import path from "node:path";

export interface Note {
  rel: string; // path relative to the vault, with forward slashes
  name: string; // file name without .md, used by [[links]]
  frontmatter: Record<string, string>;
  body: string; // content without frontmatter
  raw: string;
  /** Locked notes are never returned, searched or edited by the door. */
  locked: boolean;
  mtimeMs: number;
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function splitFrontmatter(raw: string): { frontmatter: Record<string, string>; body: string } {
  const m = raw.match(FRONTMATTER);
  if (!m) return { frontmatter: {}, body: raw };
  const frontmatter: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*?)\s*(#.*)?$/);
    if (kv) frontmatter[kv[1]] = kv[2].replace(/^["']|["']$/g, "");
  }
  return { frontmatter, body: raw.slice(m[0].length) };
}

export function setFrontmatter(raw: string, key: string, value: string): string {
  const m = raw.match(FRONTMATTER);
  if (!m) return `---\n${key}: ${value}\n---\n${raw}`;
  const lines = m[1].split(/\r?\n/);
  const i = lines.findIndex((l) => l.startsWith(`${key}:`));
  if (i >= 0) lines[i] = `${key}: ${value}`;
  else lines.push(`${key}: ${value}`);
  return `---\n${lines.join("\n")}\n---\n` + raw.slice(m[0].length);
}

export function today(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export class Vault {
  readonly root: string;

  constructor(root: string) {
    this.root = realpathSync(path.resolve(root));
  }

  /** Resolve a vault-relative path, refusing anything that escapes the vault. */
  resolve(rel: string): string {
    const abs = path.resolve(this.root, rel);
    const relCheck = path.relative(this.root, abs);
    if (relCheck.startsWith("..") || path.isAbsolute(relCheck)) {
      throw new Error(`Path is outside the LifeGraph folder: ${rel}`);
    }
    return abs;
  }

  async list(): Promise<Note[]> {
    const out: Note[] = [];
    const walk = async (dir: string) => {
      for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
        if (entry.name.startsWith(".") || entry.name === "mailbox") continue; // .obsidian, .lifegraph, .git; mailbox is traffic, not memory
        const abs = path.join(dir, entry.name);
        if (entry.isDirectory()) await walk(abs);
        else if (entry.isFile() && entry.name.endsWith(".md")) out.push(await this.readAbs(abs));
      }
    };
    await walk(this.root);
    return out.sort((a, b) => a.rel.localeCompare(b.rel));
  }

  private async readAbs(abs: string): Promise<Note> {
    const [raw, stat] = await Promise.all([fs.readFile(abs, "utf8"), fs.stat(abs)]);
    const { frontmatter, body } = splitFrontmatter(raw);
    const rel = path.relative(this.root, abs).split(path.sep).join("/");
    const name = path.basename(abs, ".md");
    const lock = (frontmatter.locked ?? "").toLowerCase();
    return {
      rel,
      name,
      frontmatter,
      body,
      raw,
      locked: lock === "true" || lock === "yes" || (frontmatter.privacy ?? "").toLowerCase() === "private",
      mtimeMs: stat.mtimeMs,
    };
  }

  async read(rel: string): Promise<Note> {
    return this.readAbs(this.resolve(rel));
  }

  async exists(rel: string): Promise<boolean> {
    try {
      await fs.access(this.resolve(rel));
      return true;
    } catch {
      return false;
    }
  }

  /** Find a note by [[link name]], file name, or relative path. Case-insensitive on names. */
  async find(ref: string): Promise<Note | undefined> {
    const clean = ref.replace(/^\[\[|\]\]$/g, "").split("|")[0].split("#")[0].trim();
    const notes = await this.list();
    const asPath = clean.endsWith(".md") ? clean : `${clean}.md`;
    return (
      notes.find((n) => n.rel === asPath) ??
      notes.find((n) => n.name === clean) ??
      notes.find((n) => n.name.toLowerCase() === clean.toLowerCase())
    );
  }

  async write(rel: string, content: string): Promise<void> {
    const abs = this.resolve(rel);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    // Write to a temp file then rename, so a sync tool never sees half a file.
    const tmp = `${abs}.lifegraph-tmp`;
    await fs.writeFile(tmp, content, "utf8");
    await fs.rename(tmp, abs);
  }

  async remove(rel: string): Promise<void> {
    await fs.unlink(this.resolve(rel));
  }

  /** Hidden per-vault state folder for indexes and bookkeeping. Safe to delete. */
  stateDir(): string {
    return path.join(this.root, ".lifegraph");
  }
}

/** The "Rules for ..." section of index.md, used as the server's instructions. */
export function extractRules(indexBody: string): string | undefined {
  const m = indexBody.match(/^##\s+Rules for[^\n]*\n([\s\S]*?)(?=^##\s|(?![\s\S]))/m);
  return m ? m[1].trim() : undefined;
}

/** All [[links]] in a body, by target name. */
export function links(body: string): string[] {
  return [...body.matchAll(/\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g)].map((m) => m[1].trim());
}
