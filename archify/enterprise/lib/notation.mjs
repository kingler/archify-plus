// The Archify Enterprise visual language.
//
// One catalog owns every element kind and relationship kind across ArchiMate,
// UML, and BPMN, and maps each onto the seven semantic tones, the mono type
// scale, and the small shape vocabulary defined in DESIGN.md. Renderers,
// generators, the legend, and the Studio all read this file, so a kind can
// never look different from one diagram type to the next.

export const TONES = ['frontend', 'backend', 'database', 'cloud', 'security', 'messagebus', 'external'];

// Architecture layers follow the ArchiMate colour convention, expressed in
// Archify's fixed palette: business is amber, application is cyan, technology
// is green, motivation is violet.
export const LAYERS = {
  motivation: { label: 'Motivation', tone: 'database', adm: 'A' },
  strategy: { label: 'Strategy', tone: 'messagebus', adm: 'A' },
  business: { label: 'Business', tone: 'cloud', adm: 'B' },
  application: { label: 'Application', tone: 'frontend', adm: 'C' },
  technology: { label: 'Technology', tone: 'backend', adm: 'D' },
  implementation: { label: 'Implementation & Migration', tone: 'security', adm: 'F' },
  other: { label: 'Other', tone: 'external', adm: 'C' },
};

// Shape vocabulary. The aspect of an element picks its silhouette everywhere:
//   box       active structure (who or what acts)        square corners
//   round     behaviour (what is performed)              rounded corners
//   sheet     passive structure (what is acted on)       header rule
//   chamfer   motivation (why)                           cut corners
//   classifier typed structure with member compartments
//   event / gateway / bar / actor / ellipse / node3d     control and UML specials

const k = (family, layer, shape, glyph, label, extra = {}) => ({ family, layer, shape, glyph, label, tone: LAYERS[layer].tone, ...extra });

