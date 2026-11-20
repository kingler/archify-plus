// Task generation: turn the model into a dependency-ordered delivery plan
// organised by TOGAF ADM phase. Every task traces back to the element that
// caused it, and dependencies come from the relationships already modelled.

import { KINDS, LAYERS, isClassifier, layerOf } from './notation.mjs';
import { indexModel, viewRelationships, viewsOfElement } from './model.mjs';

export const ADM_PHASES = [
  { id: 'P', label: 'Preliminary' },
  { id: 'A', label: 'Architecture Vision' },
  { id: 'B', label: 'Business Architecture' },
  { id: 'C', label: 'Information Systems Architectures' },
  { id: 'D', label: 'Technology Architecture' },
  { id: 'E', label: 'Opportunities & Solutions' },
  { id: 'F', label: 'Migration Planning' },
  { id: 'G', label: 'Implementation Governance' },
  { id: 'H', label: 'Architecture Change Management' },
];

const t = (phase, type, verb, estimate, acceptance) => ({ phase, type, verb, estimate, acceptance });
const TEMPLATES = {
  stakeholder: t('A', 'analyse', 'Confirm concerns with', 1, ['Concerns and success criteria are recorded and agreed']),
  driver: t('A', 'analyse', 'Quantify driver:', 1, ['Baseline measurement and owner are recorded']),
  assessment: t('A', 'analyse', 'Validate assessment:', 1, ['Evidence for the assessment is linked']),
  goal: t('A', 'analyse', 'Define measures for goal:', 2, ['Metric, baseline, target, and deadline are agreed']),
  outcome: t('A', 'analyse', 'Define acceptance for outcome:', 2, ['The outcome has a measurable acceptance test']),
  principle: t('P', 'govern', 'Ratify principle:', 1, ['Rationale and implications are documented', 'The architecture board has approved it']),
  constraint: t('P', 'govern', 'Record constraint:', 1, ['Source and impact are documented']),
  requirement: t('A', 'specify', 'Specify acceptance criteria:', 2, ['Criteria are testable', 'Every criterion traces to a realising element']),
  value: t('A', 'analyse', 'Describe value:', 1, ['The beneficiary and measure are named']),
  capability: t('B', 'analyse', 'Assess capability:', 2, ['Current and target maturity are scored']),
  resource: t('B', 'analyse', 'Inventory resource:', 1, ['Owner and capacity are recorded']),
  'value-stream': t('B', 'design', 'Map value stream:', 3, ['Stages, stakeholders, and value items are mapped']),
  'course-of-action': t('E', 'plan', 'Plan course of action:', 3, ['Options are compared and one is selected']),
  'business-actor': t('B', 'design', 'Identify responsibilities of', 1, ['Responsibilities and contact are recorded']),
  'business-role': t('B', 'design', 'Assign and brief role:', 1, ['A named owner holds the role', 'Work instructions are available']),
  'business-collaboration': t('B', 'design', 'Agree collaboration:', 2, ['Participating roles and handoffs are agreed']),
  'business-interface': t('B', 'design', 'Define channel:', 2, ['Channel, hours, and owner are defined']),
  'business-process': t('B', 'design', 'Model and agree process:', 3, ['Process owner has signed off the flow', 'Inputs, outputs, and exceptions are documented']),
  'business-function': t('B', 'design', 'Describe function:', 2, ['Scope and owner are documented']),
  'business-event': t('B', 'design', 'Define trigger:', 1, ['Source and payload of the event are defined']),
  'business-service': t('B', 'specify', 'Define service level for', 2, ['Consumers, hours, and targets are agreed']),
  'business-object': t('B', 'design', 'Define information model:', 2, ['Attributes and owner are agreed']),
  contract: t('B', 'design', 'Draft contract:', 2, ['Terms are reviewed by the accountable owner']),
  product: t('B', 'design', 'Define product:', 3, ['Bundled services and terms are defined']),
  'application-component': t('C', 'build', 'Build component:', 8, ['Provided services pass contract tests', 'Runs in the target environment']),
  'application-collaboration': t('C', 'design', 'Design collaboration:', 3, ['Interaction contracts between members are agreed']),
  'application-interface': t('C', 'build', 'Publish interface:', 3, ['Contract is versioned and published', 'Consumers can call it in a test environment']),
  'application-function': t('C', 'build', 'Implement function:', 3, ['Behaviour is covered by automated tests']),
  'application-process': t('C', 'build', 'Implement process:', 5, ['Happy path and failure paths are tested']),
  'application-event': t('C', 'build', 'Emit event:', 2, ['Schema is registered', 'Producer publishes it in a test environment']),
  'application-service': t('C', 'specify', 'Specify service contract:', 2, ['Operations, errors, and service levels are specified']),
  'data-object': t('C', 'data', 'Design data store for', 3, ['Schema is reviewed', 'Retention and ownership are defined']),
  node: t('D', 'platform', 'Provision', 5, ['Infrastructure is defined as code', 'Monitoring and access control are in place']),
  device: t('D', 'platform', 'Provision device:', 3, ['Device is configured and monitored']),
  'execution-node': t('D', 'platform', 'Provision', 5, ['Environment is defined as code', 'Monitoring and access control are in place']),
  'system-software': t('D', 'platform', 'Install and configure', 3, ['Version is pinned', 'Backup and upgrade paths are tested']),
  'technology-interface': t('D', 'platform', 'Expose technology interface:', 2, ['Endpoint is reachable from its consumers']),
  'technology-service': t('D', 'platform', 'Offer platform service:', 3, ['Service level and onboarding guide are published']),
  'communication-network': t('D', 'platform', 'Configure network:', 3, ['Routes and firewall rules are verified']),
  artifact: t('D', 'release', 'Build and publish artifact:', 2, ['Pipeline builds a versioned, signed artifact']),
  'work-package': t('F', 'plan', 'Deliver work package:', 5, ['Scope, owner, and dates are agreed', 'All realised deliverables are accepted']),
  deliverable: t('F', 'release', 'Accept deliverable:', 2, ['Acceptance review is recorded']),
  plateau: t('F', 'milestone', 'Reach plateau:', 0, ['Everything realising this plateau is live']),
  gap: t('E', 'plan', 'Close gap:', 2, ['The gap is covered by an accepted work package']),
  component: t('C', 'build', 'Build component:', 5, ['Provided interfaces pass contract tests']),
  package: t('C', 'build', 'Set up package:', 1, ['Module boundary and ownership are defined']),
  usecase: t('C', 'build', 'Deliver use case:', 3, ['Main and alternate flows pass acceptance tests']),
  subprocess: t('B', 'design', 'Detail sub-process:', 3, ['The sub-process has its own agreed flow']),
};
const TASK_TYPES = {
  service: t('C', 'build', 'Automate step:', 3, ['The step runs without manual intervention', 'Failures are retried or escalated']),
  script: t('C', 'build', 'Script step:', 2, ['The script is versioned and tested']),
  send: t('C', 'build', 'Integrate outbound message:', 2, ['Message is delivered and logged']),
  receive: t('C', 'build', 'Integrate inbound message:', 2, ['Message is validated and acknowledged']),
  user: t('B', 'design', 'Design user task:', 2, ['Screen or form and work instruction are approved']),
  manual: t('B', 'design', 'Write work instruction:', 1, ['Instruction is published to the team doing the work']),
};

