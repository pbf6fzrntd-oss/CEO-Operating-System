import { z } from "zod";
import {
  chiefSnapshot,
  saveIntake,
  generateChiefBrief,
  chiefAsk,
  saveDraft,
  approveDraft,
  approveChiefStage,
  saveChiefRecord,
  prepareChiefMeeting,
} from "../../../lib/chief-service";
import { failure, checkMutation } from "../../../lib/store";
export async function GET() {
  try {
    return Response.json(await chiefSnapshot(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    checkMutation(request);
    const p = z
      .object({
        action: z.enum([
          "intake",
          "review",
          "brief",
          "ask",
          "draft",
          "approve",
          "reject",
          "proof",
          "specialists",
          "morning",
          "record",
          "prep",
        ]),
        answers: z.array(z.string().max(4000)).length(16).optional(),
        version: z.number().int().positive().optional(),
        id: z.string().optional(),
        question: z.string().trim().min(1).max(4000).optional(),
        kind: z.enum(["task", "loop", "decision"]).optional(),
        data: z.record(z.unknown()).optional(),
        scheduled: z.boolean().optional(),
      })
      .parse(await request.json());
    if (p.action === "intake" || p.action === "review") {
      if (!p.answers || !p.version)
        throw new Error("Answers and version are required.");
      return Response.json({
        item: await saveIntake(p.answers, p.version, p.action === "review"),
      });
    }
    if (p.action === "brief")
      return Response.json(await generateChiefBrief(p.scheduled));
    if (p.action === "ask") {
      if (!p.question) throw new Error("Enter a request.");
      return Response.json({ item: await chiefAsk(p.question) });
    }
    if (p.action === "draft") {
      if (!p.data) throw new Error("Draft content is required.");
      return Response.json({ item: await saveDraft(p.data, p.id, p.version) });
    }
    if (p.action === "record") {
      if (!p.kind || !p.data)
        throw new Error("Record kind and data are required.");
      return Response.json({
        item: await saveChiefRecord(p.kind, p.data, p.id, p.version),
        executed: false,
      });
    }
    if (p.action === "prep") {
      if (!p.id || !p.version)
        throw new Error("Meeting and current version are required.");
      return Response.json(await prepareChiefMeeting(p.id, p.version));
    }
    if (!p.version) throw new Error("Current version is required.");
    if (p.action === "approve" || p.action === "reject") {
      if (!p.id) throw new Error("Choose the draft.");
      return Response.json({
        item: await approveDraft(
          p.id,
          p.version,
          p.action === "approve" ? "Approved" : "Rejected",
        ),
        executed: false,
        message: "Review recorded. No external action was executed.",
      });
    }
    return Response.json({
      item: await approveChiefStage(p.action, p.version),
    });
  } catch (e) {
    return failure(e);
  }
}