export const KINDS = {
  // ArchiMate: motivation
  stakeholder: k('archimate', 'motivation', 'chamfer', 'role', 'Stakeholder'),
  driver: k('archimate', 'motivation', 'chamfer', 'driver', 'Driver'),
  assessment: k('archimate', 'motivation', 'chamfer', 'assessment', 'Assessment'),
  goal: k('archimate', 'motivation', 'chamfer', 'goal', 'Goal'),
  outcome: k('archimate', 'motivation', 'chamfer', 'outcome', 'Outcome'),
  principle: k('archimate', 'motivation', 'chamfer', 'principle', 'Principle'),
  requirement: k('archimate', 'motivation', 'chamfer', 'requirement', 'Requirement'),
  constraint: k('archimate', 'motivation', 'chamfer', 'constraint', 'Constraint'),
  value: k('archimate', 'motivation', 'ellipse', 'none', 'Value'),
  // ArchiMate: strategy
  resource: k('archimate', 'strategy', 'box', 'resource', 'Resource'),
  capability: k('archimate', 'strategy', 'round', 'capability', 'Capability'),
  'value-stream': k('archimate', 'strategy', 'round', 'process', 'Value stream'),
  'course-of-action': k('archimate', 'strategy', 'round', 'goal', 'Course of action'),
  // ArchiMate: business
  'business-actor': k('archimate', 'business', 'box', 'actor', 'Business actor'),
  'business-role': k('archimate', 'business', 'box', 'role', 'Business role'),
  'business-collaboration': k('archimate', 'business', 'box', 'collaboration', 'Business collaboration'),
  'business-interface': k('archimate', 'business', 'box', 'interface', 'Business interface'),
  'business-process': k('archimate', 'business', 'round', 'process', 'Business process'),
  'business-function': k('archimate', 'business', 'round', 'function', 'Business function'),
  'business-event': k('archimate', 'business', 'round', 'event', 'Business event'),
  'business-service': k('archimate', 'business', 'round', 'service', 'Business service'),
  'business-object': k('archimate', 'business', 'sheet', 'none', 'Business object'),
  contract: k('archimate', 'business', 'sheet', 'none', 'Contract'),
  product: k('archimate', 'business', 'sheet', 'none', 'Product'),
  // ArchiMate: application
  'application-component': k('archimate', 'application', 'box', 'component', 'Application component'),
  'application-collaboration': k('archimate', 'application', 'box', 'collaboration', 'Application collaboration'),
  'application-interface': k('archimate', 'application', 'box', 'interface', 'Application interface'),
  'application-function': k('archimate', 'application', 'round', 'function', 'Application function'),
  'application-process': k('archimate', 'application', 'round', 'process', 'Application process'),
  'application-event': k('archimate', 'application', 'round', 'event', 'Application event'),
  'application-service': k('archimate', 'application', 'round', 'service', 'Application service'),
  'data-object': k('archimate', 'application', 'sheet', 'none', 'Data object'),
  // ArchiMate: technology
  node: k('archimate', 'technology', 'node3d', 'none', 'Node'),
  device: k('archimate', 'technology', 'node3d', 'device', 'Device'),
  'system-software': k('archimate', 'technology', 'box', 'software', 'System software'),
  'technology-interface': k('archimate', 'technology', 'box', 'interface', 'Technology interface'),
  'technology-service': k('archimate', 'technology', 'round', 'service', 'Technology service'),
  'communication-network': k('archimate', 'technology', 'box', 'network', 'Communication network'),
  artifact: k('archimate', 'technology', 'sheet', 'artifact', 'Artifact'),
  // ArchiMate: implementation and migration
  'work-package': k('archimate', 'implementation', 'round', 'workpackage', 'Work package'),
  deliverable: k('archimate', 'implementation', 'sheet', 'none', 'Deliverable'),
  plateau: k('archimate', 'implementation', 'node3d', 'plateau', 'Plateau'),
  gap: k('archimate', 'implementation', 'ellipse', 'gap', 'Gap'),
  // UML: classifiers (tones match the native Archify class renderer)
  class: k('uml', 'application', 'classifier', 'none', 'Class', { tone: 'backend' }),
  abstract: k('uml', 'application', 'classifier', 'none', 'Abstract class', { tone: 'backend', stereotype: 'abstract', italic: true }),
  interface: k('uml', 'application', 'classifier', 'none', 'Interface', { tone: 'frontend', stereotype: 'interface' }),
  enum: k('uml', 'application', 'classifier', 'none', 'Enumeration', { tone: 'messagebus', stereotype: 'enumeration' }),
  record: k('uml', 'application', 'classifier', 'none', 'Record', { tone: 'database', stereotype: 'record' }),
  entity: k('uml', 'application', 'classifier', 'none', 'Entity', { tone: 'database', stereotype: 'entity' }),
  // UML: structure and use cases
  component: k('uml', 'application', 'box', 'component', 'Component'),
  package: k('uml', 'application', 'box', 'package', 'Package'),
  actor: k('uml', 'business', 'actor', 'none', 'Actor', { tone: 'external' }),
  usecase: k('uml', 'application', 'ellipse', 'none', 'Use case'),
  'execution-node': k('uml', 'technology', 'node3d', 'none', 'Execution node'),
  // UML: behaviour
  state: k('uml', 'application', 'round', 'none', 'State'),
  initial: k('uml', 'other', 'event', 'none', 'Initial node', { fill: 'solid' }),
  final: k('uml', 'other', 'event', 'none', 'Final node', { fill: 'bullseye' }),
  choice: k('uml', 'other', 'gateway', 'none', 'Choice', { tone: 'cloud' }),
  action: k('uml', 'application', 'round', 'none', 'Action'),
  decision: k('uml', 'other', 'gateway', 'none', 'Decision', { tone: 'cloud' }),
  merge: k('uml', 'other', 'gateway', 'none', 'Merge', { tone: 'cloud' }),
  fork: k('uml', 'other', 'bar', 'none', 'Fork'),
  join: k('uml', 'other', 'bar', 'none', 'Join'),
  'object-node': k('uml', 'application', 'sheet', 'none', 'Object node', { tone: 'database' }),
  // BPMN
  'start-event': k('bpmn', 'business', 'event', 'none', 'Start event', { tone: 'backend', ring: 'thin' }),
  'intermediate-event': k('bpmn', 'business', 'event', 'none', 'Intermediate event', { tone: 'cloud', ring: 'double' }),
  'end-event': k('bpmn', 'business', 'event', 'none', 'End event', { tone: 'security', ring: 'thick' }),
  task: k('bpmn', 'business', 'round', 'none', 'Task', { tone: 'frontend' }),
  subprocess: k('bpmn', 'business', 'round', 'subprocess', 'Sub-process', { tone: 'frontend' }),
  'exclusive-gateway': k('bpmn', 'business', 'gateway', 'none', 'Exclusive gateway', { mark: 'x' }),
  'parallel-gateway': k('bpmn', 'business', 'gateway', 'none', 'Parallel gateway', { mark: 'plus' }),
  'inclusive-gateway': k('bpmn', 'business', 'gateway', 'none', 'Inclusive gateway', { mark: 'o' }),
  'data-store': k('bpmn', 'business', 'sheet', 'store', 'Data store', { tone: 'database' }),
  // Shared
  note: k('shared', 'other', 'note', 'none', 'Note'),
};

