# LifeGraph website: brief for the builder

This brief is everything needed to build the LifeGraph website. It is written for a coding agent (Codex) working in this repository. Read it top to bottom before writing code. Where it says **must**, that is a hard rule. Where it says *suggested*, use your judgment.

The source of truth for what the product does is the code and docs on `main`: `README.md`, `PRIVACY.md`, `spec/FORMAT.md`, `install.sh` (Mac and Linux), `install.ps1` (Windows), `door/src/`, the fictional demo folder `demo/`, and the token benchmark in `docs/benchmark.md` (run by `bench/run.mjs` over `bench/questions.json`). If this brief and the code disagree, the code wins, and the site must not promise anything the code doesn't do.

---

## 1. The product in one paragraph

LifeGraph is your AI ID: one memory about you that you own, can read and edit yourself, and that every AI on your computer can use, on Mac, Windows or Linux. It is a plain Markdown folder (synced through iCloud Drive on a Mac, or however you like elsewhere), with an `index.md` of rules every AI reads first. A small background program on the computer, **the door**, is a local MCP server that Claude Desktop, Claude Code, Codex, Cursor, Gemini CLI and LM Studio connect to. The door hands each AI only the few notes a question needs, never the whole folder, and never shows notes you lock. Apps that can only read files (like Muse on the Mac) use a **mailbox** instead: they write an ask file and get a reply file. AIs can pass work to each other through **handoff notes**, and every change carries a label saying which AI made it. One install command, free and open source (MIT), no servers, no accounts.

## 2. Audience

Primary, in order:

1. **People who use more than one AI.** They switch between Claude, ChatGPT, Codex, Cursor and others, and re-explain themselves to each one. Each app's built-in memory is locked inside that app, and they can't see or fix what it remembers.
2. **Developers and power users on Mac, Windows or Linux.** Comfortable pasting one command into Terminal or PowerShell, already use Claude Code, Codex or Cursor, and know or will quickly learn what MCP is.
3. **Privacy-minded people.** They want their personal context in files on their own disk, not on another company's server.

Not the audience yet: people who only use AI on their phone, teams. The site should say so plainly rather than hide it (see section 8).

What they need to believe by the end of the page:

- My memory should be a file I own, not a feature of one app.
- This works with the AIs I already use, today, on my computer.
- It only sends an AI what the question needs, and I control what's off-limits.
- It's safe to try: free, open source, one command, easy to remove, my notes stay.

## 3. Positioning

**Category:** a personal memory layer for AI, local-first and open.

**Against the alternatives:**

| Alternative | Its problem | LifeGraph's answer |
| --- | --- | --- |
| Each app's built-in memory | Stuck in one app, hard to see or correct, gone if you switch | One folder every AI uses; you read and edit it like any notes |
| Pasting a long "about me" prompt | Goes stale, sent whole every time, wastes context | Always up to date, and the AI opens only the note it needs |
| Cloud memory services | Another account, another server holding your life | No accounts, no servers; files on your computer, synced only if you choose (iCloud, OneDrive, Syncthing...) |
| A notes app or Obsidian vault on its own | AIs can't reach it, or read all of it at once | The door gives AIs safe, small, rule-following access |

**The one-line claim:** your context belongs to you, not to whichever AI you happened to tell.

**Tone:** calm, plain, confident, a little warm. Short sentences. No hype words ("revolutionary", "supercharge", "unlock", "seamless", "10x"). No invented numbers, testimonials, logos or user counts. Speak to the reader as "you".

### Tagline options

Pick one for the hero; the others can be used as section headers or social text. Recommended first.

1. **Your AI ID. A memory you own, that every AI can use.** (recommended)
2. One memory. Every AI.
3. Tell one AI. Every AI knows.
4. Stop re-introducing yourself to every AI.
5. Your context, in a folder you own.

Subheadline (pairs with any of them):

> LifeGraph is a plain folder of notes about you, on your computer. Claude, Codex, Cursor and other AIs read it and add to it, but each one only sees what the question needs, and never what you lock.

## 4. Selling points (in priority order)

