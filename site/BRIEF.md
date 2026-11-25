# Website brief: LifeGraph

This is the full brief for building the LifeGraph website. It is written for a coding agent (Codex) or a person. Build exactly this. Where something is not specified, choose the simplest option that keeps the site static, fast and private.

## 1. The product in one paragraph

LifeGraph is one folder about you that every AI on your Mac reads and writes through. The folder is plain Markdown that you can open and edit yourself. A small program on the Mac, called **the door**, connects the folder to Claude Desktop, Claude Code, Codex, Cursor and other AI apps. Each app gets only the notes a question needs, never the whole folder. Apps save what they learn back into the folder, each change labelled with the app that made it. It is free, open source (MIT), with no accounts, no servers and no tracking. Setup is one Terminal command.

**One-line promise (hero):** *One memory for all your AIs. Yours, on your Mac.*

**Sub-line:** *LifeGraph is a folder of plain notes about you. Claude, Codex, Cursor and others read what they need from it and keep it up to date. Free, open source, no account.*

## 2. Who it is for

People who pay for or use more than one AI app, are tired of re-explaining themselves to each one, and care that their personal information stays theirs. Technical enough to paste one command into Terminal, but not necessarily developers. Mac users first.

## 3. What makes it different (use these, in this order)

1. **Every AI shares one memory.** Today Claude knows one slice of you, ChatGPT another, and none of them can see the rest. LifeGraph is one folder they all use.
2. **Only what the question needs.** An AI reads a short index, then one note. Not your whole life every time. (See the benchmark, section 7.)
3. **It keeps itself up to date.** AIs add a dated line to the right note when they learn something. No rebuilding, no re-uploading.
4. **You can read and edit all of it.** Plain Markdown files. Works with Obsidian, any text editor, iCloud Drive.
5. **Private by design.** No LifeGraph account or server exists. Lock any note and no AI ever sees it.
6. **AIs can hand work to each other.** One AI writes a handoff note; another picks it up. While one AI rewrites a note, others wait instead of overwriting it.

Do not claim things beyond this list. In particular, do not claim it works on the iPhone (no iPhone app yet; the phone only has an iCloud copy of the files), do not claim the ChatGPT Mac app is supported (unconfirmed), and do not claim token savings bigger than the benchmark shows.

## 4. Tone and writing rules

- Plain, warm, confident. Short sentences. Talk to the reader as "you".
- No jargon on the first screen. "MCP server" may appear only on the How it works page and in the FAQ, explained once as "the standard way AI apps connect to tools".
- No hype words: revolutionary, supercharge, seamless, unleash, magic.
- Never use em-dashes in copy. Use commas, colons or full stops.
- British or American spelling is fine; be consistent (use American).

## 5. Pages

A single-page site with anchored sections is fine, plus two separate pages (Docs, Privacy). Required:

### 5.1 Home (`/`)