// Markers: none | open (open arrow) | filled (solid arrow) | triangle (hollow
// generalisation) | diamond / diamond-filled | dot | circle (hollow).
const r = (family, label, dash, start, end, verb) => ({ family, label, dash, start, end, verb });

export const RELATIONS = {
  // Structural
  composition: r('structural', 'Composition', 'solid', 'diamond-filled', 'none', 'is composed of'),
  aggregation: r('structural', 'Aggregation', 'solid', 'diamond', 'none', 'aggregates'),
  assignment: r('structural', 'Assignment', 'solid', 'dot', 'filled', 'is assigned to'),
  realization: r('structural', 'Realization', 'dashed', 'none', 'triangle', 'realizes'),
  // Dependency
  serving: r('dependency', 'Serving', 'solid', 'none', 'open', 'serves'),
  access: r('dependency', 'Access', 'dotted', 'none', 'open', 'accesses'),
  influence: r('dependency', 'Influence', 'dashed', 'none', 'open', 'influences'),
  dependency: r('dependency', 'Dependency', 'dashed', 'none', 'open', 'depends on'),
  include: r('dependency', 'Include', 'dashed', 'none', 'open', 'includes'),
  extend: r('dependency', 'Extend', 'dashed', 'none', 'open', 'extends'),
  deployment: r('dependency', 'Deployment', 'dashed', 'none', 'open', 'is deployed on'),
  // Dynamic
  triggering: r('dynamic', 'Triggering', 'solid', 'none', 'filled', 'triggers'),
  flow: r('dynamic', 'Flow', 'dashed', 'none', 'filled', 'flows to'),
  'sequence-flow': r('dynamic', 'Sequence flow', 'solid', 'none', 'filled', 'then'),
  'message-flow': r('dynamic', 'Message flow', 'dashed', 'circle', 'open', 'messages'),
  transition: r('dynamic', 'Transition', 'solid', 'none', 'filled', 'transitions to'),
  'control-flow': r('dynamic', 'Control flow', 'solid', 'none', 'open', 'then'),
  'object-flow': r('dynamic', 'Object flow', 'dotted', 'none', 'open', 'passes'),
  // Other
  specialization: r('other', 'Specialization', 'solid', 'none', 'triangle', 'specializes'),
  inheritance: r('other', 'Inheritance', 'solid', 'none', 'triangle', 'extends'),
  association: r('other', 'Association', 'solid', 'none', 'none', 'is associated with'),
};

export const VIEW_TYPES = {
  archimate: { label: 'ArchiMate viewpoint', family: 'Enterprise' },
  bpmn: { label: 'BPMN process', family: 'Process' },
  activity: { label: 'UML activity', family: 'Process' },
  state: { label: 'UML state machine', family: 'Process' },
  sequence: { label: 'UML sequence', family: 'Interaction' },
  usecase: { label: 'UML use case', family: 'Interaction' },
  class: { label: 'UML class', family: 'Structure' },
  component: { label: 'UML component', family: 'Structure' },
  deployment: { label: 'UML deployment', family: 'Structure' },
};

export const GROUP_KINDS = ['lane', 'boundary', 'pool', 'package', 'system'];

