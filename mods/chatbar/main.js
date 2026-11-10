// Chat bar: a box per agent that needs you (blocked), finished-and-unseen agents as round heads.
// Answer from any layout: numbered choices as buttons (hc keys), a reply field (hc send),
// the live terminal in a window, or go to its pane. Floats bottom-right through the layouts'
// "floating" lists; renders nothing (so the float hides) when nobody waits.
// Screens are read (hc read, ~0.4 s) only for open blocked boxes, once per status change or open.
// Other mods plug in through shared state only (PROVIDERS.md): chatbar.request, chatbar.agents.<provider>,
// the "goto.context" hook, and Go to's items.

import { View, div, image, svg } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { agents, spaces, panes, focused, shared, setShared, theme, run, hc, openOverlay, notify, settings } from "herdr";
import { parseScreen } from "./screen.js";
import { API_VERSION, mergeProviders, infoFor, goTo, readRequest, gotoItems } from "./plugins.js";

const MAX_OPEN = 3, W = 360, LINE = 18;
const MOTION = { duration: 180, easing: "ease-out" };
const STATUS = { blocked: "needs you", done: "finished", working: "working", idle: "idle" };

// Closed boxes, by the status they were closed in; shared so every layout's copy agrees.
const closedMap = () => shared("chatbar.closed") ?? {};

function ago(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 1) return "<1m";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
}


function icon(p, size, color) {
  if (!p?.icon) return null;
  return p.tint ? svg(p.icon).size(size).flex_none().text_color(color) : image(p.icon).w(size).h(size).flex_none();
}

export default class Chatbar extends View {
  init(_props, cx) {
    // Others detect the contract here (pr-review hands drafts over only when it is set).
    if (shared("chatbar.api")?.version !== API_VERSION) setShared("chatbar.api", { version: API_VERSION });
    const p = shared("goto.providers") ?? [];
    if (!p.includes("chatbar")) setShared("goto.providers", [...p, "chatbar"]);
    this.since = {};          // address -> { status, at }: when it started waiting
    this.screens = {};        // address -> parsed screen for its current status ({ loading } while read)
    this.min = new Set();     // boxes folded to their header
    this.picked = [];         // opened from a head, newest first
    this.grown = new Set();   // boxes past their open flip (native height transition)
    this.reads = 0;
    this.asked = new Set();   // opened by a chatbar.request: shown whatever their status, until closed
    this.drafts = {};         // address -> text for its reply field, from a "draft" request
    // One input per open slot, made here (InputState needs init); owner[i] is the address it types to.
    this.owner = Array(MAX_OPEN).fill(null);
    this.inputs = this.owner.map((_, i) => {
      const s = InputState.new({ placeholder: "Reply…" });
      s.on("submit", (_e, cx) => this.reply(i, cx));
      return s;
    });
    // Data only: the "waiting 5m" labels.
    cx.timer.every(30000, (cx) => cx.notify());
  }

  read(address, cx) {
    const id = ++this.reads;
    this.screens[address] = { loading: id, lines: [], options: [] };
    cx.spawn(async (cx) => {
      let next;
      try {
        const r = await hc(["read", address, "--json"]);
        next = r.code === 0 ? parseScreen(JSON.parse(r.stdout).text ?? "") : { lines: [], options: [], error: (r.stderr || r.stdout).trim() };
      } catch (e) {
        next = { lines: [], options: [], error: String(e) };
      }
      // Dropped when the status moved on (or another read started) meanwhile.
      if (this.screens[address]?.loading === id) this.screens[address] = next;
      cx.notify();
    });
  }

  // Always by address: the box's own agent, never the focused terminal.
  send(address, args, what, cx) {
    if (this.screens[address]) this.screens[address].sent = what;
    cx.notify();
    cx.spawn(async (cx) => {
      let r;
      try { r = await hc(args); } catch (e) { r = { code: 1, stderr: String(e), stdout: "" }; }
      if (r.code !== 0) {
        notify({ title: `Couldn't send to ${address}`, body: (r.stderr || r.stdout).trim().slice(0, 200), level: "error" });
        if (this.screens[address]) this.screens[address].sent = null;
      }
      cx.notify();
    });
  }

  reply(slot, cx) {
    const address = this.owner[slot];
    const text = this.inputs[slot].value().trim();
    const a = agents().find((x) => x.address === address);
    if (!a || !text) return;
    this.inputs[slot].set_value("");
    // A blocked program refuses plain sends; --force types into its dialog, as asked.
    this.send(address, ["send", ...(a.status === "blocked" ? ["--force"] : []), "--", address, text], `“${text}”`, cx);
  }

