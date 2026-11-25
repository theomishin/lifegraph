# The LifeGraph format (v0.2)

A LifeGraph is a folder of Markdown files that any person or program can read and write. This spec is CC0, so any tool may implement it.

## Layout

```
index.md            root: one line per branch, plus "Rules for AI assistants"
<Branch>/<Branch>.md   a hub: one line per leaf in that branch
<Branch>/<leaf>.md     a leaf: the current state of one subject
inbox/inbox.md      lines waiting to be filed
inbox/phone.md      lines appended from the phone (append-only on the phone)
handoff/<name>.md   handoff notes passed between AIs
mailbox/            ask-*.md / reply-*.md files for apps that can only use files
.lifegraph/         the door's bookkeeping (who last looked, who is editing what); safe to delete
```

- Links use Obsidian's double-bracket form, `[[leaf-name]]`, resolved by file name anywhere in the folder.
- A hub lists each leaf as `- [[leaf-name]] — one-line description`. The description is what lets a model decide whether to open the leaf, so keep it specific.
- A leaf links back up with `Back to [[Hub]].` or `Part of [[Hub]].`

## Frontmatter

Every file may start with YAML frontmatter:

```yaml
---
updated: 2026-11-24        # last real change, ISO date
updated_by: Claude         # which AI (or person) made it
locked: true               # optional: the door never shows, searches or edits this note
---
```

`privacy: private`, from v0.1, is read as `locked: true`. A locked hub (`Money/Money.md`) locks every note in its folder.

## Lines

- A fact is one list line. A dated fact starts with the date and ends with who wrote it: `- 2026-11-24: Started a new job at ... (via Claude)`.
- Leaves keep the current state. A tool that learns a fact has changed replaces the old line rather than adding a second one. History lives in git if you want it.

## Inbox and phone

- `inbox/phone.md` is appended to only by the phone, one line per note: `- 2026-11-24 09:41: text`.
- The computer's assistant files each line into a leaf and then removes exactly the lines it filed. Sync tools (iCloud Drive and others) may leave conflict copies such as `phone 2.md`; tools treat any `inbox/phone*.md` as part of the phone inbox.

## Handoff notes and claims

A handoff note in `handoff/` has the sections Goal, Done so far, Next step, Open questions, Notes it touches, From, Status (`open` or `done`).

An AI rewriting a note over several steps claims it for 30 minutes. While it is claimed, other AIs' changes to that note go to `inbox/inbox.md` tagged `[for <path>]`, so two AIs never edit one note at once.

## Mailbox

An app that can only use files writes `mailbox/ask-<app>.md`: a `from: <app>` line, then a plain question or commands (`open:`, `search:`, `remember:`, `inbox`, `handoff`). The door answers in `mailbox/reply-<app>.md` and deletes the ask. The mailbox folder is traffic, not memory: it is never searched.