// 16x16 corner glyphs, stroked with the element's tone. Each is path data.
export const GLYPHS = {
  actor: 'M8 2.2a1.9 1.9 0 1 0 0 3.8a1.9 1.9 0 0 0 0-3.8M8 6v4.6M4.6 7.6h6.8M8 10.6l-2.8 3.2M8 10.6l2.8 3.2',
  role: 'M4 4h7.5M4 12h7.5M4 4a2.2 4 0 0 0 0 8M11.5 4a2.2 4 0 0 1 0 8a2.2 4 0 0 1 0-8',
  collaboration: 'M6 4a4 4 0 1 0 0 8a4 4 0 0 0 0-8M10 4a4 4 0 1 0 0 8a4 4 0 0 0 0-8',
  interface: 'M2 8h5M10.5 4.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 0 0 0-7',
  process: 'M2 6h7V3.5L14 8l-5 4.5V10H2z',
  function: 'M3 13V6.5L8 3l5 3.5V13L8 9.5z',
  event: 'M2.5 4h7.5a4 4 0 0 1 0 8H2.5a4 4 0 0 0 0-8',
  service: 'M5.5 4.5h5a3.5 3.5 0 0 1 0 7h-5a3.5 3.5 0 0 1 0-7',
  component: 'M5 2.5h9v11H5v-2.5M5 8.5V6.5M5 4.5v-2M2.5 4.5h5v2h-5zM2.5 8.5h5v2.5h-5z',
  package: 'M2 5h12v8.5H2zM2 5V2.8h5V5',
  software: 'M5.5 5.5a4.2 4.2 0 1 0 0 8.4a4.2 4.2 0 0 0 0-8.4M7 3.5a4.2 4.2 0 0 1 5.8 5.8',
  device: 'M3 3.5h10v6.5H3zM1.8 13h12.4L13 10H3z',
  network: 'M4 11a1.6 1.6 0 1 0 0 .1M12 11a1.6 1.6 0 1 0 0 .1M5.5 5a1.6 1.6 0 1 0 0 .1M13 5a1.6 1.6 0 1 0 0 .1M5.2 6.5l-1 3M12.7 6.5l-.6 3M7 5h4.4M5.6 11h4.8',
  artifact: 'M4 2h5.5L12.5 5v9H4zM9.5 2v3h3',
  store: 'M2.5 4.5a5.5 2 0 0 1 11 0v7a5.5 2 0 0 1-11 0zM2.5 4.5a5.5 2 0 0 0 11 0M2.5 7a5.5 2 0 0 0 11 0',
  goal: 'M8 2.5a5.5 5.5 0 1 0 0 11a5.5 5.5 0 0 0 0-11M8 5.2a2.8 2.8 0 1 0 0 5.6a2.8 2.8 0 0 0 0-5.6M8 7.6a.4.4 0 1 0 0 .8a.4.4 0 0 0 0-.8',
  outcome: 'M7 4a5 5 0 1 0 5 5M7 6.6a2.4 2.4 0 1 0 2.4 2.4M7 9l6-6M10.6 3H13v2.4',
  driver: 'M8 2.5a5.5 5.5 0 1 0 0 11a5.5 5.5 0 0 0 0-11M8 1v14M1 8h14M3 3l10 10M13 3L3 13',
  assessment: 'M9.5 2.5a4 4 0 1 0 0 8a4 4 0 0 0 0-8M6.6 9.4L2.5 13.5',
  principle: 'M3 2.5h10v11H3zM8 5v4.5M8 11.4v.4',
  requirement: 'M5 3.5h9.5L11 12.5H1.5z',
  constraint: 'M5 3.5h9.5L11 12.5H1.5zM7.5 3.5L4 12.5',
  resource: 'M2 4.5h10.5v7H2zM12.5 6.5H14v3h-1.5M4.5 6.5v3M6.8 6.5v3M9.1 6.5v3',
  capability: 'M2 13.5h4v-4h4v-4h4v8H6M6 13.5v-4M10 13.5v-4',
  workpackage: 'M8 2.8a5.2 5.2 0 1 0 5.2 5.2M13.2 8l-2-2.2M13.2 8l1.8-2',
  plateau: 'M4 5h10M3 8h10M2 11h10',
  gap: 'M8 3a5 5 0 1 0 0 10a5 5 0 0 0 0-10M1.5 6.6h13M1.5 9.4h13',
  subprocess: 'M3 3h10v10H3zM8 5.5v5M5.5 8h5',
  // BPMN task and event markers
  user: 'M8 2.5a2.3 2.3 0 1 0 0 4.6a2.3 2.3 0 0 0 0-4.6M3 13.5c0-3 2-5 5-5s5 2 5 5z',
  serviceTask: 'M8 5.4a2.6 2.6 0 1 0 0 5.2a2.6 2.6 0 0 0 0-5.2M8 1.8v2M8 12.2v2M1.8 8h2M12.2 8h2M3.6 3.6l1.5 1.5M10.9 10.9l1.5 1.5M12.4 3.6l-1.5 1.5M5.1 10.9l-1.5 1.5',
  script: 'M5 2.5h8c-2 2.5-2 3.5 0 5.5s2 3 0 5.5H3c2-2.5 2-3.5 0-5.5S3 5 5 2.5M6 6h4M6 8.5h4M6 11h3',
  send: 'M2 4h12v8H2zM2 4l6 4.6L14 4',
  receive: 'M2 4h12v8H2zM2 4l6 4.6L14 4',
  manual: 'M3 8.5V6.2c0-1.2 1.6-1.2 1.6 0V4c0-1.2 1.6-1.2 1.6 0v-.7c0-1.2 1.6-1.2 1.6 0V4c0-1.2 1.6-1.2 1.6 0v5.5l1.2-1.6c.8-1 2.1-.2 1.5.9L10 13.5H5.4C4 13.5 3 12 3 10.5z',
  message: 'M3 4.5h10v7H3zM3 4.5l5 4l5-4',
  timer: 'M8 3a5 5 0 1 0 0 10a5 5 0 0 0 0-10M8 5v3l2 1.4',
  error: 'M3 12.5l3-8.5l3 5l3-6l-2.4 9.5l-3-5z',
  signal: 'M8 3.2l5 8.8H3z',
};

