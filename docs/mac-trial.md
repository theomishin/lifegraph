# First run on a real Mac: checklist

About 20 minutes. Tick each box; if one fails, note what you saw (or paste `lifegraph doctor` output) and it gets fixed.

Tip: add the command line to your PATH first, so you can type `lifegraph`:
`echo 'export PATH="$HOME/.lifegraph-app/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc`

## 1. Install

- [ ] Node.js 20+ installed (`node -v`).
- [ ] `curl -fsSL https://raw.githubusercontent.com/theomishin/lifegraph/main/install.sh | bash` finishes and ends with "Everything looks good." (Your existing `~/LifeGraph` is used as it is. Add `bash -s -- --icloud` instead of `bash` to move it into iCloud Drive.)
- [ ] macOS did not show a permission prompt, or you allowed it. If the doctor says the mailbox didn't answer, open `~/Library/Logs/LifeGraph/mailbox.log`.
- [ ] `lifegraph doctor` again: every line has a ✓.

## 2. Claude Desktop

Quit and reopen Claude Desktop, new chat:

- [ ] "What do you know about me? Use LifeGraph." It calls `lg_start` and answers from your index, without opening every note.
- [ ] Ask something only one note knows. It uses `lg_search` or `lg_open` on that note, not the whole branch.
- [ ] "Remember that I ..." (something new). The line appears in the right note ending with `(via Claude)`.
- [ ] Lock a note: `lifegraph lock <note>`. Ask about it: Claude says it's locked and shows nothing from it. `lifegraph unlock <note>` afterwards.

## 3. Codex and Claude Code

- [ ] Codex: `codex` then "Use LifeGraph: what am I working on?" It answers through the door. If not, check `~/.codex/config.toml` has `[mcp_servers.lifegraph]`.
- [ ] Claude Code: `claude mcp list` shows `lifegraph`. Ask the same question.
- [ ] Save a fact from Codex. The line ends with `(via Codex)`.

## 4. Two AIs at once

- [ ] In Claude Desktop: "Claim my <note> note, you're going to reorganise it." Then in Codex: "Remember <fact> in <note>." Codex says the note is being edited and the fact goes to `inbox/inbox.md`.
- [ ] In Claude: "Release the note and file the inbox." The fact lands in the note and leaves the inbox.
- [ ] Handoff: in Claude, "Hand this task to Codex: <task>." A note appears in `handoff/`. In Codex, "Pick up the open handoff." It reads it.

## 5. Muse (mailbox)

- [ ] Tell Muse on the Mac to read `~/LifeGraph/index.md` and ask it a question about you. It writes `mailbox/ask-muse.md`, and `reply-muse.md` appears within a few seconds.
- [ ] If Muse can't write files, test by hand: create `~/LifeGraph/mailbox/ask-test.md` containing `search: <word>` and check the reply.

## 6. iPhone (files only)

- [ ] On the iPhone, Files app, iCloud Drive: the LifeGraph folder is there. Long-press it and choose Keep Downloaded.
- [ ] Add a line to `inbox/phone.md` from the phone, e.g. `- 2026-11-26 09:00: Dentist moved to Friday`. Back on the Mac, ask Claude to file the inbox. The line moves into the right note.

## 7. Token check (optional)

- [ ] `node ~/.lifegraph-app/src/bench/run.mjs --vault ~/LifeGraph` shows the folder's size against the door's cost (ignore the ok/MISS column; the questions are for the demo).

## 8. Uninstall test (optional, at the end)

- [ ] `bash ~/.lifegraph-app/src/uninstall.sh`. Your notes are untouched; apps no longer list `lifegraph`. Reinstall with the curl command.
