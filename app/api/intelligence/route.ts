import { z } from "zod";
import {
  all,
  get,
  insert,
  update,
  failure,
  checkMutation,
} from "../../../lib/store";
import { openai } from "../../../lib/integrations";
import {
  chiefBrief,
  chiefInstructions,
  chiefContext,
} from "../../../lib/chief";
import { today } from "../../../lib/model";
import { prepareChiefMeeting } from "../../../lib/chief-service";
export async function POST(request: Request) {
  try {
    checkMutation(request);
    const p = z
      .object({
        action: z.enum(["briefing", "prep", "chat"]),
        id: z.string().optional(),
        prompt: z.string().trim().min(1).max(4000).optional(),
      })
      .parse(await request.json());
    const items = await all(),
      profile = items.find((i) => i.kind === "settings"),
      day = today(profile?.data.timezone);
    const tasks = items
      .filter((i) => i.kind === "task" && !i.data.done && i.data.due <= day)
      .sort(
        (a, b) =>
          Number(b.data.priority === "High") -
          Number(a.data.priority === "High"),
      );
    const loops = items.filter(
        (i) => i.kind === "loop" && i.data.status === "Waiting",
      ),
      overdue = loops.filter((i) => i.data.due < day);
    const meetings = items
      .filter(
        (i) =>
          i.kind === "meeting" &&
          new Intl.DateTimeFormat("en-CA", {
            timeZone: profile?.data.timezone || "America/New_York",
          }).format(new Date(i.data.start)) === day,
      )
      .sort((a, b) => a.data.start.localeCompare(b.data.start));
    const chief = items.find((i) => i.id === "chief-desk"),
      reviewed = chief?.data.reviewed;
    const context = items.filter((i) => i.kind !== "briefing").slice(0, 160);
    let content = "",
      engine = "Workspace synthesis";
    if (p.action === "briefing") {
      const generated = reviewed
        ? null
        : await openai(
            `Create today's CEO briefing for ${day}: priorities, calendar, overdue commitments, decisions, and one recommended focus block. Use the profile timezone.`,
            context,
          );
      engine = generated ? "OpenAI GPT" : "Workspace synthesis";
      content =
        generated ||
        `EXECUTIVE SUMMARY\n${tasks.length} priorities need attention today. ${meetings.length} meetings are on your calendar. ${overdue.length} commitments are overdue.\n\nYOUR PRIORITIES\n${tasks.map((t) => `• ${t.data.title} (${t.data.priority}; due ${t.data.due})`).join("\n") || "No due priorities. Choose one strategic outcome for today."}\n\nYOUR CALENDAR\n${meetings.map((m) => `• ${m.data.title} — ${new Date(m.data.start).toLocaleTimeString("en-US", { timeZone: profile?.data.timezone || "America/New_York", hour: "numeric", minute: "2-digit" })}`).join("\n") || "No scheduled meetings today."}\n\nFOLLOW THROUGH\n${overdue.map((l) => `• ${l.data.owner}: ${l.data.title} (due ${l.data.due})`).join("\n") || "No overdue OpenLoops."}\n\nPROTECT YOUR ATTENTION\nReserve a 90-minute focus block for ${tasks[0]?.data.title || "your most important strategic outcome"}.\n\nSource: saved workspace records. ${items.some((i) => i.data.demo) ? "Includes labeled sample records. " : ""}No external news or live research included.`;
      if (reviewed) {
        const ai = await openai(
          "Create the daily Chief brief in at most 12 nonempty lines with Need you / Ship-ready / Team / Ignore / Next.",
          chiefContext(items, chief!.data.answers),
          chiefInstructions(chief!.data.answers),
        );
        content = ai
          ? ai.split(/\n/).filter(Boolean).slice(0, 12).join("\n")
          : chiefBrief(items, chief!.data.answers);
        engine = ai ? "OpenAI GPT" : "Chief workspace synthesis";
      }
      const id = `briefing-${day}`,
        existing = await get(id),
        data = {
          title: `Daily briefing · ${day}`,
          date: day,
          content,
          engine,
          demo: reviewed ? false : context.some((i) => i.data.demo),
          source: engine,
        };
      return Response.json({
        item: existing
          ? await update(existing, data, existing.version)
          : await insert("briefing", data, id),
        content,
        engine,
      });
    }
    if (p.action === "prep") {
      const meeting = items.find((i) => i.id === p.id && i.kind === "meeting");
      if (!meeting)
        return Response.json({ error: "Select a meeting." }, { status: 400 });
      if (reviewed && !meeting.data.demo) {
        return Response.json(await prepareChiefMeeting(meeting.id, meeting.version));
      }
      const names = meeting.data.attendees.toLowerCase();
      const related = loops.filter((l) =>
        Boolean(l.data.demo) === Boolean(meeting.data.demo) && names.includes(l.data.owner.toLowerCase()),
      );
      const generated = await openai(
        "Prepare a concise meeting brief with objective, agenda, relevant commitments, questions, decisions needed, and follow-up template. Do not invent participant backgrounds.",
        { meeting, related, tasks: tasks.filter(i => Boolean(i.data.demo) === Boolean(meeting.data.demo)) },
      );
      engine = generated ? "OpenAI GPT" : "Workspace synthesis";
      content =
        generated ||
        `MEETING OBJECTIVE\n${meeting.data.notes || `Align on the desired outcome for ${meeting.data.title}.`}\n\nPARTICIPANTS\n${meeting.data.attendees || "Confirm attendees."}\n\nAGENDA\n${meeting.data.agenda || "1. Context and desired outcome\n2. Key questions and decisions\n3. Owners and next steps"}\n\nRELEVANT OPENLOOPS\n${related.map((l) => `• ${l.data.owner}: ${l.data.title} — due ${l.data.due}`).join("\n") || "No attendee commitments found in the workspace."}\n\nQUESTIONS TO ASK\n• What has changed since the last conversation?\n• What is the most important constraint?\n• What decision do we need to make today?\n\nLEAVE WITH\nA decision, an accountable owner, and a date. Capture action items as tasks or OpenLoops.\n\nPrepared from saved workspace context; no external participant research.`;
      return Response.json({
        item: await update(
          meeting,
          { ...meeting.data, prep: content },
          meeting.version,
        ),
        content,
        engine,
      });
    }
    if (!p.prompt)
      return Response.json({ error: "Enter a question." }, { status: 400 });
    const generated = await openai(p.prompt, context);
    content =
      generated ||
      `Workspace snapshot for ${day}\n\nYour highest-priority item: ${tasks[0]?.data.title || "No due tasks"}.\n${overdue.length} overdue commitments: ${overdue.map((l) => `${l.data.owner} — ${l.data.title}`).join("; ") || "none"}.\nNext meeting today: ${meetings.find((m) => Date.parse(m.data.end) > Date.now())?.data.title || "None remaining"}.\n\nConnect OpenAI GPT in Integrations for a tailored answer to “${p.prompt}”. This snapshot is generated from saved records, not an AI response.`;
    return Response.json({
      content,
      engine: generated ? "OpenAI GPT" : "Workspace synthesis",
    });
  } catch (e) {
    return failure(e);
  }
}