  open(address) {
    this.min.delete(address);
    this.picked = [address, ...this.picked.filter((x) => x !== address)];
    delete this.screens[address];
  }

  close(a) {
    setShared("chatbar.closed", { ...closedMap(), [a.address]: a.status });
    this.picked = this.picked.filter((x) => x !== a.address);
    this.asked.delete(a.address);
  }

  // Another mod asks for a bubble: open it (and fill its reply field) once, then clear the key so the same ask works again.
  // Outside render: setting shared state re-renders every mod.
  take(cx) {
    const req = shared("chatbar.request");
    if (!req || this.taking) return;
    this.taking = true;
    cx.timer.after(0, (cx) => {
      this.taking = false;
      setShared("chatbar.request", null);
      const r = readRequest(req);
      if (!r) return;
      if (r.terminal in closedMap()) {
        const { [r.terminal]: _gone, ...closed } = closedMap();
        setShared("chatbar.closed", closed);
      }
      this.asked.add(r.terminal);
      if (r.text != null) this.drafts[r.terminal] = r.text;
      this.open(r.terminal);
      cx.notify();
    });
  }

  // Agent info from the providers and the context hook, for every agent once per render.
  infos(all) {
    const extra = mergeProviders(shared("chatbar.providers"), (name) => shared(`chatbar.agents.${name}`));
    const hook = shared("goto.context") ?? null;
    return { hook, info: new Map(all.map((a) => [a.address, infoFor(a, extra[a.address], hook)])) };
  }

  publishGoto(all, info, cx) {
    const items = gotoItems(all.map((a) => ({ a, info: info.get(a.address) })));
    const json = JSON.stringify(items);
    if (json === this.lastItems) return;
    this.lastItems = json;
    cx.timer.after(0, () => { if (json !== JSON.stringify(shared("goto.items.chatbar"))) setShared("goto.items.chatbar", items); });
  }

  openTerminal(address) {
    openOverlay({
      kind: "window", key: `chatbar-${address}`, width: 780, height: 480,
      layout: { type: "column", children: [
        { type: "block", size: { px: 30 }, content: { mod: "peek", props: { terminal: address } } },
        { type: "block", content: { terminal: address } },
      ] },
    });
  }

  render(cx) {
    const t = theme();
    const now = Date.now();
    const all = agents();
    this.take(cx);
    const { hook, info } = this.infos(all);
    this.info = info;
    this.hook = hook;
    this.publishGoto(all, info, cx);
    const tabs = new Map(spaces().flatMap((s) => s.tabs.map((tb) => [tb.id, tb])));

    // A status change starts the wait clock again and drops the cached screen.
    for (const a of all) {
      const prev = this.since[a.address];
      if (prev?.status === a.status) continue;
      let at = now;
      if (!prev) { const c = tabs.get(a.tab)?.changed_at; if (c) at = c < 1e12 ? c * 1000 : c; }
      this.since[a.address] = { status: a.status, at };
      delete this.screens[a.address];
    }

    // A closed box comes back once its agent's status changes.
    const closed = closedMap();
    const stale = Object.keys(closed).filter((k) => all.find((a) => a.address === k)?.status !== closed[k]);
    if (stale.length) {
      const next = { ...closed };
      for (const k of stale) delete next[k];
      setShared("chatbar.closed", next);
    }

    // Agents already on screen (any pane of the shown tab, or the focused one) get no box: you can see them.
    const shownTab = spaces().find((s) => s.active)?.tabs?.find((tb) => tb.active)?.id;
    const onScreen = new Set(panes().filter((p) => p.tab === shownTab && p.terminal).map((p) => p.terminal));
    const focusedT = focused()?.terminal;
    for (const x of this.asked) if (!all.some((a) => a.address === x)) this.asked.delete(x);
    const waiting = all.filter((a) => this.asked.has(a.address) || ((a.status === "blocked" || a.status === "done") && closed[a.address] !== a.status
      && !onScreen.has(a.address) && a.address !== focusedT));
    const byAddr = new Map(waiting.map((a) => [a.address, a]));
    this.picked = this.picked.filter((x) => byAddr.has(x));
    const at = (a) => this.since[a.address]?.at ?? now;
    const blocked = waiting.filter((a) => a.status === "blocked" && !this.picked.includes(a.address)).sort((x, y) => at(x) - at(y));
    const open = [...this.picked.map((x) => byAddr.get(x)), ...blocked].slice(0, MAX_OPEN);
    const openSet = new Set(open.map((a) => a.address));
    const heads = waiting.filter((a) => !openSet.has(a.address))
      .sort((x, y) => (x.status === y.status ? at(y) - at(x) : x.status === "blocked" ? -1 : 1));

    // Inputs follow their agent; a freed one is cleared before another agent gets it.
    this.owner.forEach((addr, i) => {
      if (addr && !openSet.has(addr)) { this.owner[i] = null; this.inputs[i].set_value(""); }
    });
    for (const a of open) if (!this.owner.includes(a.address)) this.owner[this.owner.indexOf(null)] = a.address;
    for (const [addr, text] of Object.entries(this.drafts)) {
      const slot = this.owner.indexOf(addr);
      if (slot >= 0) { this.inputs[slot].set_value(text); delete this.drafts[addr]; }
    }
    for (const x of this.grown) if (!openSet.has(x)) this.grown.delete(x);

    for (const a of open) {
      if (a.status === "blocked" && !this.min.has(a.address) && !this.screens[a.address]) this.read(a.address, cx);
    }
    // New boxes mount folded and grow one flip later; GPUI animates the height natively.
    // ponytail: a one-shot flip, not an animation timer.
    if (open.some((a) => !this.grown.has(a.address)) && !this.flipping) {
      this.flipping = true;
      cx.timer.after(30, (cx) => {
        this.flipping = false;
        for (const x of this.owner) if (x) this.grown.add(x);
        cx.notify();
      });
    }

    if (!open.length && !heads.length) return div();
    return h_flex().id("chatbar").items_end().gap(10).px(4)
      .when(heads.length > 0, (el) => el.child(h_flex().gap(6).pb(4).items_center().children(heads.map((a) => this.head(t, a)))))
      // Right to left: the first box sits at the corner.
      .children([...open].reverse().map((a) => this.box(t, a, now)));
  }

