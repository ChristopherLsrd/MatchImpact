'use strict';

/** Groupes de stats, chacun piloté par un réglage. */
const GROUPS = Object.freeze(['popularity', 'momentumMorale', 'condition', 'skills']);

function stat(key, group, table, inverted) {
  return Object.freeze({ key, group, table, inverted });
}

/** Stats suivies, dans l'ordre d'affichage. Les libellés sont dans presentation/i18n.js. */
const STATS = Object.freeze([
  stat('northAmericaPop', 'popularity', 'workers', false),
  stat('southAmericaPop', 'popularity', 'workers', false),
  stat('europePop', 'popularity', 'workers', false),
  stat('asiaPop', 'popularity', 'workers', false),
  stat('oceaniaPop', 'popularity', 'workers', false),
  stat('africaPop', 'popularity', 'workers', false),
  stat('momentum', 'momentumMorale', 'contracts', false),
  stat('morale', 'momentumMorale', 'contracts', false),
  stat('fatigue', 'condition', 'workers', true),
  stat('stamina', 'condition', 'workers', false),
  stat('wrestlingSkill', 'skills', 'workers', false),
  stat('entertainment', 'skills', 'workers', false),
  stat('starPower', 'skills', 'workers', false),
  stat('psychology', 'skills', 'workers', false),
  stat('charisma', 'skills', 'workers', false),
  stat('brawling', 'skills', 'workers', false),
  stat('technical', 'skills', 'workers', false),
  stat('aerial', 'skills', 'workers', false),
  stat('puroresu', 'skills', 'workers', false),
  stat('acting', 'skills', 'workers', false),
  stat('basics', 'skills', 'workers', false),
  stat('consistency', 'skills', 'workers', false),
  stat('athleticism', 'skills', 'workers', false),
  stat('toughness', 'skills', 'workers', false),
  stat('resilience', 'skills', 'workers', false),
]);

module.exports = { STATS, GROUPS };
