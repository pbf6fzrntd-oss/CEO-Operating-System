import { parseICS, exportICS } from "../../../lib/calendar";
import { all, get, db, failure, checkMutation } from "../../../lib/store";
import { schemas } from "../../../lib/model";
export async function GET() {
  try {
    return new Response(
      exportICS((await all()).filter((i) => i.kind === "meeting")),
      {
        headers: {
          "Content-Type": "text/calendar; charset=utf-8",
          "Content-Disposition": 'attachment; filename="ceo-calendar.ics"',
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    checkMutation(request);
    const { content } = (await request.json()) as { content: string };
    if (typeof content !== "string" || content.length > 500000)
      return Response.json(
        { error: "Choose an ICS file under 500 KB." },
        { status: 400 },
      );
    const profile = await get("profile"),
      events = parseICS(content, profile?.data.timezone || "America/New_York");
    const statements = [];
    for (const event of events) {
      const hash = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(event.uid),
      );
      const id =
        "ics-" +
        Array.from(new Uint8Array(hash))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
      const data = schemas.meeting.parse(event);
      statements.push(
        db()
          .prepare(
            "INSERT OR IGNORE INTO records (id,kind,payload,version,updated_at) VALUES (?,'meeting',?,1,?)",
          )
          .bind(id, JSON.stringify(data), new Date().toISOString()),
      );
    }
    const results = statements.length ? await db().batch(statements) : [];
    return Response.json({
      count: results.reduce((n, r) => n + (r.meta.changes || 0), 0),
    });
  } catch (e) {
    return failure(e);
  }
}
