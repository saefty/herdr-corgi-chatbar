// The plug-in contract (PROVIDERS.md), as pure functions so node can test them without Herdr.

export const API_VERSION = 1;

const clean = (s) => (s ?? "").replace(/^[^\p{L}\p{N}]+/u, "").trim();

// Every provider's fields per terminal address, merged in registration order (a later provider wins per field).
export function mergeProviders(names, read) {
  const out = {};
  for (const name of names ?? []) {
    for (const [address, fields] of Object.entries(read(name) ?? {})) {
      for (const [k, v] of Object.entries(fields ?? {})) if (v != null) (out[address] ??= {})[k] = v;
    }
  }
  return out;
}

// What the bar shows for an agent: provider fields first, then the context hook ("goto.context"), then Herdr's own data.
export function infoFor(a, extra, hook) {
  const x = extra ?? {};
  const context = x.context ?? hook?.terminals?.[a.address] ?? hook?.spaces?.[a.space] ?? null;
  return {
    title: clean(x.title) || clean(a.title) || clean(a.tab_name) || a.program?.name || a.address,
    context,
    label: x.label ?? (context ? hook?.labels?.[context] ?? context : null),
    color: x.color ?? (context ? hook?.colors?.[context] ?? null : null),
    // Hidden: the hook shows one context now and this agent is in another.
    hidden: x.hidden ?? Boolean(hook?.current && context && context !== hook.current),
  };
}

// "Go to": through the context hook when one listens in this layout (it switches context, then runs), else focus here.
export function goTo(address, context, hook, layout, at) {
  const run = [["pane.focus", { terminal: address }]];
  const live = hook?.request && (!hook.layouts || hook.layouts.includes(layout));
  return live ? { request: { key: hook.request, value: { context: context ?? null, run, at } }, run: [] } : { request: null, run };
}

// A "chatbar.request" -> { terminal, text } to open (text: a draft for the reply field), or null if it isn't one.
export function readRequest(req) {
  if (!req || typeof req.terminal !== "string" || !["open", "draft"].includes(req.action)) return null;
  return { terminal: req.terminal, text: req.action === "draft" && typeof req.text === "string" ? req.text : null };
}

// Go to's items (its PROVIDERS.md): "Reply to <title>" per agent that needs you or finished; picking one opens its bubble.
// No `at` in the request: the bar clears the key after taking it, so the same item works twice and the list stays stable.
export function gotoItems(list) {
  return list.filter(({ a }) => a.status === "blocked" || a.status === "done").map(({ a, info }) => ({
    id: a.address,
    title: `Reply to ${info.title}`,
    subtitle: `${a.space_name} · ${a.status === "blocked" ? "needs you" : "finished"}`,
    tag: "Chat",
    context: info.context ?? undefined,
    run: [["goto.set", { key: "chatbar.request", value: { action: "open", terminal: a.address, from: "goto" } }]],
  }));
}
