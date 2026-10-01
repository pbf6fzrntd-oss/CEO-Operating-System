"use client";
import {
  useState,
  useEffect,
  useRef,
  type ReactNode,
  type FormEvent,
} from "react";
import {
  Sun,
  Check,
  Plus,
  Search,
  CalendarDays,
  CircleCheck,
  Layers,
  FileText,
  Users,
  Scale,
  Plug,
  Settings,
  ChevronRight,
  ChevronLeft,
  ArrowUpRight,
  Clock,
  MoreHorizontal,
  X,
  Sparkles,
  RefreshCw,
  Download,
  Upload,
  Copy,
  Trash2,
  Menu,
  Focus,
  Send,
  ExternalLink,
  Command,
  Flag,
  MessageSquare,
  CheckCheck,
  Circle,
  Link2,
  ShieldCheck,
  Compass,
} from "lucide-react";
import {
  type Item,
  type Kind,
  today,
  dayOffset,
  localDateTime,
} from "../lib/model";
const views = [
  { id: "today", label: "Today", icon: Sun },
  { id: "tasks", label: "Priorities", icon: CircleCheck },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "loops", label: "OpenLoops", icon: Layers },
  { id: "briefings", label: "Daily briefings", icon: FileText },
  { id: "meetings", label: "Meeting room", icon: Users },
  { id: "decisions", label: "Decisions", icon: Scale },
  { id: "integrations", label: "Integrations", icon: Plug },
];
const priorityRank: any = { High: 0, Medium: 1, Low: 2 };
async function api(path: string, method = "GET", body?: unknown) {
  const r = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const d: any = await r.json();
  if (!r.ok) throw new Error(d.error || "Unable to complete the request.");
  return d;
}
function Dialog({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={"modal " + (wide ? "wide" : "")}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-header">
        <h2>{title}</h2>
        <button
          className="icon-btn"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Empty({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <Compass size={28} />
      <p>{children}</p>
      {action}
    </div>
  );
}
function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={"pill " + tone}>{children}</span>;
}
function download(name: string, text: string, type = "text/plain") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export default function Workspace() {
  const [items, setItems] = useState<Item[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [view, setView] = useState("today"),
    [query, setQuery] = useState(""),
    [command, setCommand] = useState(false),
    [mobile, setMobile] = useState(false),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false),
    [edit, setEdit] = useState<{ kind: Kind; item?: Item } | null>(null),
    [detail, setDetail] = useState<Item | null>(null),
    [follow, setFollow] = useState<Item | null>(null),
    [agent, setAgent] = useState(false),
    [bridge, setBridge] = useState<string | null>(null),
    [connections, setConnections] = useState<any[]>([]),
    [setup, setSetup] = useState<any>(null),
    [tab, setTab] = useState("Active"),
    [calendarMode, setCalendarMode] = useState("Agenda"),
    [selectedDay, setSelectedDay] = useState(today()),
    [focus, setFocus] = useState(false),
    [remaining, setRemaining] = useState(25 * 60),
    [chat, setChat] = useState<{ role: string; text: string }[]>([]),
    [question, setQuestion] = useState("");
  const profile = items.find((i) => i.kind === "settings"),
    p = profile?.data || {
      name: "Joshua",
      timezone: "America/New_York",
      role: "Chief Executive Officer",
      northStar:
        "Build enduring companies. Protect time for the work only I can do.",
    },
    day = today(p.timezone);
  const tasks = items
    .filter((i) => i.kind === "task")
    .sort(
      (a, b) =>
        Number(a.data.done) - Number(b.data.done) ||
        priorityRank[a.data.priority] - priorityRank[b.data.priority] ||
        a.data.due.localeCompare(b.data.due),
    );
  const loops = items
      .filter((i) => i.kind === "loop")
      .sort((a, b) => a.data.due.localeCompare(b.data.due)),
    waiting = loops.filter((i) => i.data.status === "Waiting"),
    overdue = waiting.filter((i) => i.data.due < day);
  const meetings = items
      .filter((i) => i.kind === "meeting")
      .sort((a, b) => a.data.start.localeCompare(b.data.start)),
    dateOf = (s: string) =>
      new Intl.DateTimeFormat("en-CA", { timeZone: p.timezone }).format(
        new Date(s),
      ),
    todaysMeetings = meetings.filter((m) => dateOf(m.data.start) === day),
    dueTasks = tasks.filter((i) => i.data.due <= day),
    completed = dueTasks.filter((i) => i.data.done).length;
  const briefings = items
      .filter((i) => i.kind === "briefing")
      .sort((a, b) => b.data.date.localeCompare(a.data.date)),
    decisions = items.filter((i) => i.kind === "decision"),
    messages = items
      .filter((i) => i.kind === "message")
      .sort((a, b) => Number(b.data.ts) - Number(a.data.ts));
  const notify = (message: string) => {
      setToast(message);
      setTimeout(() => setToast(""), 4500);
    },
    put = (item: Item) =>
      setItems((prev) => [...prev.filter((i) => i.id !== item.id), item]);
  async function load() {
    try {
      setError("");
      setLoading(true);
      const d = await api("/api/workspace");
      setItems(d.items);
      const c = await api("/api/integrations");
      setConnections(c.integrations);
      const localDay = today(
        d.items.find((i: Item) => i.kind === "settings")?.data.timezone,
      );
      if (
        !d.items.some(
          (i: Item) => i.kind === "briefing" && i.data.date === localDay,
        )
      ) {
        try {
          const b = await api("/api/intelligence", "POST", {
            action: "briefing",
          });
          put(b.item);
        } catch {
          notify("Daily briefing could not refresh. You can retry from Today.");
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommand((s) => !s);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  useEffect(() => {
    if (!focus || remaining <= 0) return;
    const timer = setInterval(() => setRemaining((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [focus, remaining]);
  useEffect(() => {
    if (remaining === 0) {
      setFocus(false);
      notify("Focus session complete. Take a short break.");
    }
  }, [remaining]);
  function navigate(id: string) {
    setView(id);
    setMobile(false);
    setTab("Active");
    setQuery("");
  }
  async function change(item: Item, data: any) {
    try {
      const r = await api("/api/workspace", "PATCH", {
        id: item.id,
        version: item.version,
        data: { ...item.data, ...data },
      });
      put(r.item);
      if (detail?.id === item.id) setDetail(r.item);
      notify("Saved");
    } catch (e) {
      notify((e as Error).message);
    }
  }
  async function erase(item: Item) {
    setBusy(true);
    try {
      await api("/api/workspace", "DELETE", {
        id: item.id,
        version: item.version,
      });
      setItems((s) => s.filter((i) => i.id !== item.id));
      setDetail(null);
      setEdit(null);
      notify("Item deleted");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function intelligence(action: string, id?: string) {
    setBusy(true);
    try {
      const r = await api("/api/intelligence", "POST", { action, id });
      if (r.item) {
        put(r.item);
        setDetail(r.item);
      }
      notify(
        action === "prep" ? "Meeting brief saved" : "Daily briefing saved",
      );
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function sync(provider: string) {
    setBusy(true);
    try {
      const r = await api("/api/integrations", "POST", { provider });
      await load();
      notify(r.message);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const formatDate = (s: string) =>
      new Date(s + "T12:00:00Z").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }),
    time = (s: string) =>
      new Date(s).toLocaleTimeString("en-US", {
        timeZone: p.timezone,
        hour: "numeric",
        minute: "2-digit",
      });
  const dayLabel = new Date(day + "T12:00:00Z").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  const filter = (list: Item[]) =>
    list.filter((i) =>
      JSON.stringify(i.data).toLowerCase().includes(query.toLowerCase()),
    );
  const addButton = (kind: Kind, label: string) => (
    <button className="btn gold" onClick={() => setEdit({ kind })}>
      <Plus size={17} />
      {label}
    </button>
  );
  function TaskRow({ item }: { item: Item }) {
    const d = item.data;
    return (
      <div className={"task-row " + (d.done ? "done" : "")}>
        <button
          className={"checkbox " + (d.done ? "checked" : "")}
          aria-label={(d.done ? "Reopen " : "Complete ") + d.title}
          onClick={() => void change(item, { done: !d.done })}
        >
          {d.done && <Check size={14} />}
        </button>
        <button className="row-main" onClick={() => setDetail(item)}>
          <span>{d.title}</span>
          <small>
            {d.category} <b>·</b>{" "}
            {d.due < day && !d.done ? (
              <em>Overdue · {formatDate(d.due)}</em>
            ) : d.due === day ? (
              "Today"
            ) : (
              formatDate(d.due)
            )}
          </small>
        </button>
        <Pill tone={d.priority === "High" ? "gold-tone" : "neutral"}>
          {d.priority}
        </Pill>
        <button
          className="icon-btn"
          aria-label={"Edit " + d.title}
          onClick={() => setEdit({ kind: "task", item })}
        >
          <MoreHorizontal size={18} />
        </button>
      </div>
    );
  }
  function LoopRow({
    item,
    compact = false,
  }: {
    item: Item;
    compact?: boolean;
  }) {
    const d = item.data,
      isOver = d.due < day && d.status === "Waiting";
    return (
      <div className={"loop-row " + (compact ? "compact" : "")}>
        <span className="avatar">
          {d.owner
            .split(" ")
            .map((w: string) => w[0])
            .slice(0, 2)
            .join("")}
        </span>
        <button className="row-main" onClick={() => setDetail(item)}>
          <span>{d.title}</span>
          <small>
            {d.owner} <b>·</b> {d.channel}
          </small>
        </button>
        <span className={"due " + (isOver ? "late" : "")}>
          {d.status === "Received"
            ? "Received"
            : isOver
              ? "Overdue"
              : d.due === day
                ? "Due today"
                : formatDate(d.due)}
        </span>
        <button
          className="btn small"
          onClick={() =>
            d.status === "Received"
              ? void change(item, { status: "Waiting" })
              : setFollow(item)
          }
        >
          {d.status === "Received" ? "Reopen" : "Follow up"}
        </button>
      </div>
    );
  }
  function MeetingRow({ item }: { item: Item }) {
    const d = item.data;
    return (
      <button className="meeting-row" onClick={() => setDetail(item)}>
        <span className="meeting-time">
          {time(d.start)}
          <small>
            {Math.round((Date.parse(d.end) - Date.parse(d.start)) / 60000)} min
          </small>
        </span>
        <span className="meeting-line" />
        <span className="row-main">
          <span>{d.title}</span>
          <small>{d.location || d.attendees || "No location set"}</small>
        </span>
        <Pill tone={d.prep ? "mint" : "neutral"}>
          {d.prep ? "Prepared" : "Prep"}
        </Pill>
      </button>
    );
  }
  const heading: any = {
    today: "Your day, with intention.",
    tasks: "Make the important happen.",
    calendar: "Own your time.",
    loops: "Nothing falls through.",
    briefings: "Clarity before the noise.",
    meetings: "Arrive prepared.",
    decisions: "Make your thinking visible.",
    integrations: "Connect your operating system.",
    settings: "Make this workspace yours.",
  };
  return (
    <div className="app-shell">
      <aside className={"sidebar " + (mobile ? "open" : "")}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("today");
          }}
        >
          <img src="/favicon.svg" width="36" height="36" alt="" />
          <span>
            CEO<span className="brand-os">OPERATING SYSTEM</span>
          </span>
        </a>
        <div className="workspace-switch">
          <span className="workspace-mark">JL</span>
          <span>
            Executive workspace<small>Private workspace</small>
          </span>
          <ShieldCheck size={16} />
        </div>
        <span className="nav-label">WORKSPACE</span>
        <nav>
          {views.map((v) => (
            <button
              key={v.id}
              className={view === v.id ? "active" : ""}
              onClick={() => navigate(v.id)}
            >
              <v.icon size={19} />
              <span>{v.label}</span>
              {v.id === "loops" && waiting.length > 0 && (
                <b className="nav-count">{waiting.length}</b>
              )}
              {v.id === "today" && <span className="nav-short">01</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="assistant-card" onClick={() => setAgent(true)}>
            <span className="ai-symbol">
              <Sparkles size={18} />
            </span>
            <span>
              Your chief of staff<small>Think clearly. Move forward.</small>
            </span>
            <ChevronRight size={16} />
          </button>
          <button
            className={
              "profile-button " + (view === "settings" ? "active" : "")
            }
            onClick={() => navigate("settings")}
          >
            <span className="avatar gold-avatar">{p.name.slice(0, 1)}L</span>
            <span>
              {p.name}
              <small>{p.role}</small>
            </span>
            <Settings size={17} />
          </button>
        </div>
      </aside>
      {mobile && (
        <button
          aria-label="Close navigation"
          className="scrim"
          onClick={() => setMobile(false)}
        />
      )}
      <main className="main">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-btn mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={21} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>
              {views.find((v) => v.id === view)?.label || "Settings"}
            </strong>
          </div>
          <div className="top-actions">
            <button className="search-trigger" onClick={() => setCommand(true)}>
              <Search size={16} />
              <span>Search your workspace</span>
              <kbd>⌘ K</kbd>
            </button>
            <button
              className="icon-btn"
              aria-label="Refresh workspace"
              onClick={() => void load()}
            >
              <RefreshCw size={17} />
            </button>
            <button
              className="btn capture"
              onClick={() => setEdit({ kind: "task" })}
            >
              <Plus size={17} />
              <span>Quick capture</span>
            </button>
          </div>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {view === "today"
                  ? dayLabel
                  : views.find((v) => v.id === view)?.label || "Preferences"}
              </div>
              <h1>
                {view === "today" ? (
                  <>
                    Good{" "}
                    {Number(
                      new Intl.DateTimeFormat("en-US", {
                        timeZone: p.timezone,
                        hour: "numeric",
                        hourCycle: "h23",
                      }).format(new Date()),
                    ) < 12
                      ? "morning"
                      : "afternoon"}
                    , {p.name}.
                  </>
                ) : (
                  heading[view]
                )}
              </h1>
              <p>
                {view === "today"
                  ? heading.today
                  : view === "loops"
                    ? "The commitments others have made to you."
                    : view === "integrations"
                      ? "One workspace. The tools you already rely on."
                      : view === "calendar"
                        ? p.timezone.replace("_", " ")
                        : view === "tasks"
                          ? "Your outcomes, ordered by importance."
                          : view === "meetings"
                            ? "Context, questions, and decisions for every conversation."
                            : view === "decisions"
                              ? "A record of what you chose, and why."
                              : view === "briefings"
                                ? "A daily perspective from your saved workspace."
                                : p.northStar}
              </p>
            </div>
            {view === "today" ? (
              <button
                className="btn"
                onClick={() => void intelligence("briefing")}
                disabled={busy}
              >
                <Sparkles size={16} />
                {busy ? "Preparing…" : "Generate briefing"}
              </button>
            ) : view === "tasks" ? (
              addButton("task", "Add priority")
            ) : view === "loops" ? (
              addButton("loop", "Add OpenLoop")
            ) : view === "calendar" || view === "meetings" ? (
              addButton("meeting", "Schedule meeting")
            ) : view === "decisions" ? (
              addButton("decision", "Log a decision")
            ) : view === "briefings" ? (
              <button
                className="btn gold"
                onClick={() => void intelligence("briefing")}
                disabled={busy}
              >
                <Sparkles size={16} />
                Generate today
              </button>
            ) : null}
          </div>
          {loading ? (
            <div className="loading">
              <RefreshCw className="spin" size={24} />
              Loading your workspace…
            </div>
          ) : error ? (
            <div className="error-state">
              <h2>Workspace unavailable</h2>
              <p>{error}</p>
              <button className="btn" onClick={() => void load()}>
                Try again
              </button>
            </div>
          ) : (
            <>
              {items.some((i) => i.data.demo) && (
                <div className="sample-note">
                  <span>
                    <Circle size={9} /> Sample workspace · Example people and
                    commitments
                  </span>
                  <button onClick={() => navigate("settings")}>
                    Start with your own data <ChevronRight size={14} />
                  </button>
                </div>
              )}
              {view === "today" && (
                <>
                  <section className="stats-strip">
                    <div>
                      <span>PRIORITIES TODAY</span>
                      <strong>
                        {dueTasks
                          .filter((i) => !i.data.done)
                          .length.toString()
                          .padStart(2, "0")}
                        <small>{completed} completed</small>
                      </strong>
                    </div>
                    <div>
                      <span>ON YOUR CALENDAR</span>
                      <strong>
                        {todaysMeetings.length.toString().padStart(2, "0")}
                        <small>
                          {Math.round(
                            todaysMeetings.reduce(
                              (sum, m) =>
                                sum +
                                Date.parse(m.data.end) -
                                Date.parse(m.data.start),
                              0,
                            ) / 60000,
                          )}{" "}
                          min in meetings
                        </small>
                      </strong>
                    </div>
                    <div>
                      <span>OPENLOOPS</span>
                      <strong>
                        {waiting.length.toString().padStart(2, "0")}
                        <small className={overdue.length ? "late" : ""}>
                          {overdue.length} overdue
                        </small>
                      </strong>
                    </div>
                    <div>
                      <span>DECISIONS IN MOTION</span>
                      <strong>
                        {decisions
                          .filter((i) => i.data.status !== "Decided")
                          .length.toString()
                          .padStart(2, "0")}
                        <small>Keep momentum</small>
                      </strong>
                    </div>
                  </section>
                  <div className="dashboard-grid">
                    <div className="dashboard-left">
                      <section className="panel priorities-panel">
                        <div className="section-title">
                          <div>
                            <span className="section-kicker">
                              THE WORK THAT MATTERS
                            </span>
                            <h2>
                              Today's priorities{" "}
                              <span className="muted-number">
                                {dueTasks.length}
                              </span>
                            </h2>
                          </div>
                          <button
                            className="icon-btn"
                            aria-label="Add priority"
                            onClick={() => setEdit({ kind: "task" })}
                          >
                            <Plus size={20} />
                          </button>
                        </div>
                        <div className="progress-line">
                          <span>
                            {completed} of {dueTasks.length} complete
                          </span>
                          <div>
                            <i
                              style={{
                                width: `${dueTasks.length ? (completed / dueTasks.length) * 100 : 0}%`,
                              }}
                            />
                          </div>
                        </div>
                        {dueTasks.length ? (
                          dueTasks
                            .slice(0, 5)
                            .map((t) => <TaskRow key={t.id} item={t} />)
                        ) : (
                          <Empty
                            action={addButton("task", "Choose a priority")}
                          >
                            A clear day starts with a clear outcome.
                          </Empty>
                        )}
                        <button
                          className="panel-link"
                          onClick={() => navigate("tasks")}
                        >
                          All priorities <ChevronRight size={15} />
                        </button>
                      </section>
                      <section className="focus-card">
                        <div>
                          <span className="section-kicker">SPACE TO THINK</span>
                          <h3>
                            {focus
                              ? "One thing at a time."
                              : "Protect your focus."}
                          </h3>
                          <p>
                            {focus
                              ? `${Math.floor(remaining / 60)
                                  .toString()
                                  .padStart(
                                    2,
                                    "0",
                                  )}:${(remaining % 60).toString().padStart(2, "0")} remaining`
                              : "Give your most important work 25 uninterrupted minutes."}
                          </p>
                        </div>
                        <button
                          className="btn"
                          onClick={() => {
                            if (!focus && remaining === 0) setRemaining(1500);
                            setFocus((s) => !s);
                          }}
                        >
                          <Focus size={17} />
                          {focus
                            ? "Pause session"
                            : remaining < 1500 && remaining > 0
                              ? "Resume focus"
                              : "Start focus"}
                        </button>
                      </section>
                    </div>
                    <section className="panel agenda-panel">
                      <div className="section-title">
                        <div>
                          <span className="section-kicker">YOUR TIME</span>
                          <h2>Today's agenda</h2>
                        </div>
                        <CalendarDays size={20} className="muted" />
                      </div>
                      {todaysMeetings.length ? (
                        todaysMeetings.map((m) => (
                          <MeetingRow key={m.id} item={m} />
                        ))
                      ) : (
                        <Empty>Your calendar has room to breathe.</Empty>
                      )}
                      <div className="agenda-footer">
                        <span>
                          <ShieldCheck size={14} />{" "}
                          {p.timezone.split("/").pop()?.replace("_", " ")}
                        </span>
                        <button onClick={() => navigate("calendar")}>
                          View calendar <ChevronRight size={14} />
                        </button>
                      </div>
                    </section>
                  </div>
                  <section className="panel openloops-panel">
                    <div className="section-title">
                      <div>
                        <span className="section-kicker">
                          KEEP THE MOMENTUM
                        </span>
                        <h2>
                          Waiting on others{" "}
                          <Pill tone={overdue.length ? "rose" : "neutral"}>
                            {overdue.length} overdue
                          </Pill>
                        </h2>
                      </div>
                      <button
                        className="text-button"
                        onClick={() => navigate("loops")}
                      >
                        View all <ChevronRight size={14} />
                      </button>
                    </div>
                    {waiting.length ? (
                      waiting
                        .slice(0, 3)
                        .map((l) => <LoopRow key={l.id} item={l} compact />)
                    ) : (
                      <Empty>All commitments accounted for.</Empty>
                    )}
                  </section>
                  <div className="north-star">
                    <Compass size={16} />
                    <span>{p.northStar}</span>
                  </div>
                </>
              )}
              {view === "tasks" && (
                <>
                  <div className="toolbar">
                    <div className="tabs">
                      {["Active", "Today", "Completed", "All"].map((t) => (
                        <button
                          key={t}
                          className={tab === t ? "selected" : ""}
                          onClick={() => setTab(t)}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    <label className="inline-search">
                      <Search size={16} />
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Find a priority"
                        aria-label="Filter priorities"
                      />
                    </label>
                  </div>
                  <section className="panel">
                    {filter(tasks)
                      .filter(
                        (i) =>
                          tab === "All" ||
                          (tab === "Completed"
                            ? i.data.done
                            : tab === "Today"
                              ? i.data.due <= day && !i.data.done
                              : !i.data.done),
                      )
                      .map((t) => (
                        <TaskRow key={t.id} item={t} />
                      ))}
                    {!filter(tasks).some(
                      (i) =>
                        tab === "All" ||
                        (tab === "Completed"
                          ? i.data.done
                          : tab === "Today"
                            ? i.data.due <= day && !i.data.done
                            : !i.data.done),
                    ) && (
                      <Empty>
                        Nothing here yet. Add a priority or change your filter.
                      </Empty>
                    )}
                  </section>
                </>
              )}
              {view === "loops" && (
                <>
                  <div className="toolbar">
                    <div className="tabs">
                      {["Active", "Overdue", "Received", "All"].map((t) => (
                        <button
                          key={t}
                          className={tab === t ? "selected" : ""}
                          onClick={() => setTab(t)}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    <label className="inline-search">
                      <Search size={16} />
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search people or commitments"
                        aria-label="Filter OpenLoops"
                      />
                    </label>
                  </div>
                  <section className="panel">
                    {filter(loops)
                      .filter(
                        (i) =>
                          tab === "All" ||
                          (tab === "Received"
                            ? i.data.status === "Received"
                            : tab === "Overdue"
                              ? i.data.status === "Waiting" && i.data.due < day
                              : i.data.status === "Waiting"),
                      )
                      .map((l) => (
                        <LoopRow key={l.id} item={l} />
                      ))}
                    {!filter(loops).some(
                      (i) =>
                        tab === "All" ||
                        (tab === "Received"
                          ? i.data.status === "Received"
                          : tab === "Overdue"
                            ? i.data.status === "Waiting" && i.data.due < day
                            : i.data.status === "Waiting"),
                    ) && <Empty>No commitments in this view.</Empty>}
                  </section>
                </>
              )}
              {view === "calendar" && (
                <>
                  <div className="toolbar calendar-toolbar">
                    <div className="date-controls">
                      <button
                        className="icon-btn"
                        aria-label="Previous day or week"
                        onClick={() =>
                          setSelectedDay((s) =>
                            dayOffset(s, calendarMode === "Week" ? -7 : -1),
                          )
                        }
                      >
                        <ChevronLeft size={19} />
                      </button>
                      <strong>{formatDate(selectedDay)}</strong>
                      <button
                        className="icon-btn"
                        aria-label="Next day or week"
                        onClick={() =>
                          setSelectedDay((s) =>
                            dayOffset(s, calendarMode === "Week" ? 7 : 1),
                          )
                        }
                      >
                        <ChevronRight size={19} />
                      </button>
                      <button
                        className="btn small"
                        onClick={() => setSelectedDay(day)}
                      >
                        Today
                      </button>
                      <input
                        type="date"
                        value={selectedDay}
                        onChange={(e) => setSelectedDay(e.target.value || day)}
                        aria-label="Calendar date"
                      />
                    </div>
                    <div className="tabs">
                      {["Agenda", "Week"].map((t) => (
                        <button
                          key={t}
                          className={calendarMode === t ? "selected" : ""}
                          onClick={() => setCalendarMode(t)}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    <div className="button-group">
                      <label className="btn small upload-label">
                        <Upload size={15} />
                        Import .ics
                        <input
                          type="file"
                          accept=".ics,text/calendar"
                          onChange={async (e) => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            try {
                              const r = await api("/api/calendar", "POST", {
                                content: await f.text(),
                              });
                              await load();
                              notify(`Imported ${r.count} events`);
                            } catch (e) {
                              notify((e as Error).message);
                            }
                          }}
                        />
                      </label>
                      <a className="btn small" href="/api/calendar">
                        <Download size={15} />
                        Export
                      </a>
                    </div>
                  </div>
                  {calendarMode === "Agenda" ? (
                    <section className="panel">
                      {meetings
                        .filter((m) => dateOf(m.data.start) === selectedDay)
                        .map((m) => (
                          <MeetingRow key={m.id} item={m} />
                        ))}
                      {!meetings.some(
                        (m) => dateOf(m.data.start) === selectedDay,
                      ) && (
                        <Empty action={addButton("meeting", "Add a meeting")}>
                          No meetings on {formatDate(selectedDay)}.
                        </Empty>
                      )}
                    </section>
                  ) : (
                    <div className="week-grid">
                      {Array.from({ length: 7 }, (_, i) =>
                        dayOffset(selectedDay, i),
                      ).map((d) => (
                        <section
                          className={
                            "week-day " + (d === day ? "is-today" : "")
                          }
                          key={d}
                        >
                          <h3>
                            {new Date(d + "T12:00:00Z").toLocaleDateString(
                              "en-US",
                              { weekday: "short", timeZone: "UTC" },
                            )}
                            <span>{d.slice(-2)}</span>
                          </h3>
                          {meetings
                            .filter((m) => dateOf(m.data.start) === d)
                            .map((m) => (
                              <button
                                key={m.id}
                                className="week-event"
                                onClick={() => setDetail(m)}
                              >
                                <small>{time(m.data.start)}</small>
                                <strong>{m.data.title}</strong>
                                <span>
                                  {Math.round(
                                    (Date.parse(m.data.end) -
                                      Date.parse(m.data.start)) /
                                      60000,
                                  )}{" "}
                                  min
                                </span>
                              </button>
                            ))}
                        </section>
                      ))}
                    </div>
                  )}
                  <p className="helper">
                    Calendar sync is read-only. File import supports individual
                    events; recurring series should use Google Calendar sync.
                  </p>
                </>
              )}
              {view === "meetings" && (
                <>
                  <div className="toolbar">
                    <label className="inline-search">
                      <Search size={16} />
                      <input
                        placeholder="Find a meeting"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        aria-label="Filter meetings"
                      />
                    </label>
                    <span className="helper">
                      {meetings.filter((m) => m.data.prep).length} meeting
                      briefs ready
                    </span>
                  </div>
                  <div className="meeting-cards">
                    {filter(meetings).map((m) => (
                      <section className="panel meeting-card" key={m.id}>
                        <div className="card-top">
                          <Pill tone={m.data.prep ? "mint" : "neutral"}>
                            {m.data.prep ? "Brief ready" : "Needs preparation"}
                          </Pill>
                          <span className="helper">
                            {formatDate(dateOf(m.data.start))}
                          </span>
                        </div>
                        <h2>{m.data.title}</h2>
                        <p>
                          <Clock size={15} />
                          {time(m.data.start)} – {time(m.data.end)}
                        </p>
                        <p>
                          <Users size={15} />
                          {m.data.attendees || "No attendees set"}
                        </p>
                        <div className="card-actions">
                          <button className="btn" onClick={() => setDetail(m)}>
                            Open meeting
                          </button>
                          <button
                            className="btn gold"
                            disabled={busy}
                            onClick={() => void intelligence("prep", m.id)}
                          >
                            <Sparkles size={15} />
                            {m.data.prep ? "Refresh brief" : "Prepare"}
                          </button>
                        </div>
                      </section>
                    ))}
                  </div>
                  {!filter(meetings).length && (
                    <Empty>Add a meeting to start preparing.</Empty>
                  )}
                </>
              )}
              {view === "briefings" && (
                <div className="briefing-layout">
                  <section className="briefing-intro">
                    <span className="section-kicker">YOUR DAILY ADVANTAGE</span>
                    <h2>
                      A clear view of
                      <br />
                      what matters.
                    </h2>
                    <p>
                      Your priorities, meetings, and outstanding commitments,
                      brought together in one readable brief.
                    </p>
                    <div className="briefing-source">
                      <Sparkles size={18} />
                      <div>
                        <strong>
                          {connections.find((c) => c.id === "grok")?.configured
                            ? "Powered by Grok"
                            : "Workspace synthesis"}
                        </strong>
                        <small>
                          {connections.find((c) => c.id === "grok")?.configured
                            ? "AI uses your saved workspace context."
                            : "Connect Grok for AI-generated commentary."}
                        </small>
                      </div>
                    </div>
                  </section>
                  <div className="briefing-list">
                    {briefings.map((b) => (
                      <button
                        className="panel briefing-card"
                        key={b.id}
                        onClick={() => setDetail(b)}
                      >
                        <div className="card-top">
                          <Pill tone="gold-tone">{b.data.engine}</Pill>
                          <span className="helper">
                            {formatDate(b.data.date)}
                          </span>
                        </div>
                        <h2>{b.data.title}</h2>
                        <p>{b.data.content.slice(0, 180)}…</p>
                        <span className="text-button">
                          Read briefing <ChevronRight size={15} />
                        </span>
                      </button>
                    ))}
                    {!briefings.length && (
                      <Empty>Generate your first daily briefing.</Empty>
                    )}
                  </div>
                </div>
              )}
              {view === "decisions" && (
                <div className="decision-list">
                  {decisions.map((d) => (
                    <button
                      className="panel decision-card"
                      key={d.id}
                      onClick={() => setDetail(d)}
                    >
                      <div>
                        <span className="section-kicker">
                          REVIEW {formatDate(d.data.due)}
                        </span>
                        <h2>{d.data.title}</h2>
                        <p>
                          {d.data.rationale ||
                            d.data.notes ||
                            "Add your options and reasoning."}
                        </p>
                      </div>
                      <Pill
                        tone={
                          d.data.status === "Decided" ? "mint" : "gold-tone"
                        }
                      >
                        {d.data.status}
                      </Pill>
                      <ChevronRight size={19} />
                    </button>
                  ))}
                  {!decisions.length && (
                    <Empty>
                      Start a decision record to capture your reasoning.
                    </Empty>
                  )}
                </div>
              )}
              {view === "integrations" && (
                <>
                  <div className="integration-summary">
                    <ShieldCheck size={19} />
                    <span>
                      Credentials stay on the server. Only configured services
                      can sync.
                    </span>
                  </div>
                  <div className="integration-grid">
                    {connections.map((c) => (
                      <section className="panel integration-card" key={c.id}>
                        <div className="card-top">
                          <span className={"provider-icon " + c.id}>
                            {c.id === "google" ? (
                              <CalendarDays size={24} />
                            ) : c.id === "slack" ? (
                              <MessageSquare size={24} />
                            ) : c.id === "grok" ? (
                              <Sparkles size={24} />
                            ) : (
                              <Link2 size={24} />
                            )}
                          </span>
                          <Pill
                            tone={
                              c.lastSync
                                ? "mint"
                                : c.configured
                                  ? "gold-tone"
                                  : "neutral"
                            }
                          >
                            {c.lastSync
                              ? "Last sync successful"
                              : c.configured
                                ? "Configured"
                                : c.requirements.length
                                  ? "Not connected"
                                  : "Manual handoff"}
                          </Pill>
                        </div>
                        <h2>{c.name}</h2>
                        <h3>{c.category}</h3>
                        <p>{c.description}</p>
                        {c.lastSync && (
                          <small className="helper">
                            Last synced{" "}
                            {new Date(c.lastSync).toLocaleString("en-US", {
                              timeZone: p.timezone,
                            })}
                          </small>
                        )}
                        <div className="card-actions">
                          {c.requirements.length ? (
                            <button className="btn" onClick={() => setSetup(c)}>
                              {c.configured
                                ? "Configuration"
                                : "Set up connection"}
                            </button>
                          ) : (
                            <button
                              className="btn"
                              onClick={() => setBridge(c.id)}
                            >
                              Import agent output
                            </button>
                          )}
                          {c.configured &&
                            ["google", "slack"].includes(c.id) && (
                              <button
                                className="btn gold"
                                disabled={busy}
                                onClick={() => void sync(c.id)}
                              >
                                <RefreshCw size={15} />
                                Sync now
                              </button>
                            )}
                        </div>
                      </section>
                    ))}
                  </div>
                  <section className="panel slack-inbox">
                    <div className="section-title">
                      <div>
                        <span className="section-kicker">FROM YOUR TEAM</span>
                        <h2>
                          Slack inbox{" "}
                          <span className="muted-number">
                            {messages.length}
                          </span>
                        </h2>
                      </div>
                    </div>
                    {messages.length ? (
                      messages.slice(0, 100).map((m) => (
                        <div className="slack-message" key={m.id}>
                          <div>
                            <strong>{m.data.author}</strong>
                            <small>
                              {m.data.channel} ·{" "}
                              {new Date(
                                Number(m.data.ts) * 1000,
                              ).toLocaleDateString()}
                            </small>
                            <p>{m.data.text}</p>
                          </div>
                          <div className="button-group">
                            <button
                              className="btn small"
                              onClick={() =>
                                setEdit({
                                  kind: "task",
                                  item: {
                                    ...m,
                                    kind: "task",
                                    id: "",
                                    data: {
                                      title: m.data.title,
                                      notes: m.data.text,
                                      due: day,
                                      priority: "Medium",
                                      category: "Leadership",
                                      source: "Slack",
                                    },
                                  },
                                })
                              }
                            >
                              Create task
                            </button>
                            <button
                              className="btn small"
                              onClick={() =>
                                setEdit({
                                  kind: "loop",
                                  item: {
                                    ...m,
                                    kind: "loop",
                                    id: "",
                                    data: {
                                      title: m.data.title,
                                      notes: m.data.text,
                                      owner: m.data.author,
                                      due: day,
                                      channel: "Slack",
                                      source: "Slack",
                                    },
                                  },
                                })
                              }
                            >
                              Create OpenLoop
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <Empty>
                        Connect Slack, choose channels, and sync to see messages
                        here.
                      </Empty>
                    )}
                  </section>
                </>
              )}
              {view === "settings" && (
                <>
                  <section className="panel settings-panel">
                    <h2>Your executive profile</h2>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!profile) return;
                        const f = new FormData(e.currentTarget);
                        await change(profile, Object.fromEntries(f));
                      }}
                    >
                      <div className="form-grid">
                        <label>
                          Name
                          <input
                            name="name"
                            defaultValue={p.name}
                            required
                            maxLength={80}
                          />
                        </label>
                        <label>
                          Role
                          <input
                            name="role"
                            defaultValue={p.role}
                            maxLength={100}
                          />
                        </label>
                        <label>
                          Company
                          <input
                            name="company"
                            defaultValue={p.company}
                            maxLength={100}
                          />
                        </label>
                        <label>
                          Timezone
                          <select name="timezone" defaultValue={p.timezone}>
                            {[
                              "America/New_York",
                              "America/Chicago",
                              "America/Denver",
                              "America/Los_Angeles",
                              "Europe/London",
                              "Europe/Paris",
                              "Asia/Singapore",
                              "Etc/UTC",
                            ].map((t) => (
                              <option key={t}>{t}</option>
                            ))}
                          </select>
                        </label>
                        <label className="full-width">
                          North star
                          <textarea
                            name="northStar"
                            defaultValue={p.northStar}
                            maxLength={1000}
                          />
                        </label>
                      </div>
                      <button className="btn gold" type="submit">
                        Save profile
                      </button>
                    </form>
                  </section>
                  <section className="panel settings-panel">
                    <h2>Workspace data</h2>
                    <p>
                      Export a full snapshot of your records, or clear the
                      labeled sample records when you are ready to begin.
                    </p>
                    <div className="button-group">
                      <button
                        className="btn"
                        onClick={() =>
                          download(
                            "ceo-workspace.json",
                            JSON.stringify(
                              { exportedAt: new Date().toISOString(), items },
                              null,
                              2,
                            ),
                            "application/json",
                          )
                        }
                      >
                        <Download size={16} />
                        Export workspace
                      </button>
                      <button
                        className="btn"
                        onClick={() => setBridge("manual")}
                      >
                        <Upload size={16} />
                        Import records
                      </button>
                      <button
                        className="btn danger"
                        disabled={!items.some((i) => i.data.demo) || busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            await api("/api/workspace", "DELETE", {
                              samples: true,
                            });
                            await load();
                            notify("Sample records removed");
                          } catch (e) {
                            notify((e as Error).message);
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        <Trash2 size={16} />
                        Clear sample records
                      </button>
                    </div>
                    <p className="helper">
                      Sample removal leaves your profile and your own records
                      intact.
                    </p>
                  </section>
                  <section className="panel settings-panel">
                    <h2>Daily briefing cadence</h2>
                    <p>
                      A daily brief is created when you first open the workspace
                      each day. Regenerate it from Today or Daily briefings to
                      include the latest records.
                    </p>
                    <p className="helper">
                      Briefings refresh on opening or on demand. Unattended
                      scheduling and Slack delivery require connected accounts
                      and a verified service access path.
                    </p>
                  </section>
                </>
              )}
            </>
          )}
          <footer className="workspace-footer">
            <span>CEO OPERATING SYSTEM</span>
            <span>
              Private by design <ShieldCheck size={13} />
            </span>
          </footer>
        </div>
      </main>
      {toast && (
        <div className="toast" role="status">
          <CheckCheck size={18} />
          {toast}
        </div>
      )}
      {edit && (
        <RecordForm
          kind={edit.kind}
          item={edit.item}
          timezone={p.timezone}
          defaultDay={selectedDay || day}
          busy={busy}
          onClose={() => setEdit(null)}
          onSave={async (kind, data, item) => {
            setBusy(true);
            try {
              const r = await api(
                "/api/workspace",
                item?.id ? "PATCH" : "POST",
                item?.id
                  ? { id: item.id, version: item.version, data }
                  : { kind, data },
              );
              put(r.item);
              setEdit(null);
              if (detail?.id === r.item.id) setDetail(r.item);
              notify("Saved");
            } catch (e) {
              throw e;
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
      {detail && (
        <Dialog title={detail.data.title} onClose={() => setDetail(null)} wide>
          <div className="detail-body">
            <div className="detail-meta">
              <Pill tone="gold-tone">{detail.kind}</Pill>
              {detail.data.demo && <Pill>Sample</Pill>}
              <span>{detail.data.source || "Manual"}</span>
            </div>
            {detail.kind === "briefing" ? (
              <>
                <pre className="document">{detail.data.content}</pre>
                <button
                  className="btn"
                  onClick={() =>
                    download(
                      `briefing-${detail.data.date}.md`,
                      detail.data.content,
                    )
                  }
                >
                  <Download size={16} />
                  Download briefing
                </button>
              </>
            ) : detail.kind === "meeting" ? (
              <>
                <div className="meeting-details">
                  <p>
                    <CalendarDays size={17} />
                    {formatDate(dateOf(detail.data.start))} ·{" "}
                    {time(detail.data.start)} – {time(detail.data.end)}
                  </p>
                  <p>
                    <Users size={17} />
                    {detail.data.attendees || "No attendees set"}
                  </p>
                  <p>
                    <Link2 size={17} />
                    {/^https:\/\//.test(detail.data.location) ? (
                      <a
                        href={detail.data.location}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Join meeting <ExternalLink size={14} />
                      </a>
                    ) : (
                      detail.data.location || "No location set"
                    )}
                  </p>
                </div>
                <div className="detail-tabs">
                  <h3>Meeting brief</h3>
                  <button
                    className="btn small gold"
                    onClick={() => void intelligence("prep", detail.id)}
                    disabled={busy}
                  >
                    <Sparkles size={15} />
                    {busy
                      ? "Preparing…"
                      : detail.data.prep
                        ? "Regenerate"
                        : "Generate brief"}
                  </button>
                </div>
                {detail.data.prep ? (
                  <pre className="document">{detail.data.prep}</pre>
                ) : (
                  <p className="helper">
                    Generate a brief from this meeting and relevant commitments
                    in your workspace.
                  </p>
                )}
                <h3>Agenda</h3>
                <pre className="document compact-doc">
                  {detail.data.agenda || "No agenda yet."}
                </pre>
                <h3>Outcome & notes</h3>
                <pre className="document compact-doc">
                  {detail.data.outcome ||
                    detail.data.notes ||
                    "Capture the decisions and next steps after this meeting."}
                </pre>
                <div className="button-group">
                  <button
                    className="btn"
                    onClick={() => {
                      setEdit({
                        kind: "task",
                        item: {
                          ...detail,
                          id: "",
                          kind: "task",
                          data: {
                            title: "Follow up: " + detail.data.title,
                            notes: detail.data.outcome || detail.data.notes,
                            due: day,
                            priority: "Medium",
                            category: "Leadership",
                          },
                        },
                      });
                    }}
                  >
                    <Plus size={16} />
                    Add action item
                  </button>
                  <button
                    className="btn"
                    onClick={() =>
                      download(
                        "meeting-prep.md",
                        `# ${detail.data.title}\n\n${detail.data.prep || detail.data.agenda}\n\n## Outcome\n${detail.data.outcome}`,
                      )
                    }
                  >
                    <Download size={16} />
                    Download prep
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="detail-properties">
                  {["owner", "priority", "category", "due", "status", "channel"]
                    .filter((k) => detail.data[k])
                    .map((k) => (
                      <div key={k}>
                        <span>{k}</span>
                        <strong>{detail.data[k]}</strong>
                      </div>
                    ))}
                </div>
                {detail.data.notes && (
                  <>
                    <h3>Notes</h3>
                    <pre className="document compact-doc">
                      {detail.data.notes}
                    </pre>
                  </>
                )}
                {detail.kind === "decision" && (
                  <>
                    <h3>Options</h3>
                    <pre className="document compact-doc">
                      {detail.data.options || "No options recorded."}
                    </pre>
                    <h3>Reasoning</h3>
                    <pre className="document compact-doc">
                      {detail.data.rationale || "Add your reasoning."}
                    </pre>
                  </>
                )}
                {detail.kind === "loop" && (
                  <div className="button-group">
                    <button
                      className="btn gold"
                      onClick={() =>
                        void change(detail, {
                          status:
                            detail.data.status === "Received"
                              ? "Waiting"
                              : "Received",
                        })
                      }
                    >
                      <Check size={16} />
                      {detail.data.status === "Received"
                        ? "Reopen commitment"
                        : "Mark received"}
                    </button>
                    <button className="btn" onClick={() => setFollow(detail)}>
                      Draft follow-up
                    </button>
                  </div>
                )}
                {detail.kind === "task" && (
                  <button
                    className="btn gold"
                    onClick={() =>
                      void change(detail, { done: !detail.data.done })
                    }
                  >
                    <Check size={16} />
                    {detail.data.done ? "Reopen task" : "Mark complete"}
                  </button>
                )}
              </>
            )}
            <div className="detail-bottom">
              {detail.kind !== "briefing" && (
                <button
                  className="btn"
                  onClick={() => setEdit({ kind: detail.kind, item: detail })}
                >
                  Edit details
                </button>
              )}
              <DeleteButton busy={busy} onDelete={() => void erase(detail)} />
            </div>
          </div>
        </Dialog>
      )}
      {follow && (
        <Dialog
          title="Follow up with intention"
          onClose={() => setFollow(null)}
        >
          <FollowDraft item={follow} onCopy={notify} />
        </Dialog>
      )}
      {setup && (
        <Dialog title={`Connect ${setup.name}`} onClose={() => setSetup(null)}>
          <div className="detail-body">
            <p>{setup.description}</p>
            <h3>Required server settings</h3>
            <div className="secret-list">
              {setup.requirements.map((r: string) => (
                <code key={r}>{r}</code>
              ))}
            </div>
            <p>
              Have these configured as private runtime secrets by your
              administrator. No credentials are stored in the browser or source
              code.
            </p>
            {setup.id === "google" && (
              <p className="helper">
                Enable Google Calendar API and issue a refresh token with
                calendar.events.readonly permission. Reauthorization belongs to
                your Google account setup.
              </p>
            )}
            {setup.id === "slack" && (
              <p className="helper">
                Install a Slack bot with channels:history / groups:history for
                the selected channels. Invite it to those channels and supply
                their IDs. This prototype reads up to 50 recent messages per
                channel.
              </p>
            )}
            {setup.id === "grok" && (
              <p className="helper">
                Set the model identifier available to your xAI account.
                Generating a response sends selected workspace records to xAI.
              </p>
            )}
            <Pill tone={setup.configured ? "mint" : "neutral"}>
              {setup.configured
                ? "Configured · use Sync now to verify"
                : "Waiting for credentials"}
            </Pill>
          </div>
        </Dialog>
      )}
      {bridge && (
        <Dialog
          title={
            bridge === "manual"
              ? "Import workspace records"
              : `${bridge.charAt(0).toUpperCase() + bridge.slice(1)} handoff`
          }
          onClose={() => setBridge(null)}
          wide
        >
          <BridgeForm
            provider={bridge}
            day={day}
            onImported={async (count) => {
              setBridge(null);
              await load();
              notify(`Imported ${count} records`);
            }}
          />
        </Dialog>
      )}
      {command && (
        <Dialog
          title="Search your workspace"
          onClose={() => {
            setCommand(false);
            setQuery("");
          }}
        >
          <div className="command-body">
            <label className="command-input">
              <Search size={20} />
              <input
                autoFocus
                placeholder="Tasks, meetings, people, decisions…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <div className="command-results">
              {query
                ? filter(items.filter((i) => i.kind !== "settings"))
                    .slice(0, 15)
                    .map((i) => (
                      <button
                        key={i.id}
                        onClick={() => {
                          setDetail(i);
                          setCommand(false);
                          setQuery("");
                        }}
                      >
                        <span>{i.data.title}</span>
                        <Pill>{i.kind}</Pill>
                      </button>
                    ))
                : views.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => {
                        navigate(v.id);
                        setCommand(false);
                      }}
                    >
                      <span>
                        <v.icon size={17} />
                        {v.label}
                      </span>
                      <ChevronRight size={15} />
                    </button>
                  ))}
              {query &&
                !filter(items.filter((i) => i.kind !== "settings")).length && (
                  <Empty>No matching records.</Empty>
                )}
            </div>
          </div>
        </Dialog>
      )}
      {agent && (
        <Dialog
          title="Your chief of staff"
          onClose={() => setAgent(false)}
          wide
        >
          <div className="agent-body">
            <div className="agent-note">
              <Sparkles size={17} />
              {connections.find((c) => c.id === "grok")?.configured
                ? "Grok · Uses your workspace context"
                : "Workspace synthesis · Connect Grok for tailored AI answers"}
            </div>
            {!chat.length && (
              <div className="agent-suggestions">
                {[
                  "What should I focus on today?",
                  "Which commitments need a follow-up?",
                  "Help me prepare for my next meeting.",
                ].map((q) => (
                  <button
                    key={q}
                    className="btn"
                    onClick={() => setQuestion(q)}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
            <div className="chat-history">
              {chat.map((c, i) => (
                <div key={i} className={"chat-message " + c.role}>
                  <small>{c.role === "user" ? "You" : "Chief of staff"}</small>
                  <pre>{c.text}</pre>
                </div>
              ))}
            </div>
            <form
              className="chat-form"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!question.trim() || busy) return;
                const q = question;
                setQuestion("");
                setChat((s) => [...s, { role: "user", text: q }]);
                setBusy(true);
                try {
                  const r = await api("/api/intelligence", "POST", {
                    action: "chat",
                    prompt: q,
                  });
                  setChat((s) => [
                    ...s,
                    { role: "assistant", text: r.content },
                  ]);
                } catch (e) {
                  setChat((s) => [
                    ...s,
                    { role: "assistant", text: (e as Error).message },
                  ]);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                maxLength={4000}
                placeholder="Ask about your workspace…"
                aria-label="Ask your chief of staff"
              />
              <button
                className="btn gold"
                type="submit"
                disabled={busy || !question.trim()}
              >
                <Send size={17} />
                {busy ? "Thinking…" : "Ask"}
              </button>
            </form>
          </div>
        </Dialog>
      )}
    </div>
  );
}
function DeleteButton({
  onDelete,
  busy,
}: {
  onDelete: () => void;
  busy: boolean;
}) {
  const [confirm, setConfirm] = useState(false);
  return (
    <button
      className="btn danger"
      disabled={busy}
      onClick={() => {
        if (confirm) onDelete();
        else setConfirm(true);
      }}
      onBlur={() => setConfirm(false)}
    >
      <Trash2 size={15} />
      {confirm ? "Confirm delete" : "Delete"}
    </button>
  );
}
function FollowDraft({
  item,
  onCopy,
}: {
  item: Item;
  onCopy: (s: string) => void;
}) {
  const [text, setText] = useState(
    `Hi ${item.data.owner.split(" ")[0]},\n\nFollowing up on ${item.data.title.toLowerCase()}, which was due ${item.data.due}. Could you share the current status and when I can expect it?\n\n${item.data.notes ? `For context: ${item.data.notes}\n\n` : ""}Thank you.`,
  );
  return (
    <div className="detail-body">
      <Pill>{item.data.channel} draft</Pill>
      <label className="draft-label">
        Message
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={9}
        />
      </label>
      <p className="helper">
        Review and copy this draft into your conversation. Nothing has been
        sent.
      </p>
      <button
        className="btn gold"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            onCopy("Follow-up copied");
          } catch {
            onCopy("Select the draft text and copy it manually.");
          }
        }}
      >
        <Copy size={16} />
        Copy draft
      </button>
    </div>
  );
}
function RecordForm({
  kind,
  item,
  timezone,
  defaultDay,
  busy,
  onClose,
  onSave,
}: {
  kind: Kind;
  item?: Item;
  timezone: string;
  defaultDay: string;
  busy: boolean;
  onClose: () => void;
  onSave: (kind: Kind, data: any, item?: Item) => Promise<void>;
}) {
  const [selected, setSelected] = useState<Kind>(kind),
    [err, setErr] = useState("");
  const d = item?.data || {},
    isExisting = !!item?.id;
  const dateParts = (value: string) => {
    if (!value) return `${defaultDay}T09:00`;
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(value));
    const v = Object.fromEntries(parts.map((x) => [x.type, x.value]));
    return `${v.year}-${v.month}-${v.day}T${v.hour}:${v.minute}`;
  };
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr("");
    const f = Object.fromEntries(new FormData(e.currentTarget));
    let data: any = { ...(isExisting ? d : {}), ...f };
    if (selected === "task") data.done = d.done || false;
    if (selected === "loop") data.status = data.status || "Waiting";
    if (selected === "meeting") {
      for (const key of ["start", "end"]) {
        const [day, time] = (data[key] as string).split("T");
        data[key] = localDateTime(day, time, timezone);
      }
    }
    try {
      await onSave(selected, data, item);
    } catch (e) {
      setErr((e as Error).message);
    }
  }
  return (
    <Dialog
      title={isExisting ? "Edit details" : "Quick capture"}
      onClose={onClose}
      wide
    >
      <form onSubmit={submit} className="record-form">
        {!isExisting && (
          <div className="tabs capture-tabs">
            {(["task", "loop", "meeting", "decision"] as Kind[]).map((k) => (
              <button
                type="button"
                key={k}
                className={selected === k ? "selected" : ""}
                onClick={() => setSelected(k)}
              >
                {k === "task"
                  ? "Priority"
                  : k === "loop"
                    ? "OpenLoop"
                    : k === "meeting"
                      ? "Meeting"
                      : "Decision"}
              </button>
            ))}
          </div>
        )}
        <div className="form-grid" key={selected}>
          <label className="full-width">
            {selected === "loop"
              ? "What do they owe you?"
              : selected === "meeting"
                ? "Meeting title"
                : "Title"}
            <input
              name="title"
              defaultValue={d.title}
              required
              maxLength={240}
              placeholder={
                selected === "loop"
                  ? "e.g. Updated financial forecast"
                  : "A clear, specific outcome"
              }
            />
          </label>
          {selected !== "meeting" && (
            <label>
              {selected === "decision" ? "Review date" : "Due date"}
              <input
                name="due"
                type="date"
                defaultValue={d.due || defaultDay}
                required
              />
            </label>
          )}
          {selected === "task" && (
            <>
              <label>
                Priority
                <select name="priority" defaultValue={d.priority || "Medium"}>
                  {["High", "Medium", "Low"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label>
                Area
                <select name="category" defaultValue={d.category || "Strategy"}>
                  {[
                    "Strategy",
                    "Leadership",
                    "People",
                    "Finance",
                    "Growth",
                    "Product",
                    "Personal",
                  ].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
            </>
          )}
          {selected === "loop" && (
            <>
              <label>
                Accountable person
                <input
                  name="owner"
                  defaultValue={d.owner}
                  required
                  maxLength={120}
                />
              </label>
              <label>
                Channel
                <select name="channel" defaultValue={d.channel || "Email"}>
                  {["Email", "Slack", "Phone", "In person", "Other"].map(
                    (v) => (
                      <option key={v}>{v}</option>
                    ),
                  )}
                </select>
              </label>
              <label>
                Status
                <select name="status" defaultValue={d.status || "Waiting"}>
                  <option>Waiting</option>
                  <option>Received</option>
                </select>
              </label>
            </>
          )}
          {selected === "meeting" && (
            <>
              <label>
                Starts · {timezone.split("/").pop()}
                <input
                  name="start"
                  type="datetime-local"
                  defaultValue={dateParts(d.start)}
                  required
                />
              </label>
              <label>
                Ends
                <input
                  name="end"
                  type="datetime-local"
                  defaultValue={
                    d.end ? dateParts(d.end) : `${defaultDay}T10:00`
                  }
                  required
                />
              </label>
              <label className="full-width">
                Attendees
                <input
                  name="attendees"
                  defaultValue={d.attendees}
                  maxLength={1000}
                  placeholder="Names, separated by commas"
                />
              </label>
              <label className="full-width">
                Location or meeting URL
                <input
                  name="location"
                  defaultValue={d.location}
                  maxLength={500}
                />
              </label>
              <label className="full-width">
                Agenda
                <textarea
                  name="agenda"
                  defaultValue={d.agenda}
                  rows={4}
                  maxLength={16000}
                />
              </label>
              <label className="full-width">
                Outcome & decisions
                <textarea
                  name="outcome"
                  defaultValue={d.outcome}
                  rows={3}
                  maxLength={16000}
                />
              </label>
            </>
          )}
          {selected === "decision" && (
            <>
              <label>
                Status
                <select name="status" defaultValue={d.status || "Considering"}>
                  <option>Considering</option>
                  <option>Decided</option>
                  <option>Review</option>
                </select>
              </label>
              <label className="full-width">
                Options
                <textarea
                  name="options"
                  defaultValue={d.options}
                  rows={3}
                  maxLength={16000}
                />
              </label>
              <label className="full-width">
                Reasoning
                <textarea
                  name="rationale"
                  defaultValue={d.rationale}
                  rows={4}
                  maxLength={16000}
                />
              </label>
            </>
          )}
          <label className="full-width">
            {selected === "meeting" ? "Context" : "Notes"}
            <textarea
              name="notes"
              defaultValue={d.notes}
              rows={3}
              maxLength={16000}
            />
          </label>
        </div>
        {err && (
          <p className="form-error" role="alert">
            {err}
          </p>
        )}
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn gold" type="submit" disabled={busy}>
            {busy
              ? "Saving…"
              : "Save " +
                (selected === "loop"
                  ? "OpenLoop"
                  : selected === "task"
                    ? "priority"
                    : selected)}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
function BridgeForm({
  provider,
  day,
  onImported,
}: {
  provider: string;
  day: string;
  onImported: (count: number) => Promise<void>;
}) {
  const example = JSON.stringify(
    {
      provider,
      items: [
        {
          kind: "task",
          externalId: "example-001",
          data: {
            title: "Review agent findings",
            due: day,
            priority: "High",
            category: "Strategy",
            notes: "Summarize the findings and decide next steps.",
          },
        },
      ],
    },
    null,
    2,
  );
  const [text, setText] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="detail-body"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        setBusy(true);
        try {
          let payload = JSON.parse(text);
          if (
            Array.isArray(payload.items) &&
            payload.items[0]?.kind &&
            payload.exportedAt
          ) {
            payload = {
              provider,
              items: payload.items
                .filter((i: any) =>
                  ["task", "loop", "meeting", "decision"].includes(i.kind),
                )
                .map((i: any) => ({
                  kind: i.kind,
                  data: i.data,
                  externalId: i.id,
                })),
            };
          }
          payload.provider = provider;
          const r = await api("/api/import", "POST", payload);
          await onImported(r.count);
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <p>
        Paste structured agent output or upload a workspace export. Records are
        validated together before saving. External IDs prevent duplicate
        imports.
      </p>
      <label className="upload-label btn">
        <Upload size={16} />
        Choose JSON file
        <input
          type="file"
          accept=".json,application/json"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) setText(await f.text());
          }}
        />
      </label>
      <label className="draft-label">
        JSON records
        <textarea
          className="json-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={12}
          placeholder={example}
          required
          maxLength={500000}
        />
      </label>
      <details>
        <summary>View the import format</summary>
        <pre className="document">{example}</pre>
      </details>
      <p className="helper">
        The private bridge endpoint is /api/import. Direct integrations must
        authenticate through the hosting platform. This form performs a manual
        import.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button className="btn" type="button" onClick={() => setText(example)}>
          Use example
        </button>
        <button className="btn gold" type="submit" disabled={busy || !text}>
          {busy ? "Importing…" : "Import records"}
        </button>
      </div>
    </form>
  );
}
