import { z } from "zod";
export const kinds = [
  "task",
  "loop",
  "meeting",
  "decision",
  "briefing",
  "message",
  "settings",
] as const;
export type Kind = (typeof kinds)[number];
export type Item = {
  id: string;
  kind: Kind;
  version: number;
  updatedAt: string;
  data: Record<string, any>;
};
const title = z.string().trim().min(1).max(240);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(s + "T12:00:00Z");
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, "Invalid calendar date");
const base = {
  title,
  notes: z.string().max(16000).default(""),
  source: z.string().max(80).default("manual"),
  demo: z.boolean().default(false),
};
export const schemas = {
  task: z.object({
    ...base,
    due: date,
    priority: z.enum(["High", "Medium", "Low"]).default("Medium"),
    category: z.string().max(80).default("Strategy"),
    done: z.boolean().default(false),
  }),
  loop: z.object({
    ...base,
    owner: z.string().trim().min(1).max(120),
    due: date,
    status: z.enum(["Waiting", "Received"]).default("Waiting"),
    channel: z.string().max(100).default("Email"),
  }),
  meeting: z
    .object({
      ...base,
      start: z.string().datetime({ offset: true }),
      end: z.string().datetime({ offset: true }),
      attendees: z.string().max(1000).default(""),
      location: z.string().max(500).default(""),
      agenda: z.string().max(16000).default(""),
      prep: z.string().max(24000).default(""),
      outcome: z.string().max(16000).default(""),
    })
    .refine((d) => Date.parse(d.end) > Date.parse(d.start), {
      message: "Meeting end must follow start",
    }),
  decision: z.object({
    ...base,
    due: date,
    status: z.enum(["Considering", "Decided", "Review"]).default("Considering"),
    options: z.string().max(16000).default(""),
    rationale: z.string().max(16000).default(""),
  }),
  briefing: z.object({
    ...base,
    date,
    content: z.string().max(30000),
    engine: z.string().max(80).default("Workspace synthesis"),
  }),
  message: z.object({
    ...base,
    author: z.string().max(120),
    channel: z.string().max(100),
    ts: z.string().max(80),
    text: z.string().max(16000),
    externalId: z.string().max(240),
  }),
  settings: z.object({
    name: z.string().trim().min(1).max(80),
    role: z.string().max(100),
    company: z.string().max(100),
    timezone: z.string().refine((s) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: s });
        return true;
      } catch {
        return false;
      }
    }, "Invalid timezone"),
    northStar: z.string().max(1000),
  }),
};
export function today(timezone = "America/New_York") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function dayOffset(day: string, offset: number) {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}
export function localDateTime(
  day: string,
  time: string,
  timezone: string,
): string {
  const desired = Date.parse(`${day}T${time}:00Z`);
  let guess = desired;
  for (let i = 0; i < 3; i++) {
    const p = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(guess));
    const v = Object.fromEntries(p.map((x) => [x.type, x.value]));
    const represented = Date.parse(
      `${v.year}-${v.month}-${v.day}T${v.hour}:${v.minute}:${v.second}Z`,
    );
    guess += desired - represented;
  }
  return new Date(guess).toISOString();
}
