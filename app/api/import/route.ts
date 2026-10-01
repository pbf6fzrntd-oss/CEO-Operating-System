import { z } from "zod";
import { db, failure, checkMutation } from "../../../lib/store";
import { schemas } from "../../../lib/model";
export async function POST(request: Request) {
  try {
    checkMutation(request);
    const payload = z
      .object({
        provider: z.enum(["instinct", "silvia", "manual"]),
        items: z
          .array(
            z.object({
              kind: z.enum(["task", "loop", "meeting", "decision"]),
              data: z.record(z.unknown()),
              externalId: z.string().max(180).optional(),
            }),
          )
          .min(1)
          .max(100),
      })
      .parse(await request.json());
    const rows = payload.items.map((item) => ({
      id: item.externalId
        ? `${payload.provider}-${item.kind}-${item.externalId}`
        : crypto.randomUUID(),
      kind: item.kind,
      data: schemas[item.kind].parse({
        ...item.data,
        source: payload.provider,
        demo: false,
      }),
    }));
    const results = await db().batch(
      rows.map((row) =>
        db()
          .prepare(
            "INSERT OR IGNORE INTO records (id,kind,payload,version,updated_at) VALUES (?,?,?,1,?)",
          )
          .bind(
            row.id,
            row.kind,
            JSON.stringify(row.data),
            new Date().toISOString(),
          ),
      ),
    );
    return Response.json(
      { count: results.reduce((n, r) => n + (r.meta.changes || 0), 0) },
      { status: 201 },
    );
  } catch (e) {
    return failure(e);
  }
}
