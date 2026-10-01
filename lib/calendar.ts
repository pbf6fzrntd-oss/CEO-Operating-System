import { localDateTime } from "./model";
const unescape = (s: string) =>
  s.replace(/\\[nN]/g, "\n").replace(/\\([,;\\])/g, "$1");
export function parseICS(text: string, timezone: string) {
  const lines = text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
  const events: Record<string, string>[] = [];
  let current: Record<string, string> | null = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      current = {};
      continue;
    }
    if (line === "END:VEVENT") {
      if (current) events.push(current);
      current = null;
      continue;
    }
    if (!current) continue;
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    current[line.slice(0, colon)] = line.slice(colon + 1);
  }
  if (events.length > 250)
    throw new Error("Import up to 250 calendar events at a time.");
  return events.map((e, i) => {
    const field = (key: string) =>
      Object.entries(e).find(([k]) => k.split(";")[0] === key);
    const stamp = (key: string) => {
      const pair = field(key);
      if (!pair) throw new Error(`Event ${i + 1} is missing ${key}.`);
      const [k, v] = pair;
      const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(
        v,
      );
      if (!m) throw new Error("Unsupported calendar date format.");
      const day = `${m[1]}-${m[2]}-${m[3]}`,
        time = `${m[4] || "00"}:${m[5] || "00"}`;
      if (m[7]) return `${day}T${time}:${m[6] || "00"}Z`;
      const tz = /TZID=([^;]+)/.exec(k)?.[1] || timezone;
      return localDateTime(day, time, tz.replace(/^"|"$/g, ""));
    };
    if (field("RRULE") || field("RECURRENCE-ID"))
      throw new Error(
        "Recurring calendar rules are not supported by file import. Export expanded events or use Google Calendar sync.",
      );
    return {
      title: unescape(field("SUMMARY")?.[1] || "Untitled event"),
      start: stamp("DTSTART"),
      end: stamp("DTEND"),
      location: unescape(field("LOCATION")?.[1] || ""),
      agenda: unescape(field("DESCRIPTION")?.[1] || ""),
      attendees: "",
      source: "Calendar import",
      uid: field("UID")?.[1] || `${i}-${stamp("DTSTART")}`,
    };
  });
}
export function exportICS(items: any[]) {
  const esc = (s: string) =>
    s
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
  const stamp = (s: string) =>
    new Date(s)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CEO OS//Executive Calendar//EN",
  ];
  for (const item of items)
    lines.push(
      "BEGIN:VEVENT",
      `UID:${item.id}@ceo-os`,
      `DTSTAMP:${stamp(new Date().toISOString())}`,
      `DTSTART:${stamp(item.data.start)}`,
      `DTEND:${stamp(item.data.end)}`,
      `SUMMARY:${esc(item.data.title)}`,
      `DESCRIPTION:${esc(item.data.agenda || "")}`,
      `LOCATION:${esc(item.data.location || "")}`,
      "END:VEVENT",
    );
  lines.push("END:VCALENDAR");
  return (
    lines
      .map((line) => {
        const chunks: string[] = [];
        let current = "",
          size = 0;
        for (const char of line) {
          const bytes = new TextEncoder().encode(char).length;
          if (size + bytes > 73) {
            chunks.push(current);
            current = char;
            size = bytes;
          } else {
            current += char;
            size += bytes;
          }
        }
        chunks.push(current);
        return chunks.join("\r\n ");
      })
      .join("\r\n") + "\r\n"
  );
}
