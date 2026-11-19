// SVG renderer for enterprise views. Output is a self-contained string: theme
// tokens, notation styles, and markers travel inside the SVG, so the same
// markup works in the Studio, in Node, and as an exported file.

import { RELATIONS, VIEW_TYPES, GLYPHS, TASK_GLYPHS, EVENT_GLYPHS, TONES, themeCss } from './notation.mjs';
import { layoutView, textWidth, FONT } from './layout.mjs';

export const esc = (value) => String(value).replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
const n = (value) => Math.round(value * 100) / 100;
const MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

export function svgStyles() {
  return `${themeCss('.ea-svg')}
.ea-svg{font-family:${MONO};background:var(--bg);color:var(--text)}
${TONES.map((tone) => `.ea-svg .t-${tone}{--tone:var(--${tone}-stroke)}`).join('\n')}
.ea-svg .ea-shape{fill:color-mix(in srgb,var(--tone) 13%,var(--mask));stroke:color-mix(in srgb,var(--tone) 72%,var(--mask));stroke-width:1.25}
.ea-svg .ea-rule{stroke:color-mix(in srgb,var(--tone) 50%,var(--mask));stroke-width:1;fill:none}
.ea-svg .ea-head{fill:color-mix(in srgb,var(--tone) 24%,var(--mask));stroke:none}
.ea-svg .ea-glyph{fill:none;stroke:var(--tone);stroke-width:1.15;stroke-linecap:round;stroke-linejoin:round}
.ea-svg .ea-ink{fill:var(--text);stroke:none}
.ea-svg .ea-label{fill:var(--text);font-size:${FONT.label}px;font-weight:600}
.ea-svg .ea-cap{fill:var(--text-muted);font-size:${FONT.caption}px}
.ea-svg .ea-member{fill:var(--text);font-size:${FONT.member}px}
.ea-svg .ea-italic{font-style:italic}
.ea-svg .ea-static{text-decoration:underline}
.ea-svg .ea-title{fill:var(--text);font-size:${FONT.title}px;font-weight:700;letter-spacing:-.02em}
.ea-svg .ea-kicker{fill:var(--text-muted);font-size:9px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}
.ea-svg .ea-edge{color:var(--arrow)}
.ea-svg .ea-line{fill:none;stroke:currentColor;stroke-width:1.3;stroke-linejoin:round}
.ea-svg .ea-hit{fill:none;stroke:transparent;stroke-width:12}
.ea-svg .ea-dashed{stroke-dasharray:6 4}
.ea-svg .ea-dotted{stroke-dasharray:1.5 4;stroke-linecap:round}
.ea-svg .ea-mark{stroke:currentColor;stroke-width:1.3;stroke-linejoin:round}
.ea-svg .ea-mark-open{fill:none}
.ea-svg .ea-mark-solid{fill:currentColor}
.ea-svg .ea-mark-hollow{fill:var(--bg)}
.ea-svg .ea-edge-label rect{fill:var(--mask);stroke:var(--lane-stroke);stroke-width:.75}
.ea-svg .ea-edge-label text,.ea-svg .ea-mult{fill:var(--text-muted);font-size:${FONT.edge}px}
.ea-svg .ea-group{fill:color-mix(in srgb,var(--tone,var(--lane-stroke)) 5%,transparent);stroke:color-mix(in srgb,var(--tone,var(--lane-stroke)) 42%,var(--lane-stroke));stroke-width:1}
.ea-svg .ea-group-dashed{stroke-dasharray:5 4}
.ea-svg .ea-strip{fill:color-mix(in srgb,var(--tone,var(--lane-stroke)) 16%,var(--mask));stroke:none}
.ea-svg .ea-group-label{fill:color-mix(in srgb,var(--tone,var(--text-muted)) 70%,var(--text));font-size:9px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}
.ea-svg .ea-lifeline{stroke:var(--lane-stroke);stroke-width:1;stroke-dasharray:4 4}
.ea-svg .ea-activation{fill:color-mix(in srgb,var(--tone) 26%,var(--mask));stroke:color-mix(in srgb,var(--tone) 72%,var(--mask));stroke-width:1}
.ea-svg .ea-fragment{fill:none;stroke:var(--lane-stroke);stroke-width:1}
.ea-svg .ea-fragment-tab{fill:var(--mask);stroke:var(--lane-stroke);stroke-width:1}
.ea-svg .ea-node,.ea-svg .ea-edge{cursor:pointer}
.ea-svg .ea-node:focus{outline:none}
.ea-svg .ea-node:focus-visible .ea-shape,.ea-svg .ea-node.is-selected .ea-shape{stroke:var(--focus);stroke-width:2}
.ea-svg .ea-edge.is-selected,.ea-svg .ea-edge.is-linked{color:var(--focus)}
.ea-svg .ea-edge.is-selected .ea-line{stroke-width:2}
.ea-svg.has-focus .ea-node:not(.is-selected):not(.is-linked),.ea-svg.has-focus .ea-edge:not(.is-selected):not(.is-linked){opacity:.28}
.ea-svg .ea-token{fill:var(--focus);stroke:var(--bg);stroke-width:2}
.ea-svg .ea-node.is-enabled .ea-shape{stroke:var(--focus);stroke-width:2;stroke-dasharray:3 3}
@media (prefers-reduced-motion:no-preference){.ea-svg .ea-node,.ea-svg .ea-edge{transition:opacity .16s ease}}`;
}

