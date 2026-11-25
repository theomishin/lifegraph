#!/usr/bin/env node
// Guards the public repo against personal data.
// Fails if template/, prompts/, spec/ or site/demo contain:
//   - any name listed in .private-names (a local, git-ignored file, one name per line)
//   - email addresses or phone numbers
// Usage: node scripts/check-public.mjs
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const roots = ["template", "prompts", "spec", "demo", "site"].filter((d) => existsSync(d));
const names = existsSync(".private-names")
  ? readFileSync(".private-names", "utf8").split("\n").map((s) => s.trim()).filter((s) => s && !s.startsWith("#"))
  : [];

const walk = (dir) =>
  readdirSync(dir).filter((f) => !f.startsWith(".")).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

const email = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const phone = /\+?\d[\d ()-]{8,}\d/;
const problems = [];
for (const file of roots.flatMap(walk)) {
  if (!/\.(md|json|txt|html|js)$/.test(file)) continue;
  readFileSync(file, "utf8").split("\n").forEach((line, i) => {
    const where = `${file}:${i + 1}`;
    for (const n of names) {
      if (new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(line)) problems.push(`${where}: private name "${n}"`);
    }
    if (email.test(line) && !/example\.(com|org)/.test(line)) problems.push(`${where}: email address`);
    if (phone.test(line) && !/\d{4}-\d{2}-\d{2}/.test(line)) problems.push(`${where}: phone number`);
  });
}
if (problems.length) {
  console.error("Personal data check failed:\n" + problems.join("\n"));
  process.exit(1);
}
console.log(`Personal data check passed (${roots.join(", ")}; ${names.length} private names checked).`);
