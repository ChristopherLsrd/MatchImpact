'use strict';

function createGameState(gameApi) {
  return {
    playerPromotionId() {
      const state = gameApi.getState();
      if (!state || state.promotionId === null || state.promotionId === undefined) return null;
      const id = Number(state.promotionId);
      return Number.isFinite(id) ? id : null;
    },
  };
}

module.exports = { createGameState };