function glyph(name, x, y) {
  return GLYPHS[name] ? `<path class="ea-glyph" transform="translate(${n(x)} ${n(y)})" d="${GLYPHS[name]}"/>` : '';
}

function drawNode(node) {
  const { x, y, w, h, cx, cy, shape, element, spec } = node;
  const parts = [];
  let labelY = cy;
  if (shape === 'box') parts.push(`<rect class="ea-shape" x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="3"/>`);
  else if (shape === 'round') parts.push(`<rect class="ea-shape" x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="12"/>`);
  else if (shape === 'sheet') parts.push(`<rect class="ea-shape" x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="3"/><path class="ea-rule" d="M${n(x)} ${n(y + 10)}H${n(x + w)}"/>`);
  else if (shape === 'chamfer') {
    const c = 9;
    parts.push(`<path class="ea-shape" d="M${n(x + c)} ${n(y)}H${n(x + w - c)}L${n(x + w)} ${n(y + c)}V${n(y + h - c)}L${n(x + w - c)} ${n(y + h)}H${n(x + c)}L${n(x)} ${n(y + h - c)}V${n(y + c)}Z"/>`);
  } else if (shape === 'node3d') {
    const d = 7;
    parts.push(`<path class="ea-shape" d="M${n(x)} ${n(y + d)}L${n(x + d)} ${n(y)}H${n(x + w)}V${n(y + h - d)}L${n(x + w - d)} ${n(y + h)}H${n(x)}Z"/><path class="ea-rule" d="M${n(x)} ${n(y + d)}H${n(x + w - d)}V${n(y + h)}M${n(x + w - d)} ${n(y + d)}L${n(x + w)} ${n(y)}"/>`);
    labelY = cy + d / 2;
  } else if (shape === 'ellipse') {
    if (spec.glyph !== 'none') labelY = cy + 6;
    parts.push(`<ellipse class="ea-shape" cx="${n(cx)}" cy="${n(cy)}" rx="${n(w / 2)}" ry="${n(h / 2)}"/>`);
  }
  else if (shape === 'note') parts.push(`<path class="ea-shape" d="M${n(x)} ${n(y)}H${n(x + w - 12)}L${n(x + w)} ${n(y + 12)}V${n(y + h)}H${n(x)}Z"/><path class="ea-rule" d="M${n(x + w - 12)} ${n(y)}V${n(y + 12)}H${n(x + w)}"/>`);
  else if (shape === 'bar') parts.push(`<rect class="ea-ink" x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="2"/><rect class="ea-shape" x="${n(x - 3)}" y="${n(y - 3)}" width="${n(w + 6)}" height="${n(h + 6)}" rx="4" fill-opacity="0" style="fill:transparent;stroke:transparent"/>`);
  else if (shape === 'event') {
    const radius = w / 2;
    if (spec.fill === 'solid') parts.push(`<circle class="ea-shape" cx="${n(cx)}" cy="${n(cy)}" r="${n(radius - 5)}" style="fill:var(--text);stroke:var(--text)"/>`);
    else if (spec.fill === 'bullseye') parts.push(`<circle class="ea-shape" cx="${n(cx)}" cy="${n(cy)}" r="${n(radius - 3)}" style="fill:var(--mask);stroke:var(--text)"/><circle class="ea-ink" cx="${n(cx)}" cy="${n(cy)}" r="${n(radius - 8)}"/>`);
    else {
      parts.push(`<circle class="ea-shape" cx="${n(cx)}" cy="${n(cy)}" r="${n(radius)}"${spec.ring === 'thick' ? ' style="stroke-width:3"' : ''}/>`);
      if (spec.ring === 'double') parts.push(`<circle class="ea-rule" cx="${n(cx)}" cy="${n(cy)}" r="${n(radius - 3.5)}"/>`);
      if (EVENT_GLYPHS[element.trigger]) parts.push(glyph(EVENT_GLYPHS[element.trigger], cx - 8, cy - 8));
    }
  } else if (shape === 'gateway') {
    parts.push(`<path class="ea-shape" d="M${n(cx)} ${n(y)}L${n(x + w)} ${n(cy)}L${n(cx)} ${n(y + h)}L${n(x)} ${n(cy)}Z"/>`);
    const mark = { x: 'M-5.5 -5.5L5.5 5.5M5.5 -5.5L-5.5 5.5', plus: 'M0 -7.5V7.5M-7.5 0H7.5', o: 'M0 -6.5a6.5 6.5 0 1 0 0 13a6.5 6.5 0 0 0 0-13' }[spec.mark];
    if (mark) parts.push(`<path class="ea-glyph" style="stroke-width:1.8" transform="translate(${n(cx)} ${n(cy)})" d="${mark}"/>`);
  } else if (shape === 'actor') {
    parts.push(`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="transparent"/><path class="ea-shape" style="fill:none;stroke-width:1.6" stroke-linecap="round" d="M${n(cx)} ${n(y + 16)}V${n(y + 36)}M${n(cx - 15)} ${n(y + 23)}H${n(cx + 15)}M${n(cx)} ${n(y + 36)}L${n(cx - 12)} ${n(y + 53)}M${n(cx)} ${n(y + 36)}L${n(cx + 12)} ${n(y + 53)}"/><circle class="ea-shape" cx="${n(cx)}" cy="${n(y + 8)}" r="7.5"/>`);
  } else if (shape === 'classifier') {
    parts.push(`<rect class="ea-shape" x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="3"/>`);
    parts.push(`<path class="ea-head" d="M${n(x + 0.7)} ${n(y + node.headerH)}V${n(y + 3.5)}a2.8 2.8 0 0 1 2.8 -2.8H${n(x + w - 3.5)}a2.8 2.8 0 0 1 2.8 2.8V${n(y + node.headerH)}Z"/>`);
    let headY = y + node.headerH / 2;
    if (spec.stereotype) { parts.push(`<text class="ea-cap" x="${n(cx)}" y="${n(y + 12)}" text-anchor="middle" dominant-baseline="central">«${esc(spec.stereotype)}»</text>`); headY = y + 27; }
    parts.push(`<text class="ea-label${spec.italic ? ' ea-italic' : ''}" x="${n(cx)}" y="${n(headY)}" text-anchor="middle" dominant-baseline="central">${esc(element.label)}</text>`);
    let cursor = y + node.headerH;
    const compartment = (rows, source) => {
      if (!rows.length) return;
      parts.push(`<path class="ea-rule" d="M${n(x)} ${n(cursor)}H${n(x + w)}"/>`);
      rows.forEach((row, index) => {
        const member = source[index] || {};
        const cls = `ea-member${member.static ? ' ea-static' : ''}${member.abstract ? ' ea-italic' : ''}`;
        parts.push(`<text class="${cls}" x="${n(x + 10)}" y="${n(cursor + 12 + index * 15)}" dominant-baseline="central">${esc(row)}</text>`);
      });
      cursor += rows.length * 15 + 9;
    };
    compartment(node.attributes, element.attributes || []);
    compartment(node.methods, element.methods || []);
  }

  if (shape === 'event' || shape === 'gateway' || shape === 'actor') {
    node.lines.forEach((line, index) => parts.push(`<text class="${shape === 'actor' ? 'ea-label' : 'ea-cap'}" x="${n(cx)}" y="${n(y + h + (shape === 'actor' ? 12 : 11) + index * (shape === 'actor' ? 14 : 12))}" text-anchor="middle" dominant-baseline="central"${shape === 'actor' ? '' : ' style="fill:var(--text)"'}>${esc(line)}</text>`));
  } else if (shape !== 'classifier' && shape !== 'bar') {
    const block = node.lines.length * 15 + (node.caption ? 13 : 0);
    const top = labelY - block / 2 + 7.5 + (shape === 'sheet' ? 3 : 0);
    node.lines.forEach((line, index) => parts.push(`<text class="ea-label" x="${n(cx)}" y="${n(top + index * 15)}" text-anchor="middle" dominant-baseline="central">${esc(line)}</text>`));
    if (node.caption) parts.push(`<text class="ea-cap" x="${n(cx)}" y="${n(top + node.lines.length * 15 - 1)}" text-anchor="middle" dominant-baseline="central">${esc(node.caption)}</text>`);
    const taskGlyph = element.kind === 'task' ? TASK_GLYPHS[element.taskType] : null;
    if (taskGlyph) parts.push(glyph(taskGlyph, x + 6, y + 5));
    else if (spec.glyph !== 'none' && shape !== 'ellipse') parts.push(glyph(spec.glyph, x + w - 21 - (shape === 'node3d' ? 7 : 0), y + 5 + (shape === 'node3d' ? 7 : 0) + (shape === 'sheet' ? 8 : 0)));
    else if (spec.glyph !== 'none') parts.push(glyph(spec.glyph, cx - 8, y + 5));
  }
  const name = `${spec.label}: ${element.label}`;
  return `<g class="ea-node t-${node.tone}" data-id="${esc(node.id)}" data-kind="${esc(node.kind)}" tabindex="0" role="button" aria-label="${esc(name)}"><title>${esc(name)}</title>${parts.join('')}</g>`;
}

