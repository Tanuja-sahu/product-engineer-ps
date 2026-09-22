# Submission — Resumable Realtime Conversation

## Summary

A resumable server-to-client conversation stream built with React, SSE, Express/Node.js, and MongoDB.

Generated response chunks are persisted as ordered durable events before being published to the client. Each event has a monotonic sequence number (`seq`). When a client reconnects, it provides its last received sequence number and receives only the events after that cursor.

This prevents missing events and duplicate events during reconnection.

## Architecture

React Client

↓

SSE

↓

Express / Node.js

↓

RunManager

↓

MongoDB

### Main Components

- **React client** — displays the conversation and consumes the SSE stream.
- **SSE endpoint** — provides ordered server-to-client streaming.
- **Express/Node.js server** — handles conversations, messages, runs, and streaming.
- **RunManager** — tracks active generators in the current process.
- **MongoDB** — stores conversations, messages, runs, and durable stream events.

## Data Model

The application stores:

- **Conversation** — conversation metadata.
- **Message** — user and assistant messages associated with a conversation.
- **Run** — tracks the state of a generated response.
- **Event** — durable ordered stream events associated with a run.

Each run produces ordered events:

- `chunk` — streamed response content
- `completed` — successful completion
- `failed` — generator failure or interruption

Each event contains a monotonically increasing `seq` value.

A unique `(runId, seq)` constraint provides an additional layer of duplicate protection.

## Reconnection Design

When an SSE connection is created:

1. The server reads the cursor from the `cursor` query parameter or `Last-Event-ID`.
2. The server validates the cursor against the latest stored event.
3. Durable events after the cursor are loaded from MongoDB.
4. If the run is still active, the server also subscribes to its live event emitter.
5. Events are deduplicated by sequence number before being sent to the client.
6. If the run has completed or failed, the remaining durable events are replayed and the connection closes.

The client tracks its last received sequence number and reconnects using that cursor.

## Concurrency / Replay Safety

The server subscribes to the active run before replaying durable events. This reduces the replay/live race where an event could otherwise be generated between the replay query and the live subscription.

Both server-side and client-side sequence-based deduplication protect against overlapping replay and live delivery.

## Process Restart Behavior

The active generator is intentionally process-local.

Durable events remain available in MongoDB after a server restart. However, an in-progress generator cannot automatically continue after its process disappears.

Therefore, if the server finds a run marked as `running` but no active generator exists for it, the run is marked as failed/interrupted and an interruption event is persisted.

A production multi-instance implementation could move active-run coordination and job execution to a durable worker/job system.

## Setup Instructions

### Prerequisites

- Node.js
- Docker Desktop
- npm

### 1. Start MongoDB

From the project root:

```bash
docker compose up -d
```

### 2. Start the Server

Open a terminal:

```bash
cd server
npm install
npm run dev
```

The server runs on:

```text
http://localhost:5000
```

### 3. Start the Client

Open another terminal:

```bash
cd client
npm install
npm run dev
```

The client runs on:

```text
http://localhost:5173
```

Open `http://localhost:5173` in the browser.

## API

### Create Conversation

```http
POST /conversations
```

Creates a new conversation.

### Send Message

```http
POST /conversations/:id/messages
```

Adds a user message and starts a response run.

### Stream Run

```http
GET /runs/:runId/stream?cursor=<seq>
```

Streams the run using Server-Sent Events.

The stream also supports the `Last-Event-ID` header for reconnecting from the last received event.

### Fetch Events

```http
GET /runs/:runId/events?after=<seq>
```

Returns durable events after the specified sequence number.

## SSE Event Format

Each event contains its sequence number as the SSE event ID.

Example:

```text
id: 4
event: chunk
data: {"content":"Hello"}
```

Completion events use:

```text
id: 36
event: completed
data: {"content":""}
```

Failure events use:

```text
id: <seq>
event: failed
data: {"content":"<error message>"}
```

## Tests

Automated tests cover:

