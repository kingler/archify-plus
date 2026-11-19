// Enterprise model repository: one set of elements and relationships, many
// views. Validation returns Archify-style diagnostics (code, severity,
// subject, message, supportedFixes) instead of throwing.

import { KINDS, RELATIONS, VIEW_TYPES, GROUP_KINDS, TONES, isClassifier } from './notation.mjs';

const ID = /^[a-zA-Z][a-zA-Z0-9_-]*$/;
const GRID_VIEWS = Object.keys(VIEW_TYPES).filter((type) => type !== 'sequence');
const MESSAGE_KINDS = ['sync', 'async', 'reply', 'self'];

export function indexModel(model) {
  const elements = new Map((model.elements || []).map((element) => [element.id, element]));
  const relationships = new Map((model.relationships || []).map((rel) => [rel.id, rel]));
  const views = new Map((model.views || []).map((view) => [view.id, view]));
  return { elements, relationships, views };
}

// Relationships drawn in a view: every model relationship whose two ends are
// both placed, unless the view lists `relationships` or `exclude`.
export function viewRelationships(model, view) {
  const placed = new Set(view.type === 'sequence' ? (view.participants || []) : (view.nodes || []).map((node) => node.ref));
  const only = Array.isArray(view.relationships) ? new Set(view.relationships) : null;
  const exclude = new Set(view.exclude || []);
  return (model.relationships || []).filter((rel) => placed.has(rel.from) && placed.has(rel.to)
    && (!only || only.has(rel.id)) && !exclude.has(rel.id));
}

export function viewsOfElement(model, elementId) {
  return (model.views || []).filter((view) => (view.type === 'sequence'
    ? (view.participants || []).includes(elementId)
    : (view.nodes || []).some((node) => node.ref === elementId)));
}

