'use strict';

// api.game.getState() lit saveInfo.promotionID, colonne absente des sauvegardes :
// la promotion du joueur est dans saveInfo.saveUserPromotion.
const PLAYER_PROMOTION_SQL = 'SELECT saveUserPromotion FROM saveInfo LIMIT 1';

function toId(value) {
  if (value === null || value === undefined || value === '') return null;
  const id = Number(value);
  return Number.isFinite(id) ? id : null;
}

function createGameState(gameApi, query) {
  function fromDatabase() {
    try {
      const rows = query(PLAYER_PROMOTION_SQL, []);
      return rows && rows.length ? toId(rows[0].saveUserPromotion) : null;
    } catch (e) {
      return null;
    }
  }

  return {
    playerPromotionId() {
      const state = gameApi.getState();
      const id = toId(state && state.promotionId);
      return id !== null ? id : fromDatabase();
    },
  };
}

module.exports = { createGameState };