function roundedPath(points, radius = 6) {
  if (points.length < 3) return `M${points.map((point) => `${n(point[0])} ${n(point[1])}`).join('L')}`;
  let d = `M${n(points[0][0])} ${n(points[0][1])}`;
  for (let index = 1; index < points.length - 1; index += 1) {
    const [px, py] = points[index - 1]; const [x, y] = points[index]; const [qx, qy] = points[index + 1];
    const inLen = Math.hypot(x - px, y - py); const outLen = Math.hypot(qx - x, qy - y);
    const rr = Math.min(radius, inLen / 2, outLen / 2);
    const ax = x - ((x - px) / inLen) * rr; const ay = y - ((y - py) / inLen) * rr;
    const bx = x + ((qx - x) / outLen) * rr; const by = y + ((qy - y) / outLen) * rr;
    d += `L${n(ax)} ${n(ay)}Q${n(x)} ${n(y)} ${n(bx)} ${n(by)}`;
  }
  const last = points[points.length - 1];
  return `${d}L${n(last[0])} ${n(last[1])}`;
}

const MARKER_PATHS = {
  open: ['ea-mark-open', 'M-9 -4.5L0 0L-9 4.5'],
  filled: ['ea-mark-solid', 'M-9 -4.5L0 0L-9 4.5Z'],
  triangle: ['ea-mark-hollow', 'M-12 -6.5L0 0L-12 6.5Z'],
  diamond: ['ea-mark-hollow', 'M0 0L-8 -4.5L-16 0L-8 4.5Z'],
  'diamond-filled': ['ea-mark-solid', 'M0 0L-8 -4.5L-16 0L-8 4.5Z'],
  dot: ['ea-mark-solid', 'M-6.5 0a3.2 3.2 0 1 0 6.4 0a3.2 3.2 0 1 0 -6.4 0'],
  circle: ['ea-mark-hollow', 'M-8 0a3.6 3.6 0 1 0 7.2 0a3.6 3.6 0 1 0 -7.2 0'],
};