1. **Ownership.** It's a folder of Markdown files. Open it in any editor, change anything, delete anything, back it up, move it. No lock-in, no export button needed.
2. **Works across rival AIs.** Claude, Codex, Cursor, Gemini CLI, LM Studio connect directly; Muse on the Mac through the mailbox. Tell one AI something and the next one already knows. They can even hand work to each other.
3. **Privacy.** No servers, no accounts, no telemetry. The door makes no network calls (CI enforces it). Lock any note and no AI ever sees it.
4. **Token efficiency.** An AI reads the index, then one hub, then one note, a few hundred words instead of your whole life. The cost of a chat **stays nearly flat as your folder grows**, while pasting the folder grows with every note. Numbers from `docs/benchmark.md` may be used, but only under the rules in section 4.1.

### 4.1 Rules for token numbers (must)

The benchmark ran on the fictional `demo/` folder (43 notes, about 2,700 words) with 20 questions. Its figures, all **estimated** (characters divided by 3.5, not exact model counts):

| | Estimated tokens |
| --- | --- |
| Whole folder pasted into a chat | about 4,692 |
| Door, once per chat (tool list, rules and `lg_start`) | about 1,970 |
| Door, per question (`lg_search` + `lg_open`) | about 384 |
| Chat with 1 question through the door | about 2,354, which is 50% less than pasting |
| Chat with 10 questions through the door | about 5,812 (pasting: 4,692) |
| Found the note holding the answer | 20 of 20 questions |

Wherever a number appears on the site:

- Label it **estimated**, and say it was measured on the demo folder.
- Say, close by, that **on a small folder with many questions in one chat, pasting is cheaper**. Do not hide this in a footnote only.
- The headline claim is **"stays flat as your folder grows"**. Never a fixed multiplier ("5x fewer tokens", "saves 80%") and never a dollar figure. "50% less" may appear only next to "for a one-question chat on the demo folder".
- "Found the right note 20 of 20 times" may be quoted as is, with "on 20 test questions".
- Link to `docs/benchmark.md` on GitHub from every place a number appears, so readers can check it and rerun it.
5. **Always up to date.** AIs replace stale lines instead of piling up history, so the folder says what's true now. You see who changed what from the `(via Claude)` labels.

## 5. Site structure

A single long landing page plus a few small pages. Hosted on **GitHub Pages**.

```
/                 landing page (sections below)
/install/         install and first-run guide
/how-it-works/    the folder, the door, the mailbox, locks, handoffs, in more depth
/privacy/         PRIVACY.md, rendered
/faq/             full FAQ (landing page shows the top 6)
/spec/            spec/FORMAT.md, rendered, for people building tools
```

Header nav: How it works · Install · Privacy · FAQ · GitHub (link to the repo).
Footer: MIT license · Spec · Privacy · GitHub · "No cookies, no analytics." 

### Landing page sections, in order

1. Hero
2. The problem
3. How it works (three parts: folder, door, mailbox)
4. Interactive demo (see section 7)
5. Selling points grid
6. AIs working together (handoff + labels)
7. Which apps work today
8. Privacy
9. Install
10. Honest limits / what's next
11. FAQ (top 6, link to full)
12. Final call to action

## 6. Section copy

Use this copy as written unless it doesn't fit the layout; small trims are fine. Do not add claims.

### 6.1 Hero

- **Headline:** Your AI ID. A memory you own, that every AI can use.
- **Sub:** LifeGraph is a plain folder of notes about you, on your computer. Claude, Codex, Cursor and other AIs read it and add to it, but each one only sees what the question needs, and never what you lock.
- **Primary button:** Install → `/install/` (the install section detects Mac, Windows or Linux and shows that command first; see 6.8)
- **Secondary button:** See how it works → `#how`
- **Small line under buttons:** Free and open source. No accounts. Mac, Windows and Linux.
- **Visual:** a stylised folder tree on the left (`index.md`, `Me/`, `Work/`, `People/`, `Money/` with a lock icon) and three or four AI app chips on the right (generic labels, see section 9 on logos) with thin lines going *through a single small "door"* into the folder. The lines touch one note each, not the whole tree.

### 6.2 The problem

**Heading:** Every AI is meeting you for the first time.

> You told Claude about your job. You told ChatGPT about your diet. You told Cursor how you like your code. None of them talk to each other, and you can't easily see or fix what any of them remembers.
>
> So you paste the same "about me" into every new chat, or you give up and get generic answers.

### 6.3 How it works

**Heading:** Three small pieces. All on your computer.

