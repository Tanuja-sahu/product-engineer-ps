import { Router } from 'express';
import { writeSse, invalid } from '../utils/sse.js';

export function runRoutes({ store, runManager }) {
  const r = Router();

  r.get('/:runId/events', async (q, s, n) => {
    try {
      const run = await store.getRun(q.params.runId);

      if (!run) {
        return s.status(404).json({ error: 'run not found' });
      }

      s.json(
        await store.listEvents(
          run._id,
          Math.max(0, Number(q.query.after || 0))
        )
      );
    } catch (e) {
      n(e);
    }
  });

  r.get('/:runId/stream', async (q, s, n) => {
    try {
      const run = await store.getRun(q.params.runId);

      if (!run) {
        return s.status(404).end();
      }

      const a = Number(q.query.cursor);
      const b = Number(q.get('Last-Event-ID'));

      const cursor = Number.isFinite(a)
        ? a
        : Number.isFinite(b)
          ? b
          : 0;

      const latest = await store.latestSeq(run._id);

      s.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no'
      });

      s.flushHeaders?.();

      if (cursor > latest) {
        invalid(s);
        return s.end();
      }

      const emitter = runManager.get(run._id);
      const sent = new Set();

      let closed = false;
      let done = false;

      const send = (e) => {
        if (closed || sent.has(e.seq)) {
          return;
        }

        sent.add(e.seq);
        writeSse(s, e);

        if (e.type !== 'chunk') {
          done = true;
        }
      };

      const onEvent = (e) => send(e);

      if (emitter) {
        emitter.on('event', onEvent);
      }

      const replay = await store.listEvents(run._id, cursor);

      replay.forEach(send);

      if (!emitter) {
        if (run.status === 'running') {
          await store.setRunStatus(
            run._id,
            'failed',
            'interrupted'
          );

          const e = await store.appendEvent(
            run._id,
            'failed',
            'interrupted'
          );

          send(e);
        }

        s.end();
      } else if (done) {
        s.end();
      }

      q.on('close', () => {
        closed = true;

        if (emitter) {
          emitter.off('event', onEvent);
        }
      });
    } catch (e) {
      n(e);
    }
  });

  r.get('/:runId', async (q, s, n) => {
    try {
      const run = await store.getRun(q.params.runId);

      if (!run) {
        return s.status(404).json({ error: 'run not found' });
      }

      s.json(run);
    } catch (e) {
      n(e);
    }
  });

  return r;
}