export function marker(kind, tip, from) {
  const spec = MARKER_PATHS[kind];
  if (!spec) return '';
  const angle = (Math.atan2(tip[1] - from[1], tip[0] - from[0]) * 180) / Math.PI;
  return `<path class="ea-mark ${spec[0]}" transform="translate(${n(tip[0])} ${n(tip[1])}) rotate(${n(angle)})" d="${spec[1]}"/>`;
}

function drawEdge(edge) {
  const relation = RELATIONS[edge.rel.kind];
  const points = edge.points;
  const d = roundedPath(points);
  const dash = relation.dash === 'solid' ? '' : ` ea-${relation.dash}`;
  const parts = [`<path class="ea-hit" d="${d}"/>`, `<path class="ea-line${dash}" d="${d}"/>`];
  parts.push(marker(relation.start, points[0], points[1]));
  parts.push(marker(relation.end, points[points.length - 1], points[points.length - 2]));
  const mult = (text, at, toward) => {
    if (!text) return '';
    const dx = Math.sign(toward[0] - at[0]); const dy = Math.sign(toward[1] - at[1]);
    const tx = at[0] + dx * 14 + (dy ? 9 : 0); const ty = at[1] + dy * 16 + (dx ? -9 : 0);
    return `<text class="ea-mult" x="${n(tx)}" y="${n(ty)}" text-anchor="${dy ? 'start' : 'middle'}" dominant-baseline="central">${esc(text)}</text>`;
  };
  parts.push(mult(edge.rel.fromMult, points[0], points[1]), mult(edge.rel.toMult, points[points.length - 1], points[points.length - 2]));
  if (edge.label) {
    parts.push(`<g class="ea-edge-label"><rect x="${n(edge.label.x)}" y="${n(edge.label.y)}" width="${n(edge.label.w)}" height="${n(edge.label.h)}" rx="7"/><text x="${n(edge.label.x + edge.label.w / 2)}" y="${n(edge.label.y + edge.label.h / 2)}" text-anchor="middle" dominant-baseline="central">${esc(edge.label.text)}</text></g>`);
  }
  const name = `${relation.label}: ${edge.from} to ${edge.to}`;
  return `<g class="ea-edge" data-id="${esc(edge.id)}" data-from="${esc(edge.from)}" data-to="${esc(edge.to)}" data-kind="${esc(edge.rel.kind)}"><title>${esc(name)}</title>${parts.join('')}</g>`;
}

