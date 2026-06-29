'use strict';
const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STATES = {
  WAITING: 'WAITING',
  RUNNING: 'RUNNING',
  RETRY: 'RETRY',
  FAILED: 'FAILED',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
};

const PRIORITY = { CRITICAL: 10, HIGH: 8, NORMAL: 5, LOW: 3 };

class LoopEngine extends EventEmitter {
  constructor({ storageDir, maxConcurrent = 1, dedupWindowMs = 0 }) {
    super();
    this.storageDir = storageDir;
    this.maxConcurrent = maxConcurrent;
    this.dedupWindowMs = dedupWindowMs;
    this.running = new Map();
    this.queue = [];
    this.setMaxListeners(50);
    this._ensureDir();
    this._dedupFile = path.join(storageDir, '.dedup.json');
  }

  _ensureDir() {
    try { fs.mkdirSync(this.storageDir, { recursive: true }); } catch {}
  }

  _scoreTask(opts = {}) {
    const { urgency = 5, importance = 5, probability = 5, time = 5 } = opts;
    return Math.round((urgency * 0.35 + importance * 0.35 + probability * 0.15 + time * 0.15) * 10) / 10;
  }

  _dedupKey(pipelineDef, opts) {
    if (opts.dedupKey) return opts.dedupKey;
    return crypto.createHash('sha1')
      .update(`${pipelineDef.name}|${pipelineDef.cycle || 'manual'}|${pipelineDef.steps.map(s => s.name).join(',')}`)
      .digest('hex');
  }

  _readDedup() {
    try { return JSON.parse(fs.readFileSync(this._dedupFile, 'utf8')); } catch { return {}; }
  }

  _writeDedup(store) {
    try { fs.writeFileSync(this._dedupFile, JSON.stringify(store)); } catch {}
  }

  isDuplicate(pipelineDef, opts = {}) {
    const window = opts.dedupWindowMs !== undefined ? opts.dedupWindowMs : this.dedupWindowMs;
    if (!window || opts.skipDedup) return false;
    const key = this._dedupKey(pipelineDef, opts);
    const store = this._readDedup();
    const last = store[key];
    if (last && Date.now() - last < window) return true;
    return false;
  }

  _markDedup(pipelineDef, opts = {}) {
    const window = opts.dedupWindowMs !== undefined ? opts.dedupWindowMs : this.dedupWindowMs;
    if (!window || opts.skipDedup) return;
    const key = this._dedupKey(pipelineDef, opts);
    const store = this._readDedup();
    store[key] = Date.now();
    for (const k of Object.keys(store)) {
      if (Date.now() - store[k] > window * 4) delete store[k];
    }
    this._writeDedup(store);
  }

  submit(pipelineDef, opts = {}) {
    if (this.isDuplicate(pipelineDef, opts)) {
      this.emit('deduped', { name: pipelineDef.name });
      return null;
    }
    this._markDedup(pipelineDef, opts);
    const id = crypto.randomBytes(6).toString('hex');
    const priority = opts.priority !== undefined ? opts.priority : this._scoreTask(opts.scoring || {});

    const record = {
      id,
      name: pipelineDef.name,
      cycle: pipelineDef.cycle || 'manual',
      priority,
      state: STATES.WAITING,
      startedAt: null,
      completedAt: null,
      steps: pipelineDef.steps.map(s => ({
        name: s.name,
        state: STATES.WAITING,
        startedAt: null,
        completedAt: null,
        attempt: 0,
        maxRetries: s.maxRetries !== undefined ? s.maxRetries : 2,
        timeoutMs: s.timeoutMs || 300000,
        error: null,
        durationMs: null,
      })),
      logs: [],
      metrics: { totalDurationMs: 0, retries: 0 },
      _fns: pipelineDef.steps.map(s => s.fn),
    };

    this._log(record, `Enfileirado: ${record.name} (prioridade ${record.priority})`);
    this._persist(record);
    this.queue.push(record);
    this.queue.sort((a, b) => b.priority - a.priority);
    this.emit('queued', record);
    setImmediate(() => this._tick());
    return id;
  }

  _log(record, msg) {
    const ts = new Date().toISOString();
    record.logs.push(`[${ts}] ${msg}`);
    if (record.logs.length > 500) record.logs.shift();
    this.emit('log', { pipelineId: record.id, msg });
  }

  _persist(record) {
    const { _fns, ...data } = record;
    try {
      fs.writeFileSync(path.join(this.storageDir, `pipeline-${record.id}.json`), JSON.stringify(data, null, 2));
    } catch {}
  }

