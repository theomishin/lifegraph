// Line-level full-text search over the vault, in memory.
// A personal vault is small (thousands of lines), so a fresh scan with BM25
// scoring is fast and needs no native database. Results are lines, not files,
// so an assistant spends tokens only on what matches.
import { Note } from "./vault.js";

export interface Hit {
  file: string;
  heading?: string;
  line: number;
  text: string;
  score: number;
}

const STOP = new Set(
  "a an and are as at be but by do for from has have i in is it its me my of on or our so that the their them they this to was we what when where which who why will with you your".split(
    " ",
  ),
);

export function tokenize(text: string): string[] {
  return (text.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").match(/[\p{L}\p{N}]+/gu) ?? [])
    .filter((t) => t.length > 1 && !STOP.has(t))
    .map(stem);
}

// Tiny English stemmer: enough to match "running"/"run", "books"/"book".
function stem(t: string): string {
  if (t.length > 5 && t.endsWith("ing")) return t.slice(0, -3);
  if (t.length > 4 && t.endsWith("ies")) return t.slice(0, -3) + "y";
  if (t.length > 4 && t.endsWith("ed")) return t.slice(0, -2);
  if (t.length > 3 && t.endsWith("s") && !t.endsWith("ss")) return t.slice(0, -1);
  return t;
}

interface Doc {
  file: string;
  heading?: string;
  line: number;
  text: string;
  tokens: string[];
}

export function search(notes: Note[], query: string, limit = 8): Hit[] {
  const q = [...new Set(tokenize(query))];
  if (q.length === 0) return [];

  const docs: Doc[] = [];
  for (const note of notes) {
    const offset = note.raw.split("\n").length - note.body.split("\n").length;
    let heading: string | undefined;
    // Blank out <!-- comments --> (template hints) but keep line numbers.
    const body = note.body.replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, ""));
    body.split("\n").forEach((text, i) => {
      const h = text.match(/^#{1,6}\s+(.*)/);
      if (h) heading = h[1].trim();
      const trimmed = text.trim();
      if (!trimmed) return;
      // File name counts as context for every line, so "music" finds Interests/music.md lines.
      const tokens = tokenize(`${trimmed} ${note.name.replace(/[-_]/g, " ")} ${heading ?? ""}`);
      if (tokens.length) docs.push({ file: note.rel, heading, line: offset + i + 1, text: trimmed, tokens });
    });
  }
  if (docs.length === 0) return [];

  const N = docs.length;
  const avg = docs.reduce((s, d) => s + d.tokens.length, 0) / N;
  const df = new Map<string, number>();
  for (const t of q) df.set(t, docs.filter((d) => d.tokens.includes(t)).length);

  const k1 = 1.2;
  const b = 0.75;
  const hits: Hit[] = [];
  for (const d of docs) {
    let score = 0;
    for (const t of q) {
      const tf = d.tokens.filter((x) => x === t).length;
      if (!tf) continue;
      const n = df.get(t) ?? 0;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      score += (idf * tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * d.tokens.length) / avg));
    }
    // Hub lines only point at a leaf; prefer the leaf's own lines.
    if (/\[\[/.test(d.text)) score *= 0.6;
    if (score > 0) hits.push({ file: d.file, heading: d.heading, line: d.line, text: d.text, score: Math.round(score * 100) / 100 });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}
