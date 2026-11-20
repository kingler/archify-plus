# Archify Enterprise

One typed-JSON model repository, many consistent views, and generators for
code and delivery tasks. It extends Archify's visual system (the seven semantic
tones, the mono type scale, the authored grid) to ArchiMate, BPMN, and the UML
diagram family, and compiles down to Archify's native diagram types where one
exists.

```
enterprise/
  lib/notation.mjs   every element kind, relationship kind, shape, glyph, and theme token
  lib/model.mjs      repository helpers and validation diagnostics
  lib/layout.mjs     grid sizing, lanes and frames, orthogonal routing, sequence layout
  lib/render.mjs     self-contained SVG for any view
  lib/codegen.mjs    TypeScript, Java, Python, SQL, OpenAPI, state machines, BPMN 2.0, ArchiMate exchange
  lib/tasks.mjs      dependency-ordered delivery plan by TOGAF ADM phase; GOAL agent program
  lib/simulate.mjs   token-flow execution for activity, BPMN, and state views
  lib/native.mjs     compile views to native Archify typed JSON
  bin/enterprise.mjs CLI
  studio.html        the interactive Studio (generated, self-contained)
  examples/          order-to-cash.enterprise.json
```

No dependencies. Node 18 or newer.

## Try it

Paths below are relative to the Skill package root (`archify/` in the repository).

Open `enterprise/studio.html` in a browser. It loads the bundled example and
keeps your edits in that browser's local storage.

- **Views** (left): thirteen views over one repository, grouped by family.
- **Canvas**: drag the background to pan, scroll to zoom, click a node or
  relationship to inspect it, drag a node to another grid cell. `+ Element`
  adds a kind that fits the current view.
- **Inspect**: rename, re-kind, document, connect, or delete. A change applies
  everywhere the element appears.
- **Code**: pick a target, read the files, copy one or all.
- **Tasks**: the delivery plan by ADM phase; click a task to jump to the
  element it traces to. Copy as Markdown, CSV, JSON, or a GOAL agent program.
- **Model**: the typed JSON itself. Edit and apply, or open a file.
- **Run tokens** (activity, BPMN, and state views): step a token run on the
  diagram. Dashed nodes can fire; unguarded branches ask you to choose.

Or use the CLI:

```bash
node enterprise/bin/enterprise.mjs validate enterprise/examples/order-to-cash.enterprise.json
```

```bash
node enterprise/bin/enterprise.mjs build enterprise/examples/order-to-cash.enterprise.json --out enterprise-out
```

`build` writes `diagrams/*.svg`, `code/**`, `tasks/**`, `goal/**`, and
`archify/*.json`. The single-purpose commands are `render`, `code`, `tasks`,
`archify`, and `simulate`; run the CLI with no arguments for their flags.

## The visual language

`lib/notation.mjs` is the only place a kind is given a look, so a kind cannot
drift between diagram types.

**Colour is the architecture layer.** The mapping follows the ArchiMate
convention, expressed in Archify's fixed palette:

| Layer | Tone | Token |
| --- | --- | --- |
| Motivation | violet | `database` |
| Strategy | orange | `messagebus` |
| Business | amber | `cloud` |
| Application | cyan | `frontend` |
| Technology | green | `backend` |
| Implementation & migration | rose | `security` |
| Other, external actors | slate | `external` |

UML classifiers keep the tones of the native class renderer (class green,
interface cyan, enumeration orange, record and entity violet). An element may
override its tone with `"tone"`.

**Shape is the aspect.**

| Shape | Meaning | Used by |
| --- | --- | --- |
| `box`, square corners | active structure: who or what acts | actors, roles, components, interfaces, system software |
| `round`, rounded corners | behaviour: what is performed | processes, functions, services, events, BPMN tasks, UML actions and states |
| `sheet`, header rule | passive structure: what is acted on | business and data objects, contracts, artifacts, deliverables |
| `chamfer`, cut corners | motivation: why | stakeholders, drivers, goals, requirements, principles |
| `classifier` | typed structure with members | class, abstract, interface, enum, record, entity |
| `node3d` | a place things run | nodes, devices, execution nodes, plateaus |
| `event`, `gateway`, `bar` | control | BPMN events and gateways; UML initial, final, decision, merge, fork, join |
| `actor`, `ellipse` | UML use-case actors and use cases | |

A 16px corner glyph distinguishes kinds that share a shape (component,
interface, service, process, and so on).

**A relationship kind owns its whole notation**: line style plus both markers.
The same kind draws the same way in every view, which `test/enterprise.test.mjs`
checks.

| Kind | Line | Markers |
| --- | --- | --- |
| `composition` / `aggregation` | solid | filled / hollow diamond at the whole |
| `assignment` | solid | dot at the source, filled arrow |
| `realization` | dashed | hollow triangle |
| `inheritance`, `specialization` | solid | hollow triangle |
| `serving` | solid | open arrow |
| `access`, `object-flow` | dotted | open arrow |
| `influence`, `dependency`, `include`, `extend`, `deployment` | dashed | open arrow |
| `triggering`, `sequence-flow`, `transition` | solid | filled arrow |
| `flow` | dashed | filled arrow |
| `control-flow` | solid | open arrow |
| `message-flow` | dashed | hollow circle at the source, open arrow |
| `association` | solid | none |