export const TASK_GLYPHS = { user: 'user', service: 'serviceTask', script: 'script', send: 'send', receive: 'receive', manual: 'manual' };
export const EVENT_GLYPHS = { message: 'message', timer: 'timer', error: 'error', signal: 'signal' };

export function kindSpec(kind) {
  return KINDS[kind] || null;
}

export function toneOf(element) {
  if (element && TONES.includes(element.tone)) return element.tone;
  return KINDS[element?.kind]?.tone || 'external';
}

export function layerOf(element) {
  return element?.layer && LAYERS[element.layer] ? element.layer : KINDS[element?.kind]?.layer || 'other';
}

export const isClassifier = (kind) => KINDS[kind]?.shape === 'classifier';

// Theme tokens mirror viewer/viewer.css so an exported SVG carries the same
// palette as a native Archify artifact without the Viewer stylesheet.
export const THEMES = {
  dark: {
    bg: '#020617', mask: '#0f172a', text: '#ffffff', muted: '#94a3b8', dim: '#475569', border: '#1e293b',
    lane: 'rgba(15, 23, 42, 0.22)', laneStroke: '#334155', arrow: '#94a3b8', focus: '#22d3ee', dot: 'rgba(148, 163, 184, 0.16)',
    tones: { frontend: '#22d3ee', backend: '#34d399', database: '#a78bfa', cloud: '#fbbf24', security: '#fb7185', messagebus: '#fb923c', external: '#94a3b8' },
  },
  light: {
    bg: '#f4f5f7', mask: '#ffffff', text: '#111827', muted: '#5b6474', dim: '#9aa3b2', border: '#e5e7eb',
    lane: 'rgba(248, 250, 252, 0.65)', laneStroke: '#cbd5e1', arrow: '#64748b', focus: '#0891b2', dot: '#e2e7ec',
    tones: { frontend: '#0891b2', backend: '#059669', database: '#7c3aed', cloud: '#d97706', security: '#e11d48', messagebus: '#ea580c', external: '#64748b' },
  },
  blueprint: {
    bg: '#030711', mask: '#07101e', text: '#f5fbff', muted: '#9eb0c7', dim: '#52667f', border: '#1d3350',
    lane: 'rgba(9, 22, 40, 0.5)', laneStroke: '#2c4564', arrow: '#9eb0c7', focus: '#67e8f9', dot: 'rgba(120, 144, 173, 0.18)',
    tones: { frontend: '#67e8f9', backend: '#5eead4', database: '#c4b5fd', cloud: '#fcd34d', security: '#fda4af', messagebus: '#fdba74', external: '#9eb0c7' },
  },
};

export function themeCss(scope) {
  return Object.entries(THEMES).map(([name, t]) => {
    const vars = [
      `--bg:${t.bg}`, `--mask:${t.mask}`, `--text:${t.text}`, `--text-muted:${t.muted}`, `--text-dim:${t.dim}`,
      `--panel-border:${t.border}`, `--lane-fill:${t.lane}`, `--lane-stroke:${t.laneStroke}`, `--arrow:${t.arrow}`,
      `--focus:${t.focus}`, `--canvas-dot:${t.dot}`,
      ...TONES.map((tone) => `--${tone}-stroke:${t.tones[tone]}`),
    ];
    return `${scope}[data-theme="${name}"]{${vars.join(';')}}`;
  }).join('\n');
}