1. **Hero:** promise, sub-line, the install command in a copyable code block, and two buttons: "See the demo" (scrolls to demo) and "View on GitHub" (https://github.com/theomishin/lifegraph).
2. **The problem:** three small cards: "Each AI knows a different slice of you", "You keep re-explaining yourself", "Your details are scattered across company servers".
3. **How it works:** a simple diagram (inline SVG, no image files needed): AI apps on the left (Claude, Codex, Cursor, Muse) -> the door (middle) -> your LifeGraph folder (right, showing `index.md`, a few branch folders). A dashed line from the folder to an iPhone labelled "iCloud copy". Below it, the six points from section 3 as a grid with short copy.
4. **Live demo:** see section 6. This is the centrepiece.
5. **The numbers:** the benchmark result from section 7, presented honestly.
6. **Install:** three steps:
   1. Install Node.js (link to https://nodejs.org).
   2. Paste the command in Terminal.
   3. Restart your AI apps and say: *"Read my LifeGraph and fill it from what you remember about me."*
   Then a line: "Already keep notes in a folder called LifeGraph? The installer uses it as it is."
7. **Privacy in one screen:** the bullet list from `PRIVACY.md` in the repo, word for word.
8. **FAQ:** at least these:
   - *Does it cost anything?* No. It's free and open source (MIT).
   - *Does my data go to a LifeGraph server?* There is no LifeGraph server. Your notes stay on your Mac and in your own iCloud Drive. When an AI reads a note to answer you, that note is sent to that AI's company, like anything else you type to it.
   - *Which apps work?* Claude Desktop, Claude Code, Codex, Cursor, Gemini CLI, LM Studio. Apps that can only read files, like Muse on the Mac, use the mailbox.
   - *What about my iPhone?* Your LifeGraph syncs to the iPhone through iCloud Drive, so you can read and add notes in the Files app. There is no iPhone app yet.
   - *Can I hide things from the AIs?* Yes. Lock a note with `lifegraph lock <note>` and the door never shows, searches or edits it.
   - *What if two AIs change the same note?* An AI that is rewriting a note claims it; the others send their changes to the inbox, and they get filed afterwards.
   - *How do I remove it?* One command; your notes stay.
   - *Is the app signed by Apple?* Not yet. It runs on Node.js, which you install from nodejs.org, so there is nothing to sign.
9. **Footer:** GitHub link, MIT license, "No cookies, no analytics, no tracking on this site."

### 5.2 Docs (`/docs/`)

Rendered from the repo's Markdown where possible: README sections (install, how it works, command line), `spec/FORMAT.md`, and the prompts in `prompts/`. A simple left nav. Keep it a static build step that reads those files, so the docs never drift from the repo.

### 5.3 Privacy (`/privacy/`)

`PRIVACY.md` rendered, plus a sentence about the site itself (static, GitHub Pages, no cookies, no analytics, no third-party requests).

## 6. The live demo

Runs entirely in the browser. No backend, no API calls.

**Data:** the fictional demo folder in `demo/` (a person called Maya in Lisbon, 43 notes). At build time, convert it to one JSON file: for each note, its path, title, body, `[[links]]`, and token estimate (characters / 3.5). Do not edit the demo notes by hand on the site; regenerate from `demo/`.

**Layout, desktop:** two panes.

- **Left: the graph.** Every note is a node, `[[links]]` are edges. `index.md` in the centre, branch hubs around it, leaves around their hubs. Use a small force layout written by hand or a tiny library loaded from the site's own files (no CDN, see section 8). Colour nodes by branch, with the palette in section 9. Hover shows the note title; click opens it in the right pane.
- **Right: the chat simulator.** A row of example question chips (use the 20 questions in `bench/questions.json`, show 6 at random, with a "more" link) and a text box for typing any question. When a question is asked, animate what the door does, step by step, with a short pause between steps:
  1. "Reads the index" (highlight `index.md` in the graph)
  2. "Searches for: <keywords>" (show the top matching lines)
  3. "Opens <note>" (highlight that node, show the note)
  Search must be a JS port of the door's search (BM25 over lines, same tokenizer and stemmer as `door/src/search.ts`) so the demo behaves like the real thing. Do not fake results.

**Token counter:** under the simulator, two bars that update after each question:

- "Whole folder pasted": fixed, the total of all notes.
- "Through the door": tool list and rules (1,206) + index (764) + what this question loaded.

Show the numbers and the percentage saved. Label them "estimated tokens" with a tooltip: "Estimated as characters / 3.5. Run `node bench/run.mjs --exact` for exact Claude counts."

**Locked note:** `Money/budget.md` should show as locked in the demo (a lock icon on the node, greyed out). If a question would match it, the simulator shows "1 locked note skipped". Add `locked: true` to the JSON for that note at build time; don't change the demo folder.

**Mobile:** stack the panes, graph above (shorter, 300px), simulator below. The graph may be non-interactive on small screens.

## 7. The benchmark (what to say)

From `node bench/run.mjs` on the demo folder (estimated tokens, 20 questions):

| | Tokens |
| --- | --- |
| Whole folder pasted into a chat | 4,692 |
| Through the door, a chat with 1 question | 2,354 (50% less) |
| Through the door, per extra question | about 384 |
| Questions where the door found the right note | 20 of 20 |

How to present it, honestly:

- The door's cost stays about the same as your folder grows. Pasting grows with every note you add. The demo is small (about 2,700 words); a well-filled LifeGraph is often 6,000 words or more, where the gap is much larger.
- For a long chat with many questions about you on a small folder, pasting can be cheaper. Say so in one line: "On a small folder with many questions in one chat, pasting can be cheaper. The door wins as your LifeGraph grows."
- A small line chart (inline SVG): x axis "folder size (words)", y axis "tokens per chat"; one line rising (pasting), one nearly flat (door, 1 question), with the demo marked. Compute it from the formula: pasting = words x 1.73; door = 1,970 + 384. State it is a projection.
- Link to `bench/` on GitHub so anyone can rerun it.

Re-run the benchmark before launch and use its output, not these numbers, if they differ.

## 8. Technical requirements

- **Static only.** Plain HTML, CSS and JS, or Astro with static output. No server, no serverless functions.
- **Hosting:** GitHub Pages from this repo, built by a GitHub Actions workflow (`.github/workflows/site.yml`) on push to `main`, publishing `site/dist`. Do not enable Pages or buy a domain; the owner will do that.
- **No third-party requests at all.** No CDNs, no Google Fonts, no analytics, no embedded videos, no cookies, no localStorage except an optional theme preference. Self-host any font (or use the system font stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif`). Add a CI check that fails if built HTML references any `http(s)://` origin other than github.com, nodejs.org, and the site's own.
- **Size:** home page under 200 KB of JS and CSS combined, demo data included. Lighthouse 95+ on performance, accessibility, best practices and SEO.
- **Accessibility:** keyboard reachable demo (question chips and node list are buttons), visible focus, colour contrast AA, `prefers-reduced-motion` turns off the step animation and the graph simulation (render a static layout).
- **Dark mode:** follow `prefers-color-scheme`, with a toggle.
- **SEO:** title "LifeGraph: one memory for all your AIs", description = the sub-line, Open Graph image (a simple static PNG of the graph, generated at build time or drawn as SVG and exported).
- **Code layout:** everything in `site/`. Build script reads `../demo`, `../README.md`, `../PRIVACY.md`, `../spec/FORMAT.md`, `../prompts/*.md`, `../bench/questions.json`.
- **License:** MIT like the rest of the repo.

## 9. Visual direction

Calm, paper-like, personal. Think of a well-kept notebook, not a SaaS dashboard.

- Background: warm off-white `#FAF8F4` (dark mode `#151413`). Text: `#1E1C1A` (dark `#ECE8E1`). Muted text `#6B655D`.
- One accent: deep green `#2F6B4F` (dark mode `#6FBF95`) for buttons, links and the door in diagrams.
- Branch colours for the graph (muted, distinguishable, AA on both backgrounds): Me `#2F6B4F`, Work `#3B5B8C`, Learning `#7A5AA6`, Projects `#B5643C`, People `#B0476B`, Health `#3E8A82`, Money `#8A7A2E`, Life `#5E6B73`, Interests `#9A5B2E`. Index node: the text colour.
- Type: system font stack for text; a monospace stack for code and file names. Large, generous line height (1.6), max text width 68ch.
- Rounded corners 10px, hairline borders `#E6E1D8`, no heavy shadows, no gradients, no stock illustrations or AI-generated people. Simple line icons only.
- The install command block should look like a real Terminal line with a copy button that says "Copied" for 2 seconds.

## 10. Acceptance checklist

- [ ] Home, Docs and Privacy pages build with one command and deploy with the workflow.
- [ ] The install command on the site matches the README exactly.
- [ ] The demo answers all 20 benchmark questions by opening the same note the real door opens (add a build-time test that runs the JS search over `bench/questions.json` and checks the expected files).
- [ ] The locked demo note never appears in search results or the opened note pane.
- [ ] The token numbers on the page come from the benchmark output or the build-time JSON, not hard-coded guesses.
- [ ] No request leaves the site's origin (check the browser's network panel and the CI check).
- [ ] Works at 360px wide, with keyboard only, and with reduced motion.
- [ ] No claims beyond section 3; the iPhone and ChatGPT caveats from the FAQ are present.
