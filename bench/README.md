# Token benchmark

Measures how much an AI has to read to answer questions about you, two ways:

- **Whole folder:** every note pasted into the chat.
- **Through the door:** the door's tool list and rules (once per chat), `lg_start`, then `lg_search` and `lg_open` for each question.

It also checks that the door's answer contains the note that actually holds the answer, so savings never come from missing things.

```bash
cd door && npm ci && npm run build && cd ..
node bench/run.mjs                    # estimated tokens (characters / 3.5), no network
node bench/run.mjs --vault ~/LifeGraph # your own folder (questions.json targets the demo, so ignore its ok/MISS column)
```

Exact Claude token counts use Anthropic's free token-counting endpoint. This sends the notes to Anthropic, so use the demo folder unless you are fine with that:

```bash
cd bench && npm install && ANTHROPIC_API_KEY=... node run.mjs --exact
```

The questions are in `questions.json`. The demo folder (`demo/`) is a fictional person (Maya, a designer in Lisbon), also used by the website demo. It is CC0, like the starter folder.
