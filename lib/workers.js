'use strict';
const EventEmitter = require('events');

const WORKER_TYPES = {
  IA: 'ia',
  BANCO: 'banco',
  APIS: 'apis',
  ARQUIVOS: 'arquivos',
  NOTIFICACOES: 'notificacoes',
};

class Worker extends EventEmitter {
  constructor(type, handler, { concurrency = 1 } = {}) {
    super();
    this.type = type;
    this.handler = handler;
    this.concurrency = concurrency;
    this.queue = [];
    this.active = 0;
    this.stats = { processed: 0, failed: 0, totalMs: 0 };
  }

  enqueue(payload, meta = {}) {
    this.queue.push({ payload, meta, enqueuedAt: Date.now() });
    this.emit('enqueue', { type: this.type, size: this.queue.length });
    setImmediate(() => this._drain());
  }

  async _drain() {
    while (this.active < this.concurrency && this.queue.length > 0) {
      const job = this.queue.shift();
      this.active++;
      this._run(job).finally(() => {
        this.active--;
        this._drain();
      });
    }
  }

  async _run(job) {
    const t0 = Date.now();
    try {
      const result = await this.handler(job.payload, job.meta);
      this.stats.processed++;
      this.stats.totalMs += Date.now() - t0;
      this.emit('done', { type: this.type, result, durationMs: Date.now() - t0 });
      return result;
    } catch (err) {
      this.stats.failed++;
      this.emit('error', { type: this.type, error: err && err.message ? err.message : String(err) });
    }
  }

  snapshot() {
    return {
      type: this.type,
      pending: this.queue.length,
      active: this.active,
      processed: this.stats.processed,
      failed: this.stats.failed,
      avgMs: this.stats.processed > 0 ? Math.round(this.stats.totalMs / this.stats.processed) : 0,
    };
  }
}

class WorkerPool extends EventEmitter {
  constructor() {
    super();
    this.workers = new Map();
  }

  register(type, handler, opts) {
    const w = new Worker(type, handler, opts);
    w.on('done', e => this.emit('worker:done', e));
    w.on('error', e => this.emit('worker:error', e));
    this.workers.set(type, w);
    return w;
  }

  dispatch(type, payload, meta) {
    const w = this.workers.get(type);
    if (!w) throw new Error(`Worker não registrado: ${type}`);
    w.enqueue(payload, meta);
  }

  snapshot() {
    return Array.from(this.workers.values()).map(w => w.snapshot());
  }
}

module.exports = { Worker, WorkerPool, WORKER_TYPES };
