import { all, get, db, insert, update, seed } from "./store";
import {
  chiefSeed,
  normalizedAnswers,
  setupBlocks,
  chiefInstructions,
  chiefContext,
  chiefBrief,
  deskQuiet,
  quietNow,
} from "./chief";
import { openai, integrationStatus } from "./integrations";
import { today } from "./model";
export async function ensureChief() {
  await seed();
  let chief = await get("chief-desk");
  if (!chief) {
    const data = chiefSeed((await get("profile")) || undefined);
    await db()
      .prepare(
        "INSERT OR IGNORE INTO records (id,kind,payload,version,updated_at) VALUES ('chief-desk','chief',?,1,?)",
      )
      .bind(JSON.stringify(data), new Date().toISOString())
      .run();
    chief = await get("chief-desk");
  }
  return chief!;
}
export async function chiefSnapshot() {
  const chief = await ensureChief(),
    items = await all();
  return {
    chief,
    requests: items.filter((i) => i.kind === "chief_request"),
    drafts: items.filter((i) => i.kind === "draft"),
    briefs: items.filter(
      (i) => i.kind === "briefing" && i.id.startsWith("chief-brief-"),
    ),
    blocks: chief.data.reviewed ? setupBlocks(chief.data.answers) : [],
    connections: integrationStatus(),
    capabilities: {
      externalSending: false,
      specialistBots: false,
      chatgptConnection:
        "Install the private Site plugin or copy the reviewed ChatGPT setup package.",
    },
  };
}
export async function saveIntake(
  answers: string[],
  version: number,
  review = false,
) {
  const chief = await ensureChief();
  const normalized = review ? normalizedAnswers(answers) : answers;
  if (review && normalized[2] !== "UNKNOWN") {
    try {
      new Intl.DateTimeFormat("en", { timeZone: normalized[2] });
    } catch {
      throw new Error("Use an exact IANA timezone, or UNKNOWN.");
    }
  }
  return update(
    chief,
    {
      ...chief.data,
      answers: normalized,
      reviewed: review,
      reviewedAt: review ? new Date().toISOString() : "",
      firstBriefApproved: false,
      specialistApproval: false,
      morningApproved: false,
    },
    version,
  );
}
export async function generateChiefBrief(scheduled = false) {
  const chief = await ensureChief();
  if (!chief.data.reviewed)
    throw new Error("Review and approve the 16-answer sheet first.");
  const items = await all(),
    answers = chief.data.answers;
  if (
    scheduled &&
    (!chief.data.morningApproved ||
      quietNow(answers) ||
      deskQuiet(items, answers))
  )
    return {
      quiet: true,
      reason: !chief.data.morningApproved
        ? "Chief routine not approved"
        : quietNow(answers)
          ? "Quiet hours"
          : "Desk is quiet",
    };
  const generated = await openai(
    "Create the daily Chief brief. At most 12 nonempty lines. Include Need you (max 3), Ship-ready, Team, Ignore, Next. Use only real records; no sample facts.",
    chiefContext(items, answers),
    chiefInstructions(answers),
  );
  const content = generated
    ? generated.split("\n").filter(Boolean).slice(0, 12).join("\n")
    : chiefBrief(items, answers);
  const date = today(
      answers[2] === "UNKNOWN" ? "America/New_York" : answers[2],
    ),
    id = `chief-brief-${date}`,
    old = await get(id),
    data = {
      title: `Chief brief · ${date}`,
      date,
      content,
      engine: generated ? "OpenAI GPT" : "Chief workspace synthesis",
      source: "Chief",
      demo: false,
      chiefVersion: chief.version,
    };
  return {
    item: old
      ? await update(old, data, old.version)
      : await insert("briefing", data, id),
    content,
  };
}
export async function chiefAsk(question: string) {
  const chief = await ensureChief();
  if (!chief.data.reviewed)
    throw new Error("Review and approve the answer sheet before hiring Chief.");
  const items = await all(),
    lane = /draft|write|reply|rewrite/i.test(question)
      ? "Quill"
      : /research|investigate|sources|compare/i.test(question)
        ? "Scout"
        : "Chief";
  const answer = await openai(
    question,
    {
      ...chiefContext(items, chief.data.answers),
      previousRequests: items
        .filter((i) => i.kind === "chief_request")
        .slice(0, 8)
        .map((i) => ({ question: i.data.question, answer: i.data.answer })),
      proposedLane: lane,
    },
    chiefInstructions(chief.data.answers),
  );
  const content =
    answer ||
    `${chiefBrief(items, chief.data.answers)}\n\nFor this request: ${question}\n${lane === "Scout" ? "Scout is a proposed research lane; no research sources have been retrieved." : lane === "Quill" ? "Quill is a proposed drafting lane; create an unsent draft in the review queue." : "OpenAI in-app generation is not connected. Copy this context into ChatGPT or connect the private Site plugin for a tailored answer."}`;
  return insert("chief_request", {
    title: question.slice(0, 240),
    question,
    answer: content,
    lane,
    status: answer ? "Answered" : "Needs context",
    source: answer ? "OpenAI GPT" : "Workspace synthesis",
  });
}
export async function saveDraft(data: any, id?: string, version?: number) {
  const chief = await ensureChief();
  if (!chief.data.reviewed)
    throw new Error("Review the answer sheet before preparing drafts.");
  if (id && !version) throw new Error("Current draft version is required.");
  if (id) {
    const old = await get(id);
    if (!old || old.kind !== "draft") throw new Error("Draft not found.");
    return update(
      old,
      { ...old.data, ...data, status: "Draft", approvedAt: "" },
      version!,
    );
  }
  return insert("draft", {
    ...data,
    status: "Draft",
    approvedAt: "",
    source: "Chief",
  });
}
export async function approveDraft(
  id: string,
  version: number,
  decision: "Approved" | "Rejected",
) {
  const draft = await get(id);
  if (!draft || draft.kind !== "draft") throw new Error("Draft not found.");
  return update(
    draft,
    {
      ...draft.data,
      status: decision,
      approvedAt: decision === "Approved" ? new Date().toISOString() : "",
    },
    version,
  );
}
export async function approveChiefStage(stage: string, version: number) {
  const chief = await ensureChief();
  if (!chief.data.reviewed) throw new Error("Approve the intake first.");
  if (stage === "proof") {
    const briefs = (await all()).filter(
      (i) =>
        i.id.startsWith("chief-brief-") &&
        i.data.chiefVersion === chief.version,
    );
    if (!briefs.length)
      throw new Error(
        "Generate and review a brief from the current answer sheet first.",
      );
    return update(chief, { ...chief.data, firstBriefApproved: true }, version);
  }
  if (!chief.data.firstBriefApproved)
    throw new Error("Approve a useful manual proof brief first.");
  return update(
    chief,
    {
      ...chief.data,
      ...(stage === "specialists"
        ? { specialistApproval: true }
        : { morningApproved: true }),
    },
    version,
  );
}
