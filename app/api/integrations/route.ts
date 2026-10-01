import {
  integrationStatus,
  syncGoogle,
  syncSlack,
  rememberSync,
} from "../../../lib/integrations";
import { checkMutation, failure, db } from "../../../lib/store";
export async function GET() {
  try {
    const integrations = await Promise.all(
      integrationStatus().map(async (i) => {
        const s = await db()
          .prepare("SELECT payload FROM records WHERE id=?")
          .bind(`sync-${i.id}`)
          .first<{ payload: string }>();
        return { ...i, ...(s ? JSON.parse(s.payload) : {}) };
      }),
    );
    return Response.json(
      { integrations },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    checkMutation(request);
    const { provider } = (await request.json()) as { provider: string };
    if (!["google", "slack"].includes(provider))
      return Response.json(
        { error: "This provider does not support sync." },
        { status: 400 },
      );
    const r = provider === "google" ? await syncGoogle() : await syncSlack();
    await rememberSync(provider, r.message);
    return Response.json(r);
  } catch (e) {
    return failure(e);
  }
}