function drawGroup(group) {
  const tone = TONES.includes(group.tone) ? ` t-${group.tone}` : '';
  if (group.strip) {
    const cy = group.y + group.h / 2;
    return `<g class="ea-group-wrap${tone}" data-group="${esc(group.label)}"><rect class="ea-group" x="${n(group.x)}" y="${n(group.y)}" width="${n(group.w)}" height="${n(group.h)}" rx="4"/><path class="ea-strip" d="M${n(group.x + group.strip)} ${n(group.y + 0.5)}V${n(group.y + group.h - 0.5)}H${n(group.x + 4)}a3.5 3.5 0 0 1 -3.5 -3.5V${n(group.y + 4)}a3.5 3.5 0 0 1 3.5 -3.5Z"/><text class="ea-group-label" x="${n(group.x + group.strip / 2)}" y="${n(cy)}" text-anchor="middle" dominant-baseline="central" transform="rotate(-90 ${n(group.x + group.strip / 2)} ${n(cy)})">${esc(group.label)}</text></g>`;
  }
  const dashed = group.kind === 'boundary' ? ' ea-group-dashed' : '';
  const tab = group.kind === 'package' ? `<path class="ea-group" d="M${n(group.x)} ${n(group.y)}v-14h${n(Math.min(group.w - 20, textWidth(group.label, 9) * 1.15 + 20))}v14"/>` : '';
  const labelY = group.kind === 'package' ? group.y - 7 : group.y + 12;
  return `<g class="ea-group-wrap${tone}" data-group="${esc(group.label)}">${tab}<rect class="ea-group${dashed}" x="${n(group.x)}" y="${n(group.y)}" width="${n(group.w)}" height="${n(group.h)}" rx="${group.kind === 'system' ? 3 : 6}"/><text class="ea-group-label" x="${n(group.x + 10)}" y="${n(labelY)}" dominant-baseline="central">${esc(group.label)}</text></g>`;
}

