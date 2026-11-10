# Chat bar for Herdr

A chat bar in the bottom-right corner of every layout, one bubble per agent that is waiting on you. Read the
agent's question, press one of its options or type a reply, and keep working where you are.

![Chat bar](preview.png)

## Use cases

- **An agent asks for permission while you work in another tab.** Its bubble opens as a card: "Run this
  command?", the command in a monospace box, then Yes / Yes, don't ask again / No. One click and it carries on.
  You never left your tab.
- **An agent finished planning.** "Approve the plan?" with the plan's heading and the plan above it, and the
  choices auto-accept / approve each edit / keep planning as buttons.
- **You want to know how far an agent is.** Working agents with a task list wait as small heads with a progress
  ring; hover for "3/7 · Editing src/cart/total.ts · ~6 min left". Bubbles show the same in their header.
- **Three agents ask questions at once.** Each gets its own bubble, oldest first, up to three open side by
  side. The rest wait as round heads next to them.
- **An agent finished.** It shows up as a head. Click it, type its next task, press Enter.
- **Your hands are busy.** With the [dictate](https://github.com/saefty/herdr-dictate) mod installed, click the mic
  in the reply field, speak, click again: the text lands in the field, transcribed on your Mac, not sent.
- **The question needs more context.** "Open terminal" shows the agent's live terminal in a window over your
  layout. "Go to" takes you to its pane.
- **You see the agent anyway.** Agents in the tab on screen get no bubble; you can answer them right there.

## Features

- A bubble per agent that needs you, a round head per agent that finished. The newest status wins; a bubble
  you close stays closed until its agent's status changes.
- Reads the agent's screen (`hc read`) and turns Claude Code's prompts into a question and buttons: permission
  prompts and plan approval as answer cards (what is asked, the command or file, the agent's note), multiple-choice
  questions with descriptions, older boxed prompts. Other agents show the last lines of their screen.
- Progress for Claude Code agents, without an LLM: the latest task list (TodoWrite or the task tools) as "3/7" and
  a ring, what the agent is doing now (the task in progress, else its last tool call: "Running tests", "Editing
  src/app.ts"), and "~N min left" only once two tasks are done and it keeps that pace. Read from the session
  transcript by a small python3 helper, incrementally, every 5 s at most, only for agents the bar shows.
- Replies go to that agent's terminal by address (`hc send`, `hc keys`), never to the focused one.
- Headers show the title, space, how long it has waited and, with a plug-in, a context tag and color.
- Minimize a bubble to its header, close it, open the terminal, go to the pane.
- Floats over any layout and hides when nobody waits. Drag it to another corner if you like.
- A mic in the reply field when the dictate mod is installed.
- Other mods can open a bubble with a drafted reply, add titles, context labels and progress, and switch context
  before "Go to". The contract is in [PROVIDERS.md](mods/chatbar/PROVIDERS.md).

## Requirements

| What | Needed for | |
|---|---|---|
| Herdr with herdr-core (`hc`) | everything | required |
| `python3` (standard library only) | progress and "now doing" | optional: without it the bar works, without progress |
| Claude Code | answer cards, progress | other agents get their screen's last lines |
| [dictate](https://github.com/saefty/herdr-dictate) mod, with ffmpeg and parakeet-mlx | the mic | optional, macOS only (`brew install ffmpeg`, `uv tool install parakeet-mlx`) |

## Works with

The chat bar, [Go to](https://github.com/saefty/herdr-goto), [PR review](https://github.com/saefty/herdr-pr-review)
and [Dictate](https://github.com/saefty/herdr-dictate) each work alone. Installed together, they plug into each other:

- With **Go to** (⌘⇧P), agents waiting on you show up as "Reply to …" and open their bubble here. Go to is
  extensible: the chat bar uses its [provider contract](https://github.com/saefty/herdr-goto/blob/main/mods/goto/PROVIDERS.md).
  A context mod that registers Go to's context hook also tags the bubbles and switches context on "Go to".
- With **PR review**, Discuss on a finding opens the agent's bubble here with the finding drafted in the reply
  field (`chatbar.request`).
- With **Dictate**, each reply field gets a mic; the transcript is appended to the field, never sent.
- Your own mod can open a bubble the same way, or add titles, context labels and progress per agent. See
  [PROVIDERS.md](mods/chatbar/PROVIDERS.md).

## Install

1. Copy `mods/chatbar` to `~/.config/herdr-app/mods/`.
2. Add the floating block to each layout you want it in (`~/.config/herdr-app/layouts/<name>.json`), on the
   root node or the node that holds your terminals:

   ```json
   "floating": [
     { "id": "chatbar", "content": { "mod": "chatbar" }, "edge": "bottom", "align": "end" }
   ]
   ```

   If the node already has a `floating` list, add the entry to it.
3. Run `herdr-app check ~/.config/herdr-app/mods/chatbar`.

It runs `hc read`, `hc send` and `hc keys` on your agents' terminals, and `python3 progress.py`, which reads Claude
Code's session transcripts (`~/.claude/projects/…`, and `~/.claude/sessions/<pid>.json` to find them; never the
`*.key` files) and keeps a small cache next to itself. It makes no network calls.

## Tests

`node --test mods/chatbar/test_screen.mjs mods/chatbar/test_plugins.mjs mods/chatbar/test_progress.mjs`
(the progress test runs `python3`).

## License

MIT
