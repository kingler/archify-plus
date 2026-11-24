// Deterministic layout for enterprise views. Authors place nodes on a row/col
// grid (the same authored-grid contract as Archify's native renderers); this
// module sizes nodes from their text, positions bands and groups, and routes
// relationships orthogonally around the placed nodes.

import { KINDS, toneOf } from './notation.mjs';
import { indexModel, viewRelationships } from './model.mjs';

export const FONT = { label: 12, caption: 9.5, member: 10.5, edge: 9.5, title: 15 };
const MARGIN = 36;
const TITLE_H = 46;
const LANE_STRIP = 26;

// JetBrains Mono advances 0.6em per Latin glyph; wide scripts take a full em.
export function textWidth(text, size) {
  let units = 0;
  for (const char of String(text)) units += char.codePointAt(0) > 0x2e7f ? 1 : 0.6;
  return units * size;
}

export function wrapText(text, maxWidth, size, maxLines = 3) {
  const out = [];
  let line = '';
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (!line || textWidth(next, size) <= maxWidth) line = next;
    else { out.push(line); line = word; }
  }
  if (line) out.push(line);
  if (out.length > maxLines) {
    const kept = out.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1].replace(/.$/, '')}…`;
    return kept;
  }
  return out.length ? out : [''];
}

export function clip(text, maxWidth, size) {
  const value = String(text);
  if (textWidth(value, size) <= maxWidth) return value;
  let out = '';
  for (const char of value) {
    if (textWidth(`${out}${char}…`, size) > maxWidth) break;
    out += char;
  }
  return `${out}…`;
}

const VISIBILITY = { public: '+', protected: '#', package: '~', private: '-' };
export function attributeText(attribute) {
  const marks = `${attribute.pk ? ' {pk}' : ''}${attribute.unique ? ' {unique}' : ''}`;
  return `${VISIBILITY[attribute.visibility] || '+'} ${attribute.name}${attribute.type ? `: ${attribute.type}` : ''}${marks}`;
}
export function methodText(method) {
  return `${VISIBILITY[method.visibility] || '+'} ${method.name}(${method.parameters || ''})${method.returns ? `: ${method.returns}` : ''}`;
}

function measureNode(element, placement) {
  const spec = KINDS[element.kind];
  const shape = spec.shape;
  const node = { id: element.id, element, kind: element.kind, spec, shape, tone: toneOf(element), below: 0, lines: [], caption: element.sublabel || element.tech || '' };
  if (shape === 'classifier') {
    const attributes = (element.attributes || []).map((attribute) => (element.kind === 'enum' ? attribute.name : attributeText(attribute)));
    const methods = (element.methods || []).map(methodText);
    const widest = Math.max(textWidth(element.label, FONT.label) + 28, ...[...attributes, ...methods].map((text) => textWidth(text, FONT.member) + 22), spec.stereotype ? textWidth(`«${spec.stereotype}»`, FONT.caption) + 28 : 0);
    node.w = Math.min(320, Math.max(168, Math.ceil(widest)));
    node.headerH = spec.stereotype ? 40 : 30;
    node.attributes = attributes.map((text) => clip(text, node.w - 20, FONT.member));
    node.methods = methods.map((text) => clip(text, node.w - 20, FONT.member));
    const compartment = (rows) => (rows.length ? rows.length * 15 + 9 : 0);
    node.attrH = compartment(node.attributes);
    node.methH = compartment(node.methods);
    node.h = node.headerH + node.attrH + node.methH + (node.attrH + node.methH ? 0 : 8);
    node.lines = [element.label];
  } else if (shape === 'event') {
    node.w = 36; node.h = 36;
    node.lines = element.kind === 'initial' || element.kind === 'final' ? [] : wrapText(element.label, 116, FONT.caption + 0.5, 2);
    node.below = node.lines.length * 12 + (node.lines.length ? 5 : 0);
  } else if (shape === 'gateway') {
    node.w = 44; node.h = 44;
    node.lines = wrapText(element.label, 116, FONT.caption + 0.5, 2);
    node.below = node.lines.length * 12 + 5;
  } else if (shape === 'bar') {
    const horizontal = placement.orient === 'h';
    node.w = horizontal ? 104 : 8; node.h = horizontal ? 8 : 72;
  } else if (shape === 'actor') {
    node.w = 36; node.h = 54;
    node.lines = wrapText(element.label, 116, FONT.label, 2);
    node.below = node.lines.length * 14 + 4;
  } else {
    const maxW = shape === 'ellipse' ? 150 : 148;
    node.lines = wrapText(element.label, maxW, FONT.label, 3);
    const textW = Math.max(...node.lines.map((line) => textWidth(line, FONT.label)), node.caption ? Math.min(150, textWidth(node.caption, FONT.caption)) : 0);
    const marked = spec.glyph !== 'none' || (element.kind === 'task' && element.taskType);
    const pad = shape === 'ellipse' ? 52 : marked ? 58 : 40;
    node.w = Math.max(132, Math.ceil(textW + pad));
    node.caption = node.caption ? clip(node.caption, node.w - 24, FONT.caption) : '';
    node.h = Math.max(56, 28 + node.lines.length * 15 + (node.caption ? 14 : 0) + (shape === 'node3d' ? 6 : 0) + (shape === 'ellipse' && marked ? 14 : 0));
  }
  if (Number.isFinite(placement.w)) node.w = placement.w;
  if (Number.isFinite(placement.h)) node.h = placement.h;
  return node;
}

function bands(nodes, axis, size, extra, gap, start) {
  const key = axis === 'x' ? 'col' : 'row';
  const count = Math.max(0, ...nodes.map((node) => Math.ceil(node[key]))) + 1;
  const sizes = Array.from({ length: count }, () => 0);
  for (const node of nodes) {
    if (Number.isInteger(node[key])) sizes[node[key]] = Math.max(sizes[node[key]], node[size] + 2 * (extra ? node.below : 0));
  }
  const out = [];
  let cursor = start;
  for (let index = 0; index < count; index += 1) {
    const length = sizes[index] || (axis === 'x' ? 56 : 28);
    out.push({ start: cursor, end: cursor + length, mid: cursor + length / 2 });
    cursor += length + gap;
  }
  return out;
}

const lerp = (a, b, t) => a + (b - a) * t;
function bandPosition(list, value) {
  const low = Math.floor(value);
  if (low === value) return list[low];
  const high = list[Math.min(list.length - 1, low + 1)];
  const mid = lerp(list[low].mid, high.mid, value - low);
  return { start: null, end: null, mid };
}

// ---- Routing --------------------------------------------------------------

const fixedPort = (node) => node.shape === 'event' || node.shape === 'gateway';

function hits(points, obstacles, skip) {
  let count = 0;
  for (const rect of obstacles) {
    if (skip.has(rect.id)) continue;
    const x0 = rect.x - 5; const x1 = rect.x + rect.w + 5; const y0 = rect.y - 5; const y1 = rect.y + rect.h + rect.below + 5;
    for (let index = 0; index < points.length - 1; index += 1) {
      const [ax, ay] = points[index]; const [bx, by] = points[index + 1];
      if (Math.max(ax, bx) > x0 && Math.min(ax, bx) < x1 && Math.max(ay, by) > y0 && Math.min(ay, by) < y1) { count += 1; break; }
    }
  }
  return count;
}

function buildPoints(route, a, b) {
  const pa = portPoint(a, route.fromSide, route.fromOffset || 0);
  const pb = portPoint(b, route.toSide, route.toOffset || 0);
  const points = [pa];
  if (route.shape === 'HVH') points.push([route.channel, pa[1]], [route.channel, pb[1]]);
  else if (route.shape === 'VHV') points.push([pa[0], route.channel], [pb[0], route.channel]);
  else if (route.shape === 'HV') points.push([pb[0], pa[1]]);
  else if (route.shape === 'VH') points.push([pa[0], pb[1]]);
  points.push(pb);
  return simplify(points);
}

function simplify(points) {
  const out = [];
  for (const point of points) {
    const last = out[out.length - 1];
    if (last && Math.abs(last[0] - point[0]) < 0.5 && Math.abs(last[1] - point[1]) < 0.5) continue;
    if (out.length >= 2) {
      const prev = out[out.length - 2];
      const collinear = (Math.abs(prev[0] - last[0]) < 0.5 && Math.abs(last[0] - point[0]) < 0.5) || (Math.abs(prev[1] - last[1]) < 0.5 && Math.abs(last[1] - point[1]) < 0.5);
      if (collinear) out.pop();
    }
    out.push(point);
  }
  return out;
}

function portPoint(node, side, offset) {
  if (side === 'left') return [node.x, node.cy + offset];
  if (side === 'right') return [node.x + node.w, node.cy + offset];
  if (side === 'top') return [node.cx + offset, node.y];
  return [node.cx + offset, node.y + node.h];
}

function candidates(a, b, gapX, gapY) {
  const dx = b.cx - a.cx; const dy = b.cy - a.cy;
  const sameRow = Math.abs(dy) < 2; const sameCol = Math.abs(dx) < 2;
  const out = [];
  const h = dx >= 0 ? ['right', 'left'] : ['left', 'right'];
  const v = dy >= 0 ? ['bottom', 'top'] : ['top', 'bottom'];
  if (!sameCol) {
    const nearA = dx >= 0 ? a.cell.x1 + gapX / 2 : a.cell.x0 - gapX / 2;
    const nearB = dx >= 0 ? b.cell.x0 - gapX / 2 : b.cell.x1 + gapX / 2;
    for (const channel of new Set([nearA, nearB])) out.push({ shape: 'HVH', fromSide: h[0], toSide: h[1], channel, bends: sameRow ? 0 : 2 });
  }
  if (!sameRow) {
    const nearA = dy >= 0 ? a.cell.y1 + gapY / 2 : a.cell.y0 - gapY / 2;
    const nearB = dy >= 0 ? b.cell.y0 - gapY / 2 : b.cell.y1 + gapY / 2;
    for (const channel of new Set([nearA, nearB])) out.push({ shape: 'VHV', fromSide: v[0], toSide: v[1], channel, bends: sameCol ? 0 : 2 });
  }
  if (!sameRow && !sameCol) {
    out.push({ shape: 'HV', fromSide: h[0], toSide: v[1], bends: 1 });
    out.push({ shape: 'VH', fromSide: v[0], toSide: h[1], bends: 1 });
  }
  // Detours that leave and re-enter on the same side: loops back along a row
  // or column, and the escape hatch when the direct corridor is occupied.
  const top = Math.min(a.cell.y0, b.cell.y0) - gapY / 2; const bottom = Math.max(a.cell.y1, b.cell.y1) + gapY / 2;
  const left = Math.min(a.cell.x0, b.cell.x0) - gapX / 2; const right = Math.max(a.cell.x1, b.cell.x1) + gapX / 2;
  if (!sameCol) {
    out.push({ shape: 'VHV', fromSide: 'top', toSide: 'top', channel: top, bends: 2, detour: true });
    out.push({ shape: 'VHV', fromSide: 'bottom', toSide: 'bottom', channel: bottom, bends: 2, detour: true });
  }
  if (!sameRow) {
    out.push({ shape: 'HVH', fromSide: 'left', toSide: 'left', channel: left, bends: 2, detour: true });
    out.push({ shape: 'HVH', fromSide: 'right', toSide: 'right', channel: right, bends: 2, detour: true });
  }
  return out;
}

const VERTICAL_KINDS = new Set(['inheritance', 'specialization', 'realization']);
const FLOW_VIEWS = new Set(['bpmn', 'activity', 'state']);

function routeEdges(view, nodes, rels, gapX, gapY) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const authored = view.routes || {};
  const edges = [];
  const loops = [];
  const usedPairs = new Map();
  for (const rel of rels) {
    const a = byId.get(rel.from); const b = byId.get(rel.to);
    if (!a || !b) continue;
    if (a === b) {
      // A self-relationship leaves the right side and re-enters the top.
      const nth = loops.filter((loop) => loop.from === a.id).length;
      const reach = 22 + nth * 10; const inset = Math.min(a.w / 2 - 4, 14 + nth * 10);
      const y = a.cy - Math.min(a.h / 2 - 4, 8 + nth * 8); const x = a.x + a.w - inset;
      loops.push({ id: rel.id, rel, from: a.id, to: a.id, points: [[a.x + a.w, y], [a.x + a.w + reach, y], [a.x + a.w + reach, a.y - reach + 4], [x, a.y - reach + 4], [x, a.y]] });
      continue;
    }
    const skip = new Set([a.id, b.id]);
    const choose = (want) => {
     let best = null;
     for (const option of candidates(a, b, gapX, gapY)) {
      if ((want.fromSide && want.fromSide !== option.fromSide) || (want.toSide && want.toSide !== option.toSide)) continue;
      const points = buildPoints(option, a, b);
      const length = points.slice(1).reduce((sum, point, index) => sum + Math.abs(point[0] - points[index][0]) + Math.abs(point[1] - points[index][1]), 0);
      const vertical = option.fromSide === 'top' || option.fromSide === 'bottom';
      let bias = 0;
      if (VERTICAL_KINDS.has(rel.kind) && !(vertical && (option.toSide === 'top' || option.toSide === 'bottom'))) bias += 12;
      if (FLOW_VIEWS.has(view.type) && vertical && !VERTICAL_KINDS.has(rel.kind)) bias += 1.5;
      // A branch leaving a gateway for another row departs from its own vertex.
      if (fixedPort(a) && !vertical && Math.abs(b.cy - a.cy) > 2) bias += 12;
      if (fixedPort(b) && (option.toSide === 'left' || option.toSide === 'right') && Math.abs(b.cy - a.cy) > 2) bias += 12;
      if (!FLOW_VIEWS.has(view.type) && !vertical && option.bends) bias += 1.5;
      // A reverse edge between the same pair takes a different corridor.
      const pairKey = [a.id, b.id].sort().join('|');
      if (usedPairs.get(pairKey) === `${option.shape}:${[option.fromSide, option.toSide].sort().join()}` && option.bends) bias += 4;
      const score = hits(points, nodes, skip) * 1000 + option.bends * 10 + (option.detour ? 14 : 0) + bias + length / 100;
      if (!best || score < best.score) best = { ...option, score };
     }
     return best;
    };
    // Authored sides that no route can honour must not make the relationship vanish.
    const best = choose(authored[rel.id] || {}) || choose({});
    usedPairs.set([a.id, b.id].sort().join('|'), `${best.shape}:${[best.fromSide, best.toSide].sort().join()}`);
    edges.push({ id: rel.id, rel, a, b, route: best });
  }

  // Spread ports along each node side, ordered by where the far end sits.
  const sides = new Map();
  const claim = (edge, end) => {
    const node = end === 'from' ? edge.a : edge.b; const other = end === 'from' ? edge.b : edge.a;
    const side = edge.route[`${end}Side`];
    const key = `${node.id}:${side}`;
    const far = side === 'left' || side === 'right' ? other.cy : other.cx;
    if (!sides.has(key)) sides.set(key, { node, side, items: [] });
    sides.get(key).items.push({ edge, end, far });
  };
  for (const edge of edges) { claim(edge, 'from'); claim(edge, 'to'); }
  for (const { node, side, items } of sides.values()) {
    items.sort((p, q) => p.far - q.far);
    const length = side === 'left' || side === 'right' ? node.h : node.w;
    const step = fixedPort(node) ? 0 : Math.min(18, (length - Math.min(20, length / 3)) / items.length);
    items.forEach((item, index) => { item.edge.route[`${item.end}Offset`] = (index - (items.length - 1) / 2) * step; });
  }

  // Straighten near-aligned direct runs, then separate parallel channels.
  for (const edge of edges) {
    const { route, a, b } = edge;
    if (route.detour || (route.shape !== 'HVH' && route.shape !== 'VHV')) continue;
    const axis = route.shape === 'HVH' ? 'cy' : 'cx'; const span = route.shape === 'HVH' ? 'h' : 'w';
    const pa = a[axis] + route.fromOffset; const pb = b[axis] + route.toOffset;
    if (Math.abs(pa - pb) > 22 || Math.abs(pa - pb) < 0.5) continue;
    if (!fixedPort(b) && Math.abs(pa - b[axis]) < b[span] / 2 - 5) route.toOffset = pa - b[axis];
    else if (!fixedPort(a) && Math.abs(pb - a[axis]) < a[span] / 2 - 5) route.fromOffset = pb - a[axis];
  }
  const channels = new Map();
  for (const edge of edges) {
    if (edge.route.channel === undefined) continue;
    const key = `${edge.route.shape}:${Math.round(edge.route.channel)}`;
    channels.set(key, [...(channels.get(key) || []), edge]);
  }
  for (const group of channels.values()) {
    const distinct = group;
    const lanes = [];
    for (const edge of distinct) {
      const points = buildPoints(edge.route, edge.a, edge.b);
      if (points.length < 4) continue;
      const horizontal = edge.route.shape === 'VHV';
      const lo = Math.min(points[1][horizontal ? 0 : 1], points[2][horizontal ? 0 : 1]);
      const hi = Math.max(points[1][horizontal ? 0 : 1], points[2][horizontal ? 0 : 1]);
      let lane = lanes.findIndex((spans) => spans.every((span) => span.hi < lo - 4 || span.lo > hi + 4 || span.shared === edge.a.id || span.shared === edge.b.id));
      if (lane < 0) { lane = lanes.length; lanes.push([]); }
      lanes[lane].push({ lo, hi, shared: VERTICAL_KINDS.has(edge.rel.kind) ? edge.b.id : null });
      edge.lane = lane;
    }
    for (const edge of distinct) if (edge.lane !== undefined) edge.route.channel += (edge.lane - (lanes.length - 1) / 2) * 9;
  }
  return [...edges.map((edge) => ({ id: edge.id, rel: edge.rel, from: edge.a.id, to: edge.b.id, points: buildPoints(edge.route, edge.a, edge.b) })), ...loops];
}

function edgeLabelText(rel) {
  const parts = [];
  if (rel.kind === 'include' || rel.kind === 'extend' || rel.kind === 'deployment') parts.push(`«${rel.kind === 'deployment' ? 'deploy' : rel.kind}»`);
  if (rel.label) parts.push(rel.label);
  else if (rel.guard) parts.push(`[${rel.guard}]`);
  return parts.join(' ');
}

function placeLabels(edges, nodes) {
  const taken = [];
  for (const edge of edges) {
    const text = edgeLabelText(edge.rel);
    if (!text) continue;
    const w = textWidth(text, FONT.edge) + 10; const h = 15;
    const segments = edge.points.slice(1).map((point, index) => ({ a: edge.points[index], b: point, length: Math.abs(point[0] - edge.points[index][0]) + Math.abs(point[1] - edge.points[index][1]) }))
      .sort((p, q) => q.length - p.length);
    let best = null;
    for (const segment of segments) {
      for (const t of [0.5, 0.32, 0.68]) {
        const cx = lerp(segment.a[0], segment.b[0], t); const cy = lerp(segment.a[1], segment.b[1], t);
        const box = { x: cx - w / 2, y: cy - h / 2, w, h };
        const clash = [...nodes.map((node) => ({ x: node.x, y: node.y, w: node.w, h: node.h + node.below })), ...taken]
          .filter((rect) => box.x < rect.x + rect.w + 2 && box.x + box.w > rect.x - 2 && box.y < rect.y + rect.h + 2 && box.y + box.h > rect.y - 2).length;
        const score = clash * 100 + (segment.length < w + 12 ? 20 : 0) + Math.abs(t - 0.5);
        if (!best || score < best.score) best = { score, box };
      }
    }
    edge.label = { text, ...best.box };
    taken.push(best.box);
  }
}

// ---- Grid views -----------------------------------------------------------

function layoutGrid(model, view) {
  const { elements } = indexModel(model);
  const gapX = view.layout?.gapX ?? (view.type === 'class' ? 96 : 72);
  const gapY = view.layout?.gapY ?? 68;
  const lanes = (view.groups || []).filter((group) => group.kind === 'lane' || group.kind === 'pool');
  const nodes = (view.nodes || []).filter((placement) => elements.has(placement.ref))
    .map((placement) => ({ ...measureNode(elements.get(placement.ref), placement), row: placement.row, col: placement.col }));
  const left = MARGIN + (lanes.length ? LANE_STRIP + 14 : 0);
  const cols = bands(nodes, 'x', 'w', false, gapX, left);
  const framed = (view.groups || []).some((group) => !lanes.includes(group));
  const rows = bands(nodes, 'y', 'h', true, gapY, MARGIN + TITLE_H + (lanes.length ? 8 : 0) + (framed ? 44 : 0));
  for (const node of nodes) {
    const col = bandPosition(cols, node.col); const row = bandPosition(rows, node.row);
    node.cx = col.mid; node.cy = row.mid;
    node.x = node.cx - node.w / 2; node.y = node.cy - node.h / 2;
    node.cell = {
      x0: col.start ?? node.x, x1: col.end ?? node.x + node.w,
      y0: row.start ?? node.y, y1: row.end ?? node.y + node.h + node.below,
    };
  }
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const right = cols[cols.length - 1].end;
  const groups = [];
  const others = (view.groups || []).filter((group) => !lanes.includes(group));
  for (const group of view.groups || []) {
    const members = (group.wraps || []).map((ref) => byId.get(ref)).filter(Boolean);
    if (!members.length) continue;
    if (lanes.includes(group)) {
      const y0 = Math.min(...members.map((node) => node.cell.y0)) - gapY / 2 + 4;
      const y1 = Math.max(...members.map((node) => node.cell.y1)) + gapY / 2 - 4;
      groups.push({ ...group, x: MARGIN, y: y0, w: right - MARGIN + 18, h: y1 - y0, strip: LANE_STRIP });
    } else {
      const nested = others.filter((other) => other !== group && (other.wraps || []).length < (group.wraps || []).length && (other.wraps || []).every((ref) => (group.wraps || []).includes(ref))).length;
      const pad = 14 + nested * 12;
      const x0 = Math.min(...members.map((node) => node.x)) - pad; const x1 = Math.max(...members.map((node) => node.x + node.w)) + pad;
      const y0 = Math.min(...members.map((node) => node.y)) - pad - 16; const y1 = Math.max(...members.map((node) => node.y + node.h + node.below)) + pad;
      groups.push({ ...group, x: x0, y: y0, w: x1 - x0, h: y1 - y0, depth: nested });
    }
  }
  groups.sort((p, q) => q.w * q.h - p.w * p.h);
  const edges = routeEdges(view, nodes, viewRelationships(model, view), gapX, gapY);
  placeLabels(edges, nodes);
  const extents = [
    ...nodes.map((node) => {
      const half = node.below ? Math.max(node.w / 2, ...node.lines.map((line) => textWidth(line, FONT.label) / 2)) : node.w / 2;
      return [node.cx - half, node.y, node.cx + half, node.y + node.h + node.below];
    }),
    ...groups.map((group) => [group.x, group.y, group.x + group.w, group.y + group.h]),
    ...edges.flatMap((edge) => [...edge.points.map(([x, y]) => [x - 8, y - 8, x + 8, y + 8]), ...(edge.label ? [[edge.label.x, edge.label.y, edge.label.x + edge.label.w, edge.label.y + edge.label.h]] : [])]),
  ];
  const minX = Math.min(MARGIN, ...extents.map((rect) => rect[0] - 12));
  const minY = Math.min(0, ...extents.map((rect) => rect[1] - 12));
  const width = Math.max(520, ...extents.map((rect) => rect[2])) + MARGIN - Math.min(0, minX);
  const height = Math.max(...extents.map((rect) => rect[3])) + MARGIN - minY;
  return { kind: 'grid', width, height, shiftX: minX < 0 ? -minX : 0, shiftY: minY < 0 ? -minY : 0, nodes, groups, edges };
}

// ---- Sequence views -------------------------------------------------------

function layoutSequence(model, view) {
  const { elements } = indexModel(model);
  const participants = (view.participants || []).filter((ref) => elements.has(ref)).map((ref) => {
    const element = elements.get(ref);
    const lines = wrapText(element.label, 120, FONT.label, 2);
    return { id: ref, element, kind: element.kind, spec: KINDS[element.kind], tone: toneOf(element), lines, w: 140, h: 46 };
  });
  const longest = Math.max(0, ...(view.messages || []).map((message) => textWidth(message.label || '', FONT.edge)));
  const pitch = Math.max(172, Math.min(260, longest + 44));
  const top = MARGIN + TITLE_H;
  participants.forEach((participant, index) => { participant.cx = MARGIN + 70 + index * pitch; participant.x = participant.cx - 70; participant.y = top; participant.cy = top + 23; });
  const byId = new Map(participants.map((participant) => [participant.id, participant]));
  let y = top + 46 + 36;
  const messages = [];
  const open = [];
  const activations = [];
  (view.messages || []).forEach((message, index) => {
    const a = byId.get(message.from); const b = byId.get(message.to);
    if (!a || !b) return;
    const kind = message.kind || (message.from === message.to ? 'self' : 'sync');
    if ((view.fragments || []).some((fragment) => fragment.from === index)) y += 22;
    const entry = { index, kind, label: message.label || '', from: a.id, to: b.id, x1: a.cx, x2: b.cx, y };
    if (kind === 'sync' && a !== b) open.push({ participant: b.id, caller: a.id, from: y });
    if (kind === 'reply') {
      const at = open.map((item) => item.participant === a.id && item.caller === b.id).lastIndexOf(true);
      if (at >= 0) { const [done] = open.splice(at, 1); activations.push({ participant: done.participant, from: done.from, to: y }); }
    }
    messages.push(entry);
    y += kind === 'self' ? 46 : 36;
  });
  for (const item of open) activations.push({ participant: item.participant, from: item.from, to: y - 18 });
  const fragments = (view.fragments || []).map((fragment) => {
    const inside = messages.filter((message) => message.index >= fragment.from && message.index <= fragment.to);
    if (!inside.length) return null;
    const xs = inside.flatMap((message) => [message.x1, message.x2]);
    return { ...fragment, x: Math.min(...xs) - 58, y: inside[0].y - 42, w: Math.max(...xs) - Math.min(...xs) + 116 + (inside.some((message) => message.kind === 'self') ? 40 : 0), h: inside[inside.length - 1].y - inside[0].y + 58 + (inside[inside.length - 1].kind === 'self' ? 12 : 0) };
  }).filter(Boolean);
  const bottom = y + 6;
  const extentRight = Math.max(...participants.map((participant) => participant.x + participant.w), ...fragments.map((fragment) => fragment.x + fragment.w), ...messages.filter((message) => message.kind === 'self').map((message) => message.x1 + 46 + textWidth(message.label, FONT.edge)));
  const extentLeft = Math.min(MARGIN, ...fragments.map((fragment) => fragment.x - 10));
  return { kind: 'sequence', width: extentRight + MARGIN - Math.min(0, extentLeft - 0), height: bottom + MARGIN, shiftX: extentLeft < 10 ? 10 - extentLeft : 0, shiftY: 0, participants, messages, activations, fragments, lifelineBottom: bottom };
}

export function layoutView(model, view) {
  return view.type === 'sequence' ? layoutSequence(model, view) : layoutGrid(model, view);
}
