'use strict';
const path = require('node:path');

// Cibles autorisées par couche, relatives à src/ (sans extension).
const ALLOWED = {
  domain: ['domain/'],
  application: ['domain/', 'application/'],
  presentation: ['domain/', 'presentation/'],
  adapters: ['domain/', 'application/ports', 'presentation/'],
};

function requiresOf(source) {
  const re = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
  const found = [];
  let match;
  while ((match = re.exec(source)) !== null) found.push(match[1]);
  return found;
}

function isAllowed(target, prefixes) {
  return prefixes.some((prefix) => (prefix.endsWith('/') ? target.startsWith(prefix) : target === prefix));
}

function violations(relFile, source) {
  const layer = relFile.split('/')[0];
  const allowed = ALLOWED[layer];
  if (!allowed) return [`${relFile} : couche inconnue "${layer}"`];
  const errors = [];
  for (const spec of requiresOf(source)) {
    if (!spec.startsWith('.')) {
      errors.push(`${relFile} : require("${spec}") interdit (module externe)`);
      continue;
    }
    const target = path.posix
      .normalize(path.posix.join(path.posix.dirname(relFile), spec))
      .replace(/\.js$/, '');
    if (!isAllowed(target, allowed)) {
      errors.push(`${relFile} : require("${spec}") viole la règle de dépendance`);
    }
  }
  return errors;
}

module.exports = { violations, ALLOWED };
