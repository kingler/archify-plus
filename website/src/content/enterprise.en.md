# Enterprise models: ArchiMate, BPMN and UML from one model

<span id="answer" class="section-anchor" aria-hidden="true"></span>

## The short answer

Archify Enterprise keeps your elements and relationships in **one typed-JSON model** and draws them as many views: ArchiMate viewpoints, BPMN processes, and UML activity, state, sequence, use-case, class, component and deployment diagrams. Every view uses the same visual language, so an element looks the same wherever it appears.

From that same model it generates code and a delivery plan. It ships inside the Archify Skill from v3.3.0, in the `enterprise/` folder, and needs no dependencies beyond Node.js 18.

It is a modelling and generation layer, not a hosted repository or a drawing tool. You or your agent author the model; Archify validates it, draws it, and generates from it.

<span id="views" class="section-anchor" aria-hidden="true"></span>

## Nine view types over one repository

An element lives once in the model. A view places elements on a row and column grid, the same authored-grid contract as Archify's native diagrams, and draws every relationship whose two ends it places.

| View type | Use it for |
| --- | --- |
| `archimate` | Layered, application cooperation, motivation, technology and migration viewpoints |
| `bpmn` | Processes with lanes, events, typed tasks and gateways |
| `activity` | UML activities with decisions, forks and joins |
| `state` | State machines |
| `sequence` | Lifelines, messages and fragments |
| `usecase` | Actors, use cases and a system boundary |
| `class` | Classifiers with attributes, methods and multiplicities |
| `component` | Components, packages and their dependencies |
| `deployment` | Nodes, execution environments and artifacts |

The bundled example, an invented order-to-cash platform, has 100 elements and 14 views.

<span id="language" class="section-anchor" aria-hidden="true"></span>

## One visual language

One catalog gives every element kind and relationship kind its look, so a kind cannot drift between diagram types.

**Colour is the architecture layer.** The mapping follows the ArchiMate convention, expressed in Archify's fixed palette:

| Layer | Colour |
| --- | --- |
| Motivation | violet |
| Strategy | orange |
| Business | amber |
| Application | cyan |
| Technology | green |
| Implementation and migration | rose |
| Other, external actors | slate |

**Shape is the role.** Square corners mean active structure (who or what acts). Rounded corners mean behaviour (what is performed). A header rule means passive structure (what is acted on). Cut corners mean motivation (why). Classifiers show member compartments; events, gateways and bars carry control.

**A relationship kind owns its whole notation**, line style plus both markers. A realization is dashed with a hollow triangle in an ArchiMate view and in a class view alike. The repository tests check this for every relationship kind the example uses.

Dark, light and blueprint themes carry the same tokens as native Archify artifacts, and the tokens travel inside each exported SVG.

<span id="studio" class="section-anchor" aria-hidden="true"></span>

## Try the Studio

The Studio is a single self-contained page over the same model. It runs here in your browser: nothing is uploaded, and your edits stay in this browser's local storage.

<iframe class="studio-frame" src="enterprise-studio.html" title="Archify Enterprise Studio" loading="lazy"></iframe>

<p class="studio-open"><a href="enterprise-studio.html">Open the Studio in its own tab →</a></p>

- **Views** switches between the fourteen example views.
- **Canvas:** drag to pan, scroll to zoom, select a node or relationship, drag a node to another grid cell.
- **Inspect:** rename, re-kind, document, connect or delete. A change applies everywhere the element appears.
- **Code** and **Tasks** show what the model generates.
- **Model** is the typed JSON itself. Edit it and apply.
- **Run tokens** steps a token through activity, BPMN and state views.

The Studio offers copy buttons, not file downloads. Use the command line to write files.

<span id="generate" class="section-anchor" aria-hidden="true"></span>

## What it generates

**Code.** TypeScript, Java and Python types from classifiers and their relationships. PostgreSQL DDL from entities, with keys derived from multiplicity. OpenAPI from application interfaces. State-machine tables from state views. BPMN 2.0 XML with diagram interchange, and the ArchiMate exchange format.

**Tasks.** A delivery plan grouped by TOGAF ADM phase. Each element becomes work with acceptance criteria, and order comes from the relationships already modelled: a consumer waits for what serves it, a requirement is verified after whatever realises it is built, and an artifact is deployed after its node exists. The plan exports as Markdown, CSV, JSON, or a GOAL agent program.

**Native Archify diagrams.** Class, sequence, state and architecture-shaped views compile to Archify's native typed JSON, so the existing renderers, Viewer and delivery checks apply to them. See the [agent diagramming guide](agent-diagrams.html) for that workflow.

<span id="cli" class="section-anchor" aria-hidden="true"></span>

## From the command line

Run these from the installed Skill folder:

```bash
node enterprise/bin/enterprise.mjs validate enterprise/examples/order-to-cash.enterprise.json
node enterprise/bin/enterprise.mjs build enterprise/examples/order-to-cash.enterprise.json --out enterprise-out
```

`build` writes one SVG per view, the generated code, the task plan, and the native typed JSON. `validate` reports problems with a stable code, the element concerned, and a supported fix; an invalid model writes nothing.

To ask your agent instead, [install Archify](start.html) and describe the model in plain words, for example: *"Model our ordering platform as an ArchiMate layered view and a BPMN fulfilment process, then generate the task plan."*

<span id="limits" class="section-anchor" aria-hidden="true"></span>

## Honest limits

- **Authored layout.** Views need rows and columns. There is no automatic layout.
- **No import.** It does not read existing BPMN, XMI or ArchiMate files.
- **Skeletons, not implementations.** Generated code has types, fields and method stubs, not method bodies.
- **Partly verified exports.** The generated BPMN opened in the bpmn.io viewer without warnings. The ArchiMate exchange file was checked only for well-formed XML, and the GOAL agent program has not been run through the GOAL toolchain. Verify those two in your own tool.
- **Delivery checks.** BPMN, activity and use-case views have no native Archify diagram type, so their SVGs do not pass through Archify's delivery checks. The compiled native diagrams do.
- **A model, not proof.** Like every Archify diagram, a view shows the facts its author supplied. It does not prove that a running system behaves that way.
