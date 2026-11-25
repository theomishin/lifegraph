# Token benchmark results

Run with `node bench/run.mjs` (see [bench/README.md](../bench/README.md)). Folder: the fictional `demo/` (43 notes, about 2,700 words). 20 questions from `bench/questions.json`. Tokens are **estimated** as characters / 3.5; exact Claude counts need `--exact` and an API key, and have not been run yet.

| | Estimated tokens |
| --- | --- |
| Whole folder pasted into a chat | 4,692 |
| Door, once per chat (tool list and rules + `lg_start`) | 1,970 |
| Door, per question (`lg_search` + `lg_open`) | about 384 |
| Chat with 1 question through the door | 2,354 (50% less than pasting) |
| Chat with 10 questions through the door | 5,812 (pasting: 4,692) |
| Questions where the door opened the note holding the answer | 20 of 20 |

What this does and doesn't show:

- The door's cost per chat stays about the same as the folder grows; pasting grows with every note. The demo is small. A well-filled LifeGraph is several times larger, and the gap grows with it.
- On a small folder with many questions in one chat, pasting is cheaper.
- Per question assumes the AI always opens the top note; often the search lines alone answer it, so this is on the high side.
- This measures what goes into the context, not answer quality beyond "found the right note".