function drawSequence(layout) {
  const parts = [];
  for (const fragment of layout.fragments) {
    const tabW = textWidth(fragment.kind || 'alt', 9) * 1.15 + 18;
    parts.push(`<g class="ea-fragment-wrap"><rect class="ea-fragment" x="${n(fragment.x)}" y="${n(fragment.y)}" width="${n(fragment.w)}" height="${n(fragment.h)}" rx="3"/><path class="ea-fragment-tab" d="M${n(fragment.x)} ${n(fragment.y)}h${n(tabW)}v10l-6 6H${n(fragment.x)}Z"/><text class="ea-group-label" x="${n(fragment.x + 7)}" y="${n(fragment.y + 8)}" dominant-baseline="central">${esc(fragment.kind || 'alt')}</text>${fragment.label ? `<text class="ea-cap" x="${n(fragment.x + tabW + 8)}" y="${n(fragment.y + 8)}" dominant-baseline="central">[${esc(fragment.label)}]</text>` : ''}</g>`);
  }
  for (const participant of layout.participants) {
    parts.push(`<path class="ea-lifeline" d="M${n(participant.cx)} ${n(participant.y + participant.h)}V${n(layout.lifelineBottom)}"/>`);
  }
  const tones = new Map(layout.participants.map((participant) => [participant.id, participant.tone]));
  for (const activation of layout.activations) {
    const participant = layout.participants.find((entry) => entry.id === activation.participant);
    parts.push(`<rect class="ea-activation t-${tones.get(activation.participant)}" x="${n(participant.cx - 5)}" y="${n(activation.from)}" width="10" height="${n(Math.max(12, activation.to - activation.from))}" rx="2"/>`);
  }
  for (const participant of layout.participants) {
    const node = { ...participant, shape: participant.spec.shape === 'actor' ? 'box' : ['box', 'round', 'sheet', 'chamfer'].includes(participant.spec.shape) ? participant.spec.shape : 'box', caption: '', below: 0 };
    parts.push(drawNode(node));
  }
  for (const message of layout.messages) {
    const cls = `ea-line${message.kind === 'reply' ? ' ea-dashed' : ''}`;
    const tip = message.kind === 'sync' || message.kind === 'self' ? 'filled' : 'open';
    let body;
    if (message.kind === 'self') {
      const x = message.x1 + 5;
      body = `<path class="${cls}" d="M${n(x)} ${n(message.y)}h30v20h-30"/>${marker(tip, [x, message.y + 20], [x + 30, message.y + 20])}<text class="ea-mult" x="${n(x + 38)}" y="${n(message.y + 10)}" dominant-baseline="central">${esc(message.label)}</text>`;
    } else {
      const dir = Math.sign(message.x2 - message.x1);
      const x1 = message.x1 + dir * 5; const x2 = message.x2 - dir * 5;
      body = `<path class="${cls}" d="M${n(x1)} ${n(message.y)}H${n(x2)}"/>${marker(tip, [x2, message.y], [x1, message.y])}<text class="ea-mult" x="${n((x1 + x2) / 2)}" y="${n(message.y - 9)}" text-anchor="middle" dominant-baseline="central">${esc(message.label)}</text>`;
    }
    parts.push(`<g class="ea-edge" data-message="${message.index}" data-from="${esc(message.from)}" data-to="${esc(message.to)}" data-kind="${message.kind}"><title>${esc(`${message.from} → ${message.to}: ${message.label}`)}</title>${body}</g>`);
  }
  return parts.join('');
}

