"use client";
import { useEffect, useState } from "react";
import {
  Sparkles,
  ShieldCheck,
  Copy,
  Download,
  ExternalLink,
  Send,
  Check,
  ChevronRight,
  ChevronLeft,
  Users,
  Clock,
  FileText,
  Plus,
  MessageSquare,
  RefreshCw,
} from "lucide-react";
import {
  intakeQuestions,
  intakeDefaults,
  answerSheet,
  normalizedAnswers,
} from "../lib/chief";
import { type Item } from "../lib/model";
import ChiefToday from "./chief-today";
async function api(body?: any) {
  const r = await fetch("/api/chief", {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data: any = await r.json();
  if (!r.ok) throw new Error(data.error || "Chief desk unavailable");
  return data;
}
function download(name: string, text: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/markdown" }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export default function ChiefDesk({ onRefresh }: { onRefresh: () => void }) {
  const [state, setState] = useState<any>(null),
    [tab, setTab] = useState("Today"),
    [round, setRound] = useState(0),
    [answers, setAnswers] = useState<string[]>(Array(16).fill("")),
    [review, setReview] = useState(false),
    [question, setQuestion] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [draft, setDraft] = useState<any>(null),
    [draftBody, setDraftBody] = useState(""),
    [draftTitle, setDraftTitle] = useState(""),
    [recipient, setRecipient] = useState(""),
    [channel, setChannel] = useState("Email");
  async function load() {
    try {
      const d = await api();
      setState(d);
      setAnswers(d.chief.data.answers);
      if (!d.chief.data.reviewed) setTab("Setup");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function act(body: any, message = "Saved") {
    setBusy(true);
    setError("");
    try {
      const d = await api(body);
      await load();
      onRefresh();
      setNotice(message);
      return d;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Copied. Paste into your Chief conversation in ChatGPT.");
    } catch {
      setError("Clipboard unavailable. Use Download and copy from the file.");
    }
  }
  if (!state)
    return (
      <section className="panel settings-panel">
        <RefreshCw size={20} />
        <p>{error || "Opening the Chief desk…"}</p>
        <button className="btn" onClick={() => void load()}>
          Retry
        </button>
      </section>
    );
  const chief = state.chief,
    ready = chief.data.reviewed,
    latest = state.briefs.sort((a: Item, b: Item) =>
      b.updatedAt.localeCompare(a.updatedAt),
    )[0],
    pending = state.drafts.filter((d: Item) => d.data.status === "Draft"),
    sheet = answerSheet(normalizedAnswers(answers));
  const tabs = [
    "Today",
    "Inbox",
    "Setup",
    "Drafts",
    "Roster",
    "Routines",
    "ChatGPT",
  ];
  async function bundle() {
    const r = await fetch("/api/workspace");
    const data: any = await r.json();
    const real = data.items.filter(
      (i: Item) => !i.data.demo && i.kind !== "chief" && i.kind !== "settings",
    );
    return `# ${chief.data.answers[1]} · ChatGPT Chief of Staff\n\n${state.blocks.map((b: any) => `## ${b.title}\n${b.content}`).join("\n\n")}\n\n## Saved workspace snapshot\nCaptured ${new Date().toISOString()}. This is a snapshot, not a live account connection.\n\n${JSON.stringify(real, null, 2)}`;
  }
  function openDraft(item?: Item) {
    setDraft(item || { id: "" });
    setDraftBody(item?.data.body || "");
    setDraftTitle(item?.data.title || "");
    setRecipient(item?.data.recipient || "UNKNOWN");
    setChannel(item?.data.channel || "Email");
    setTab("Drafts");
  }
  return (
    <div className="chief-desk">
      <section className="chief-banner">
        <div>
          <span className="section-kicker">ONE CHIEF. ONE INBOX.</span>
          <h2>{ready ? chief.data.answers[1] : "Hire your Chief of Staff."}</h2>
          <p>
            {ready
              ? "Ready. Talk to me. I will run the whole desk."
              : "A short intake, a useful brief, and one unsent draft. Start there."}
          </p>
        </div>
        <span className="chief-seal">
          <ShieldCheck size={20} />
          Drafts only
        </span>
      </section>
      <div className="toolbar">
        <div className="tabs chief-tabs">
          {tabs.map((t) => (
            <button
              key={t}
              className={tab === t ? "selected" : ""}
              onClick={() => {
                setTab(t);
                setReview(false);
              }}
            >
              {t}
              {t === "Drafts" && pending.length > 0
                ? ` · ${pending.length}`
                : ""}
            </button>
          ))}
        </div>
        <span className="helper">
          {ready ? "Reviewed context" : "Intake awaiting review"}
        </span>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="chief-notice" role="status">
          {notice}
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            Dismiss
          </button>
        </p>
      )}
      {tab === "Today" && <ChiefToday state={state} busy={busy} act={act} />}
      {tab === "Setup" && (
        <section className="panel chief-setup">
          <div className="section-title">
            <div>
              <span className="section-kicker">
                YOUR CONTEXT IS THE SOURCE OF TRUTH
              </span>
              <h2>
                {review
                  ? "Review MY ANSWERS"
                  : ready
                    ? "Your reviewed answer sheet"
                    : `Round ${round + 1} of 4`}
              </h2>
            </div>
            <span className="helper">
              {review || ready
                ? "16 answers"
                : `${round * 4 + 1}–${round * 4 + 4} of 16`}
            </span>
          </div>
          {ready && !review ? (
            <div className="detail-body">
              <pre className="document">{answerSheet(answers)}</pre>
              <p className="helper">
                UNKNOWN and NONE remain literal. Editing the sheet resets brief,
                routine, and specialist approvals.
              </p>
              <button
                className="btn"
                onClick={() => {
                  setReview(false);
                  setRound(0);
                  setState({
                    ...state,
                    chief: {
                      ...chief,
                      data: { ...chief.data, reviewed: false },
                    },
                  });
                }}
              >
                Edit answer sheet
              </button>
            </div>
          ) : review ? (
            <div className="detail-body">
              <pre className="document">{sheet}</pre>
              <div className="chief-defaults">
                <h3>Defaults used for blank answers</h3>
                {Object.entries(intakeDefaults)
                  .filter(([i]) => !answers[Number(i)]?.trim())
                  .map(([i, v]) => (
                    <p key={i}>
                      {Number(i) + 1}. {v}
                    </p>
                  ))}
                <p>
                  All other blanks become UNKNOWN. No pricing, priorities,
                  people, tools, or quiet hours have been guessed.
                </p>
              </div>
              <div className="form-actions">
                <button
                  className="btn"
                  onClick={() => {
                    setReview(false);
                    setRound(0);
                  }}
                >
                  Review my answers
                </button>
                <button
                  className="btn gold"
                  disabled={busy}
                  onClick={async () => {
                    const d = await act(
                      { action: "review", answers, version: chief.version },
                      "Answer sheet approved. Chief is ready.",
                    );
                    if (d) {
                      setReview(false);
                      setTab("Inbox");
                    }
                  }}
                >
                  <Check size={16} />
                  Approve answer sheet
                </button>
              </div>
            </div>
          ) : (
            <form
              className="detail-body"
              onSubmit={async (e) => {
                e.preventDefault();
                const d = await act(
                  { action: "intake", answers, version: chief.version },
                  "Intake saved",
                );
                if (d) {
                  if (round < 3) setRound(round + 1);
                  else setReview(true);
                }
              }}
            >
              <p className="helper">
                Use your exact words. UNKNOWN and NONE are valid answers.
                Defaults are applied only when you approve the full sheet.
              </p>
              <div className="form-grid chief-question-grid">
                {intakeQuestions.slice(round * 4, round * 4 + 4).map((q, i) => {
                  const index = round * 4 + i;
                  return (
                    <label key={index}>
                      <span>
                        {String(index + 1).padStart(2, "0")} · {q}
                      </span>
                      <textarea
                        value={answers[index]}
                        maxLength={4000}
                        rows={index === 5 ? 4 : 2}
                        onChange={(e) =>
                          setAnswers((a) =>
                            a.map((v, j) => (j === index ? e.target.value : v)),
                          )
                        }
                        placeholder={
                          index === 3
                            ? "e.g. 11:00 PM to 6:30 AM, or UNKNOWN"
                            : index === 5
                              ? "One priority per line. Exactly three, or UNKNOWN."
                              : intakeDefaults[index]
                                ? `Blank uses: ${intakeDefaults[index]}`
                                : "Your words, UNKNOWN, or NONE"
                        }
                      />
                    </label>
                  );
                })}
              </div>
              <div className="form-actions">
                {round > 0 && (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setRound(round - 1)}
                  >
                    <ChevronLeft size={16} />
                    Previous round
                  </button>
                )}
                <button className="btn gold" disabled={busy} type="submit">
                  {busy
                    ? "Saving…"
                    : round === 3
                      ? "Review answer sheet"
                      : "Save & next round"}
                  <ChevronRight size={16} />
                </button>
              </div>
            </form>
          )}
        </section>
      )}
      {tab === "Inbox" && (
        <div className="chief-inbox-layout">
          <section className="panel chief-conversation">
            <div className="section-title">
              <div>
                <span className="section-kicker">TALK ONLY TO CHIEF</span>
                <h2>Chief inbox</h2>
              </div>
              <MessageSquare size={20} />
            </div>
            {!ready ? (
              <div className="empty">
                <p>Approve your answer sheet before Chief starts working.</p>
                <button className="btn gold" onClick={() => setTab("Setup")}>
                  Complete intake
                </button>
              </div>
            ) : (
              <>
                <div className="chief-suggestions">
                  {[
                    "What needs my decision today?",
                    "Prepare my next meeting.",
                    "Draft a follow-up for an overdue commitment.",
                  ].map((q) => (
                    <button
                      className="btn small"
                      key={q}
                      onClick={() => setQuestion(q)}
                    >
                      {q}
                    </button>
                  ))}
                </div>
                <div className="chief-history">
                  {state.requests.length ? (
                    state.requests
                      .sort((a: Item, b: Item) =>
                        a.updatedAt.localeCompare(b.updatedAt),
                      )
                      .map((r: Item) => (
                        <article className="chief-thread" key={r.id}>
                          <div className="chief-user-request">
                            <small>You</small>
                            <p>{r.data.question}</p>
                          </div>
                          <div className="chief-answer">
                            <div className="detail-meta">
                              <span className="pill gold-tone">
                                {r.data.lane}
                              </span>
                              <span>{r.data.source}</span>
                              {!chief.data.specialistApproval &&
                                r.data.lane !== "Chief" && (
                                  <span className="helper">
                                    Proposed lane · no bot hired
                                  </span>
                                )}
                            </div>
                            <pre>{r.data.answer}</pre>
                            <div className="button-group">
                              <button
                                className="btn small"
                                onClick={() => void copy(r.data.answer)}
                              >
                                <Copy size={14} />
                                Copy
                              </button>
                              <button
                                className="btn small"
                                onClick={() => {
                                  openDraft();
                                  setDraftTitle(r.data.title);
                                  setDraftBody(r.data.answer);
                                }}
                              >
                                Save as draft
                              </button>
                            </div>
                          </div>
                        </article>
                      ))
                  ) : (
                    <div className="empty">
                      <Sparkles size={25} />
                      <p>
                        Chief holds your priorities, owners, and next decisions.
                      </p>
                      <p className="helper">
                        Use the private ChatGPT plugin for live context, or
                        export the setup package. In-app synthesis uses GPT only
                        when its API connection is configured.
                      </p>
                    </div>
                  )}
                </div>
                <form
                  className="chat-form chief-ask"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const d = await act(
                      { action: "ask", question },
                      "Request saved in Chief inbox",
                    );
                    if (d) setQuestion("");
                  }}
                >
                  <input
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    maxLength={4000}
                    placeholder="Chief, here’s what I need…"
                    aria-label="Request for Chief"
                  />
                  <button
                    className="btn gold"
                    type="submit"
                    disabled={busy || !question.trim()}
                  >
                    <Send size={16} />
                    {busy ? "Working…" : "Ask Chief"}
                  </button>
                </form>
              </>
            )}
          </section>
          <aside className="panel chief-brief-panel">
            <div className="section-title">
              <div>
                <span className="section-kicker">
                  NEED YOU / SHIP-READY / TEAM / IGNORE / NEXT
                </span>
                <h2>The 12-line brief</h2>
              </div>
            </div>
            {latest ? (
              <div className="detail-body">
                <span className="pill">{latest.data.engine}</span>
                <pre className="document">{latest.data.content}</pre>
                <div className="button-group">
                  <button
                    className="btn small"
                    onClick={() => void copy(latest.data.content)}
                  >
                    <Copy size={14} />
                    Copy brief
                  </button>
                  {!chief.data.firstBriefApproved && (
                    <button
                      className="btn small gold"
                      disabled={busy}
                      onClick={() =>
                        void act(
                          { action: "proof", version: chief.version },
                          "Manual proof brief approved",
                        )
                      }
                    >
                      This brief is useful
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="detail-body">
                <p className="helper">
                  First prove the workflow by hand. Chief uses confirmed context
                  and shows exactly which sources were available.
                </p>
              </div>
            )}
            <div className="chief-brief-footer">
              <button
                className="btn gold"
                disabled={!ready || busy}
                onClick={() =>
                  void act({ action: "brief" }, "Chief brief saved")
                }
              >
                <Sparkles size={16} />
                Generate proof brief
              </button>
              <small>Sample records are excluded. Nothing is sent.</small>
            </div>
          </aside>
        </div>
      )}
      {tab === "Drafts" && (
        <>
          <div className="toolbar">
            <div>
              <h2>Ready for your decision</h2>
              <p className="helper">
                Approving records your decision. It does not send or publish.
              </p>
            </div>
            <button
              className="btn gold"
              disabled={!ready}
              onClick={() => openDraft()}
            >
              <Plus size={16} />
              Create unsent draft
            </button>
          </div>
          {draft && (
            <form
              className="panel chief-draft-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const d = await act(
                  {
                    action: "draft",
                    id: draft.id || undefined,
                    version: draft.version,
                    data: {
                      title: draftTitle,
                      body: draftBody,
                      recipient,
                      channel,
                    },
                  },
                  "Draft saved · unsent",
                );
                if (d) setDraft(null);
              }}
            >
              <h2>{draft.id ? "Edit draft" : "New draft"}</h2>
              <div className="form-grid">
                <label>
                  Title
                  <input
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    required
                    maxLength={240}
                  />
                </label>
                <label>
                  Channel
                  <select
                    value={channel}
                    onChange={(e) => setChannel(e.target.value)}
                  >
                    {["Email", "Slack", "Document", "Other"].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <label className="full-width">
                  Recipient or destination
                  <input
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    maxLength={240}
                    required
                  />
                </label>
                <label className="full-width">
                  Draft
                  <textarea
                    value={draftBody}
                    onChange={(e) => setDraftBody(e.target.value)}
                    maxLength={24000}
                    rows={9}
                    required
                  />
                </label>
              </div>
              <p className="helper">
                Editing an approved draft resets approval. No send endpoint
                exists.
              </p>
              <div className="form-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setDraft(null)}
                >
                  Cancel
                </button>
                <button className="btn gold" disabled={busy} type="submit">
                  Save draft
                </button>
              </div>
            </form>
          )}
          <div className="chief-draft-list">
            {state.drafts.map((d: Item) => (
              <article className="panel chief-draft-card" key={d.id}>
                <div className="card-top">
                  <span
                    className={
                      "pill " +
                      (d.data.status === "Approved"
                        ? "mint"
                        : d.data.status === "Rejected"
                          ? "rose"
                          : "gold-tone")
                    }
                  >
                    {d.data.status} · unsent
                  </span>
                  <span className="helper">
                    {d.data.channel} · {d.data.recipient}
                  </span>
                </div>
                <h2>{d.data.title}</h2>
                <pre className="document">{d.data.body}</pre>
                <div className="button-group">
                  <button className="btn" onClick={() => openDraft(d)}>
                    Edit
                  </button>
                  <button
                    className="btn"
                    onClick={() => void copy(d.data.body)}
                  >
                    <Copy size={15} />
                    Copy
                  </button>
                  {d.data.status === "Draft" && (
                    <>
                      <button
                        className="btn gold"
                        disabled={busy}
                        onClick={() =>
                          void act(
                            { action: "approve", id: d.id, version: d.version },
                            "Approved for manual use. Nothing was sent.",
                          )
                        }
                      >
                        <Check size={16} />
                        Approve this draft
                      </button>
                      <button
                        className="btn"
                        disabled={busy}
                        onClick={() =>
                          void act(
                            { action: "reject", id: d.id, version: d.version },
                            "Draft rejected",
                          )
                        }
                      >
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
          {!state.drafts.length && !draft && (
            <div className="empty">
              <FileText size={24} />
              <p>No drafts waiting. Prepare one for review.</p>
            </div>
          )}
        </>
      )}
      {tab === "Roster" && (
        <div className="chief-roster">
          <section className="panel settings-panel">
            <h2>Humans & ownership</h2>
            <pre className="document">
              {ready ? chief.data.answers[9] : "UNKNOWN"}
            </pre>
            <h3>Existing bots</h3>
            <pre className="document">
              {ready ? chief.data.answers[10] : "UNKNOWN"}
            </pre>
            <p className="helper">
              The desk does not infer your team from sample people or email
              senders.
            </p>
          </section>
          <section className="panel settings-panel">
            <h2>Proposed specialist lanes</h2>
            <pre className="document">
              {ready
                ? chief.data.answers[15]
                : "Scout and Quill are proposals only."}
            </pre>
            <div className="chief-lanes">
              <div>
                <strong>Scout</strong>
                <p>Research with sources. Never publish.</p>
              </div>
              <div>
                <strong>Quill</strong>
                <p>Draft in your voice. Never publish.</p>
              </div>
            </div>
            <p className="helper">
              Skills are reusable methods. Routines are schedules. Bots own
              ongoing queues. No independent specialist bots have been created.
            </p>
            <button
              className="btn"
              disabled={
                busy ||
                !chief.data.firstBriefApproved ||
                chief.data.specialistApproval
              }
              onClick={() =>
                void act(
                  { action: "specialists", version: chief.version },
                  "Specialist lanes approved; no bots created",
                )
              }
            >
              {chief.data.specialistApproval
                ? "Lanes approved"
                : "Approve proposed lanes"}
            </button>
            {!chief.data.firstBriefApproved && (
              <p className="helper">First approve a useful manual brief.</p>
            )}
          </section>
        </div>
      )}
      {tab === "Routines" && (
        <section className="panel settings-panel">
          <h2>Earn the morning routine.</h2>
          <p>
            One routine after one useful manual brief. Midday and evening remain
            proposals.
          </p>
          <div className="detail-properties">
            <div>
              <span>Proposed times</span>
              <strong>{ready ? chief.data.answers[14] : "UNKNOWN"}</strong>
            </div>
            <div>
              <span>Quiet hours</span>
              <strong>{ready ? chief.data.answers[3] : "UNKNOWN"}</strong>
            </div>
            <div>
              <span>Routine readiness</span>
              <strong>
                {chief.data.morningApproved ? "Approved" : "Awaiting proof"}
              </strong>
            </div>
          </div>
          <p className="helper">
            The existing CEO briefing is scheduled at 7:00 a.m. Eastern. This
            layer does not change that schedule. Chief’s morning routine stays
            inactive until you approve a useful brief and its exact schedule.
            Quiet hours and a quiet desk suppress scheduled Chief output. No
            email or Slack delivery is enabled.
          </p>
          <button
            className="btn"
            disabled={
              !chief.data.firstBriefApproved ||
              chief.data.morningApproved ||
              busy
            }
            onClick={() =>
              void act(
                { action: "morning", version: chief.version },
                "Morning readiness approved. Exact schedule still needs activation.",
              )
            }
          >
            {chief.data.morningApproved
              ? "Morning readiness approved"
              : "Approve morning readiness"}
          </button>
          <p className="helper">
            Readiness is saved separately from an active schedule. No extra
            routines are created here.
          </p>
        </section>
      )}
      {tab === "ChatGPT" && (
        <div className="chief-chatgpt">
          <section className="panel settings-panel">
            <span className="section-kicker">YOUR CHIEF IN CHATGPT</span>
            <h2>Connect the private Chief plugin.</h2>
            <p>
              After installing the Site’s private plugin, ask ChatGPT to read
              Chief context. ChatGPT can save its answers, manage tasks and
              OpenLoops, prepare meetings, and save unsent drafts into this
              desk. Review and approval stay here.
            </p>
            <p className="helper">
              Connection is a separate install/connect step. The prototype has
              not created a ChatGPT Project, a custom GPT, or specialist bots on
              your account.
            </p>
            <a
              className="btn"
              href="https://chatgpt.com"
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={16} />
              Open ChatGPT
            </a>
          </section>
          <section className="panel settings-panel">
            <h2>Or use a reviewed setup package.</h2>
            <p>
              Create a private ChatGPT Project for Chief. Use Block A as its
              instructions, add your workspace snapshot, and send Block B as the
              first assignment. Copy Block C only when you approve a real
              specialist lane.
            </p>
            <div className="button-group">
              <button
                className="btn gold"
                disabled={!ready}
                onClick={async () => void copy(await bundle())}
              >
                <Copy size={16} />
                Copy ChatGPT package
              </button>
              <button
                className="btn"
                disabled={!ready}
                onClick={async () =>
                  download("Chief-ChatGPT-Setup.md", await bundle())
                }
              >
                <Download size={16} />
                Download package
              </button>
            </div>
            {!ready && (
              <p className="helper">
                Approve your answer sheet to unlock these blocks.
              </p>
            )}
          </section>
          {state.blocks.map((b: any) => (
            <details className="panel chief-block" key={b.title}>
              <summary>{b.title}</summary>
              <div className="detail-body">
                <pre className="document">{b.content}</pre>
                <button
                  className="btn small"
                  onClick={() => void copy(b.content)}
                >
                  <Copy size={14} />
                  Copy block
                </button>
              </div>
            </details>
          ))}
        </div>
      )}
      <p className="chief-attribution">
        Adapted from Visser Labs’ Chief of Staff Starter Pack for ChatGPT. One
        inbox · drafts only · no invented context.
      </p>
    </div>
  );
}
