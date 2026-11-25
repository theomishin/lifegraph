// The mailbox: the same door for AIs that can only read and write files (Muse on the Mac, for example).
// An AI writes mailbox/ask-<anything>.md; the door answers in mailbox/reply-<anything>.md and removes the ask.
//
// An ask file holds a question in plain words, or one or more commands, one per line:
//   from: Muse                 who is asking (used as the change label)
//   open: People               one note
//   search: dog vet            matching lines
//   remember: Likes jazz now   a fact, to the inbox (or `remember books: ...` for a note)
//   inbox                      list inbox lines
//   handoff                    list handoff notes; `handoff: name` reads one
import { promises as fs, existsSync, watch } from "node:fs";
import path from "node:path";
import { LifeGraph } from "./lifegraph.js";

export const MAILBOX = "mailbox";

export async function answer(lg: LifeGraph, ask: string): Promise<string> {
  const lines = ask.split("\n").map((l) => l.trim()).filter((l) => l && !/^#/.test(l) && l !== "---");
  let from = "Mailbox";
  const out: string[] = [];
  const question: string[] = [];

  for (const line of lines) {
    const m = line.match(/^([a-z]+)(?:\s+([^:]+))?\s*:\s*(.*)$/i);
    const cmd = (m?.[1] ?? line).toLowerCase();
    const arg = m?.[3]?.trim() ?? "";
    if (m && cmd === "from") from = arg || from;
    else if (m && cmd === "open") out.push(await lg.open(arg));
    else if (m && cmd === "search") out.push(formatHits(await lg.search(arg, 10), arg));
    else if (m && cmd === "remember") out.push(await lg.remember({ fact: arg, leaf: m[2]?.trim() || undefined }, from));
    else if (cmd === "inbox") {
      const items = await lg.inboxLines();
      out.push(items.length ? items.map((i) => i.text).join("\n") : "The inbox is empty.");
    } else if (cmd === "handoff" && !arg) {
      const cards = await lg.handoffList();
      out.push(cards.length ? cards.map((c) => `- ${c.name} [${c.status}] ${c.goal}`).join("\n") : "No handoff notes.");
    } else if (m && cmd === "handoff") out.push(await lg.open(`handoff/${arg}`));
    else question.push(line);
  }

  if (question.length) out.push(await answerQuestion(lg, question.join(" ")));
  if (!out.length) out.push(await lg.start(from));
  return out.join("\n\n---\n\n");
}

/** A plain question: the lines that match, plus the one note they mostly come from. */
async function answerQuestion(lg: LifeGraph, q: string): Promise<string> {
  const hits = await lg.search(q, 10);
  if (!hits.length) {
    const start = await lg.start("Mailbox");
    return `Nothing in LifeGraph matches "${q}". Here is the index, so you can ask for a note by name with "open: <name>":\n\n${start}`;
  }
  const byFile = new Map<string, number>();
  for (const h of hits) byFile.set(h.file, (byFile.get(h.file) ?? 0) + h.score);
  const [best] = [...byFile.entries()].sort((a, b) => b[1] - a[1]);
  const parts = [formatHits(hits, q)];
  if (best) parts.push(`Most relevant note:\n\n${await lg.open(best[0])}`);
  return parts.join("\n\n");
}

function formatHits(hits: { file: string; heading?: string; text: string }[], q: string): string {
  if (!hits.length) return `No lines match "${q}".`;
  return `Lines matching "${q}":\n` + hits.map((h) => `- ${h.file}${h.heading ? ` (${h.heading})` : ""}: ${h.text}`).join("\n");
}

/** Answer every waiting ask file once. Returns how many were answered. */
export async function processMailbox(lg: LifeGraph): Promise<number> {
  const dir = lg.vault.resolve(MAILBOX);
  if (!existsSync(dir)) return 0;
  let n = 0;
  for (const f of await fs.readdir(dir)) {
    const m = f.match(/^ask(.*)\.(md|txt)$/i);
    if (!m) continue; // replies, README, iCloud placeholders (".ask.md.icloud")
    const askPath = path.join(dir, f);
    let ask: string;
    try {
      ask = await fs.readFile(askPath, "utf8");
    } catch {
      continue;
    }
    const reply = await answer(lg, ask).catch((e) => `The door could not answer: ${e instanceof Error ? e.message : e}`);
    const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
    await lg.vault.write(`${MAILBOX}/reply${m[1]}.md`, `# Reply from LifeGraph (${stamp})\n\nYou asked:\n\n> ${ask.trim().split("\n").join("\n> ")}\n\n${reply}\n`);
    await fs.unlink(askPath).catch(() => undefined);
    n++;
  }
  return n;
}

/** Watch the mailbox until the process ends. Polls as well, because file events from iCloud Drive are unreliable. */
export function watchMailbox(lg: LifeGraph, log: (msg: string) => void = () => undefined, everyMs = 2000): () => void {
  let busy = false;
  const run = async () => {
    if (busy) return;
    busy = true;
    try {
      const n = await processMailbox(lg);
      if (n) log(`answered ${n} ask file(s)`);
    } catch (e) {
      log(`mailbox error: ${e instanceof Error ? e.message : e}`);
    } finally {
      busy = false;
    }
  };
  const dir = lg.vault.resolve(MAILBOX);
  let watcher: ReturnType<typeof watch> | undefined;
  try {
    if (existsSync(dir)) watcher = watch(dir, () => void run());
  } catch {
    /* polling covers it */
  }
  const timer = setInterval(run, everyMs);
  void run();
  return () => {
    clearInterval(timer);
    watcher?.close();
  };
}
