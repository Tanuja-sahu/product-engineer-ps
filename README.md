# Resumable Realtime Conversation

Caygnus Problem 1 implementation using React, Node/Express, SSE and MongoDB.

## Run

1. `docker compose up -d`
2. `cd server && npm install`
3. Copy `.env.example` to `.env`
4. `npm run dev`
5. In another terminal: `cd client && npm install && npm run dev`
6. Open the Vite URL.

## Tests

`cd server && npm test`

Tests use the in-memory store, so MongoDB is not required for the test suite.

## Benchmark

`cd server && npm run benchmark`

It creates a 35-event stream, disconnects during delivery, reconnects from the last cursor and checks ordering, duplicates, gaps and completion.
