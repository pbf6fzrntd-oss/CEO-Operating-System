import { env } from "cloudflare:workers";
import {
  type Kind,
  type Item,
  schemas,
  today,
  dayOffset,
  localDateTime,
} from "./model";
export function db() {
  if (!env.DB)
    throw new Error("Workspace storage is unavailable. Please try again.");
  return env.DB;
}
function decode(row: any): Item {
  return {
    id: row.id,
    kind: row.kind,
    version: row.version,
    updatedAt: row.updated_at,
    data: JSON.parse(row.payload),
  };
}
export async function all() {
  const r = await db()
    .prepare(
      "SELECT * FROM records WHERE kind != 'meta' ORDER BY updated_at DESC",
    )
    .all();
  return r.results.map(decode);
}
export async function get(id: string) {
  const row = await db()
    .prepare("SELECT * FROM records WHERE id = ?")
    .bind(id)
    .first();
  return row ? decode(row) : null;
}
export async function insert(
  kind: Kind,
  data: unknown,
  id = crypto.randomUUID(),
) {
  const parsed = schemas[kind].parse(data);
  await db()
    .prepare(
      "INSERT INTO records (id,kind,payload,version,updated_at) VALUES (?,?,?,1,?)",
    )
    .bind(id, kind, JSON.stringify(parsed), new Date().toISOString())
    .run();
  return (await get(id))!;
}
export async function update(item: Item, data: unknown, version: number) {
  const parsed = schemas[item.kind].parse(data);
  const r = await db()
    .prepare(
      "UPDATE records SET payload=?, version=version+1, updated_at=? WHERE id=? AND version=?",
    )
    .bind(JSON.stringify(parsed), new Date().toISOString(), item.id, version)
    .run();
  if (!r.meta.changes)
    throw new Error("This item changed in another tab. Refresh and try again.");
  return (await get(item.id))!;
}
export async function remove(id: string, version: number) {
  const r = await db()
    .prepare("DELETE FROM records WHERE id=? AND version=?")
    .bind(id, version)
    .run();
  if (!r.meta.changes)
    throw new Error("This item changed in another tab. Refresh and try again.");
}
export async function seed() {
  if (
    await db().prepare("SELECT id FROM records WHERE id='initialized'").first()
  )
    return;
  const day = today(),
    tz = "America/New_York";
  const demo: any[] = [
    [
      "settings",
      "profile",
      {
        name: "Joshua",
        role: "Chief Executive Officer",
        company: "Executive workspace",
        timezone: tz,
        northStar:
          "Build enduring companies. Protect time for the work only I can do.",
      },
    ],
    [
      "task",
      "demo-task-1",
      {
        title: "Set the three outcomes that matter this quarter",
        due: day,
        priority: "High",
        category: "Strategy",
        notes: "Choose measurable outcomes and one accountable owner for each.",
      },
    ],
    [
      "task",
      "demo-task-2",
      {
        title: "Review the board narrative",
        due: day,
        priority: "High",
        category: "Leadership",
        notes: "Clarify the ask, the risks, and the evidence behind the plan.",
      },
    ],
    [
      "task",
      "demo-task-3",
      {
        title: "Make the senior hire decision",
        due: day,
        priority: "Medium",
        category: "People",
        notes: "Compare references against the role scorecard.",
      },
    ],
    [
      "task",
      "demo-task-4",
      {
        title: "Protect 90 minutes for deep work",
        due: day,
        priority: "Medium",
        category: "Personal",
        done: true,
      },
    ],
    [
      "loop",
      "demo-loop-1",
      {
        title: "Updated cash forecast",
        owner: "Alex Morgan",
        due: dayOffset(day, -2),
        channel: "Slack",
        notes:
          "Need the base case and downside scenario before the board conversation.",
      },
    ],
    [
      "loop",
      "demo-loop-2",
      {
        title: "Final commercial proposal",
        owner: "Jordan Lee",
        due: day,
        channel: "Email",
        notes: "Confirm pricing, timeline, and the implementation owner.",
      },
    ],
    [
      "loop",
      "demo-loop-3",
      {
        title: "Candidate reference notes",
        owner: "Sam Rivera",
        due: dayOffset(day, 1),
        channel: "Slack",
        notes: "Two former managers and one cross-functional partner.",
      },
    ],
    [
      "meeting",
      "demo-meeting-1",
      {
        title: "Leadership alignment",
        start: localDateTime(day, "09:00", tz),
        end: localDateTime(day, "09:45", tz),
        attendees: "Alex Morgan, Jordan Lee, Sam Rivera",
        location: "Executive team · Zoom",
        agenda:
          "1. Progress against quarterly outcomes\n2. Decisions and constraints\n3. Owners and next steps",
      },
    ],
    [
      "meeting",
      "demo-meeting-2",
      {
        title: "Investor conversation",
        start: localDateTime(day, "13:00", tz),
        end: localDateTime(day, "14:00", tz),
        attendees: "Taylor Chen",
        location: "Video call",
        agenda:
          "1. Business progress\n2. Capital plan\n3. Questions and next steps",
        notes:
          "Prepare the operating story and a clear capital allocation thesis.",
      },
    ],
    [
      "meeting",
      "demo-meeting-3",
      {
        title: "Product & growth review",
        start: localDateTime(day, "15:30", tz),
        end: localDateTime(day, "16:15", tz),
        attendees: "Jordan Lee, Product team",
        location: "Studio",
        agenda:
          "1. Customer learning\n2. Growth constraints\n3. Next experiment",
      },
    ],
    [
      "decision",
      "demo-decision-1",
      {
        title: "Prioritize the next senior hire",
        due: dayOffset(day, 7),
        status: "Considering",
        options:
          "Commercial leadership\nProduct leadership\nFinance leadership",
        rationale:
          "Evaluate which role removes the most important execution constraint.",
      },
    ],
  ];
  const statements = demo.map(([kind, id, data]) =>
    db()
      .prepare(
        "INSERT OR IGNORE INTO records (id,kind,payload,version,updated_at) VALUES (?,?,?,1,?)",
      )
      .bind(
        id,
        kind,
        JSON.stringify(
          schemas[kind as Kind].parse(
            kind === "settings"
              ? data
              : { ...data, demo: true, source: "sample" },
          ),
        ),
        new Date().toISOString(),
      ),
  );
  statements.push(
    db()
      .prepare(
        "INSERT OR IGNORE INTO records (id,kind,payload,version,updated_at) VALUES ('initialized','meta','{}',1,?)",
      )
      .bind(new Date().toISOString()),
  );
  await db().batch(statements);
}
export function checkMutation(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    throw new Error("Cross-origin requests are not allowed.");
}
export function failure(error: unknown) {
  console.error(
    "CEO workspace request failed",
    error instanceof Error ? error.message : "unknown",
  );
  const validation = error && typeof error === "object" && "issues" in error;
  return Response.json(
    {
      error: validation
        ? "Please check the required fields and date formats."
        : error instanceof Error
          ? error.message
          : "Unable to complete this request.",
    },
    {
      status: validation
        ? 400
        : error instanceof Error &&
            error.message.includes("changed in another tab")
          ? 409
          : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
