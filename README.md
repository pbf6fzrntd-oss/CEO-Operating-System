# CEO Operating System

A working single-owner executive workspace with a midnight interface, brass accents, serif typography, and responsive layouts. The deployed application is private. This GitHub repository contains source code, not your saved data or credentials.

## Workflows

- **Today:** priorities due today, meeting agenda, outstanding commitments, decision counts, focus timer, and personal north star.
- **Priorities:** create, edit, complete, reopen, filter, and search tasks by importance and due date.
- **OpenLoops:** track what people owe you, owners, dates, channels, received status, and editable follow-up drafts. Messages are never automatically sent.
- **Calendar:** daily/seven-day views, timezone-aware meetings, ICS import/export, and Google read-only sync.
- **Meeting room:** context, agendas, participants, preparation briefs, outcome notes, action-item creation, and Markdown downloads.
- **Daily briefings:** a persisted brief on the first workspace opening each day. Same-day regeneration updates the existing entry. Without Grok, clearly labeled workspace synthesis uses saved records. With Grok, selected records are sent to xAI.
- **Decisions:** options, reasoning, status, and review dates.
- **Slack:** read selected channel history and turn messages into tasks or OpenLoops.
- **Chief of staff:** workspace snapshot without credentials; tailored answers with Grok.
- **Agent bridge:** validated JSON imports for Instinct/Silvia output with external IDs for deduplication.
- **Settings:** profile, timezone, north star, export/import, and sample cleanup.
- **Search:** Cmd/Ctrl+K across all records.

## Connection status

| Service         | Implemented                                                                                                       | Required to activate                                                                       |
| --------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Google Calendar | Reads next 14 days, paginates, preserves meeting briefs/outcomes, reconciles removed events after successful sync | OAuth client ID, secret, refresh token with calendar.events.readonly; optional calendar ID |
| Slack           | Reads up to 50 recent messages per channel, up to ten channels; deduplicates timestamps                           | Bot token, channel IDs, history scopes and membership                                      |
| Grok            | Workspace questions, meeting prep, briefings through xAI chat completions                                         | xAI key and account-supported model identifier                                             |
| Instinct        | Manual authenticated import bridge                                                                                | Native provider API not verified                                                           |
| Silvia          | Manual authenticated import bridge                                                                                | Direct product URL/API access; supplied Substack redirect unresolved                       |

No provider credentials were available during implementation. Live provider calls are not verified. Status distinguishes configuration from last successful sync. Thread expansion, automatic DMs, two-way calendar writes, provider OAuth consent screens, autonomous agent execution, and automatic message delivery are not activated. A private cloud task refreshes the saved briefing daily at 7:00 a.m. America/New_York while the app is closed, syncing Google and Slack only when configured. The authenticated writer and readback were verified against the published workspace. Briefings also refresh on first opening and on demand. No email or Slack delivery is scheduled.

## Local setup

Requires Node.js >=22.13 and pnpm 11.25.0 (pinned by packageManager).

```sh
pnpm install --frozen-lockfile
cp .env.example .env
pnpm build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_little_stryfe.sql
pnpm dev
```

Apply migrations once per local database. Append future migrations instead of rewriting applied ones. Portable development uses Vinext. In managed ChatGPT environments, use the Sites workflow. `pnpm start` serves the built Worker with local Wrangler. Production uses Worker ESM and D1, with Sites managing private access and deployment.

## Runtime secrets

Use `.env.example` for setting names. Configure production values as private runtime secrets; never commit `.env` or send credentials to the frontend.

- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, optional `GOOGLE_CALENDAR_ID` (defaults to primary). Issue the refresh token through authorized Google OAuth setup with calendar.events.readonly. Frontend reauthorization is not implemented.
- `SLACK_BOT_TOKEN`, `SLACK_CHANNEL_IDS` (comma separated). Bot needs channels:history and/or groups:history, as applicable, and membership of selected channels. Provider rate limits and retention apply.
- `XAI_API_KEY`, `XAI_MODEL`. Select a supported model. Grok operations share selected workspace records with xAI.

Official references: [Google events](https://developers.google.com/workspace/calendar/api/v3/reference/events/list), [Google scopes](https://developers.google.com/workspace/calendar/api/auth), [Slack history](https://docs.slack.dev/reference/methods/conversations.history/), [xAI completions](https://docs.x.ai/developers/model-capabilities/legacy/chat-completions).

## Private access and persistence

This is a **single-owner private prototype**. The hosting platform authenticates requests before forwarding pages/APIs, including its service access path. The app relies on that boundary and does not implement separate multi-tenant authentication. Do not make it public or expose the raw Worker without adding server authentication and per-user authorization. Sharing requires a deliberate permission model for writes.

D1 stores product records. Browser state holds temporary UI and drafts only; localStorage is not authoritative. Writes use prepared statements and schema validation. Update/delete requires the current version; conflicts return 409. Imports validate the full batch before transactional saving. External IDs prevent duplication. Samples can be removed without deleting personal records or the profile.

Initial examples use fictional people and commitments. Samples do not imply actual company financial data, meeting participants, researched backgrounds, or live news.

## APIs

| Endpoint          | Methods                  | Purpose                                          |
| ----------------- | ------------------------ | ------------------------------------------------ |
| /api/workspace    | GET, POST, PATCH, DELETE | Records, versioned writes, sample cleanup        |
| /api/intelligence | POST                     | briefing, prep (meeting ID), chat (prompt)       |
| /api/integrations | GET, POST                | Configuration status; explicit google/slack sync |
| /api/calendar     | GET, POST                | ICS export/import                                |
| /api/import       | POST                     | Atomic agent import                              |

```json
{
  "provider": "instinct",
  "items": [
    {
      "kind": "task",
      "externalId": "agent-job-001",
      "data": {
        "title": "Review findings",
        "due": "2026-10-05",
        "priority": "High",
        "category": "Strategy"
      }
    }
  ]
}
```

Providers: instinct, silvia, manual. Kinds: task, loop, meeting, decision. Maximum 100 records/batch. Loops require owner; meetings require offset/UTC ISO start/end. Workspace exports are adapted by the import UI. Existing external IDs are skipped, not overwritten.

ICS supports UTC, floating dates, and TZID individual events. Unexpanded recurrence rules/instances are rejected; use Google sync for recurring meetings. Repeated UIDs are skipped. Exports escape punctuation and fold UTF-8 lines. Avoid ambiguous/nonexistent DST wall times in manual scheduling; provider UTC timestamps are authoritative.

## Verification

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm test:api
```

Contracts cover real dates, timezone conversion, UTC/escaped ICS round trips, UTF-8 folding, and recurrence rejection. API smoke tests run the compiled Worker with an isolated D1 database: CRUD/readback, conflicts, atomic validation, idempotency, cross-origin rejection, briefing updates, meeting prep, unconfigured services, and sample cleanup. They never touch production.

Browser interaction/visual QA was unavailable in the authoring session. Types, build, calendar contracts, and actual Worker/D1 API checks were verified. Live provider authentication needs verification after credentials are configured.