export function legendFor(model, view, layout) {
  const kinds = layout.kind === 'sequence' ? [] : [...new Set(layout.edges.map((edge) => edge.rel.kind))];
  return kinds.map((kind) => ({ kind, ...RELATIONS[kind] }));
}

function drawLegend(entries, x, y, maxWidth) {
  const parts = [];
  let cx = x; let cy = y;
  for (const entry of entries) {
    const width = 46 + 8 + textWidth(entry.label, 9) * 1.12 + 20;
    if (cx + width > x + maxWidth && cx > x) { cx = x; cy += 20; }
    const dash = entry.dash === 'solid' ? '' : ` ea-${entry.dash}`;
    parts.push(`<g class="ea-edge ea-legend-item" data-legend="${esc(entry.kind)}"><path class="ea-line${dash}" d="M${n(cx)} ${n(cy)}H${n(cx + 46)}"/>${marker(entry.start, [cx, cy], [cx + 46, cy])}${marker(entry.end, [cx + 46, cy], [cx, cy])}<text class="ea-cap" x="${n(cx + 54)}" y="${n(cy)}" dominant-baseline="central">${esc(entry.label)}</text></g>`);
    cx += width;
  }
  return { markup: parts.join(''), height: entries.length ? cy - y + 22 : 0 };
}

export function renderView(model, viewId, options = {}) {
  const view = (model.views || []).find((entry) => entry.id === viewId);
  if (!view) throw new Error(`Unknown view "${viewId}"`);
  const layout = layoutView(model, view);
  const theme = options.theme || 'dark';
  const legendEntries = options.legend === false ? [] : legendFor(model, view, layout);
  const legend = drawLegend(legendEntries, 36, layout.height + 4, layout.width - 72);
  const width = Math.ceil(layout.width + layout.shiftX); const height = Math.ceil(layout.height + layout.shiftY + legend.height + (legend.height ? 14 : 0));
  const body = layout.kind === 'sequence'
    ? drawSequence(layout)
    : `${layout.groups.map(drawGroup).join('')}<g class="ea-edges">${layout.edges.map(drawEdge).join('')}</g><g class="ea-nodes">${layout.nodes.map(drawNode).join('')}</g>`;
  const kicker = [VIEW_TYPES[view.type].label, view.viewpoint].filter(Boolean).join(' · ');
  const svg = `<svg class="ea-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" data-theme="${esc(theme)}" data-view="${esc(view.id)}" data-view-type="${esc(view.type)}" role="img" aria-label="${esc(view.title)}">
<style>${svgStyles()}</style>
<rect class="ea-canvas" width="${width}" height="${height}" fill="var(--bg)"/>
<text class="ea-kicker" x="36" y="30" dominant-baseline="central">${esc(kicker)}</text>
<text class="ea-title" x="36" y="50" dominant-baseline="central">${esc(view.title)}</text>
<g transform="translate(${n(layout.shiftX)} ${n(layout.shiftY)})">${body}<g class="ea-tokens"></g></g>
<g class="ea-legend" transform="translate(${n(layout.shiftX)} ${n(layout.shiftY)})">${legend.markup}</g>
</svg>`;
  return { svg, width, height, layout, legend: legendEntries };
}
