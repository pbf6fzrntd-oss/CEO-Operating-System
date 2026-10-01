// Runs the actual built Worker against an isolated, disposable D1 database.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { realpathSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
const require = createRequire(
  realpathSync("node_modules/wrangler/package.json"),
);
const { Miniflare } = require("miniflare");
const root = path.resolve("dist/server");
const paths = [
  "index.js",
  ...readdirSync(root, { recursive: true }).filter(
    (f) => /\.m?js$/.test(f) && f !== "index.js",
  ),
];
const mf = new Miniflare({
  modulesRoot: root,
  modules: paths.map((p) => ({ type: "ESModule", path: path.join(root, p) })),
  compatibilityDate: "2026-05-15",
  compatibilityFlags: ["nodejs_compat"],
  d1Databases: { DB: "ceo-contract-test" },
  cf: false,
});
try {
  const page = await mf.dispatchFetch("https://ceo.test/");
  assert.equal(page.status, 200);
  assert.match(await page.text(), /CEO Operating System/);
  const db = await mf.getD1Database("DB");
  for (const file of readdirSync("drizzle")
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    const sql = readFileSync("drizzle/" + file, "utf8");
    for (const statement of sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean))
      await db.prepare(statement).run();
  }
  async function request(route, method = "GET", body, origin) {
    const r = await mf.dispatchFetch("https://ceo.test" + route, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(origin ? { Origin: origin } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, data: await r.json() };
  }
  let r = await request("/api/workspace");
  assert.equal(r.status, 200);
  assert.ok(r.data.items.some((i) => i.kind === "task"));
  r = await request("/api/workspace", "POST", {
    kind: "task",
    data: {
      title: "Persistence contract",
      due: "2026-10-01",
      priority: "High",
    },
  });
  assert.equal(r.status, 201);
  const task = r.data.item;
  r = await request("/api/workspace", "PATCH", {
    id: task.id,
    version: task.version,
    data: { ...task.data, done: true },
  });
  assert.equal(r.status, 200);
  assert.equal(r.data.item.data.done, true);
  r = await request("/api/workspace", "PATCH", {
    id: task.id,
    version: task.version,
    data: task.data,
  });
  assert.equal(r.status, 409);
  r = await request("/api/workspace");
  assert.equal(r.data.items.find((i) => i.id === task.id).data.done, true);
  const before = r.data.items.length;
  r = await request("/api/import", "POST", {
    provider: "instinct",
    items: [
      { kind: "task", data: { title: "Valid", due: "2026-10-01" } },
      { kind: "loop", data: { title: "Invalid", due: "2026-10-01" } },
    ],
  });
  assert.equal(r.status, 400);
  assert.equal((await request("/api/workspace")).data.items.length, before);
  r = await request("/api/import", "POST", {
    provider: "silvia",
    items: [
      {
        externalId: "one",
        kind: "task",
        data: { title: "Agent finding", due: "2026-10-01" },
      },
    ],
  });
  assert.equal(r.data.count, 1);
  r = await request("/api/import", "POST", {
    provider: "silvia",
    items: [
      {
        externalId: "one",
        kind: "task",
        data: { title: "Agent finding", due: "2026-10-01" },
      },
    ],
  });
  assert.equal(r.data.count, 0);
  r = await request(
    "/api/workspace",
    "POST",
    { kind: "task", data: { title: "Cross origin", due: "2026-10-01" } },
    "https://elsewhere.test",
  );
  assert.notEqual(r.status, 201);
  r = await request("/api/intelligence", "POST", { action: "briefing" });
  assert.equal(r.status, 200);
  assert.equal(r.data.engine, "Workspace synthesis");
  assert.match(r.data.content, /PRIORITIES/);
  const firstBrief = r.data.item.id;
  r = await request("/api/intelligence", "POST", { action: "briefing" });
  assert.equal(r.data.item.id, firstBrief);
  assert.equal(r.data.item.version, 2);
  const meeting = (await request("/api/workspace")).data.items.find(
    (i) => i.kind === "meeting",
  );
  r = await request("/api/intelligence", "POST", {
    action: "prep",
    id: meeting.id,
  });
  assert.equal(r.status, 200);
  assert.ok(r.data.item.data.prep);
  r = await request("/api/integrations");
  assert.equal(
    r.data.integrations.find((i) => i.id === "google").configured,
    false,
  );
  r = await request("/api/integrations", "POST", { provider: "slack" });
  assert.equal(r.status, 503);
  const ics =
    "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:contract\r\nSUMMARY:Imported meeting\r\nDTSTART:20261001T170000Z\r\nDTEND:20261001T180000Z\r\nEND:VEVENT\r\nEND:VCALENDAR";
  r = await request("/api/calendar", "POST", { content: ics });
  assert.equal(r.data.count, 1);
  r = await request("/api/calendar", "POST", { content: ics });
  assert.equal(r.data.count, 0);
  r = await request("/api/workspace", "DELETE", { samples: true });
  assert.equal(r.status, 200);
  r = await request("/api/workspace");
  assert.ok(!r.data.items.some((i) => i.data.demo));
  assert.ok(r.data.items.some((i) => i.id === task.id));
  let chief = (await request("/api/chief")).data.chief;
  r = await request("/api/chief", "POST", { action: "brief" });
  assert.notEqual(r.status, 200);
  r = await request("/api/chief", "POST", {
    action: "review",
    version: chief.version,
    answers: chief.data.answers,
  });
  assert.equal(r.status, 200);
  chief = r.data.item;
  r = await request("/api/chief", "POST", {
    action: "morning",
    version: chief.version,
  });
  assert.notEqual(r.status, 200);
  r = await request("/api/chief", "POST", { action: "brief" });
  assert.equal(r.status, 200);
  assert.ok(r.data.item.data.content.split("\n").length <= 12);
  r = await request("/api/chief", "POST", {
    action: "proof",
    version: chief.version,
  });
  assert.equal(r.status, 200);
  chief = r.data.item;
  r = await request("/api/chief", "POST", {
    action: "ask",
    question: "What needs my attention?",
  });
  assert.equal(r.status, 200);
  assert.ok((await request("/api/chief")).data.requests.length);
  r = await request("/api/chief", "POST", {
    action: "draft",
    data: {
      title: "Unsent reply",
      body: "Please share the update.",
      channel: "Email",
    },
  });
  assert.equal(r.status, 200);
  let draft = r.data.item;
  r = await request("/api/chief", "POST", {
    action: "approve",
    id: draft.id,
    version: draft.version,
  });
  assert.equal(r.data.executed, false);
  draft = r.data.item;
  r = await request("/api/chief", "POST", {
    action: "draft",
    id: draft.id,
    version: draft.version,
    data: { body: "Changed reply" },
  });
  assert.equal(r.data.item.data.status, "Draft");
  assert.equal(r.data.item.data.approvedAt, "");
  r = await request("/api/chief", "POST", {
    action: "approve",
    id: draft.id,
    version: draft.version,
  });
  assert.equal(r.status, 409);
  r = await request("/mcp", "POST", {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
  });
  assert.equal(r.data.result.tools.length, 5);
  assert.ok(
    !r.data.result.tools.some((t) => /send|approve|delete/.test(t.name)),
  );
  r = await request("/mcp", "POST", {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name: "chief_context" },
  });
  assert.equal(r.status, 401);
  const authed = await mf.dispatchFetch("https://ceo.test/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "oai-authenticated-user-id": "isolated-test-user",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "chief_context" },
    }),
  });
  assert.equal((await authed.json()).result.isError, false);
  async function callTool(name, args) {
    const response = await mf.dispatchFetch("https://ceo.test/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "oai-authenticated-user-id": "isolated-test-user",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: { name, arguments: args },
      }),
    });
    const payload = await response.json();
    return payload.result;
  }
  let toolResult = await callTool("chief_save_record", {
    kind: "loop",
    data: { title: "Forecast due", owner: "Alex", due: "2026-10-02" },
  });
  assert.equal(toolResult.isError, false);
  const savedLoop = JSON.parse(toolResult.content[0].text);
  toolResult = await callTool("chief_save_record", {
    kind: "loop",
    id: savedLoop.id,
    version: savedLoop.version,
    data: { status: "Received" },
  });
  assert.equal(JSON.parse(toolResult.content[0].text).data.status, "Received");
  toolResult = await callTool("chief_save_record", {
    kind: "loop",
    id: savedLoop.id,
    version: savedLoop.version,
    data: { status: "Waiting" },
  });
  assert.equal(toolResult.isError, true);
  toolResult = await callTool("chief_save_record", {
    kind: "task",
    id: savedLoop.id,
    version: 2,
    data: { title: "Wrong kind" },
  });
  assert.equal(toolResult.isError, true);
  toolResult = await callTool("chief_save_record", {
    kind: "task",
    data: { title: "Bad date", due: "2026-02-30" },
  });
  assert.equal(toolResult.isError, true);
  toolResult = await callTool("chief_record_request", {
    question: "Draft a plan",
    answer: "A tailored plan saved from ChatGPT.",
  });
  const savedAnswer = JSON.parse(toolResult.content[0].text);
  assert.equal(savedAnswer.data.answer, "A tailored plan saved from ChatGPT.");
  assert.equal(savedAnswer.data.source, "ChatGPT");
  assert.equal(savedAnswer.data.lane, "Chief");
  const confirmedMeeting = (await request("/api/workspace")).data.items.find(
    (i) => i.kind === "meeting" && !i.data.demo,
  );
  toolResult = await callTool("chief_meeting_prep", {
    id: confirmedMeeting.id,
    version: confirmedMeeting.version,
    content: "# Confirmed meeting prep\nDecision: Review the forecast.",
  });
  assert.equal(toolResult.isError, false);
  assert.match(
    JSON.parse(toolResult.content[0].text).item.data.prep,
    /Confirmed meeting prep/,
  );
  toolResult = await callTool("chief_meeting_prep", {
    id: confirmedMeeting.id,
    version: confirmedMeeting.version,
  });
  assert.equal(toolResult.isError, true);
  const freshMeeting = (await request("/api/workspace")).data.items.find(
    (i) => i.id === confirmedMeeting.id,
  );
  r = await request("/api/chief", "POST", {
    action: "prep",
    id: freshMeeting.id,
    version: freshMeeting.version,
  });
  assert.equal(r.status, 200);
  assert.match(r.data.content, /Objective/);
  r = await request("/api/chief", "POST", {
    action: "record",
    kind: "task",
    data: { title: "Chief action", due: "2026-10-01" },
  });
  assert.equal(r.status, 200);
  const chiefTask = r.data.item;
  r = await request("/api/chief", "POST", {
    action: "record",
    kind: "task",
    id: chiefTask.id,
    version: chiefTask.version,
    data: { done: true },
  });
  assert.equal(r.data.item.data.done, true);
  const snapshot = (await request("/api/chief")).data;
  assert.ok(snapshot.work.records.some((i) => i.id === savedLoop.id));
  assert.ok(!snapshot.work.records.some((i) => i.data.demo));
  r = await request("/api/chief", "POST", {
    action: "intake",
    version: chief.version,
    answers: chief.data.answers,
  });
  assert.equal(r.data.item.data.firstBriefApproved, false);
  assert.equal(r.data.item.data.reviewed, false);
  console.log(
    "PASS: actual Worker/D1 CRUD, persistent reload, update conflict, atomic imports, idempotency, cross-origin rejection, briefings, prep, connection states, sample cleanup, Chief review gates, persistent inbox, draft approval/reset/conflicts, MCP identity checks, ChatGPT answer persistence, local record kind/date/conflict checks, and saved meeting prep.",
  );
} finally {
  await mf.dispose();
}
