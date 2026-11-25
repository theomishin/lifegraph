# Maya's LifeGraph (demo)

A fictional person, used for the LifeGraph website demo and the token benchmark.

Start here. Each branch has a hub file listing its leaves. Open the hub, then only the leaf you need.

- [[Me]] — who Maya is, in a few lines.
- [[Work]] — job at Tidewater, career plans, skills.
- [[Learning]] — Portuguese and TypeScript.
- [[Projects]] — onboarding redesign, half marathon, ceramics.
- [[People]] — family, partner, friends, colleagues.
- [[Health]] — running, sleep, food, physio.
- [[Money]] — budget and investing.
- [[Life]] — home, travel, devices, routines.
- [[Interests]] — books, music, films, food, style.

## Rules for AI assistants
- Read this file at the start of every chat, then open only the branch and leaf the chat needs. Never load the whole vault.
- Whenever a question needs memory about me, check the graph first (this file, then the hub, then the leaf) before answering.
- When new lasting information comes up, add it to the right leaf with a small dated edit (`- 2026-01-31: ...`) and tell me what was added.
- A new subject gets a new leaf in the right branch, linked from that branch's hub with a double-bracket link.
- Leaves hold the current state. Replace a stale line instead of piling history on top of it.
- Only write what I said or decided. No guesses, no advice, no summaries of your own opinions.
- A note with `locked: true` in its frontmatter is private. The LifeGraph door never shows it to you; if you can see the files directly, don't read it.
- Label every change with your app's name, like `(via Claude)` at the end of the line. The door does this for you.
- If you are rewriting a note over several steps, claim it first (`lg_claim`) so other AIs send their changes to the inbox instead, and release it when done.
- If you are not sure where something belongs, append it to `inbox/inbox.md` instead of guessing.
- Lines in `inbox/phone.md` were added from my phone. On catch-up, file each one into the right leaf, then delete the lines you filed (and only those). Never edit leaves from the phone.
- When I ask you to hand a task to another AI, write a handoff note in `handoff/` (goal, done so far, next step, notes it touches, which AI wrote it). When you start a chat, mention any open handoff notes.
- At the start of a chat, if your app lets you read my recent chats, read the ones since the date below, file what is new, tell me what was added, and move the date.

Chats read up to: never.

## For apps that can only read and write files
If you can't use the LifeGraph connector (for example Muse on the Mac), use the mailbox instead of opening notes yourself:

1. Write your request to `mailbox/ask-<your app name>.md`. Start it with `from: <your app name>`, then either a plain question, or lines like `open: People`, `search: dentist`, `remember: <fact>`, `inbox`, `handoff`.
2. A couple of seconds later the answer is in `mailbox/reply-<your app name>.md`. Read it and delete it.

The mailbox only returns what the question needs and never shows locked notes. Don't edit other notes directly.
