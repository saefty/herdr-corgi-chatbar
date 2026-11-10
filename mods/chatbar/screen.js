// Trims a terminal screen (`hc read --json` text) to what a waiting agent asks:
// numbered choices ("❯ 1. Yes") become options, the lines above them the question.
// Without choices: the last lines above the input box (Claude Code's ─── ❯ ─── area).

const RULE = /^[\s─━═╌┄┈┅┉\-_╭╮╰╯┌┐└┘]+$/;
const OPTION = /^(?:[❯›>▶]\s*)?(\d)[.)]\s+(.+)$/;

const clean = (l) =>
  l.replace(/ /g, " ")
    .replace(/^\s*[│┃║]\s?/, "")
    .replace(/\s*[│┃║]\s*$/, "")
    .replace(/\s+$/, "");

const isRule = (l) => l.trim().length >= 3 && RULE.test(l);

// Collapse blank runs and drop rules; keep the last `max` lines.
function tail(lines, max) {
  const out = [];
  for (const l of lines) {
    if (isRule(l)) continue;
    if (!l.trim() && (!out.length || !out[out.length - 1].trim())) continue;
    out.push(l);
  }
  while (out.length && !out[out.length - 1].trim()) out.pop();
  const kept = out.slice(-max);
  while (kept.length && !kept[0].trim()) kept.shift();
  // Common indent off, so a boxed prompt reads flush left.
  const indent = Math.min(...kept.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length));
  return kept.map((l) => l.slice(Number.isFinite(indent) ? indent : 0));
}

export function parseScreen(text, max = 12) {
  const lines = (text ?? "").split("\n").map(clean);
  // The last option block: the last "N. label" line, then upward while lines are options (or blank).
  let end = -1;
  for (let i = lines.length - 1; i >= 0; i--) if (OPTION.test(lines[i].trim())) { end = i; break; }
  if (end >= 0) {
    const options = [];
    let start = end;
    const indentOf = (l) => l.match(/^ */)[0].length;
    const optIndent = indentOf(lines[end].replace(/^(\s*)[❯›>▶]\s*/, "$1"));
    for (let i = end; i >= 0; i--) {
      const m = lines[i].trim().match(OPTION);
      if (m) { options.unshift({ key: m[1], label: m[2].trim() }); start = i; }
      // Between options: blank lines, rules (Claude's "4. Chat about this" sits under one) and
      // indented description lines of the option above (AskUserQuestion) belong to the block.
      else if (lines[i].trim() && !isRule(lines[i]) && indentOf(lines[i]) <= optIndent) break;
    }
    if (options[0]?.key === "1") {
      return { lines: tail(lines.slice(0, start), Math.max(4, max - options.length)), options };
    }
  }
  // No choices: cut the input box (the second-to-last rule near the bottom) and what's under it.
  const rules = [];
  for (let i = Math.max(0, lines.length - 10); i < lines.length; i++) if (isRule(lines[i])) rules.push(i);
  const cut = rules.length >= 2 ? rules[rules.length - 2] : lines.length;
  return { lines: tail(lines.slice(0, cut), max), options: [] };
}
