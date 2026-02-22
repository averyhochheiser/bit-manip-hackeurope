import { createHmac } from "crypto";
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter(l => l.includes("=") && !l.startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; })
);

const SECRET = env.OVERRIDE_SIGNING_SECRET;
const OWNER = "acme-org", REPO = "ml-training", SHA = "abc1234def5678", CHECK = "carbon", PR = "42";
const TS = Date.now().toString();
const PAYLOAD = `check=${CHECK}&owner=${OWNER}&repo=${REPO}&sha=${SHA}&ts=${TS}`;
const SIG = createHmac("sha256", SECRET).update(PAYLOAD).digest("hex");

console.log("Sending request...");
const res = await fetch("http://localhost:3000/api/override/create-checkout", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ owner: OWNER, repo: REPO, sha: SHA, check: CHECK, pr: PR, ts: TS, sig: SIG }),
});

const data = await res.json();
console.log("Status:", res.status);
console.log("Response:", JSON.stringify(data, null, 2));
