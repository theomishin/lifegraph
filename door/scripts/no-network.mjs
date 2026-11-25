// The door must never talk to the network. Fail if its source imports anything that could.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
const banned = [
  /from\s+["'](node:)?(http|https|http2|net|tls|dgram|dns)["']/,
  /require\(\s*["'](node:)?(http|https|http2|net|tls|dgram|dns)["']\s*\)/,
  /\bfetch\s*\(/,
  /\bWebSocket\b/,
  /\bXMLHttpRequest\b/,
  /from\s+["'](undici|axios|node-fetch|got|ws)["']/,
  /server\/(sse|streamableHttp|express)/,
];
const bad = [];
for (const f of readdirSync("src")) {
  const text = readFileSync(join("src", f), "utf8");
  text.split("\n").forEach((line, i) => {
    if (banned.some((re) => re.test(line))) bad.push(`src/${f}:${i + 1}: ${line.trim()}`);
  });
}
if (bad.length) {
  console.error("Network code found in the door:\n" + bad.join("\n"));
  process.exit(1);
}
console.log("No network code in the door.");
