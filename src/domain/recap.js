'use strict';
const { STATS } = require('./stats');

const EPSILON = 1e-9;

function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  const n = Number(value);
  return Number.isNaN(n) ? 0 : n;
}

function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === '';
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function isReported(delta, minDelta) {
  return Math.abs(delta) > EPSILON && Math.abs(delta) + EPSILON >= minDelta;
}

/** Ordre d'apparition des lutteurs dans le card, segments de chacun, nom affiché. */
function indexCard(segments) {
  const order = [];
  const segmentsByWorker = new Map();
  const names = new Map();
  segments.forEach((segment, index) => {
    for (const w of segment.workers) {
      if (!segmentsByWorker.has(w.workerID)) {
        segmentsByWorker.set(w.workerID, []);
        order.push(w.workerID);
        names.set(w.workerID, w.name);
      }
      const list = segmentsByWorker.get(w.workerID);
      if (!list.includes(index)) list.push(index);
    }
  });
  return { order, segmentsByWorker, names };
}

function statChanges(beforeRow, afterRow, stats, minDelta) {
  const changes = [];
  for (const s of stats) {
    const before = toNumber(beforeRow.stats[s.key]);
    const after = toNumber(afterRow.stats[s.key]);
    const delta = after - before;
    if (!isReported(delta, minDelta)) continue;
    changes.push({
      key: s.key, label: s.label, before: round1(before), after: round1(after), delta: round1(delta), inverted: s.inverted,
    });
  }
  return changes;
}

function newInjury(beforeRow, afterRow) {
  if (!isBlank(beforeRow.injuryType) || isBlank(afterRow.injuryType)) return null;
  return { type: String(afterRow.injuryType), healDate: isBlank(afterRow.injuryHealDate) ? null : String(afterRow.injuryHealDate) };
}

function computeWorkers(beforeById, afterById, card, options) {
  const stats = STATS.filter((s) => options.groups[s.group]);
  const workers = [];
  for (const id of card.order) {
    const beforeRow = beforeById.get(id);
    const afterRow = afterById.get(id);
    if (!beforeRow || !afterRow) continue;
    workers.push({
      workerID: id,
      name: card.names.get(id) || afterRow.name,
      segments: card.segmentsByWorker.get(id),
      changes: statChanges(beforeRow, afterRow, stats, options.minDelta),
      injury: newInjury(beforeRow, afterRow),
    });
  }
  return workers;
}

/**
 * Compare deux photos et produit le récap d'un show.
 * @returns {{segments: Array, workers: Array, relations: Array}}
 */
function computeRecap(before, after, segments, options) {
  const beforeById = new Map(before.workers.map((w) => [w.workerID, w]));
  const afterById = new Map(after.workers.map((w) => [w.workerID, w]));
  const card = indexCard(segments);
  return {
    segments: segments.map((s) => ({ name: s.name, type: s.type, rating: s.rating })),
    workers: computeWorkers(beforeById, afterById, card, options),
    relations: [],
  };
}

module.exports = { computeRecap };