**1. The folder.**
> Your LifeGraph is a normal folder of Markdown notes: a few branches (Me, Work, People, Health, Money...) with a short note per subject. At the top sits `index.md`, which lists the branches and the rules every AI follows. Open it in any editor. It's yours.

**2. The door.**
> A small background program that AIs connect to (it's an MCP server, the standard way AI apps reach local tools). When an AI needs to know something about you, it goes through the door: index first, then one branch, then one note. It never gets the whole folder, and it never gets a note you've locked.

**3. The mailbox.**
> Some apps can read files but can't connect to the door. For those, there's a mailbox: the app drops a question in `mailbox/ask-muse.md` and the answer appears in `mailbox/reply-muse.md` a moment later. Same rules, same locks.

Below the three cards, a single small diagram: `AI → door → index.md → Work/ → Work/job.md`, with a caption: *"A question about your job opens three small files, not your whole life."*

### 6.4 Selling points grid

Five cards, icon + heading + two lines each.

- **You own it.** It's a folder of text files. Read it, edit it, back it up, take it anywhere.
- **Every AI, one memory.** Tell Claude something on Monday, and Codex knows it on Tuesday.
- **Private by design.** No servers, no accounts, no tracking. Lock a note and no AI ever sees it.
- **Only what's needed.** AIs open one small note per question, not your whole history. The cost stays nearly flat as your folder grows. *(Estimated on the demo folder: a one-question chat used about half the tokens of pasting the folder. [See the benchmark.](docs/benchmark.md))*
- **Always current.** AIs replace old facts instead of stacking them, and label every change with their name.

### 6.5 AIs working together

**Heading:** Your AIs can hand work to each other.

> Start a plan in Claude, ask it to hand off, and pick it up in Codex. The handoff note sits in your folder: the goal, what's done, the next step. Every change ends with a label like *(via Claude)* or *(via Codex)*, so you always know who wrote what.
>
> If one AI is in the middle of rewriting a note, it claims it for a while. Other AIs send their changes to the inbox instead, so two AIs never overwrite each other.

Visual: a small handoff note card (Goal / Done so far / Next step / From: Claude / Status: open), and next to it two lines of a note with `(via Claude)` and `(via Codex)` labels highlighted. Use made-up, generic content (e.g. planning a trip to Lisbon), not anything personal.

### 6.6 Which apps work today

**Heading:** Works with the AIs you already use.

Two columns:

**Connected automatically by the installer**
- Claude Desktop
- Claude Code
- Codex
- Cursor
- Gemini CLI
- LM Studio

**Other ways in**
- **Muse (Mac app):** through the mailbox.
- **ChatGPT desktop app:** if your version lets you add a local MCP server, `lifegraph connect` prints the settings to paste in.
- **Any app that takes a local MCP server:** same settings.
- **Phone AIs:** not yet. See below.

Do **not** say ChatGPT is connected automatically. It isn't.

### 6.7 Privacy

**Heading:** Nothing to sign up for. Nothing to leak.

> LifeGraph has no servers. There is no account, no telemetry and no update check. The door makes no network calls, and the build fails if network code ever appears in it.
>
> Your notes live in a folder on your computer. On a Mac with iCloud Drive on, they sync to your iPhone through your own Apple account. On Windows and Linux it's a plain folder: sync it with whatever you already trust, or not at all.
>
> The one honest exception: when an AI reads a note to answer you, that text goes to that AI's company, like anything else you type to it. That's why the door only hands over what a question needs, and why you can lock notes you never want any AI to see.

Button: Read the privacy page → `/privacy/`

### 6.8 Install

**Heading:** One command.

> You need [Node.js](https://nodejs.org) 20 or newer. Then paste one command.

Show three tabs: **Mac**, **Windows**, **Linux**. Pick the visitor's system by default from `navigator.userAgent` (plain inline JS, no library); fall back to Mac. Mac and Linux share the same command:

```bash
curl -fsSL https://raw.githubusercontent.com/theomishin/lifegraph/main/install.sh | bash
```

Windows, in PowerShell (no administrator rights needed):

```powershell
irm https://raw.githubusercontent.com/theomishin/lifegraph/main/install.ps1 | iex
```

Copy button on the code block (must work without any third-party script).

> It creates your LifeGraph folder (in iCloud Drive on a Mac if it's on, a plain folder elsewhere), connects the AI apps you have, and starts the mailbox in the background. Then restart your AI apps and say: *"Read my LifeGraph and fill it from what you remember about me."*
>
> To remove it: `bash ~/.lifegraph-app/src/uninstall.sh` (Mac, Linux) or `& "$HOME\.lifegraph-app\src\uninstall.ps1"` (Windows). Your notes stay.

Link: Full install guide → `/install/`. Link: Read the script first → `install.sh` or `install.ps1` on GitHub, matching the tab (people should be invited to read a script before running it).

### 6.9 Honest limits

**Heading:** What it doesn't do yet.

- **Linux without systemd** (most containers, some WSL setups): everything works except the background mailbox, which you run yourself with `lifegraph mailbox`.
- **Phone AIs can't reach it yet.** Your folder syncs to your iPhone through iCloud, and you can add quick notes from your phone into `inbox/phone.md`, but no phone AI app can open the folder by itself. An iPhone app may come later.
- **Needs Node.js.** Until there are signed desktop apps, the door runs on Node.js.
- **Early software.** This is version 0.1. Expect rough edges, and please report them on GitHub.

### 6.10 Final call to action

**Heading:** Give every AI the same you.
Buttons: Install · Star on GitHub

## 7. Interactive demo (in-browser, no network)

A widget that shows the "only what's needed" idea using the real search logic and the real benchmark numbers. It **must** run entirely in the browser. No API calls, no AI model, no network requests.

### 7.1 Data

- Use the repo's existing **`demo/` folder** ("Maya", a fictional person). Do not write a new sample folder. It already passes `node scripts/check-public.mjs`; update `scripts/check-public.mjs` roots if needed so `demo/` stays covered, and run it in CI.
- Bundle `demo/` into the site at build time (e.g. a generated JSON of path, frontmatter and body for each note). Do not copy the files by hand, so the demo can't drift from the folder the benchmark used.
- To show a locked note, mark one note locked **in the site's build step only** (suggested: `Money/investing.md`), not in `demo/` itself, so the benchmark folder is unchanged. Use the door's real refusal text from `door/src/lifegraph.ts`: "`<path>` is locked. The door never shares or edits locked notes. The user can open it themselves."

### 7.2 Search

- The demo's search is a **JavaScript port of `door/src/search.ts`**, the same scoring the door uses. Put it in `site/src/demo/search.js` (or similar) with a header comment naming the source file it ports.
- Add a build test (run in the site CI workflow) that loads `bench/questions.json` and checks that for all 20 questions the ported search, then opening the top note, lands on the expected `file`. The build fails if any question misses. This keeps the port honest when `search.ts` changes.

### 7.3 Interaction

- Left pane: Maya's folder tree.
- Top: a text box ("Ask Maya's LifeGraph...") plus preset buttons taken from `bench/questions.json` (pick four or five, e.g. her sister's birthday, Tom's allergy, the onboarding redesign deadline, the rule for big purchases) and one that hits the locked note.
- On ask, animate the door's path: `index.md` highlights, then the search hits, then the one note it opens. The right pane shows "what the AI receives": the matching lines and the opened note.
- A locked note shows the refusal text instead of its contents.
- Keyboard accessible. Without JavaScript, show a static rendering of one question's path.

### 7.4 Token counter

Two horizontal bars, both labelled **"estimated"**:

- **Pasting the whole folder:** about 4,692 tokens, the same for every chat.
- **Through the door:** about 1,970 per chat plus about 384 per question. It starts at 2,354 for one question and grows by 384 with each question the visitor asks in the demo session.

Show the running totals as numbers next to the bars. Caption: *"Estimated on Maya's demo folder (43 notes). A one-question chat uses about 50% fewer tokens than pasting. On a small folder with many questions in one chat, pasting is cheaper; see the chart below. [Benchmark](docs/benchmark.md)"*. Below the bars: *"The door found the right note in 20 of 20 test questions."*

When the visitor's door total passes the pasting bar (around question 7), don't hide it. Show a short note: *"On a folder this small, pasting wins after a handful of questions. Bigger folders change that."*

### 7.5 Projection chart

A small line chart under the counter, drawn as inline SVG (no chart library loaded from a CDN).

- X axis: folder size in words, from about 1,000 to 30,000.
- Y axis: estimated tokens for a one-question chat.
- **Pasting** line: rises in proportion to folder size, scaled from the benchmark (about 4,692 tokens at 2,700 words).
- **Door** line: nearly flat, starting at about 2,354. Model a gentle rise only for the growing index and hub lists (suggested: the index and hubs grow by one line per new note, about 15 tokens each, at roughly 60 words per note). State this assumption in a caption.
- Mark Maya's demo folder as a labelled dot on both lines ("Demo folder: 2,700 words").
- Title: **"Pasting grows with your folder. The door stays flat."** Caption: *"Projection from estimated benchmark figures, not a measurement of real folders. Assumes one question per chat."*
- Accessible: a visually hidden table with the plotted points, and both lines distinguishable without colour (solid vs dashed, direct labels).

## 8. FAQ

Landing page shows the first six; `/faq/` shows all.

**What is LifeGraph, in one sentence?**
A folder of notes about you that every AI on your computer can read and add to, through a small local program that only hands over what each question needs.

**Is it free?**
Yes. It's open source under the MIT license. The starter folder, prompts and file format are public domain (CC0). There's no paid tier and no account.

**Where is my data stored?**
In a folder on your computer: `~/LifeGraph` (on Windows, `%USERPROFILE%\LifeGraph`). On a Mac with iCloud Drive on, the folder lives there so your iPhone has a copy, synced through your own Apple account. On Windows and Linux it's a plain folder you can sync with OneDrive, Syncthing, Dropbox or git. LifeGraph itself has no servers.

**Do the AI companies see my notes?**
Only the notes an AI reads to answer you, and only when you ask it something, the same as anything else you type into it. The door gives each AI the smallest piece that answers the question. Locked notes are never shown to any AI.

**Which AIs work with it?**
Claude Desktop, Claude Code, Codex, Cursor, Gemini CLI and LM Studio are connected by the installer. Muse on the Mac works through the mailbox. ChatGPT's desktop app works if your version lets you add a local MCP server. Phone AIs can't reach it yet.

**Does it work on Windows, Linux or iPhone?**
Windows and Linux, yes: same features, one command each. iPhone and Android, not yet: on a Mac your folder syncs to your iPhone and you can add notes from it, but no phone AI can read the folder by itself yet. A phone app may come later.

**How is this different from ChatGPT or Claude memory?**
Those memories live inside one app, on that company's servers, and you can only partly see or edit them. LifeGraph is one set of plain files you own, and every AI you use shares it.

**How does it save tokens?**
Instead of pasting everything about you into every chat, the AI reads a short index, then searches and opens the one note it needs. That cost stays nearly flat as your folder grows, while pasting grows with every note. On our fictional demo folder (43 notes), a one-question chat used an estimated 50% fewer tokens than pasting, and the door found the right note in 20 of 20 test questions. On a small folder with many questions in one chat, pasting is cheaper. [Full benchmark](docs/benchmark.md), which you can rerun yourself.

**What's MCP?**
Model Context Protocol, the open standard AI apps use to connect to local tools and data. The door is an MCP server. You don't need to know anything about it; the installer sets it up.

**What's the mailbox for?**
Some AI apps can read and write files but can't connect to an MCP server, like Muse on the Mac. They write a question to a file in `mailbox/`, and the door writes the answer back a moment later, with the same rules and locks.

**How do I keep something private?**
Run `lifegraph lock <note>` (or add `locked: true` to the note's frontmatter). The door will never show, search or edit it. It still syncs like any other file, if you sync the folder.

**Can two AIs mess up the same note?**
No. An AI rewriting a note claims it for up to 30 minutes, and other AIs' changes go to the inbox until it's done.

**How do I know which AI wrote what?**
Every change ends with a label like *(via Claude)* or *(via Codex)*.

**Can I edit the notes myself?**
Yes, in any text editor, or in Obsidian, which reads the same `[[links]]`. It's your folder.

**What do I need to install it?**
A Mac, Windows or Linux computer with Node.js 20 or newer, and one command in Terminal or PowerShell. Restart your AI apps afterwards.

**How do I uninstall it?**
Run `bash ~/.lifegraph-app/src/uninstall.sh` (Mac, Linux) or `& "$HOME\.lifegraph-app\src\uninstall.ps1"` (Windows). The app and connections are removed; your notes stay where they are.

**Can I build my own tool on it?**
Yes. The file format is a short public spec, CC0. See `/spec/`.

## 9. Visual and technical requirements for the builder

### Stack and hosting

- Static site in `site/` at the repo root. *Suggested:* Astro (static output). Plain HTML/CSS with a little vanilla JS is also fine. No React needed.
- Deploy with GitHub Actions to GitHub Pages (`.github/workflows/site.yml`, using `actions/upload-pages-artifact` and `actions/deploy-pages`). Build on changes to `site/**`, `demo/**`, `door/src/search.ts`, `bench/questions.json`, `docs/benchmark.md`, `PRIVACY.md`, `spec/**` or `docs/website-brief.md`. `demo/`, `bench/` and `docs/benchmark.md` arrive with PR #2, so build after it is merged.
- Base URL: assume `https://theomishin.github.io/lifegraph/` for now, configured in one place so a custom domain can be swapped in later.

### Privacy rules (must; these are promises made in PRIVACY.md)

- **No third-party requests at all.** No Google Fonts, no CDNs, no analytics, no embedded videos, no external images, no GitHub star badges loaded from shields.io. Self-host fonts or use the system font stack.
- **No cookies, no localStorage** except, at most, remembering light/dark choice.
- Add a CI check (in the site workflow) that fails if built HTML/CSS/JS contains `http://` or `https://` URLs in `src=`, `href` for stylesheets, `@import`, or `fetch(`, other than links (`<a href>`) to github.com, nodejs.org and modelcontextprotocol.io.
- `demo/` must pass `node scripts/check-public.mjs`. Run it in CI.

### Look and feel

- Quiet and typographic, like a well-made notes app. Lots of white space. One accent colour (*suggested:* a deep green or ink blue). Monospace for file names and commands.
- Light and dark mode via `prefers-color-scheme`, with a toggle.
- Recurring motif: the folder tree with `[[links]]` and the small "door" glyph. Draw the illustrations as inline SVG.
- **App names, not logos.** Show Claude, Codex, Cursor etc. as plain text chips. Don't use their logos or brand colours, and don't imply endorsement.
- Mobile responsive down to 360px wide; the install command block scrolls horizontally inside itself rather than breaking the page.

### Quality bar

- Lighthouse: 95+ on performance, accessibility, best practices, SEO.
- Semantic HTML, one `h1`, alt text on every illustration, visible focus states, AA contrast in both themes.
- Total page weight for `/` under 200 KB excluding fonts.
- Open Graph and Twitter card meta with a static OG image (`site/public/og.png`, 1200×630, the hero tagline and the folder motif).
- `<title>`: "LifeGraph: your AI ID". Meta description: the subheadline.
- A `404.html` page.

### Content sources to reuse, not rewrite

- `/privacy/` renders `PRIVACY.md`.
- `/spec/` renders `spec/FORMAT.md`.
- `/install/` expands section 6.8 with the steps from `README.md` (options like `--icloud`, the `lifegraph` commands, what the installer touches).
- Pull these at build time so the site can't drift from the repo.

## 10. Things the site must never say

- Any token number without "estimated" and the small-folder caveat next to it, any fixed multiplier ("5x fewer tokens"), any percentage not tied to the one-question demo chat, or any cost or speed figure.
- That it works on iPhone or Android today.
- That ChatGPT connects automatically.
- That nothing ever leaves your computer (the sync you choose, and what an AI reads, do).
- That it is "encrypted" (it isn't; it's plain files, protected by your computer and whatever sync you use).
- Testimonials, user counts, press logos, or "trusted by".
- Anything about a real person. All examples use fictional people and data.

## 11. Definition of done

- [ ] `site/` builds with one command and deploys to GitHub Pages from `main`.
- [ ] All landing sections from section 5 exist, with the copy from section 6.
- [ ] Demo works offline, is built from `demo/`, and `check-public.mjs` passes.
- [ ] The search port passes the build test on all 20 questions in `bench/questions.json`.
- [ ] Token counter and projection chart show "estimated", link to `docs/benchmark.md`, and include the small-folder caveat.
- [ ] `/install/`, `/how-it-works/`, `/privacy/`, `/faq/`, `/spec/`, `404` exist.
- [ ] No third-party requests (checked in CI), no cookies, no analytics.
- [ ] Lighthouse 95+ in all four categories, light and dark.
- [ ] Nothing from section 10 appears anywhere.
