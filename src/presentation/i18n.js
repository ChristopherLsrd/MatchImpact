'use strict';

// Textes du plugin en anglais et en français. La langue suit celle du jeu (I18n.locale) :
// français si elle commence par « fr », anglais sinon.

const STAT_LABELS = Object.freeze({
  en: Object.freeze({
    northAmericaPop: 'Pop N. America',
    southAmericaPop: 'Pop S. America',
    europePop: 'Pop Europe',
    asiaPop: 'Pop Asia',
    oceaniaPop: 'Pop Oceania',
    africaPop: 'Pop Africa',
    momentum: 'Momentum',
    morale: 'Morale',
    fatigue: 'Fatigue',
    stamina: 'Stamina',
    wrestlingSkill: 'Wrestling',
    entertainment: 'Entertainment',
    starPower: 'Star power',
    psychology: 'Psychology',
    charisma: 'Charisma',
    brawling: 'Brawling',
    technical: 'Technical',
    aerial: 'Aerial',
    puroresu: 'Puroresu',
    acting: 'Acting',
    basics: 'Basics',
    consistency: 'Consistency',
    athleticism: 'Athleticism',
    toughness: 'Toughness',
    resilience: 'Resilience',
  }),
  fr: Object.freeze({
    northAmericaPop: 'Pop Am. Nord',
    southAmericaPop: 'Pop Am. Sud',
    europePop: 'Pop Europe',
    asiaPop: 'Pop Asie',
    oceaniaPop: 'Pop Océanie',
    africaPop: 'Pop Afrique',
    momentum: 'Momentum',
    morale: 'Moral',
    fatigue: 'Fatigue',
    stamina: 'Endurance',
    wrestlingSkill: 'Wrestling',
    entertainment: 'Divertissement',
    starPower: 'Star power',
    psychology: 'Psychologie',
    charisma: 'Charisme',
    brawling: 'Bagarre',
    technical: 'Technique',
    aerial: 'Aérien',
    puroresu: 'Puroresu',
    acting: "Jeu d'acteur",
    basics: 'Bases',
    consistency: 'Régularité',
    athleticism: 'Athlétisme',
    toughness: 'Robustesse',
    resilience: 'Résilience',
  }),
});

const MESSAGES = Object.freeze({
  en: Object.freeze({
    'wrestlers.one': '{n} wrestler',
    'wrestlers.many': '{n} wrestlers',
    collapse: 'Collapse',
    close: 'Close',
    photoOf: 'Photo of {name}',
    injury: 'Injury',
    injuryReturn: '{type} (back {date})',
    relations: 'Relationships',
    noChange: 'No notable change during this show.',
    historyEmpty: 'No show recorded yet.',
    historyPick: 'Pick a show from the list.',
    loading: 'Loading…',
    recapMissing: 'Recap not found.',
    recapUnreadable: 'Recap could not be read.',
    settings: 'Settings',
    'settings.tracked': 'Tracked stats',
    'settings.display': 'Display',
    'settings.saved': 'Saved',
    'settings.error': 'Could not save',
    'settings.nextShow': 'Changes apply from the next show.',
    'setting.trackPopularity.label': 'Popularity',
    'setting.trackPopularity.help': 'Popularity in the six regions',
    'setting.trackMomentumMorale.label': 'Momentum and morale',
    'setting.trackMomentumMorale.help': 'Contract momentum and morale',
    'setting.trackCondition.label': 'Fatigue and stamina',
    'setting.trackCondition.help': '',
    'setting.trackSkills.label': 'Skills',
    'setting.trackSkills.help': 'Simple or detailed, depending on the world',
    'setting.trackRelationships.label': 'Relationships',
    'setting.trackRelationships.help': 'Between wrestlers of the same segment',
    'setting.showEndOfShowPanel.label': 'End-of-show panel',
    'setting.showEndOfShowPanel.help': 'Show the recap on the results screen',
    'setting.onlyMyPromotion.label': 'Only my promotion',
    'setting.onlyMyPromotion.help': "Ignore other promotions' shows",
    'setting.minDelta.label': 'Minimum change',
    'setting.minDelta.help': 'Smaller changes are hidden (0–10)',
    'setting.historySize.label': 'Shows kept',
    'setting.historySize.help': 'Number of shows in the history (1–100)',
  }),
  fr: Object.freeze({
    'wrestlers.one': '{n} catcheur',
    'wrestlers.many': '{n} catcheurs',
    collapse: 'Replier',
    close: 'Fermer',
    photoOf: 'Photo de {name}',
    injury: 'Blessure',
    injuryReturn: '{type} (retour {date})',
    relations: 'Relations',
    noChange: 'Aucun changement notable pendant ce show.',
    historyEmpty: "Aucun show enregistré pour l'instant.",
    historyPick: 'Choisis un show dans la liste.',
    loading: 'Chargement…',
    recapMissing: 'Récap introuvable.',
    recapUnreadable: 'Récap illisible.',
    settings: 'Réglages',
    'settings.tracked': 'Stats suivies',
    'settings.display': 'Affichage',
    'settings.saved': 'Enregistré',
    'settings.error': "Échec de l'enregistrement",
    'settings.nextShow': "Les changements s'appliquent dès le show suivant.",
    'setting.trackPopularity.label': 'Popularité',
    'setting.trackPopularity.help': 'Popularité dans les six régions',
    'setting.trackMomentumMorale.label': 'Momentum et moral',
    'setting.trackMomentumMorale.help': 'Momentum et moral du contrat',
    'setting.trackCondition.label': 'Fatigue et endurance',
    'setting.trackCondition.help': '',
    'setting.trackSkills.label': 'Talent',
    'setting.trackSkills.help': 'Simples ou détaillées selon le monde',
    'setting.trackRelationships.label': 'Relations',
    'setting.trackRelationships.help': "Entre lutteurs d'un même segment",
    'setting.showEndOfShowPanel.label': 'Panneau de fin de show',
    'setting.showEndOfShowPanel.help': "Affiche le récap dans l'écran de fin de show",
    'setting.onlyMyPromotion.label': 'Seulement ma promotion',
    'setting.onlyMyPromotion.help': 'Ignore les shows des autres promotions',
    'setting.minDelta.label': 'Écart minimum',
    'setting.minDelta.help': 'Les écarts plus petits sont masqués (0 à 10)',
    'setting.historySize.label': 'Shows conservés',
    'setting.historySize.help': "Nombre de shows dans l'historique (1 à 100)",
  }),
});

function resolveLocale(code) {
  return typeof code === 'string' && /^fr/i.test(code.trim()) ? 'fr' : 'en';
}

function has(dict, key) {
  return Object.prototype.hasOwnProperty.call(dict, key);
}

function interpolate(text, params) {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name) => (
    params[name] === undefined || params[name] === null ? match : String(params[name])
  ));
}

function t(locale, key, params) {
  const dict = MESSAGES[resolveLocale(locale)];
  return interpolate(has(dict, key) ? dict[key] : String(key), params);
}

function statLabel(locale, statKey) {
  const dict = STAT_LABELS[resolveLocale(locale)];
  return has(dict, statKey) ? dict[statKey] : String(statKey);
}

module.exports = { resolveLocale, t, statLabel, MESSAGES, STAT_LABELS };
