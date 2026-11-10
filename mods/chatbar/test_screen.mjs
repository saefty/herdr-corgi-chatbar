// Run: node --test test_screen.mjs
import assert from "node:assert/strict";
import { parseScreen } from "./screen.js";

// Claude Code permission prompt: options become buttons, the question stays above them.
const perm = [
  "⏺ I'll remove the build folder.",
  "",
  "────────────────────────────────────────",
  " Bash command",
  "",
  "   rm -rf build",
  "   Remove build output",
  "",
  " Do you want to proceed?",
  " ❯ 1. Yes",
  "   2. Yes, and don't ask again for rm commands in /repo",
  "   3. No, and tell Claude what to do differently (esc)",
  "",
  " Esc to cancel · Tab to amend",
].join("\n");
const p = parseScreen(perm);
assert.deepEqual(p.options.map((o) => o.key), ["1", "2", "3"]);
assert.equal(p.options[0].label, "Yes");
assert.equal(p.lines.at(-1).trim(), "Do you want to proceed?");
assert.ok(p.lines.some((l) => l.trim() === "rm -rf build"));
assert.ok(!p.lines.some((l) => l.includes("Esc to cancel")));

// A question without choices: the input box and footer below it are cut.
const ask = [
  "⏺ Which region should I deploy to?",
  "",
  "✻ Cogitated for 6s",
  "────────────────────────────",
  "❯ ",
  "────────────────────────────",
  "  repo main",
  "  ⏵⏵ auto mode on",
].join("\n");
const a = parseScreen(ask);
assert.deepEqual(a.options, []);
assert.equal(a.lines.at(-1), "✻ Cogitated for 6s");
assert.equal(a.lines[0], "⏺ Which region should I deploy to?");

// Boxed prompt (older Claude Code) and max lines.
const boxed = ["╭──────────╮", "│ Allow?   │", "│ ❯ 1. Yes │", "│   2. No  │", "╰──────────╯"].join("\n");
const b = parseScreen(boxed);
assert.deepEqual(b.options, [{ key: "1", label: "Yes" }, { key: "2", label: "No" }]);
assert.deepEqual(b.lines, ["Allow?"]);
assert.equal(parseScreen(Array.from({ length: 40 }, (_, i) => `line ${i}`).join("\n")).lines.length, 12);
assert.deepEqual(parseScreen(""), { lines: [], options: [] });

console.log("ok");

// AskUserQuestion: options with indented descriptions and a rule before the last option.
{
  const ask = [
    "How should we do this?", "",
    "❯ 1. Build a small version (Recommended)",
    "     Adds one source to the existing list.",
    "  2. Hand it to the other session",
    "     Writes a short brief for it.",
    "  3. Type something.",
    "────────────────────────",
    "  4. Chat about this", "",
    "Enter to select · ↑/↓ to navigate · Esc to cancel",
  ].join("\n");
  const r = parseScreen(ask);
  if (r.options.map((o) => o.key).join() !== "1,2,3,4") throw new Error("ask options: " + JSON.stringify(r.options));
  if (!r.lines.some((l) => l.includes("How should we do this?"))) throw new Error("ask question: " + JSON.stringify(r.lines));
  console.log("ok ask");
}
