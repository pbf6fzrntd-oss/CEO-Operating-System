import {
  integrationConnections,
  syncGoogle,
  syncSlack,
  syncGmail,
  rememberSync,
} from "../../../lib/integrations";
import { checkMutation, failure } from "../../../lib/store";
export async function GET() {
  try {
    const integrations = await integrationConnections();
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
    if (!["google", "slack", "gmail"].includes(provider))
      return Response.json(
        { error: "This provider does not support sync." },
        { status: 400 },
      );
    const r =
      provider === "google"
        ? await syncGoogle()
        : provider === "gmail"
          ? await syncGmail()
          : await syncSlack();
    await rememberSync(provider, r.message);
    return Response.json(r);
  } catch (e) {
    return failure(e);
  }
}