Containers share one vocabulary too: a `lane` is a full-width band with a
rotated label (ArchiMate layers, BPMN lanes); `boundary`, `system`, and
`package` are frames around their members.

Themes are `dark`, `light`, and `blueprint`, with the same token values as
`viewer/viewer.css`. The tokens travel inside each SVG, so an exported file
needs no stylesheet.

## The model

```json
{
  "schema_version": 1,
  "model_type": "enterprise",
  "meta": { "title": "Order-to-Cash Platform" },
  "elements": [
    { "id": "order_svc", "kind": "application-component", "label": "Order Service", "tech": "Node.js" }
  ],
  "relationships": [
    { "id": "r1", "from": "order_svc", "to": "as_order", "kind": "realization" }
  ],
  "views": [
    { "id": "overview", "type": "archimate", "title": "Overview", "nodes": [{ "ref": "order_svc", "row": 0, "col": 0 }] }
  ]
}
```

- **Elements** live once in the repository. Classifiers add `attributes`
  (`name`, `type`, `visibility`, `static`, `pk`, `nullable`, `unique`) and
  `methods` (`name`, `parameters`, `returns`, `visibility`, `static`,
  `abstract`). BPMN tasks take `taskType` (`user`, `service`, `script`,
  `send`, `receive`, `manual`); events take `trigger` (`message`, `timer`,
  `error`, `signal`). Application interfaces may list `operations` for OpenAPI.
- **Relationships** read `from` to `to`. Optional `label`, `guard` (for
  decisions), `fromMult` / `toMult`, and `role` (the generated field name).
- **Views** place elements by `row` and `col`, the same authored-grid contract
  as Archify's native renderers. A half step such as `1.5` centres a node
  between two columns. A view draws every relationship whose two ends it
  places; narrow that with `relationships` (an allow list) or `exclude`.
  `groups` add lanes and frames. `routes` can pin `fromSide` / `toSide` for a
  relationship. `vars` supplies guard values for token runs.

View types: `archimate` (set `viewpoint` to name it), `bpmn`, `activity`,
`state`, `sequence`, `usecase`, `class`, `component`, `deployment`. A sequence
view lists `participants`, ordered `messages` (`sync`, `async`, `reply`,
`self`), and optional `fragments` over message index ranges.

Validation returns diagnostics shaped like Archify's: a stable `code` under
`enterprise/`, a `severity`, a `subject`, a `message`, and `supportedFixes`.
The CLI exits non-zero and writes nothing when there is an error.

## Generators

| Target | From | Checked with |
| --- | --- | --- |
| `typescript` | classifiers, generalisation, association ends | `tsc --strict` |
| `java` | the same | `javac` |
| `python` | the same (dataclasses, `Protocol`, `Enum`) | import and type-hint resolution |
| `sql` | `entity` classifiers; keys from multiplicity | loaded into PostgreSQL 16 |
| `openapi` | application interfaces with `operations` | YAML parse |
| `statemachine` | `state` views | `tsc --strict` |
| `bpmn` | `bpmn` and `activity` views, with diagram interchange | imported into bpmn-js 17 (bpmn.io) with no warnings |
| `archimate` | ArchiMate elements, relationships, and views | XML well-formedness |

The last column is what was run by hand against the example model when this
was written; the repository test suite checks structure, not compilation. The
ArchiMate exchange file has not been opened in Archi, Sparx EA, or Visual
Paradigm, and the GOAL program has not been run through the GOAL toolchain.
Treat those two as starting points to verify in your tool.

### Tasks

`lib/tasks.mjs` turns each element into work with acceptance criteria, files it
under a TOGAF ADM phase, and derives order from the relationships:

- a consumer waits for what serves it;
- a realiser follows its contract, and a requirement is verified (phase G)
  after whatever realises it is built;
- a whole follows its parts, except in the technology layer, where software
  follows the node that hosts it;
- an artifact is built after its component and deployed after its node;
- triggering and flow run source first.

Tasks in the same wave have no dependencies on each other. A dependency cycle
does not block the plan: one dependency is dropped and reported in
`droppedDependencies`.

### Native Archify output

`enterprise archify` writes typed JSON for views with a native diagram type:
`class`, `sequence`, `state` (as `lifecycle`), and `archimate` / `component` /
`deployment` (as `architecture`). Render them with the existing CLI to get the
full Viewer, validators, and delivery receipts:

```bash
node bin/archify.mjs render class enterprise-out/archify/domain_classes.class.json
```

Fractional grid positions are ranked into whole native cells. Where a native
type cannot carry something over, the CLI prints a `note:` line: a sequence
self-message becomes a note on the nearest real message, and a
self-relationship or self-transition is left out. A sequence view made only of
self-messages gets no native file.

The architecture renderer has seven node types and four connection variants,
so layer colour and solid versus dashed survive but ArchiMate shapes and
markers do not. BPMN, activity, and use-case views have no native type; the
workflow schema allows six columns, which is too few for most processes.

## Changing the Studio

`studio.html` is generated. Edit `studio/studio.source.html` or `lib/`, then:

```bash
node enterprise/scripts/build-studio.mjs
```

The build inlines the library modules into one script, so top-level names must
be unique across `lib/`; the build fails with the two file names if they are
not. The repository test `test/enterprise.test.mjs` fails when the committed page is stale.

## Scope

This layer ships inside the Skill package. It does not import existing BPMN,
XMI, or ArchiMate files, lay out a view without authored rows and columns, or
generate method bodies.
