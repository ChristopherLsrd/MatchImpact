'use strict';

/** Groupes de stats, chacun piloté par un réglage. */
const GROUPS = Object.freeze(['popularity', 'momentumMorale', 'condition', 'skills']);

function stat(key, label, group, table, inverted) {
  return Object.freeze({ key, label, group, table, inverted });
}

/** Stats suivies, dans l'ordre d'affichage. */
const STATS = Object.freeze([
  stat('northAmericaPop', 'Pop Am. Nord', 'popularity', 'workers', false),
  stat('southAmericaPop', 'Pop Am. Sud', 'popularity', 'workers', false),
  stat('europePop', 'Pop Europe', 'popularity', 'workers', false),
  stat('asiaPop', 'Pop Asie', 'popularity', 'workers', false),
  stat('oceaniaPop', 'Pop Océanie', 'popularity', 'workers', false),
  stat('africaPop', 'Pop Afrique', 'popularity', 'workers', false),
  stat('momentum', 'Momentum', 'momentumMorale', 'contracts', false),
  stat('morale', 'Moral', 'momentumMorale', 'contracts', false),
  stat('fatigue', 'Fatigue', 'condition', 'workers', true),
  stat('stamina', 'Endurance', 'condition', 'workers', false),
  stat('wrestlingSkill', 'Wrestling', 'skills', 'workers', false),
  stat('entertainment', 'Divertissement', 'skills', 'workers', false),
  stat('starPower', 'Star power', 'skills', 'workers', false),
  stat('psychology', 'Psychologie', 'skills', 'workers', false),
  stat('charisma', 'Charisme', 'skills', 'workers', false),
  stat('brawling', 'Bagarre', 'skills', 'workers', false),
  stat('technical', 'Technique', 'skills', 'workers', false),
  stat('aerial', 'Aérien', 'skills', 'workers', false),
  stat('puroresu', 'Puroresu', 'skills', 'workers', false),
  stat('acting', "Jeu d'acteur", 'skills', 'workers', false),
  stat('basics', 'Bases', 'skills', 'workers', false),
  stat('consistency', 'Régularité', 'skills', 'workers', false),
  stat('athleticism', 'Athlétisme', 'skills', 'workers', false),
  stat('toughness', 'Robustesse', 'skills', 'workers', false),
  stat('resilience', 'Résilience', 'skills', 'workers', false),
]);

module.exports = { STATS, GROUPS };
