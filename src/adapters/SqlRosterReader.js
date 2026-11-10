'use strict';
const { STATS } = require('../domain/stats');

const STAT_COLUMNS = STATS.map((s) => `${s.table === 'contracts' ? 'c' : 'w'}.${s.key}`);

const SQL = Object.freeze({
  SELECT_WORKERS: `SELECT w.workerID, w.name, w.injuryType, w.injuryHealDate, ${STAT_COLUMNS.join(', ')} `
    + 'FROM workers w JOIN contracts c ON c.workerID = w.workerID',
  ORDER_WORKERS: 'ORDER BY w.workerID, c.contractID',
  CARD: 'SELECT s.segmentID, s.segmentType, s.segmentName, s.rating, o.workerID, '
    + "COALESCE(NULLIF(o.workerName, ''), c.contractName, w.name) AS workerName "
    + 'FROM segments s JOIN opponents o ON o.segmentID = s.segmentID '
    + 'LEFT JOIN contracts c ON c.contractID = o.contractID '
    + 'LEFT JOIN workers w ON w.workerID = o.workerID '
    + 'WHERE s.showID = ? '
    + 'ORDER BY s.segmentorder, s.segmentID, (o.opponentSet < 0), o.opponentSet, o.opponentID',
  LATEST_WITH_DATE: 'SELECT i.instanceID FROM eventinstance i JOIN events e ON e.eventID = i.eventID '
    + 'WHERE e.promotionID = ? AND i.complete = 1 AND i.airDate <= ? '
    + 'ORDER BY i.airDate DESC, i.instanceID DESC LIMIT 1',
  LATEST: 'SELECT i.instanceID FROM eventinstance i JOIN events e ON e.eventID = i.eventID '
    + 'WHERE e.promotionID = ? AND i.complete = 1 ORDER BY i.instanceID DESC LIMIT 1',
});

function placeholders(count) {
  return Array(count).fill('?').join(', ');
}

function toNullableNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function toWorkerRow(row) {
  const stats = {};
  for (const s of STATS) stats[s.key] = toNullableNumber(row[s.key]);
  return {
    workerID: Number(row.workerID),
    name: String(row.name || ''),
    stats,
    injuryType: row.injuryType === undefined ? null : row.injuryType,
    injuryHealDate: row.injuryHealDate === undefined ? null : row.injuryHealDate,
  };
}

function uniqueWorkers(rows) {
  const seen = new Set();
  const workers = [];
  for (const row of rows) {
    const w = toWorkerRow(row);
    if (seen.has(w.workerID)) continue;
    seen.add(w.workerID);
    workers.push(w);
  }
  return workers;
}

function createSqlRosterReader(query) {
  function readRelations(ids) {
    if (!Array.isArray(ids) || ids.length < 2) return [];
    const list = placeholders(ids.length);
    const rows = query(
      `SELECT worker1, worker2, relationship FROM relationships WHERE worker1 IN (${list}) AND worker2 IN (${list})`,
      [...ids, ...ids],
    );
    return rows.map((r) => ({ worker1: Number(r.worker1), worker2: Number(r.worker2), value: toNullableNumber(r.relationship) || 0 }));
  }

  function readRoster(promotionID) {
    const workers = uniqueWorkers(query(`${SQL.SELECT_WORKERS} WHERE c.promotionID = ? AND c.expired = 0 ${SQL.ORDER_WORKERS}`, [promotionID]));
    return { workers, relations: readRelations(workers.map((w) => w.workerID)) };
  }

  function readWorkers(ids, promotionID) {
    if (!Array.isArray(ids) || ids.length === 0) return [];
    return uniqueWorkers(query(
      `${SQL.SELECT_WORKERS} WHERE c.promotionID = ? AND c.expired = 0 AND w.workerID IN (${placeholders(ids.length)}) ${SQL.ORDER_WORKERS}`,
      [promotionID, ...ids],
    ));
  }

  function readCard(showID) {
    const segments = [];
    const byId = new Map();
    for (const r of query(SQL.CARD, [showID])) {
      if (!byId.has(r.segmentID)) {
        const segment = {
          segmentID: Number(r.segmentID),
          name: String(r.segmentName || ''),
          type: String(r.segmentType || ''),
          rating: toNullableNumber(r.rating),
          workers: [],
        };
        byId.set(r.segmentID, segment);
        segments.push(segment);
      }
      const segment = byId.get(r.segmentID);
      const workerID = Number(r.workerID);
      if (!segment.workers.some((w) => w.workerID === workerID)) {
        segment.workers.push({ workerID, name: String(r.workerName || '') });
      }
    }
    return segments;
  }

  function findLatestCompletedShow(promotionID, date) {
    const rows = date ? query(SQL.LATEST_WITH_DATE, [promotionID, date]) : query(SQL.LATEST, [promotionID]);
    return rows.length ? Number(rows[0].instanceID) : null;
  }

  return { readRoster, readWorkers, readRelations, readCard, findLatestCompletedShow };
}

module.exports = { createSqlRosterReader, SQL };
