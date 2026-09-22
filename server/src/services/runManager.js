import { EventEmitter } from 'node:events';
import { createGenerator } from './generator.js';

export class RunManager {
  constructor(store) {
    this.store = store;
    this.active = new Map();
  }

  start(runId, options = {}) {
    const key = String(runId);

    if (this.active.has(key)) {
      return;
    }

    const emitter = new EventEmitter();

    this.active.set(key, emitter);

    this.run(key, emitter, options);
  }

  get(runId) {
    return this.active.get(String(runId));
  }

  clear(runId) {
    this.active.delete(String(runId));
  }

  async run(runId, emitter, options) {
    try {
      for await (const chunk of createGenerator(options)()) {
        const e = await this.store.appendEvent(
          runId,
          'chunk',
          chunk
        );

        emitter.emit('event', e);
      }

      await this.store.setRunStatus(
        runId,
        'completed'
      );

      const e = await this.store.appendEvent(
        runId,
        'completed',
        ''
      );

      emitter.emit('event', e);
      emitter.emit('done');
    } catch (err) {
      await this.store.setRunStatus(
        runId,
        'failed',
        err.message
      );

      const e = await this.store.appendEvent(
        runId,
        'failed',
        err.message
      );

      emitter.emit('event', e);
      emitter.emit('done');
    } finally {
      this.active.delete(String(runId));
    }
  }
}