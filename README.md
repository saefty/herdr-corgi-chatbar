# Chat bar for Herdr

<h3 align="center">Answer your agents without leaving the tab you are in. Each agent that waits on you gets a chat bubble in the corner, with its question, the options as buttons and a reply field.</h3>

<p align="center"><img src="preview.png" width="88%" alt="The chat bar with an agent asking for permission" /></p>

<p align="center"><sub>✓&nbsp;Free,&nbsp;MIT &nbsp;·&nbsp; ✓&nbsp;Runs&nbsp;locally &nbsp;·&nbsp; ✓&nbsp;herdr-app&nbsp;0.1.14+</sub></p>

Part of [Corgi](https://github.com/saefty/herdr-corgi), a set of Herdr mods that plug into each other.

A chat bar in the bottom-right corner of every layout, one bubble per agent that is waiting on you. Read the
agent's question, press one of its options or type a reply, and keep working where you are.

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
- **Your hands are busy.** With the [dictate](https://github.com/saefty/herdr-corgi-dictate) mod installed, click the mic
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
- Headers show the title, space, how long it has waited and, with a small mod of your own, a tag and color for
  each of your setups (work, personal).
- Minimize a bubble to its header, close it, open the terminal, go to the pane.
- Floats over any layout and hides when nobody waits. Drag it to another corner if you like.
- A mic in the reply field when the dictate mod is installed.
- Other mods can open a bubble with a reply already drafted, add titles, setup labels and progress, and switch to
  the right setup before "Go to".

## Requirements

| What | Needed for | |
|---|---|---|
| Herdr with herdr-core (`hc`) | everything | required |
| `python3` (standard library only) | progress and "now doing" | optional: without it the bar works, without progress |
| Claude Code | answer cards, progress | other agents get their screen's last lines |
| [dictate](https://github.com/saefty/herdr-corgi-dictate) mod, with ffmpeg and parakeet-mlx | the mic | optional, macOS only (`brew install ffmpeg`, `uv tool install parakeet-mlx`) |

## Works with

The chat bar, [Go to](https://github.com/saefty/herdr-corgi-goto), [PR review](https://github.com/saefty/herdr-corgi-pr-review)
and [Dictate](https://github.com/saefty/herdr-corgi-dictate) each work alone. Installed together, they plug into each other:

- With **Go to** (⌘⇧P), agents waiting on you show up as "Reply to …" and open their bubble here.
- **Separate setups**, like work and personal: a small mod of your own that tells Go to which space belongs where
  also tags the bubbles, and "Go to" switches to the right setup first.
- With **PR review**, Discuss on a finding opens the agent's bubble here with the finding drafted in the reply
  field.
- With **Dictate**, each reply field gets a mic; the transcript is appended to the field, never sent.
- Your own mod can open a bubble the same way, or add titles, setup labels and progress per agent.

## Install in three steps

<table>
<tr>
<td align="center" valign="top" width="33%"><h3>1</h3><b>Add the mod</b><br /><sub>With <a href="https://github.com/saefty/herdr-corgi">Corgi</a>: <code>corgi enable chatbar</code>. By hand: copy <code>mods/chatbar</code> to <code>~/.config/herdr-app/mods/</code>. There are no keys to merge.</sub></td>
<td align="center" valign="top" width="33%"><h3>2</h3><b>Put it in your layouts</b><br /><sub>Add the floating block below to each layout you want it in.</sub></td>
<td align="center" valign="top" width="33%"><h3>3</h3><b>Check it</b><br /><sub>Corgi does this for you. By hand: <code>herdr-app check ~/.config/herdr-app/mods/chatbar</code>.</sub></td>
</tr>
</table>

Or tell your agent: add herdr.dev/mods/saefty/herdr-corgi-chatbar

By hand, step by step:

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

## Customize

Without touching code:

- **Where it sits:** `edge` and `align` in the floating block pick the corner, or drag the bar to another corner.
- **Which layouts have it:** only the layouts you add the block to.
- **A mic in every reply field:** install [Dictate](https://github.com/saefty/herdr-corgi-dictate).
- **Tags and colors per setup** (work, personal) and extra titles or progress: from a small mod of your own.

Changed the code itself? Your edits survive `corgi update`: Corgi merges your version, the old release and the new
one. `corgi diff chatbar` shows what you changed, and `corgi resolve chatbar` helps when an update and your edit
touch the same lines.

## Tests

`node --test mods/chatbar/test_screen.mjs mods/chatbar/test_plugins.mjs mods/chatbar/test_progress.mjs`
(the progress test runs `python3`).

## For mod authors

How to open a bubble, add titles, labels and progress, or switch a setup from your own mod:
[PROVIDERS.md](mods/chatbar/PROVIDERS.md).

## License

MIT