  // The context's colour (a theme colour name or #hex), else the accent.
  tint(t, info) {
    return info.color ? t[info.color] ?? info.color : t.accent;
  }

  head(t, a) {
    const acc = this.info.get(a.address);
    const color = this.tint(t, acc);
    const pic = icon(a.program, 18, t.foreground);
    return div().id(`head-${a.address}`).relative().size(38).flex_none().rounded_full()
      .bg(t.raised).border_2().border_color(t[a.status] ?? t.done)
      .flex().items_center().justify_center().cursor_pointer().opacity(acc.hidden ? 0.45 : 1)
      .hover((s) => s.bg(t.hover))
      .tooltip([acc.title, a.space_name, acc.label, STATUS[a.status] ?? a.status].filter(Boolean).join(" · "))
      .on_click((_e, cx) => { this.open(a.address); cx.notify(); })
      .child(pic ?? div().text_size(14).font_semibold().text_color(t.foreground).child(acc.title.slice(0, 1).toUpperCase()))
      .child(div().absolute().right(-2).bottom(-2).size(12).rounded_full().border_2().border_color(t.background).bg(color));
  }

  box(t, a, now) {
    const addr = a.address;
    const acc = this.info.get(addr);
    const color = this.tint(t, acc);
    const min = this.min.has(addr);
    const grown = !min && this.grown.has(addr);
    const blocked = a.status === "blocked";
    const screen = this.screens[addr];
    const slot = this.owner.indexOf(addr);
    const waited = ago(now - (this.since[addr]?.at ?? now));
    const mono = settings().font_family ?? "JetBrains Mono";

    const hdrBtn = (id, label, tip, fn) => div().id(id).w(24).h(24).flex_none().rounded(6)
      .flex().items_center().justify_center().text_size(14).cursor_pointer()
      .hover((s) => s.bg(t.background).text_color(t.foreground)).tooltip(tip).on_click(fn).child(label);

    const header = h_flex().h(42).px(10).gap(8).items_center().bg(color).text_color(t.background)
      .child(h_flex().id(`hd-${addr}`).flex_1().min_w(0).gap(8).items_center().cursor_pointer()
        .on_click((_e, cx) => {
          if (min) { this.min.delete(addr); delete this.screens[addr]; } else this.min.add(addr);
          cx.notify();
        })
        .child(div().size(9).flex_none().rounded_full().border_1().border_color(t.background).bg(t[a.status] ?? t.done))
        .child(icon(a.program, 16, t.background))
        .child(v_flex().flex_1().min_w(0)
          .child(div().truncate().text_size(13.5).font_semibold().child(acc.title))
          .child(div().truncate().text_size(12.5).opacity(0.85)
            .child([a.space_name, acc.label, blocked ? `waiting ${waited}` : a.status === "done" ? `done ${waited} ago` : `${a.status} ${waited}`]
              .filter(Boolean).join(" · ")))))
      .child(hdrBtn(`min-${addr}`, min ? "▴" : "▾", min ? "Open" : "Minimize", (_e, cx) => {
        if (min) { this.min.delete(addr); delete this.screens[addr]; } else this.min.add(addr);
        cx.notify();
      }))
      .child(hdrBtn(`x-${addr}`, "✕", "Close until its status changes", (_e, cx) => { this.close(a); cx.notify(); }));

    const lines = screen?.lines ?? [];
    const options = blocked ? screen?.options ?? [] : [];
    const note = a.status === "done" ? "Finished. Reply to give it its next task."
      : a.status === "working" ? "Working. A reply goes in as its next message."
      : !blocked ? "Idle. Reply to give it a task."
      : screen?.loading ? "Reading the screen…"
      : screen?.error ? `Couldn't read the screen: ${screen.error}`
      : !lines.length && !options.length ? "Waiting for you." : null;
    const shown = note ? 1 : Math.min(Math.max(lines.length, 2), 12);
    // Explicit height so open/minimize animates; the screen scrolls if wrapped lines need more.
    const bodyH = 16 + shown * LINE + 12 + options.length * 32 + (screen?.sent ? 22 : 0) + 44 + 36;

    const screenEl = v_flex().id(`scr-${addr}`).flex_1().min_h(0).overflow_y_scrollbar().px(10).py(8)
      .bg(t.background).text_size(12.5)
      .when(Boolean(note), (el) => el.text_color(t.muted).child(note))
      .when(!note, (el) => el.font_family(mono).text_color(t.foreground)
        .children(lines.map((l) => div().whitespace_normal().child(l || " "))));

    const body = v_flex().id(`body-${addr}`).w_full().overflow_hidden()
      .h(grown ? bodyH : 0).opacity(grown ? 1 : 0)
      .transition("height", MOTION).transition("opacity", MOTION)
      .child(screenEl)
      .when(options.length > 0, (el) => el.child(v_flex().px(8).pt(8).gap(4).children(options.map((o) =>
        h_flex().id(`opt-${addr}-${o.key}`).h(28).px(10).gap(8).items_center().rounded(7)
          .border_1().border_color(t.input).bg(t.raised).text_size(12.5).text_color(t.foreground).cursor_pointer()
          .hover((s) => s.bg(t.hover).border_color(color))
          .on_click((_e, cx) => this.send(addr, ["keys", addr, o.key], `option ${o.key}`, cx))
          .child(div().flex_none().font_semibold().text_color(color).child(o.key))
          .child(div().flex_1().min_w(0).truncate().child(o.label))))))
      .when(Boolean(screen?.sent), (el) => el.child(div().px(10).pt(6).text_size(12.5).text_color(t.muted).truncate().child(`Sent ${screen.sent}`)))
      .child(div().px(8).pt(8).child(Input.new(this.inputs[slot]).h(34).px(10).rounded(17)
        .border_1().border_color(t.input).bg(t.background).text_size(13).text_color(t.foreground)))
      .child(h_flex().h(36).px(8).gap(6).items_center().justify_end()
        .child(this.action(t, `term-${addr}`, "Open terminal", () => this.openTerminal(addr)))
        .child(this.action(t, `go-${addr}`, "Go to", () => {
          // A context hook that listens here switches context first (e.g. a hidden one), then focuses.
          const g = goTo(addr, acc.context, this.hook, shared("layout"), Date.now());
          if (g.request) setShared(g.request.key, g.request.value);
          for (const [name, args] of g.run) run(name, args);
        })));

    return v_flex().id(`box-${addr}`).w(W).flex_none().rounded(10).overflow_hidden()
      .border_1().border_color(t.border).bg(t.popover).opacity(acc.hidden ? 0.5 : 1)
      .child(header).child(body);
  }

  action(t, id, label, fn) {
    return div().id(id).h(26).px(10).rounded(6).flex().items_center().text_size(12.5).text_color(t.muted).cursor_pointer()
      .hover((s) => s.bg(t.hover).text_color(t.foreground)).on_click(() => fn()).child(label);
  }
}
