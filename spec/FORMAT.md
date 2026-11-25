# The LifeGraph format (v0.1)

A LifeGraph is a folder of Markdown files that any person or program can read and write. This spec is CC0, so any tool may implement it.

## Layout

```
index.md            root: one line per branch, plus "Rules for AI assistants"
<Branch>/<Branch>.md   a hub: one line per leaf in that branch
<Branch>/<leaf>.md     a leaf: the current state of one subject
inbox/inbox.md      lines waiting to be filed
inbox/phone.md      lines appended from the phone (append-only on the phone)
handoff/<card>.md   task cards passed between models
.lifegraph/         tool state and indexes; safe to delete, never synced to git
```

- Links use Obsidian's double-bracket form, `[[leaf-name]]`, resolved by file name anywhere in the folder.
- A hub lists each leaf as `- [[leaf-name]] — one-line description`. The description is what lets a model decide whether to open the leaf, so keep it specific.
- A leaf links back up with `Back to [[Hub]].` or `Part of [[Hub]].`

## Frontmatter

Every file may start with YAML frontmatter:

```yaml
---
updated: 2026-11-24          # last real change, ISO date
privacy: open | personal | private
---
```

- `open`: fine to share with any assistant.
- `personal`: about you; fine for assistants you have connected.
- `private`: stays on your machine unless you explicitly allow an app to see it.

Missing `privacy` means `personal`. Tools must never show a file above an app's privacy ceiling.

## Lines

- A fact is one list line. A dated fact starts with the date: `- 2026-11-24: Started a new job at ...`.
- Leaves keep the current state. A tool that learns a fact has changed replaces the old line rather than adding a second one. History lives in git if you want it.

## Inbox and phone

- `inbox/phone.md` is appended to only by the phone, one line per note: `- 2026-11-24 09:41: text`.
- The computer's assistant files each line into a leaf and then removes exactly the lines it filed. Sync tools (iCloud Drive and others) may leave conflict copies such as `phone 2.md`; tools treat any `inbox/phone*.md` as part of the phone inbox.

## Handoff cards

A card in `handoff/` has the sections Goal, Done so far, Next step, Open questions, From, Status (`open` or `done`).