  _tick() {
    while (this.running.size < this.maxConcurrent && this.queue.length > 0) {
      const record = this.queue.shift();
      this._execute(record);
    }
  }

  async _execute(record) {
    this.running.set(record.id, record);
    record.state = STATES.RUNNING;
    record.startedAt = new Date().toISOString();
    this._log(record, `Iniciando: ${record.name}`);
    this._persist(record);
    this.emit('pipeline:start', record);

    const context = { _followUps: [] };

    for (let i = 0; i < record.steps.length; i++) {
      const step = record.steps[i];
      const fn = record._fns[i];

      if (record.state === STATES.CANCELLED) break;

      step.state = STATES.RUNNING;
      step.startedAt = new Date().toISOString();
      this._log(record, `  → ${step.name}`);
      this._persist(record);
      this.emit('step:start', { pipeline: record, stepIndex: i, step });

      let success = false;

      for (let attempt = 0; attempt <= step.maxRetries; attempt++) {
        if (attempt > 0) {
          step.state = STATES.RETRY;
          const backoffMs = Math.min(Math.pow(2, attempt) * 2000, 30000);
          this._log(record, `  ↻ Retry ${attempt}/${step.maxRetries}: ${step.name} (${backoffMs}ms)`);
          record.metrics.retries++;
          this._persist(record);
          await new Promise(r => setTimeout(r, backoffMs));
          step.state = STATES.RUNNING;
        }

        step.attempt = attempt + 1;
        const t0 = Date.now();

        try {
          const result = await Promise.race([
            fn(context),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error(`Timeout após ${step.timeoutMs}ms`)), step.timeoutMs)
            ),
          ]);

          step.durationMs = Date.now() - t0;
          step.state = STATES.COMPLETED;
          step.completedAt = new Date().toISOString();
          step.error = null;
          if (result !== undefined && result !== null) context[step.name] = result;
          this._log(record, `  ✓ ${step.name} (${step.durationMs}ms, tentativa ${step.attempt})`);
          this._persist(record);
          this.emit('step:done', { pipeline: record, stepIndex: i, step });
          success = true;
          break;

        } catch (err) {
          step.durationMs = Date.now() - t0;
          step.error = err && err.message ? err.message : String(err);
          this._log(record, `  ✗ ${step.name}: ${step.error} (tentativa ${step.attempt})`);
          this.emit('step:error', { pipeline: record, stepIndex: i, step, error: step.error });
        }
      }

      if (!success) {
        step.state = STATES.FAILED;
        step.completedAt = new Date().toISOString();
        this._log(record, `  ✗✗ ${step.name} falhou após ${step.maxRetries + 1} tentativas`);
        this._persist(record);
      }
    }

    record.completedAt = new Date().toISOString();
    record.metrics.totalDurationMs = record.startedAt
      ? new Date(record.completedAt).getTime() - new Date(record.startedAt).getTime()
      : 0;

    if (record.state !== STATES.CANCELLED) {
      const anyFailed = record.steps.some(s => s.state === STATES.FAILED);
      record.state = anyFailed ? STATES.FAILED : STATES.COMPLETED;
    }

    this._log(record, `${record.state}: ${record.name} (${record.metrics.totalDurationMs}ms)`);
    this.running.delete(record.id);
    this._persist(record);
    this.emit('pipeline:done', record);

    if (Array.isArray(context._followUps) && context._followUps.length > 0) {
      for (const fu of context._followUps) {
        if (fu && fu.def && Array.isArray(fu.def.steps)) {
          this._log(record, `↳ Follow-up gerado: ${fu.def.name}`);
          this.submit(fu.def, fu.opts || {});
        }
      }
    }

    this._tick();
  }

  cancel(id) {
    const r = this.running.get(id);
    if (r) { r.state = STATES.CANCELLED; this._log(r, 'Cancelado'); return true; }
    const qi = this.queue.findIndex(r => r.id === id);
    if (qi >= 0) {
      this.queue[qi].state = STATES.CANCELLED;
      this._persist(this.queue[qi]);
      this.queue.splice(qi, 1);
      return true;
    }
    return false;
  }

  getRunning() {
    return Array.from(this.running.values()).map(({ _fns, ...r }) => r);
  }

  getQueued() {
    return this.queue.map(({ _fns, ...r }) => r);
  }
}

module.exports = { LoopEngine, STATES, PRIORITY };
