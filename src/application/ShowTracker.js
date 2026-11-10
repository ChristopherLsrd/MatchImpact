'use strict';
const { computeRecap } = require('../domain/recap');
const { addToHistory } = require('../domain/history');
const { assertPort } = require('./ports');

const DEFAULT_MIN_DELTA = 0.5;
const DEFAULT_HISTORY_SIZE = 20;

function readOptions(settings) {
  const minDelta = Number(settings.get('minDelta'));
  return {
    groups: {
      popularity: Boolean(settings.get('trackPopularity')),
      momentumMorale: Boolean(settings.get('trackMomentumMorale')),
      condition: Boolean(settings.get('trackCondition')),
      skills: Boolean(settings.get('trackSkills')),
      relationships: Boolean(settings.get('trackRelationships')),
    },
    minDelta: Number.isFinite(minDelta) && minDelta >= 0 ? minDelta : DEFAULT_MIN_DELTA,
  };
}

function toId(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Convertit les segments de l'événement show:ended en Segment[]. */
function segmentsFromEvent(list) {
  if (!Array.isArray(list)) return [];
  return list.map((s) => ({
    segmentID: null,
    name: String((s && s.segmentName) || ''),
    type: String((s && s.segmentType) || ''),
    rating: s && typeof s.rating === 'number' ? s.rating : null,
    workers: (s && Array.isArray(s.workers) ? s.workers : [])
      .filter((w) => w && toId(w.workerID) !== null)
      .map((w) => ({ workerID: toId(w.workerID), name: String(w.workerName || '') })),
  }));
}

function participantIds(segments) {
  const ids = [];
  for (const s of segments) {
    for (const w of s.workers) if (!ids.includes(w.workerID)) ids.push(w.workerID);
  }
  return ids;
}

function createShowTracker({ roster, history, view, settings, gameState, logger }) {
  assertPort('RosterReader', roster);
  assertPort('HistoryStore', history);
  assertPort('RecapView', view);
  assertPort('Settings', settings);
  assertPort('GameState', gameState);
  assertPort('Logger', logger);

  let current = null; // { promotionID, showName, date, before, recapDone }

  function buildRecap(showID, segments) {
    const ids = participantIds(segments);
    const after = {
      workers: roster.readWorkers(ids, current.promotionID),
      relations: roster.readRelations(ids),
    };
    const body = computeRecap(current.before, after, segments, readOptions(settings));
    return {
      showID, showName: current.showName, date: current.date, promotionID: current.promotionID, ...body,
    };
  }

  function archive(recap) {
    try {
      const max = Number(settings.get('historySize')) || DEFAULT_HISTORY_SIZE;
      history.save(addToHistory(history.load(), recap, max));
    } catch (e) {
      logger.error('archive', e);
    }
  }

  function onShowStarted(data) {
    try {
      current = null;
      const promotionID = toId(data && data.promotionID);
      if (promotionID === null) return;
      if (settings.get('onlyMyPromotion') && promotionID !== toId(gameState.playerPromotionId())) return;
      const before = roster.readRoster(promotionID);
      current = {
        promotionID,
        showName: String((data && data.showName) || ''),
        date: (data && data.date) || null,
        before,
        recapDone: false,
      };
    } catch (e) {
      current = null;
      logger.error('show:started', e);
    }
  }

  function onSummaryShown(payload) {
    try {
      if (!current || current.recapDone) return;
      let showID = toId(payload && payload.showID);
      if (showID === null) showID = toId(roster.findLatestCompletedShow(current.promotionID, current.date));
      if (showID === null) return;
      const recap = buildRecap(showID, roster.readCard(showID));
      current.recapDone = true;
      if (settings.get('showEndOfShowPanel')) view.showInSummary(recap, payload && payload.locale);
      archive(recap);
    } catch (e) {
      logger.error('summary-shown', e);
    }
  }

  function onShowEnded(data) {
    try {
      if (!current || current.recapDone) return;
      const showID = toId(data && data.showID);
      const segments = showID !== null ? roster.readCard(showID) : segmentsFromEvent(data && data.segments);
      const recap = buildRecap(showID, segments);
      current.recapDone = true;
      if (settings.get('showEndOfShowPanel')) view.showFloating(recap);
      archive(recap);
    } catch (e) {
      logger.error('show:ended', e);
    } finally {
      current = null;
    }
  }

  return {
    onShowStarted,
    onSummaryShown,
    onShowEnded,
    hasSnapshot: () => current !== null,
  };
}

module.exports = { createShowTracker, readOptions };
