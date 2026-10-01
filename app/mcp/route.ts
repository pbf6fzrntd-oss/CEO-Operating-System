import { z } from "zod";
import { chiefSnapshot, chiefAsk, saveDraft } from "../../lib/chief-service";
import { all } from "../../lib/store";
import { chiefContext, chiefInstructions } from "../../lib/chief";
const tools = [
  {
    name: "chief_context",
    description:
      "Read the reviewed Chief instructions, confirmed workspace records, request history, unsent drafts, and connection status. Samples are excluded. Chief is the single inbox. No external actions.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "chief_record_request",
    description:
      "Save an executive request in the Chief inbox. The response is a local draft/synthesis, not an executed action. Requires reviewed intake.",
    inputSchema: {
      type: "object",
      properties: {
        question: { type: "string", minLength: 1, maxLength: 4000 },
      },
      required: ["question"],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  {
    name: "chief_save_draft",
    description:
      "Save an unsent reply or document for executive review. Cannot send, publish, book, pay, delete, approve, or hire. Ask Chief for context before drafting.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", maxLength: 240 },
        body: { type: "string", maxLength: 24000 },
        recipient: { type: "string", maxLength: 240 },
        channel: {
          type: "string",
          enum: ["Email", "Slack", "Document", "Other"],
        },
      },
      required: ["title", "body"],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
];
export async function POST(request: Request) {
  let id: any = null;
  try {
    const p = (await request.json()) as any;
    id = p.id ?? null;
    const reply = (result: any) =>
      Response.json({ jsonrpc: "2.0", id, result });
    if (p.method === "initialize")
      return reply({
        protocolVersion: "2025-03-26",
        capabilities: { tools: {} },
        serverInfo: { name: "CEO Chief of Staff", version: "1.0.0" },
      });
    if (p.method === "notifications/initialized")
      return new Response(null, { status: 202 });
    if (p.method === "ping") return reply({});
    if (p.method === "tools/list") return reply({ tools });
    if (p.method !== "tools/call")
      return Response.json({
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: "Method not found" },
      });
    if (!request.headers.get("oai-authenticated-user-id"))
      return Response.json(
        { error: "Authenticated user identity is required for Chief tools." },
        { status: 401 },
      );
    let result: any;
    const name = p.params?.name,
      args = p.params?.arguments || {};
    if (name === "chief_context") {
      const state = await chiefSnapshot(),
        records = await all();
      result = {
        ...state,
        context: state.chief.data.reviewed
          ? chiefContext(records, state.chief.data.answers)
          : null,
        instructions: state.chief.data.reviewed
          ? chiefInstructions(state.chief.data.answers)
          : "Complete and review the 16-question intake in the Chief desk first. Do not invent missing context.",
      };
    } else if (name === "chief_record_request")
      result = await chiefAsk(
        z.object({ question: z.string().trim().min(1).max(4000) }).parse(args)
          .question,
      );
    else if (name === "chief_save_draft") {
      const parsed = z
        .object({
          title: z.string().trim().min(1).max(240),
          body: z.string().min(1).max(24000),
          recipient: z.string().max(240).optional(),
          channel: z.enum(["Email", "Slack", "Document", "Other"]).optional(),
        })
        .parse(args);
      const state = await chiefSnapshot();
      if (!state.chief.data.reviewed)
        throw new Error("Review the intake first.");
      result = await saveDraft(parsed);
    } else
      return Response.json({
        jsonrpc: "2.0",
        id,
        error: { code: -32602, message: "Unknown tool" },
      });
    return reply({
      content: [{ type: "text", text: JSON.stringify(result) }],
      isError: false,
    });
  } catch (e) {
    return Response.json({
      jsonrpc: "2.0",
      id,
      result: {
        content: [
          {
            type: "text",
            text: e instanceof Error ? e.message : "Tool failed",
          },
        ],
        isError: true,
      },
    });
  }
}
