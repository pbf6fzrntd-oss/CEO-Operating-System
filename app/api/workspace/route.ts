import {
  all,
  seed,
  insert,
  get,
  update,
  remove,
  failure,
  checkMutation,
  db,
} from "../../../lib/store";
import { z } from "zod";
import { kinds } from "../../../lib/model";
export async function GET() {
  try {
    await seed();
    return Response.json(
      { items: await all() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    checkMutation(request);
    const p = z
      .object({ kind: z.enum(kinds), data: z.unknown() })
      .parse(await request.json());
    if (p.kind === "settings")
      return Response.json(
        { error: "Use the existing profile." },
        { status: 400 },
      );
    return Response.json(
      { item: await insert(p.kind, p.data) },
      { status: 201 },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function PATCH(request: Request) {
  try {
    checkMutation(request);
    const p = z
      .object({
        id: z.string(),
        version: z.number().int().positive(),
        data: z.unknown(),
      })
      .parse(await request.json());
    const item = await get(p.id);
    if (!item)
      return Response.json(
        { error: "Item no longer exists." },
        { status: 404 },
      );
    return Response.json({ item: await update(item, p.data, p.version) });
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(request: Request) {
  try {
    checkMutation(request);
    const p = z
      .object({
        id: z.string().optional(),
        version: z.number().int().positive().optional(),
        samples: z.boolean().optional(),
      })
      .parse(await request.json());
    if (p.samples) {
      await db()
        .prepare(
          "DELETE FROM records WHERE kind != 'settings' AND json_extract(payload, '$.demo') = 1",
        )
        .run();
      return Response.json({ ok: true });
    }
    if (!p.id || !p.version)
      return Response.json(
        { error: "An item and its version are required." },
        { status: 400 },
      );
    const item = await get(p.id);
    if (item?.kind === "settings")
      return Response.json(
        { error: "The profile cannot be removed." },
        { status: 400 },
      );
    await remove(p.id, p.version);
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
