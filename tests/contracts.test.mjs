import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import ts from "typescript";
const temp = await mkdtemp(
  new URL("../.test-runtime-", import.meta.url).pathname,
);
for (const name of ["model", "calendar", "chief"]) {
  const source = await readFile(
    new URL(`../lib/${name}.ts`, import.meta.url),
    "utf8",
  );
  const code = ts
    .transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
      },
    })
    .outputText.replace('"./model"', '"./model.mjs"');
  await writeFile(`${temp}/${name}.mjs`, code);
}
const model = await import(pathToFileURL(`${temp}/model.mjs`).href),
  calendar = await import(pathToFileURL(`${temp}/calendar.mjs`).href);
process.on("exit", () => {});
test.after(async () => {
  await rm(temp, { recursive: true, force: true });
});
test("dates reject nonexistent days and meetings reject reversed time", () => {
  assert.equal(
    model.schemas.task.safeParse({ title: "x", due: "2026-02-30" }).success,
    false,
  );
  assert.equal(
    model.schemas.meeting.safeParse({
      title: "x",
      start: "2026-10-01T15:00:00Z",
      end: "2026-10-01T14:00:00Z",
    }).success,
    false,
  );
});
test("timezone conversion preserves New York winter and summer offsets", () => {
  assert.equal(
    model.localDateTime("2026-01-15", "09:00", "America/New_York"),
    "2026-01-15T14:00:00.000Z",
  );
  assert.equal(
    model.localDateTime("2026-07-15", "09:00", "America/New_York"),
    "2026-07-15T13:00:00.000Z",
  );
});
test("ICS round trip preserves UTC, escaped punctuation, newlines and UTF-8 folding", () => {
  const data = {
    title: "Strategy, hiring; " + "é".repeat(60),
    start: "2026-10-01T13:00:00Z",
    end: "2026-10-01T14:00:00Z",
    agenda: "Review\nChoose an owner",
    location: "Studio",
  };
  const exported = calendar.exportICS([{ id: "meeting", data }]);
  for (const line of exported.split("\r\n"))
    assert.ok(new TextEncoder().encode(line).length <= 75);
  const [parsed] = calendar.parseICS(exported, "America/New_York");
  assert.equal(parsed.title, data.title);
  assert.equal(parsed.agenda, data.agenda);
  assert.equal(parsed.start, data.start);
});
test("ICS respects TZID and rejects unexpanded recurring series", () => {
  const lines =
    "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:x\r\nSUMMARY:Meeting\r\nDTSTART;TZID=America/New_York:20261001T090000\r\nDTEND;TZID=America/New_York:20261001T100000\r\nEND:VEVENT\r\nEND:VCALENDAR";
  assert.equal(
    calendar.parseICS(lines, "Etc/UTC")[0].start,
    "2026-10-01T13:00:00.000Z",
  );
  assert.throws(
    () =>
      calendar.parseICS(
        lines.replace("END:VEVENT", "RRULE:FREQ=WEEKLY\r\nEND:VEVENT"),
        "Etc/UTC",
      ),
    /Recurring/,
  );
});

test("Chief intake preserves UNKNOWN/NONE and only applies disclosed defaults", async () => {
  const chief = await import(pathToFileURL(`${temp}/chief.mjs`).href);
  const answers = Array(16).fill("");
  answers[6] = "UNKNOWN";
  answers[9] = "NONE";
  const normalized = chief.normalizedAnswers(answers);
  assert.equal(normalized[6], "UNKNOWN");
  assert.equal(normalized[9], "NONE");
  assert.equal(normalized[1], "Chief");
  assert.equal(normalized[5], "UNKNOWN");
  assert.match(chief.chiefInstructions(normalized), /Drafts only/);
  assert.equal(chief.setupBlocks(normalized).length, 4);
});
test("Chief excludes sample facts, caps briefs, and honors overnight quiet hours", async () => {
  const chief = await import(pathToFileURL(`${temp}/chief.mjs`).href);
  const answers = chief.normalizedAnswers(Array(16).fill(""));
  answers[2] = "America/New_York";
  answers[3] = "11:00 PM to 6:30 AM";
  const item = {
    id: "sample",
    kind: "loop",
    version: 1,
    updatedAt: "",
    data: {
      demo: true,
      owner: "Invented owner",
      title: "Sample money",
      status: "Waiting",
      due: "2020-01-01",
    },
  };
  const brief = chief.chiefBrief([item], answers);
  assert.ok(brief.split("\n").filter(Boolean).length <= 12);
  assert.doesNotMatch(brief, /Invented owner|Sample money/);
  assert.equal(chief.quietNow(answers, new Date("2026-10-02T04:00:00Z")), true);
  assert.equal(
    chief.quietNow(answers, new Date("2026-10-02T14:00:00Z")),
    false,
  );
});