function templateFor(element) {
  if (element.kind === 'task') return TASK_TYPES[element.taskType] || TASK_TYPES.user;
  if (isClassifier(element.kind)) {
    const members = (element.attributes || []).length + (element.methods || []).length;
    if (element.kind === 'entity') return t('C', 'data', 'Create table and repository for', 2 + Math.ceil(members / 4), ['Migration applies and rolls back cleanly', 'Repository covers create, read, and update']);
    if (element.kind === 'enum') return t('C', 'build', 'Define enumeration', 1, ['Values match the model']);
    if (element.kind === 'interface') return t('C', 'specify', 'Define interface', 1 + Math.ceil(members / 4), ['Every operation is documented']);
    return t('C', 'build', `Implement ${element.kind === 'abstract' ? 'abstract class' : element.kind}`, 1 + Math.ceil(members / 3), ['Public methods are unit tested']);
  }
  return TEMPLATES[element.kind] || null;
}

// For a relationship from -> to, return [dependent, prerequisite] or null.
function ordering(rel, from, to) {
  const technology = layerOf(from) === 'technology';
  switch (rel.kind) {
    case 'serving': return [to, from];
    case 'access': case 'dependency': case 'include': case 'extend': case 'inheritance': case 'specialization': return [from, to];
    case 'triggering': case 'flow': return [to, from];
    case 'composition': case 'aggregation': return technology ? [to, from] : [from, to];
    case 'assignment': return [to, from];
    case 'realization':
      if (['requirement', 'outcome', 'goal', 'plateau', 'deliverable', 'constraint', 'principle'].includes(to.kind)) return [to, from];
      return [from, to];
    case 'association': return to.kind === 'gap' ? [to, from] : null;
    default: return null;
  }
}

