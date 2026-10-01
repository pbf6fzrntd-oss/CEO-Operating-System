"use client";
import { useState } from "react";
import { Check, Plus, Download, FileText, Clock } from "lucide-react";
import { type Item } from "../lib/model";
type Props = {
  state: any;
  busy: boolean;
  act: (body: any, message?: string) => Promise<any>;
};
function exportPrep(item: Item) {
  const url = URL.createObjectURL(
    new Blob([item.data.prep], { type: "text/markdown" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `Meeting-Prep-${item.id.replace(/[^a-z0-9-]/gi, "-")}.md`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function ChiefToday({ state, busy, act }: Props) {
  const [adding, setAdding] = useState<"task" | "loop" | null>(null);
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState("");
  const [due, setDue] = useState(state.work.day);
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState("High");
  const [opened, setOpened] = useState<string | null>(null);
  const items: Item[] = state.work.records;
  const tasks = items
    .filter(
      (i) => i.kind === "task" && !i.data.done && i.data.due <= state.work.day,
    )
    .sort(
      (a, b) =>
        Number(b.data.priority === "High") -
          Number(a.data.priority === "High") ||
        a.data.due.localeCompare(b.data.due),
    );
  const loops = items
    .filter((i) => i.kind === "loop" && i.data.status === "Waiting")
    .sort((a, b) => a.data.due.localeCompare(b.data.due));
  const meetings = items
    .filter((i) => i.kind === "meeting")
    .sort((a, b) => a.data.start.localeCompare(b.data.start));
  function start(kind: "task" | "loop") {
    setAdding(kind);
    setTitle("");
    setOwner("");
    setDue(state.work.day);
    setNotes("");
  }
  if (!state.chief.data.reviewed)
    return (
      <section className="panel settings-panel">
        <h2>Review your context first.</h2>
        <p>Complete Setup before Chief starts organizing confirmed work.</p>
      </section>
    );
  return (
    <div className="chief-today">
      <div className="chief-day-strip">
        <div>
          <span className="section-kicker">YOUR WORKING DAY</span>
          <h2>
            {new Date(state.work.day + "T12:00:00Z").toLocaleDateString(
              "en-US",
              {
                timeZone: "UTC",
                weekday: "long",
                month: "long",
                day: "numeric",
              },
            )}
          </h2>
          <p className="helper">
            {state.work.timezone} · Confirmed records only
          </p>
        </div>
        <div className="button-group">
          <button
            className="btn gold"
            disabled={busy}
            onClick={() => start("task")}
          >
            <Plus size={16} />
            Add task
          </button>
          <button className="btn" disabled={busy} onClick={() => start("loop")}>
            <Plus size={16} />
            Track an OpenLoop
          </button>
        </div>
      </div>
      {adding && (
        <section className="panel settings-panel">
          <h2>
            {adding === "task"
              ? "A task for you"
              : "Something someone owes you"}
          </h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const data = {
                title,
                due,
                notes,
                ...(adding === "task" ? { priority } : { owner }),
              };
              const result = await act(
                { action: "record", kind: adding, data },
                adding === "task"
                  ? "Task saved to your daily list."
                  : "OpenLoop saved. No follow-up sent.",
              );
              if (result) setAdding(null);
            }}
          >
            <div className="form-grid">
              <label>
                What needs to happen?
                <input
                  required
                  maxLength={240}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label>
                Due date
                <input
                  required
                  type="date"
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                />
              </label>
              {adding === "loop" ? (
                <label>
                  Who owes you this?
                  <input
                    required
                    maxLength={120}
                    value={owner}
                    onChange={(e) => setOwner(e.target.value)}
                    placeholder="Confirmed owner"
                  />
                </label>
              ) : (
                <label>
                  Priority
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                  >
                    <option>High</option>
                    <option>Medium</option>
                    <option>Low</option>
                  </select>
                </label>
              )}
              <label>
                Context
                <textarea
                  value={notes}
                  maxLength={16000}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </label>
            </div>
            <div className="form-actions">
              <button
                className="btn"
                type="button"
                onClick={() => setAdding(null)}
              >
                Cancel
              </button>
              <button className="btn gold" disabled={busy}>
                Save {adding === "task" ? "task" : "OpenLoop"}
              </button>
            </div>
          </form>
        </section>
      )}
      <div className="chief-today-grid">
        <section className="panel">
          <div className="section-title">
            <h2>Today’s to-do list</h2>
            <span className="helper">{tasks.length} due</span>
          </div>
          <div className="chief-work-list">
            {tasks.length ? (
              tasks.map((i) => (
                <article className="chief-work-row" key={i.id}>
                  <button
                    className="chief-complete"
                    disabled={busy}
                    aria-label={`Complete ${i.data.title}`}
                    onClick={() =>
                      void act(
                        {
                          action: "record",
                          kind: "task",
                          id: i.id,
                          version: i.version,
                          data: { done: true },
                        },
                        "Task completed.",
                      )
                    }
                  >
                    <Check size={16} />
                  </button>
                  <div>
                    <h3>{i.data.title}</h3>
                    <p className="helper">
                      {i.data.priority} priority · Due {i.data.due}
                      {i.data.due < state.work.day ? " · Overdue" : ""}
                    </p>
                    {i.data.notes && <p>{i.data.notes}</p>}
                  </div>
                </article>
              ))
            ) : (
              <div className="empty">
                <p>
                  No confirmed tasks due today. Add your next meaningful
                  outcome.
                </p>
              </div>
            )}
          </div>
        </section>
        <section className="panel">
          <div className="section-title">
            <h2>People owe you</h2>
            <span className="helper">{loops.length} waiting</span>
          </div>
          <div className="chief-work-list">
            {loops.length ? (
              loops.map((i) => (
                <article className="chief-work-row" key={i.id}>
                  <Clock size={18} />
                  <div>
                    <h3>{i.data.title}</h3>
                    <p>
                      {i.data.owner} · Due {i.data.due}
                      {i.data.due < state.work.day ? " · Overdue" : ""}
                    </p>
                    {i.data.notes && <p className="helper">{i.data.notes}</p>}
                    <button
                      className="btn small"
                      disabled={busy}
                      onClick={() =>
                        void act(
                          {
                            action: "record",
                            kind: "loop",
                            id: i.id,
                            version: i.version,
                            data: { status: "Received" },
                          },
                          "OpenLoop marked received.",
                        )
                      }
                    >
                      Mark received
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="empty">
                <p>
                  No confirmed commitments waiting. Track the owner and due date
                  when you delegate.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
      <section className="panel">
        <div className="section-title">
          <div>
            <span className="section-kicker">NEXT FIVE DAYS</span>
            <h2>Walk into every meeting prepared.</h2>
          </div>
          <span className="helper">{meetings.length} saved meetings</span>
        </div>
        <div className="chief-work-list">
          {meetings.length ? (
            meetings.map((i) => (
              <article className="chief-meeting-card" key={i.id}>
                <div className="chief-meeting-heading">
                  <div>
                    <h3>{i.data.title}</h3>
                    <p>
                      {new Date(i.data.start).toLocaleString("en-US", {
                        timeZone: state.work.timezone,
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}{" "}
                      · {i.data.attendees || "Attendees UNKNOWN"}
                    </p>
                  </div>
                  <div className="button-group">
                    <button
                      className="btn small"
                      disabled={busy}
                      onClick={async () => {
                        const r = await act(
                          { action: "prep", id: i.id, version: i.version },
                          "Meeting prep saved. No calendar changes made.",
                        );
                        if (r) setOpened(i.id);
                      }}
                    >
                      <FileText size={15} />
                      {i.data.prep ? "Refresh prep" : "Prepare meeting"}
                    </button>
                    {i.data.prep && (
                      <>
                        <button
                          className="btn small"
                          onClick={() =>
                            setOpened(opened === i.id ? null : i.id)
                          }
                        >
                          {opened === i.id ? "Hide prep" : "Read prep"}
                        </button>
                        <button
                          className="btn small"
                          onClick={() => exportPrep(i)}
                        >
                          <Download size={15} />
                          Download
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {opened === i.id && i.data.prep && (
                  <pre className="document">{i.data.prep}</pre>
                )}
              </article>
            ))
          ) : (
            <div className="empty">
              <p>
                No confirmed meetings in the next five days. Import your
                calendar or add a meeting in Calendar.
              </p>
            </div>
          )}
        </div>
      </section>
      <section className="panel chief-source-panel">
        <div className="section-title">
          <h2>What Chief can actually read</h2>
          <span className="helper">
            Credentials and sync are separate steps
          </span>
        </div>
        <div className="chief-source-grid">
          {state.connections
            .filter((c: any) =>
              ["gmail", "google", "slack", "openai"].includes(c.id),
            )
            .map((c: any) => (
              <div key={c.id}>
                <h3>{c.name}</h3>
                <p>
                  {c.configured
                    ? "Credentials configured"
                    : "Awaiting credentials"}
                </p>
                <p className="helper">
                  {c.lastSync
                    ? `Last successful sync: ${new Date(c.lastSync).toLocaleString("en-US", { timeZone: state.work.timezone })}`
                    : ["gmail", "google", "slack"].includes(c.id)
                      ? "No successful sync recorded"
                      : "Optional in-app generation"}
                </p>
                {c.result && <p className="helper">{c.result}</p>}
                <p className="helper">{c.description}</p>
              </div>
            ))}
        </div>
        <p className="helper">
          ChatGPT access requires the private plugin connection. Sample records
          are excluded from this desk.
        </p>
      </section>
    </div>
  );
}