export function validateModel(model) {
  const diagnostics = [];
  const add = (severity, code, subject, message, supportedFixes = []) => diagnostics.push({ code: `enterprise/${code}`, severity, subject, message, supportedFixes });
  const error = (...args) => add('error', ...args);
  const warning = (...args) => add('warning', ...args);

  if (!model || typeof model !== 'object' || Array.isArray(model)) {
    error('model-shape', {}, 'The model must be a JSON object.', ['Start from enterprise/examples/order-to-cash.enterprise.json.']);
    return { ok: false, diagnostics };
  }
  if (model.schema_version !== 1) error('schema-version', {}, 'schema_version must be 1.', ['Set "schema_version": 1.']);
  if (model.model_type !== 'enterprise') error('model-type', {}, 'model_type must be "enterprise".', ['Set "model_type": "enterprise".']);
  if (!model.meta || typeof model.meta.title !== 'string' || !model.meta.title.trim()) error('meta-title', {}, 'meta.title is required.', ['Add a non-empty meta.title.']);
  for (const key of ['elements', 'relationships', 'views']) {
    if (model[key] !== undefined && !Array.isArray(model[key])) error('model-shape', { key }, `${key} must be an array.`, [`Make ${key} an array.`]);
  }
  const elements = Array.isArray(model.elements) ? model.elements : [];
  const relationships = Array.isArray(model.relationships) ? model.relationships : [];
  const views = Array.isArray(model.views) ? model.views : [];

  const seen = new Map();
  const claim = (id, where) => {
    if (typeof id !== 'string' || !ID.test(id)) {
      error('id-format', { id, where }, `${where} id ${JSON.stringify(id)} must start with a letter and use letters, digits, "_" or "-".`, ['Rename the id.']);
      return false;
    }
    if (seen.has(id)) {
      error('duplicate-id', { id, where }, `Id "${id}" is used by both ${seen.get(id)} and ${where}.`, ['Give every element, relationship, and view a unique id.']);
      return false;
    }
    seen.set(id, where);
    return true;
  };

  const elementIds = new Set();
  for (const element of elements) {
    if (!element || typeof element !== 'object') { error('model-shape', {}, 'Every element must be an object.'); continue; }
    if (claim(element.id, 'element')) elementIds.add(element.id);
    if (!KINDS[element.kind]) error('unknown-kind', { element: element.id, kind: element.kind }, `Element "${element.id}" has unknown kind ${JSON.stringify(element.kind)}.`, ['Use a kind from enterprise/lib/notation.mjs KINDS.']);
    const control = ['gateway', 'bar', 'event'].includes(KINDS[element.kind]?.shape);
    if (typeof element.label !== 'string' || (!element.label.trim() && !control)) error('element-label', { element: element.id }, `Element "${element.id}" needs a label.`, ['Add a non-empty label.']);
    if (element.tone !== undefined && !TONES.includes(element.tone)) error('unknown-tone', { element: element.id, tone: element.tone }, `Element "${element.id}" has unknown tone ${JSON.stringify(element.tone)}.`, [`Use one of: ${TONES.join(', ')}.`]);
    for (const key of ['attributes', 'methods', 'operations']) {
      if (element[key] === undefined) continue;
      if (!Array.isArray(element[key]) || element[key].some((member) => !member || typeof member.name !== 'string' && key !== 'operations')) {
        error('member-shape', { element: element.id, key }, `Element "${element.id}" ${key} must be an array of objects with a name.`, ['Give every member a name.']);
      }
    }
    if ((element.attributes || element.methods) && KINDS[element.kind] && !isClassifier(element.kind) && element.kind !== 'data-object' && element.kind !== 'business-object') {
      warning('members-ignored', { element: element.id }, `Element "${element.id}" is a ${element.kind}; its attributes and methods are not drawn or generated.`, ['Use a classifier kind such as class, interface, enum, record, or entity.']);
    }
  }

  const relIds = new Set();
  for (const rel of relationships) {
    if (!rel || typeof rel !== 'object') { error('model-shape', {}, 'Every relationship must be an object.'); continue; }
    if (claim(rel.id, 'relationship')) relIds.add(rel.id);
    if (!RELATIONS[rel.kind]) error('unknown-relationship', { relationship: rel.id, kind: rel.kind }, `Relationship "${rel.id}" has unknown kind ${JSON.stringify(rel.kind)}.`, ['Use a kind from enterprise/lib/notation.mjs RELATIONS.']);
    for (const end of ['from', 'to']) {
      if (!elementIds.has(rel[end])) error('dangling-reference', { relationship: rel.id, end, target: rel[end] }, `Relationship "${rel.id}" ${end} "${rel[end]}" is not an element.`, ['Point the relationship at an existing element id, or add the element.']);
    }
    if (rel.from === rel.to && !['transition', 'flow'].includes(rel.kind)) warning('self-relationship', { relationship: rel.id }, `Relationship "${rel.id}" connects "${rel.from}" to itself and is not drawn.`, ['Remove it or connect two elements.']);
  }

  // Generalisation must stay acyclic for code generation.
  const parents = new Map();
  for (const rel of relationships) {
    if (rel && ['inheritance', 'specialization'].includes(rel.kind)) parents.set(rel.from, [...(parents.get(rel.from) || []), rel.to]);
  }
  const state = new Map();
  const visit = (id, trail) => {
    if (state.get(id) === 2) return;
    if (state.get(id) === 1) {
      error('inheritance-cycle', { cycle: [...trail.slice(trail.indexOf(id)), id] }, `Inheritance forms a cycle: ${[...trail.slice(trail.indexOf(id)), id].join(' -> ')}.`, ['Remove one inheritance relationship from the cycle.']);
      return;
    }
    state.set(id, 1);
    for (const parent of parents.get(id) || []) visit(parent, [...trail, id]);
    state.set(id, 2);
  };
  for (const id of parents.keys()) visit(id, []);

  const placedAnywhere = new Set();
  for (const view of views) {
    if (!view || typeof view !== 'object') { error('model-shape', {}, 'Every view must be an object.'); continue; }
    claim(view.id, 'view');
    if (!VIEW_TYPES[view.type]) { error('unknown-view-type', { view: view.id, type: view.type }, `View "${view.id}" has unknown type ${JSON.stringify(view.type)}.`, [`Use one of: ${Object.keys(VIEW_TYPES).join(', ')}.`]); continue; }
    if (typeof view.title !== 'string' || !view.title.trim()) error('view-title', { view: view.id }, `View "${view.id}" needs a title.`, ['Add a non-empty title.']);
    if (view.type === 'sequence') {
      const participants = Array.isArray(view.participants) ? view.participants : [];
      if (participants.length < 2) error('sequence-participants', { view: view.id }, `Sequence view "${view.id}" needs at least two participants.`, ['List two or more element ids in participants.']);
      for (const ref of participants) {
        if (!elementIds.has(ref)) error('dangling-reference', { view: view.id, target: ref }, `View "${view.id}" participant "${ref}" is not an element.`, ['Use an existing element id.']);
        placedAnywhere.add(ref);
      }
      const messages = Array.isArray(view.messages) ? view.messages : [];
      if (!messages.length) error('sequence-messages', { view: view.id }, `Sequence view "${view.id}" needs at least one message.`, ['Add a message with from, to, and label.']);
      messages.forEach((message, index) => {
        for (const end of ['from', 'to']) {
          if (!participants.includes(message?.[end])) error('sequence-message-end', { view: view.id, index, end }, `View "${view.id}" message ${index} ${end} "${message?.[end]}" is not a participant.`, ['Add the element to participants or fix the id.']);
        }
        if (message?.kind !== undefined && !MESSAGE_KINDS.includes(message.kind)) error('sequence-message-kind', { view: view.id, index }, `View "${view.id}" message ${index} kind must be one of ${MESSAGE_KINDS.join(', ')}.`, ['Fix the message kind.']);
      });
      for (const fragment of view.fragments || []) {
        if (!(Number.isInteger(fragment?.from) && Number.isInteger(fragment?.to) && fragment.from >= 0 && fragment.to >= fragment.from && fragment.to < messages.length)) {
          error('sequence-fragment-range', { view: view.id, fragment: fragment?.label }, `View "${view.id}" fragment range must be message indexes within 0..${messages.length - 1}.`, ['Set from and to to existing message indexes.']);
        }
      }
      continue;
    }
    if (!GRID_VIEWS.includes(view.type)) continue;
    const nodes = Array.isArray(view.nodes) ? view.nodes : [];
    if (!nodes.length) error('view-empty', { view: view.id }, `View "${view.id}" places no nodes.`, ['Add nodes with ref, row, and col.']);
    const cells = new Map();
    const inView = new Set();
    for (const node of nodes) {
      if (!elementIds.has(node?.ref)) { error('dangling-reference', { view: view.id, target: node?.ref }, `View "${view.id}" places "${node?.ref}", which is not an element.`, ['Use an existing element id.']); continue; }
      if (inView.has(node.ref)) error('duplicate-placement', { view: view.id, element: node.ref }, `View "${view.id}" places "${node.ref}" twice.`, ['Place each element once per view.']);
      inView.add(node.ref);
      placedAnywhere.add(node.ref);
      if (!(Number.isFinite(node.row) && Number.isFinite(node.col) && node.row >= 0 && node.col >= 0)) {
        error('grid-cell', { view: view.id, element: node.ref }, `View "${view.id}" node "${node.ref}" needs non-negative numeric row and col.`, ['Set row and col to grid coordinates.']);
        continue;
      }
      const cell = `${node.row}:${node.col}`;
      if (cells.has(cell)) error('cell-collision', { view: view.id, cell, elements: [cells.get(cell), node.ref] }, `View "${view.id}" places "${cells.get(cell)}" and "${node.ref}" in the same cell (row ${node.row}, col ${node.col}).`, ['Move one node to a free cell.']);
      cells.set(cell, node.ref);
    }
    for (const group of view.groups || []) {
      if (!GROUP_KINDS.includes(group?.kind)) error('group-kind', { view: view.id, group: group?.label }, `View "${view.id}" group kind must be one of ${GROUP_KINDS.join(', ')}.`, ['Fix the group kind.']);
      const wraps = Array.isArray(group?.wraps) ? group.wraps : [];
      if (!wraps.length) error('group-empty', { view: view.id, group: group?.label }, `View "${view.id}" group "${group?.label}" wraps nothing.`, ['List placed element ids in wraps.']);
      for (const ref of wraps) if (!inView.has(ref)) error('group-member', { view: view.id, group: group?.label, target: ref }, `View "${view.id}" group "${group?.label}" wraps "${ref}", which is not placed in this view.`, ['Place the element in the view or remove it from wraps.']);
      if (group?.tone !== undefined && !TONES.includes(group.tone)) error('unknown-tone', { view: view.id, group: group?.label }, `View "${view.id}" group "${group?.label}" has an unknown tone.`, [`Use one of: ${TONES.join(', ')}.`]);
    }
    for (const key of ['relationships', 'exclude']) {
      for (const id of view[key] || []) if (!relIds.has(id)) error('dangling-reference', { view: view.id, target: id }, `View "${view.id}" ${key} lists "${id}", which is not a relationship.`, ['Use an existing relationship id.']);
    }
  }
  for (const id of elementIds) {
    if (!placedAnywhere.has(id)) warning('unplaced-element', { element: id }, `Element "${id}" does not appear in any view.`, ['Place it in a view or remove it from the model.']);
  }
  return { ok: !diagnostics.some((entry) => entry.severity === 'error'), diagnostics };
}

// Small naming helpers shared by the generators.
export const words = (text) => String(text).replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[^A-Za-z0-9]+/).filter(Boolean);
export const pascal = (text) => words(text).map((word) => word[0].toUpperCase() + word.slice(1)).join('') || 'Unnamed';
export const camel = (text) => { const name = pascal(text); return name[0].toLowerCase() + name.slice(1); };
export const snake = (text) => words(text).map((word) => word.toLowerCase()).join('_') || 'unnamed';
export const kebab = (text) => words(text).map((word) => word.toLowerCase()).join('-') || 'unnamed';
export const screaming = (text) => snake(text).toUpperCase();
