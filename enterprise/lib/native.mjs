// Compile enterprise views down to Archify's native typed JSON so the
// existing renderers, validators, Viewer, and delivery receipts apply.
//
//   class                               -> diagram_type "class"
//   sequence                            -> diagram_type "sequence"
//   state                               -> diagram_type "lifecycle" (schema 3)
//   archimate / component / deployment  -> diagram_type "architecture" (grid)
//
// Views with no native counterpart (bpmn, activity, usecase) return null; the
// enterprise renderer remains their only output.

import { RELATIONS, VIEW_TYPES, toneOf, kindSpec } from './notation.mjs';
import { indexModel, viewRelationships } from './model.mjs';

export const NATIVE_TYPES = { class: 'class', sequence: 'sequence', state: 'lifecycle', archimate: 'architecture', component: 'architecture', deployment: 'architecture' };

const meta = (model, view, extra = {}) => ({ title: view.title, subtitle: [model.meta?.title, view.viewpoint || VIEW_TYPES[view.type].label].filter(Boolean).join(' · '), output: `${view.id}.html`, ...extra });
const LABEL_DROP = 78;
const CLASS_KINDS = { entity: 'record' };
const CLASS_RELATIONS = { specialization: 'inheritance' };
const pick = (source, keys) => Object.fromEntries(keys.filter((key) => source[key] !== undefined).map((key) => [key, source[key]]));

function classView(model, view, elements) {
  const types = (view.nodes || []).map((node) => {
    const element = elements.get(node.ref);
    return {
      id: element.id, label: element.label, kind: CLASS_KINDS[element.kind] || element.kind, ...(element.doc ? { sublabel: element.doc } : {}),
      row: Math.round(node.row), col: Math.round(node.col * 2) / 2,
      ...(element.attributes?.length ? { attributes: element.attributes.map((item) => pick(item, ['name', 'type', 'visibility', 'static'])) } : {}),
      ...(element.methods?.length ? { methods: element.methods.map((item) => pick(item, ['name', 'parameters', 'returns', 'visibility', 'static', 'abstract'])) } : {}),
    };
  }).filter((type) => ['class', 'abstract', 'interface', 'enum', 'record'].includes(type.kind));
  const ids = new Set(types.map((type) => type.id));
  const relationships = viewRelationships(model, view).filter((rel) => ids.has(rel.from) && ids.has(rel.to) && rel.from !== rel.to)
    .map((rel) => ({ id: rel.id, from: rel.from, to: rel.to, kind: CLASS_RELATIONS[rel.kind] || rel.kind, ...(rel.label ? { label: rel.label } : {}) }))
    .filter((rel) => ['dependency', 'association', 'inheritance', 'realization', 'composition', 'aggregation'].includes(rel.kind));
  return { schema_version: 1, diagram_type: 'class', meta: meta(model, view), layout: { mode: 'grid' }, types, relationships };
}

function sequenceView(model, view, elements) {
  const participants = (view.participants || []).map((ref) => { const element = elements.get(ref); return { id: element.id, type: toneOf(element), label: element.label, sublabel: element.tech || kindSpec(element.kind).label }; });
  const VARIANTS = { sync: 'default', async: 'dashed', reply: 'return', self: 'default' };
  const step = 30;
  const messages = (view.messages || []).map((message, index) => ({ id: `m${index + 1}`, from: message.from, to: message.to, y: 170 + index * step, label: message.label || '…', variant: VARIANTS[message.kind || 'sync'] }))
    .filter((message) => message.from !== message.to);
  const last = 170 + (view.messages || []).length * step;
  return { schema_version: 1, diagram_type: 'sequence', meta: meta(model, view, { viewBox: [Math.max(480, participants.length * 190), Math.max(480, last + 90)], column_fit: 'spread' }), participants, messages };
}