export function generateTasks(model) {
  const { elements } = indexModel(model);
  const drafts = [];
  const primary = new Map(); // element id -> draft that "delivers" the element
  const verify = new Map(); // requirement id -> governance draft
  const add = (draft) => { drafts.push(draft); return draft; };

  for (const element of model.elements || []) {
    const template = templateFor(element);
    if (!template) continue;
    const label = `${template.verb} ${element.label}`;
    const extra = element.kind === 'application-interface' && element.operations ? Math.ceil(element.operations.length / 2) : 0;
    const draft = add({ key: `el:${element.id}`, title: label.replace(/\s+/g, ' '), phase: template.phase, type: template.type, estimate: template.estimate + extra, acceptance: [...template.acceptance], element: element.id, deps: new Set() });
    if (element.doc) draft.description = element.doc;
    primary.set(element.id, draft);
    if (element.kind === 'requirement') {
      verify.set(element.id, add({ key: `verify:${element.id}`, title: `Verify requirement is met: ${element.label}`, phase: 'G', type: 'verify', estimate: 2, acceptance: ['Each acceptance criterion has passing evidence', 'Compliance review is recorded'], element: element.id, deps: new Set([draft.key]) }));
    }
  }

  // Behavioural views become one implementation task each.
  for (const view of model.views || []) {
    if (view.type !== 'state' && view.type !== 'activity') continue;
    const count = viewRelationships(model, view).length;
    add({ key: `view:${view.id}`, title: `Implement ${view.type === 'state' ? 'state machine' : 'workflow'}: ${view.title}`, phase: 'C', type: 'build', estimate: 2 + Math.ceil(count / 4), acceptance: [view.type === 'state' ? 'Every modelled transition is tested, and illegal transitions are rejected' : 'Every branch and parallel path is covered by a test'], view: view.id, deps: new Set() });
  }

  for (const rel of model.relationships || []) {
    const from = elements.get(rel.from); const to = elements.get(rel.to);
    if (!from || !to || from === to) continue;
    // Deploying an artifact is its own piece of work, after build and provisioning.
    const deploy = (rel.kind === 'deployment' && [from, to]) || (rel.kind === 'assignment' && to.kind === 'artifact' && layerOf(from) === 'technology' && [to, from]);
    if (deploy) {
      const [artifact, host] = deploy;
      if (primary.has(artifact.id) && primary.has(host.id)) {
        add({ key: `deploy:${rel.id}`, title: `Deploy ${artifact.label} to ${host.label}`, phase: 'G', type: 'release', estimate: 2, acceptance: ['Deployment is automated and repeatable', 'Health checks pass after rollout'], element: artifact.id, relationship: rel.id, deps: new Set([primary.get(artifact.id).key, primary.get(host.id).key]) });
      }
      continue;
    }
    // An artifact is built from the component it realises.
    const pair = rel.kind === 'realization' && (from.kind === 'artifact' || from.kind === 'deliverable') && !['plateau', 'deliverable'].includes(to.kind) ? [from, to] : ordering(rel, from, to);
    if (!pair) continue;
    const [dependent, prerequisite] = pair;
    const target = rel.kind === 'realization' && dependent.kind === 'requirement' ? verify.get(dependent.id) : primary.get(dependent.id);
    const source = primary.get(prerequisite.id);
    if (target && source && target !== source) target.deps.add(source.key);
  }

  // Order: break cycles deterministically, then level by longest path.
  const byKey = new Map(drafts.map((draft) => [draft.key, draft]));
  const dropped = [];
  const level = new Map();
  const remaining = new Set(drafts.map((draft) => draft.key));
  while (remaining.size) {
    const ready = [...remaining].filter((key) => [...byKey.get(key).deps].every((dep) => !remaining.has(dep)));
    if (!ready.length) {
      // Remove the dependency that points at the latest-phase prerequisite.
      const candidates = [...remaining].flatMap((key) => [...byKey.get(key).deps].filter((dep) => remaining.has(dep)).map((dep) => ({ key, dep })));
      const phaseIndex = (key) => ADM_PHASES.findIndex((phase) => phase.id === byKey.get(key).phase);
      candidates.sort((p, q) => (phaseIndex(q.dep) - phaseIndex(q.key)) - (phaseIndex(p.dep) - phaseIndex(p.key)) || p.key.localeCompare(q.key) || p.dep.localeCompare(q.dep));
      const cut = candidates[0];
      byKey.get(cut.key).deps.delete(cut.dep);
      dropped.push(cut);
      continue;
    }
    for (const key of ready) {
      level.set(key, Math.max(0, ...[...byKey.get(key).deps].map((dep) => level.get(dep) + 1)));
      remaining.delete(key);
    }
  }

  const phaseOrder = new Map(ADM_PHASES.map((phase, index) => [phase.id, index]));
  const ordered = drafts.map((draft, index) => ({ draft, index })).sort((p, q) => phaseOrder.get(p.draft.phase) - phaseOrder.get(q.draft.phase) || level.get(p.draft.key) - level.get(q.draft.key) || p.index - q.index);
  const ids = new Map(ordered.map(({ draft }, index) => [draft.key, `T-${String(index + 1).padStart(3, '0')}`]));
  const tasks = ordered.map(({ draft }) => {
    const element = draft.element ? elements.get(draft.element) : null;
    return {
      id: ids.get(draft.key), title: draft.title, phase: draft.phase, phaseLabel: ADM_PHASES.find((phase) => phase.id === draft.phase).label,
      type: draft.type, layer: element ? layerOf(element) : 'application', estimate: draft.estimate, wave: level.get(draft.key) + 1,
      dependsOn: [...draft.deps].map((key) => ids.get(key)).sort(),
      acceptance: draft.acceptance, ...(draft.description ? { description: draft.description } : {}),
      trace: { ...(element ? { element: element.id, kind: element.kind } : {}), ...(draft.view ? { view: draft.view } : {}), ...(draft.relationship ? { relationship: draft.relationship } : {}), views: element ? viewsOfElement(model, element.id).map((view) => view.id) : draft.view ? [draft.view] : [] },
    };
  });
  return {
    title: model.meta?.title || 'Enterprise model',
    phases: ADM_PHASES.map((phase) => ({ ...phase, tasks: tasks.filter((task) => task.phase === phase.id).map((task) => task.id) })).filter((phase) => phase.tasks.length),
    tasks,
    totals: { tasks: tasks.length, points: tasks.reduce((sum, task) => sum + task.estimate, 0), waves: Math.max(0, ...tasks.map((task) => task.wave)) },
    droppedDependencies: dropped.map((cut) => ({ task: ids.get(cut.key), dependsOn: ids.get(cut.dep), reason: 'dependency cycle' })),
  };
}

