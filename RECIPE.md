# Chat bar

A chat bar that floats in the bottom-right corner of every layout, like a messenger's chat tabs. Each agent that
needs you gets a bubble with its question, the answer options as buttons and a reply field. Finished agents wait
as round heads. You answer without leaving the tab you are in.

![Chat bar](preview.png)

**What you see:** a floating block at the bottom right, drawn by Herdr's float frame, holding one horizontal
row, aligned to the bottom, 10 px gaps, 4 px side padding:

- **Heads** (left of the bubbles, 6 px apart): 38 px circles in the `raised` color with a 2 px ring in the
  status color (`blocked` red for needs you, `done` for finished). Inside, the program icon at 18 px (tinted
  with `foreground` when the icon is a glyph), else the title's first letter at 14 px semibold. A 12 px dot at
  the bottom right in the context color, with a 2 px `background` ring. Hover: `hover` background. Tooltip:
  "title · space · context label · needs you / finished · 3/7 · now doing". An agent with a task list gets a
  progress ring (2.5 px, `border` track, status-colored arc from 12 o'clock) in place of the status border.
- **Working heads** (left of the heads, 4 px apart, at most 4): 28 px versions for working Claude Code agents out
  of sight that have a task list, ring included, 10 px context dot. Click: opens the agent's bubble.
- **Bubbles** (right to left, the first one at the corner): 360 px wide, 10 px corners, 1 px `border`, `popover`
  background.
  - Header, 42 px, 10 px padding, background the context color (else `accent`), text in `background`: a 9 px
    status dot (a 14 px ring in `background` when the agent has a task list), the 16 px program icon, the title
    (13.5 px semibold, truncated) over a line "space · context label · waiting 5m · 3/7 · ~6 min left" (12.5 px,
    85% opacity; "done 3m ago" when finished). On the right two 24 px buttons:
    ▾/▴ (minimize/open) and ✕ (close until the status changes).
  - The screen: 12.5 px in the person's terminal font (`settings().font_family`), `background` color, 10 px
    by 8 px padding, up to 12 lines, scrolls when wrapped lines need more. While reading: "Reading the screen…"
    in `muted`. Finished: "Finished. Reply to give it its next task."
  - Answer card (permission prompts and plan approval), 10 px side padding: the title ("Run this command?",
    "Edit this file?", "Approve the plan?"; 13 px semibold), the command, file or plan heading in a monospace box
    (12 px, `background` fill, 1 px `border`, 6 px corners), the agent's note in `muted` 12 px. A permission card
    replaces the screen lines; a plan card sits under the plan's lines.
  - Options: one 28 px row per choice, 7 px corners, 1 px `input` border, `raised` background: the number in the
    context color (semibold), the label truncated. Hover: `hover` background and a context-colored border.
  - After a send, "Sent option 1" or "Sent “text”" in `muted`.
  - A 34 px reply field, fully rounded (17 px), `input` border, `background` fill, placeholder "Reply…". With the
    dictate mod, a 30 px round mic button right of it (`input` border; a pulsing `blocked` dot while recording, a
    braille spinner while transcribing; dimmed with the install hint as tooltip when dictate isn't ready).
  - A 36 px action row, right aligned: "Open terminal" and "Go to" as 26 px text buttons in `muted`.
- Bubbles and heads of an agent hidden by the current context are dimmed (bubble 50%, head 45%).

**How it behaves:**
- `blocked` (needs you): a bubble opens by itself, the oldest first, at most 3 open. More wait as heads.
  `done`: a head. `working`: a small ringed head only when it has a task list and is out of sight; otherwise
  `working` and `idle` agents show only when another mod asked for them (below). A working bubble says
  "Working: <now doing>. A reply goes in as its next message." An agent in
  any pane of the tab on screen, or the focused terminal, gets nothing: you can see it.
- New bubbles mount folded and grow one frame later: the body's height and opacity animate (180 ms ease-out).
  Minimize animates back to the header.
- A blocked bubble reads its agent's screen once per status change or open (`hc read <address> --json`) and
  parses it: the last block of numbered lines starting at 1 becomes buttons (a `❯`/`›`/`>` marker, rules and
  indented description lines inside the block are allowed), the lines above it the question. Without
  options: the last lines above Claude Code's input box (the second-to-last rule near the bottom).
- Permission prompt: the question ("Do you want to proceed?", "Do you want to make this edit to x?", "Do you want to
  allow …?", "Allow …?") with a first option starting "Yes" makes a card; the header line above it (`Bash
  command`, `Edit file`, `Create file`, `Fetch`, `Tool use`, …) picks the title, the block under the header the
  snippet (its last line is the note when the block has two or more lines; for edits only the path). Plan
  approval: "Would you like to proceed?" or an option with auto-accept / manually approve / keep planning; the
  snippet is the plan's last `#` heading.
- An option button sends that key (`hc keys <address> <n>`), cards included: Claude Code selects on the digit. Enter in the reply field sends the text
  (`hc send --force -- <address> <text>` when blocked, without `--force` otherwise). An error shows as a toast.
- Clicking a head opens its bubble in front. ✕ closes until the agent's status changes; closed boxes are shared
  so every layout agrees.
- "Open terminal" opens a 780 × 480 window with the shipped `peek` mod as a 30 px title bar over the live
  terminal. "Go to" focuses the pane, through the context hook when one listens in this layout.
- Progress: every 5 s (and when the set changes), for Claude Code agents shown in the bar or working out of sight
  that no provider gives `progress`/`doing` for, `python3 mods/chatbar/progress.py '<json [{address, pid, cwd,
  session}]>'` prints `{address: {done, total, eta, doing, session}}`; the bar redraws only when the output
  changed. Transcript: `session`, else the `claude` process under the terminal's pid with
  `~/.claude/sessions/<pid>.json` (`sessionId` → `~/.claude/projects/*/<id>.jsonl`), else the newest JSONL in
  `~/.claude/projects/<cwd with non-alphanumerics as ->/`. Parse: the last `TodoWrite` replaces the list;
  `TaskCreate` adds (its result's `#id`), `TaskUpdate` sets status or deletes; "now doing" is the in-progress
  item's activeForm (else subject), else the last non-bookkeeping tool call (Bash: its description; Edit/Write/Read:
  the path relative to the session's cwd; Grep, Glob, WebFetch host, WebSearch, Agent, Skill, `mcp__server__tool`).
  ETA: (last completion − list start) / completions × remaining, only with two completions and while the last one
  is less than two steps (+1 min) ago. Sub-agent (sidechain) lines are skipped.
- Mic (dictate installed): click sets `dictate.request` `{action: "toggle", id: "chatbar:<address>", reply: {key:
  "chatbar.request", value: {action: "draft", terminal, append: true}}}`; the answer comes back as a draft request
  and is appended to the reply field.
- The wait labels refresh every 30 s. With nobody waiting the mod renders an empty `div`, so the float hides.
- Plug-ins (PROVIDERS.md): `chatbar.request` opens a bubble (`draft` fills the reply field without sending),
  `chatbar.agents.<provider>` adds title, context, label, color, hidden; `goto.context` gives contexts, labels,
  colors, the current context and the "Go to" route; with Go to installed, waiting agents become "Reply to …".

**Built from:** a mod `mods/chatbar` with `mod.json` `{ "place": "none" }`, placed by each layout's `floating`
list: `{ "id": "chatbar", "content": { "mod": "chatbar" }, "edge": "bottom", "align": "end" }`.
`main.js` (the view), `screen.js` (pure: screen text to `{lines, options, card?}`), `plugins.js` (pure: provider
merge, agent info with progress, the "Go to" route, request parsing, Go to items, the "3/7 · ~N min left" line),
`progress.py` (python3 standard library: terminal → transcript, incremental parse, cache in a hidden
`.progress-cache.json` next to it), `mic.svg` (a 24 px stroke icon). It uses `agents() spaces() panes()
terminals() focused() theme() settings() shared() setShared() run() hc() exec() appHome() openOverlay() notify()`,
gpui-kit's `PathBuilder` with `window.paint_path` for rings, gpui-base's `InputState`/`Input`, and the commands
`pane.focus` plus `hc read`, `hc send`, `hc keys`. One `InputState` per open slot is made in
`init` (it can't be made in render); each slot belongs to an address and is cleared when it changes hands.

**Watch out:**
- `InputState.new` only works in `init`: keep 3 inputs and hand them to bubbles by slot.
- Never send to the focused terminal: always by address. A blocked Claude Code refuses plain sends; `--force`
  types into its dialog.
- Set shared state outside render (`cx.timer.after(0, …)`) and only when the value changed: every set
  re-renders every mod.
- Take a request, then set `chatbar.request` back to `null`; deduplicating by `at` breaks Go to's items,
  whose value is fixed.
- A screen read takes about 0.4 s; read only open blocked bubbles, once per status change, and drop a result
  whose status moved on meanwhile.
- The height transition needs an explicit body height: compute it from the line and option counts.
- Herdr's `done` turns `idle` once someone looks at the agent, so a head disappears when you visit it.
- Rings: `paint_path` coordinates are % of the element; draw the arc as a stroked polyline (48 points for a full
  turn) and keep the stroke inside (radius 50% minus the stroke's share). `window` there is gpui's global, not
  herdr's `window()`.
- Progress reading is bounded: the first read of a transcript takes its last 8 MB (tasks created before that are
  missed), later reads only appended bytes (cache by inode and offset; a half-written last line waits). Never
  read `~/.claude/sessions/*.key`. Run it with `exec`, never in render.
- A provider's `progress`/`doing` win and suppress the bar's own read; `session` only says where to read.
- Cards need the wrapped option lines Claude Code draws (indented under the label), or the option block ends early.

**Done when:** `herdr-app check mods/chatbar` passes; `node --test mods/chatbar/test_screen.mjs
mods/chatbar/test_plugins.mjs mods/chatbar/test_progress.mjs` passes (cards for Bash, edit, create, fetch, MCP and
plan screens; TodoWrite and task-tool progress, "now doing", ETA, incremental reads); with a Claude Code agent asking permission in another tab, its bubble
appears bottom right with the question and the options as buttons, pressing 1 answers it and the bubble goes
away when the agent works again; a finished agent shows as a head; and
`setShared("chatbar.request", {action: "draft", terminal, text})` from another mod opens that agent's bubble with
the text in its reply field.
