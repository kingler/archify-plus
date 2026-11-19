// Token-flow execution for activity, BPMN, and state views. The semantics are
// a small subset of fUML's offer-and-fire model: tokens sit on flows, a node
// fires when its inputs are offered, decisions route one token by guard, forks
// copy tokens, joins wait for every input, and a final node ends the run.

import { indexModel, viewRelationships } from './model.mjs';

const FLOW_KINDS = new Set(['control-flow', 'object-flow', 'sequence-flow', 'transition']);
const EXCLUSIVE = new Set(['decision', 'choice', 'exclusive-gateway', 'state', 'initial']);
const WAIT_ALL = new Set(['join', 'parallel-gateway']);
const SOURCES = new Set(['initial', 'start-event']);

export function evaluateGuard(guard, vars = {}) {
  const text = String(guard || '').trim();
  if (!text) return true;
  if (text === 'else') return null;
  const match = text.match(/^(!?)\s*([A-Za-z_][\w.]*)\s*(?:(==|!=|>=|<=|>|<)\s*(.+))?$/);
  if (!match) return undefined;
  const [, negate, name, operator, raw] = match;
  if (!(name in vars)) return undefined;
  const left = vars[name];
  if (!operator) return negate ? !left : Boolean(left);
  let right = raw.trim();
  if (/^-?\d+(\.\d+)?$/.test(right)) right = Number(right);
  else if (right === 'true' || right === 'false') right = right === 'true';
  else right = right in vars ? vars[right] : right.replace(/^['"]|['"]$/g, '');
  switch (operator) {
    case '==': return left === right;
    case '!=': return left !== right;
    case '>': return left > right;
    case '<': return left < right;
    case '>=': return left >= right;
    default: return left <= right;
  }
}

export function createRun(model, viewId, vars) {
  const view = (model.views || []).find((entry) => entry.id === viewId);
  if (!view || !['activity', 'bpmn', 'state'].includes(view.type)) throw new Error(`View "${viewId}" is not executable; use an activity, bpmn, or state view.`);
  const { elements } = indexModel(model);
  const flows = viewRelationships(model, view).filter((rel) => FLOW_KINDS.has(rel.kind));
  const nodes = (view.nodes || []).map((node) => elements.get(node.ref)).filter(Boolean);
  const run = { view: view.id, type: view.type, vars: { ...(view.vars || {}), ...(vars || {}) }, nodes, flows, tokens: [], log: [], steps: 0, done: false };
  for (const node of nodes) {
    if (SOURCES.has(node.kind) && !flows.some((flow) => flow.to === node.id)) fire(run, node.id);
  }
  return run;
}

const incoming = (run, id) => run.flows.filter((flow) => flow.to === id);
const outgoing = (run, id) => run.flows.filter((flow) => flow.from === id);

// Nodes that can fire now, with the outgoing choices a caller may pick.
export function enabled(run) {
  if (run.done) return [];
  const out = [];
  for (const node of run.nodes) {
    const inputs = incoming(run, node.id);
    if (!inputs.length) continue;
    const offered = inputs.filter((flow) => run.tokens.includes(flow.id));
    const ready = WAIT_ALL.has(node.kind) && inputs.length > 1 ? offered.length === inputs.length : offered.length > 0;
    if (!ready) continue;
    const exits = outgoing(run, node.id);
    const choices = EXCLUSIVE.has(node.kind) && exits.length > 1 ? enabledChoices(run, node, exits) : [];
    out.push({ node: node.id, choices });
  }
  return out;
}
const flowHasGuard = (flow) => Boolean(String(flow.guard || '').trim());

export function fire(run, nodeId, choice) {
  const node = run.nodes.find((entry) => entry.id === nodeId);
  if (!node) throw new Error(`Node "${nodeId}" is not in view "${run.view}".`);
  const inputs = incoming(run, nodeId); const exits = outgoing(run, nodeId);
  if (inputs.length) {
    const offered = inputs.filter((flow) => run.tokens.includes(flow.id));
    const consume = WAIT_ALL.has(node.kind) && inputs.length > 1 ? offered : offered.slice(0, 1);
    if (!consume.length) throw new Error(`Node "${nodeId}" has no offered token.`);
    for (const flow of consume) run.tokens.splice(run.tokens.indexOf(flow.id), 1);
  }
  let produced = exits;
  if (EXCLUSIVE.has(node.kind) && exits.length > 1) {
    const options = enabledChoices(run, node, exits);
    const picked = choice && options.includes(choice) ? choice : options.length === 1 ? options[0] : null;
    if (!picked) {
      // Undo consumption so the caller can retry with a choice.
      for (const flow of inputs.slice(0, 1)) run.tokens.push(flow.id);
      throw new Error(`Node "${nodeId}" needs a choice between: ${options.join(', ')}.`);
    }
    produced = exits.filter((flow) => flow.id === picked);
  }
  run.steps += 1;
  if (node.kind === 'final' && run.type === 'activity') run.tokens = [];
  else for (const flow of produced) run.tokens.push(flow.id);
  run.log.push({ step: run.steps, node: nodeId, label: node.label || node.kind, took: produced.map((flow) => flow.id) });
  if (!run.tokens.length) run.done = true;
  return run;
}

function enabledChoices(run, node, exits) {
  const results = exits.map((flow) => ({ flow, result: evaluateGuard(flow.guard, run.vars) }));
  const passing = results.filter((entry) => entry.result === true && flowHasGuard(entry.flow));
  if (passing.length) return [passing[0].flow.id];
  const open = results.filter((entry) => entry.result !== false);
  const decided = open.filter((entry) => entry.result === null);
  const unknown = open.filter((entry) => entry.result !== null);
  return unknown.length ? open.map((entry) => entry.flow.id) : decided.map((entry) => entry.flow.id);
}

// Run until nothing can fire. `chooser` resolves ambiguous decisions; the
// default takes the first option so a run is always deterministic.
export function runToCompletion(run, { maxSteps = 500, chooser = (options) => options[0] } = {}) {
  while (!run.done && run.steps < maxSteps) {
    const ready = enabled(run);
    if (!ready.length) break;
    const next = ready[0];
    fire(run, next.node, next.choices.length > 1 ? chooser(next.choices, next.node) : next.choices[0]);
  }
  return run;
}