export function tasksMarkdown(plan) {
  const lines = [`# Delivery plan: ${plan.title}`, '', `${plan.totals.tasks} tasks · ${plan.totals.points} points · ${plan.totals.waves} dependency waves. Generated by Archify Enterprise; phases follow the TOGAF ADM.`, ''];
  for (const phase of plan.phases) {
    lines.push(`## Phase ${phase.id}: ${phase.label}`, '');
    for (const task of plan.tasks.filter((entry) => entry.phase === phase.id)) {
      lines.push(`- [ ] **${task.id}** ${task.title} _(${task.type}, ${task.estimate} pt, wave ${task.wave})_`);
      if (task.dependsOn.length) lines.push(`  - Depends on: ${task.dependsOn.join(', ')}`);
      if (task.trace.element) lines.push(`  - Traces to: \`${task.trace.element}\` (${KINDS[task.trace.kind]?.label || task.trace.kind})`);
      for (const criterion of task.acceptance) lines.push(`  - Done when: ${criterion}`);
    }
    lines.push('');
  }
  if (plan.droppedDependencies.length) {
    lines.push('## Dependency cycles', '', 'These dependencies were removed so the plan can be ordered. Review the relationships that caused them.', '', ...plan.droppedDependencies.map((cut) => `- ${cut.task} no longer waits for ${cut.dependsOn}`), '');
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

export function tasksCsv(plan) {
  const cell = (value) => { const text = String(value ?? ''); return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; };
  const rows = [['ID', 'Title', 'Phase', 'Phase name', 'Type', 'Layer', 'Estimate', 'Wave', 'Depends on', 'Element', 'Acceptance criteria']];
  for (const task of plan.tasks) rows.push([task.id, task.title, task.phase, task.phaseLabel, task.type, LAYERS[task.layer]?.label || task.layer, task.estimate, task.wave, task.dependsOn.join(' '), task.trace.element || task.trace.view || '', task.acceptance.join('; ')]);
  return `${rows.map((row) => row.map(cell).join(',')).join('\n')}\n`;
}

// A GOAL agent program whose goal base is the plan: one `done/1` goal per
// task, beliefs for what is finished, and rules that start any ready task.
export function tasksGoal(plan) {
  const atom = (id) => `'${id}'`;
  const quote = (text) => `'${String(text).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  const knowledge = ['% Task knowledge generated by Archify Enterprise.', ':- dynamic done/1, started/1.', '',
    ...plan.tasks.map((task) => `task(${atom(task.id)}, ${quote(task.title)}, ${task.phase.toLowerCase()}, ${task.estimate}).`), '',
    ...plan.tasks.flatMap((task) => task.dependsOn.map((dep) => `requires(${atom(task.id)}, ${atom(dep)}).`)), '',
    'ready(T) :- task(T, _, _, _), not(done(T)), forall(requires(T, D), done(D)).', ''];
  const goals = ['% One achievement goal per task.', ...plan.tasks.map((task) => `done(${atom(task.id)}).`), ''];
  const moduleFile = ['use tasks as knowledge.', 'use progress as beliefs.', 'use targets as goals.', 'use delivery as actionspec.', '', 'exit = nogoals.', '',
    'module plan {', '\t% Start any task whose prerequisites are done, then finish what was started.', '\tif goal(done(T)), bel(ready(T), not(started(T))) then start(T).', '\tif bel(started(T), not(done(T))) then complete(T).', '}', ''];
  const actions = ['use tasks as knowledge.', '', 'define start(T) with', '\tpre { ready(T), not(started(T)) }', '\tpost { started(T) }', '', 'define complete(T) with', '\tpre { started(T), not(done(T)) }', '\tpost { done(T) }', ''];
  const mas = ['define planner as agent {', '\tuse plan as main module.', '}', '', 'launchpolicy {', '\tlaunch planner.', '}', ''];
  return [
    { path: 'goal/tasks.pl', content: knowledge.join('\n') },
    { path: 'goal/progress.pl', content: '% Beliefs: nothing is started or done yet.\n:- dynamic done/1, started/1.\n' },
    { path: 'goal/targets.pl', content: goals.join('\n') },
    { path: 'goal/plan.mod2g', content: moduleFile.join('\n') },
    { path: 'goal/delivery.act2g', content: actions.join('\n') },
    { path: 'goal/delivery.mas2g', content: mas.join('\n') },
  ];
}

export function taskFiles(plan) {
  return [
    { path: 'tasks/plan.md', content: tasksMarkdown(plan) },
    { path: 'tasks/plan.csv', content: tasksCsv(plan) },
    { path: 'tasks/plan.json', content: `${JSON.stringify(plan, null, 2)}\n` },
    ...tasksGoal(plan),
  ];
}