function stateView(model, view, elements) {
  const rels = viewRelationships(model, view).filter((rel) => rel.kind === 'transition');
  const placed = (view.nodes || []).map((node) => elements.get(node.ref));
  const real = placed.filter((element) => element.kind !== 'initial');
  const entry = new Set(rels.filter((rel) => elements.get(rel.from).kind === 'initial').map((rel) => rel.to));
  const outgoing = new Map(real.map((element) => [element.id, rels.filter((rel) => rel.from === element.id && elements.get(rel.to).kind !== 'initial')]));
  const typeOf = (element) => {
    if (element.kind === 'final') return 'success';
    if (entry.has(element.id)) return 'start';
    if (element.kind === 'choice') return 'decision';
    if (!outgoing.get(element.id).length) return 'neutral';
    return 'active';
  };
  // The happy path is the longest simple path from the entry state.
  const start = real.find((element) => entry.has(element.id)) || real[0];
  let best = [];
  const walk = (id, trail) => {
    const next = outgoing.get(id).filter((rel) => !trail.includes(rel.to));
    if (trail.length > best.length) best = trail;
    for (const rel of next) walk(rel.to, [...trail, rel.to]);
  };
  walk(start.id, [start.id]);
  const states = real.map((element) => ({ id: element.id, type: typeOf(element), label: element.label || 'Done' }));
  const seen = new Set();
  const transitions = rels.filter((rel) => elements.get(rel.from).kind !== 'initial' && rel.from !== rel.to)
    .filter((rel) => { const key = `${rel.from}>${rel.to}`; if (seen.has(key)) return false; seen.add(key); return true; })
    .map((rel) => ({ id: rel.id, from: rel.from, to: rel.to, ...(rel.label ? { label: rel.label } : {}) }));
  return { schema_version: 3, diagram_type: 'lifecycle', meta: meta(model, view), mainPath: best, states, transitions };
}

function architectureView(model, view, elements) {
  const nodes = view.nodes || [];
  const scale = nodes.some((node) => !Number.isInteger(node.col)) ? 2 : 1;
  // Native cards are fixed-size, so size every card for the longest label.
  const width = Math.max(150, ...nodes.map((node) => Math.ceil(elements.get(node.ref).label.length * 7.4) + 34));
  const components = nodes.map((node) => { const element = elements.get(node.ref); return { id: element.id, type: toneOf(element), label: element.label, sublabel: element.tech || kindSpec(element.kind).label, row: Math.round(node.row), col: Math.round(node.col * scale), size: [width, 64] }; });
  const cell = new Map(components.map((component) => [component.id, component]));
  // A label on a vertical run is moved off the source card into the row gap.
  const labelShift = (rel) => { const from = cell.get(rel.from); const to = cell.get(rel.to); return from.col === to.col && from.row !== to.row ? { labelDy: Math.sign(to.row - from.row) * LABEL_DROP } : {}; };
  const connections = viewRelationships(model, view).filter((rel) => rel.from !== rel.to).map((rel) => ({ id: rel.id, from: rel.from, to: rel.to, ...(rel.label ? { label: rel.label, ...labelShift(rel) } : {}), ...(RELATIONS[rel.kind].dash === 'solid' ? {} : { variant: 'dashed' }) }));
  const boundaries = (view.groups || []).map((group) => ({ kind: 'region', label: group.label, wraps: group.wraps }));
  const layout = { mode: 'grid', cols: Math.max(...components.map((component) => component.col)) + 1, cellW: width, cellH: 64, gapX: 150, gapY: 110 };
  return { schema_version: 1, diagram_type: 'architecture', meta: meta(model, view), layout, components, ...(boundaries.length ? { boundaries } : {}), connections };
}

export function compileView(model, viewId) {
  const { elements, views } = indexModel(model);
  const view = views.get(viewId);
  if (!view) throw new Error(`Unknown view "${viewId}"`);
  const type = NATIVE_TYPES[view.type];
  if (!type) return null;
  const diagram = { class: classView, sequence: sequenceView, lifecycle: stateView, architecture: architectureView }[type](model, view, elements);
  return { type, path: `archify/${view.id}.${type}.json`, diagram };
}

export function compileNative(model) {
  return (model.views || []).map((view) => compileView(model, view.id)).filter(Boolean);
}
