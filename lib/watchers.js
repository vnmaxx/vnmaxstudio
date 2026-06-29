'use strict';
const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');

class WatcherManager extends EventEmitter {
  constructor() {
    super();
    this.watchers = [];
    this.fsWatchers = [];
    this.pollers = [];
  }

  watchDir(dir, { onChange, debounceMs = 1500, label } = {}) {
    try { fs.mkdirSync(dir, { recursive: true }); } catch {}
    let timer = null;
    const handler = (eventType, filename) => {
      if (filename && filename.startsWith('.')) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const payload = { dir, eventType, filename, label, at: new Date().toISOString() };
        this.emit('change', payload);
        if (onChange) onChange(payload);
      }, debounceMs);
    };
    try {
      const w = fs.watch(dir, { persistent: true }, handler);
      this.fsWatchers.push(w);
      this.watchers.push({ type: 'fs', dir, label });
    } catch (e) {
      this.emit('error', { dir, error: e.message });
    }
    return this;
  }

  poll(name, checkFn, { intervalMs = 60000, onTrigger } = {}) {
    let lastState = null;
    const tick = async () => {
      try {
        const state = await checkFn(lastState);
        if (state !== undefined && state !== null && JSON.stringify(state) !== JSON.stringify(lastState)) {
          const payload = { name, state, prev: lastState, at: new Date().toISOString() };
          lastState = state;
          this.emit('poll:change', payload);
          if (onTrigger) onTrigger(payload);
        }
      } catch (e) {
        this.emit('error', { name, error: e.message });
      }
    };
    const handle = setInterval(tick, intervalMs);
    this.pollers.push({ name, handle });
    this.watchers.push({ type: 'poll', name, intervalMs });
    setImmediate(tick);
    return this;
  }

  watchFileCount(dir, { intervalMs = 30000, onIncrease, label } = {}) {
    return this.poll(label || `count:${path.basename(dir)}`, () => {
      try {
        if (!fs.existsSync(dir)) return 0;
        return fs.readdirSync(dir).filter(f => !f.startsWith('.')).length;
      } catch { return 0; }
    }, {
      intervalMs,
      onTrigger: (p) => {
        if (onIncrease && typeof p.prev === 'number' && p.state > p.prev) {
          onIncrease({ ...p, dir, added: p.state - p.prev });
        }
      },
    });
  }

  snapshot() {
    return this.watchers;
  }

  stopAll() {
    for (const w of this.fsWatchers) { try { w.close(); } catch {} }
    for (const p of this.pollers) { try { clearInterval(p.handle); } catch {} }
    this.fsWatchers = [];
    this.pollers = [];
  }
}

module.exports = { WatcherManager };