1. Ordered delivery and completion
2. Replay after a cursor
3. Duplicate protection using sequence numbers
4. Generator failure persistence
5. Restart/interruption recovery

### Test Result

```text
Test Suites: 1 passed, 1 total
Tests:       5 passed, 5 total
```

All 5 focused tests passed successfully.

## Verification Benchmark

The problem-specific verification benchmark was executed successfully.

```text
36/36 events, 0 duplicates, 0 gaps, final state: completed
```

The benchmark produces:

- 35 chunk events
- 1 completed event
- 36 total events

This verifies ordered delivery, absence of duplicates, absence of gaps, and successful completion.

## Manual Verification

The reconnect behavior was also manually verified.

After receiving events through sequence `3`, the client was reconnected using:

```text
cursor=3
```

The server resumed the stream from sequence `4` through sequence `36`.

This verified that:

- previously received events were not unnecessarily replayed
- no events were missing
- the completed event was received
- sequence ordering was preserved

## Engineering Decisions

### Why SSE?

SSE is well suited for this problem because the communication is primarily server-to-client streaming.

It also works naturally with browser `EventSource` and provides event IDs that can be used with `Last-Event-ID`.

### Why Durable Events?

Keeping generated events in MongoDB allows the server to replay events after a client disconnects.

The client does not need to rely only on in-memory state.

### Why Sequence Numbers?

Every event has a monotonically increasing sequence number.

The sequence number provides:

- deterministic ordering
- cursor-based replay
- duplicate detection
- gap detection

### Why an In-Memory RunManager?

The `RunManager` keeps track of active generators in the current Node.js process.

This keeps the implementation simple while still allowing durable event history to survive client disconnects.

The trade-off is that active generation is not shared across multiple server instances.

## Limitations

The current implementation intentionally keeps the scope focused on the challenge requirements.

Current limitations include:

- No authentication or authorization layer
- Generator execution is process-local
- No multi-instance coordination
- No Redis/pub/sub layer
- No production worker/job orchestration
- No production-grade observability or distributed tracing
- The response generator is deterministic rather than connected to an external LLM

For a production multi-instance system, I would use a durable job/worker system and a coordination mechanism such as Redis/pub/sub or another distributed event infrastructure.

## Assumptions

- Each run has a unique `runId`.
- Event sequence numbers start at `1`.
- MongoDB is the durable source of truth for persisted events.
- The active generator is process-local.
- A generator that disappears because of a process restart cannot automatically resume.
- The client reconnects using the latest successfully received sequence number.
- The `(runId, seq)` combination is unique.
- The current implementation is intended for a single-server deployment.

## AI Usage

AI tools were used to assist with implementation, debugging, documentation, and test planning.

I reviewed and verified the generated suggestions by:

- running the application locally
- checking API behavior
- running the automated test suite
- running the verification benchmark
- manually testing cursor-based SSE reconnection

The final implementation decisions, debugging, testing, and verification were performed on the submitted codebase.

## Credibility Note

I personally implemented and verified the submitted solution.

I ran the application locally with Docker MongoDB, verified realtime SSE streaming, tested cursor-based reconnection and replay behavior, ran the automated test suite, and ran the verification benchmark.

The reported results in this submission are based on actual local execution of the submitted code.

## Demo Video

[Watch the 3–5 minute demo video](https://drive.google.com/file/d/18E3xhPZ_6ips5_uAgxZ4Xe5tETaLaM1q/view?usp=sharing)

The demo covers:

- project architecture
- successful realtime streaming
- cursor-based reconnect/recovery
- automated tests
- verification benchmark
- engineering trade-off and limitations

## Final Verification

Before submission, the following were verified:

- [x] MongoDB starts successfully
- [x] Backend starts successfully
- [x] Frontend starts successfully
- [x] Realtime SSE streaming works
- [x] Cursor-based reconnection works
- [x] Automated tests pass
- [x] Verification benchmark passes
- [x] Manual recovery scenario verified
- [x] No API keys or private credentials are included
- [x] Demo video recorded
- [x] Demo video link added
- [x] `SUBMISSION.md` completed