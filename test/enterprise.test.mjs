import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SaxesParser } from 'saxes';

import { validateModel } from '../enterprise/lib/model.mjs';
import { renderView } from '../enterprise/lib/render.mjs';
import { generateCode, classifierModel } from '../enterprise/lib/codegen.mjs';
import { generateTasks, tasksCsv, tasksGoal, tasksMarkdown } from '../enterprise/lib/tasks.mjs';
import { createRun, enabled, fire, runToCompletion } from '../enterprise/lib/simulate.mjs';
import { compileNative } from '../enterprise/lib/native.mjs';
import { buildStudio } from '../enterprise/scripts/build-studio.mjs';
import { createScratchDirectory } from './helpers/scratch-directory.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const examplePath = path.join(repoRoot, 'enterprise', 'examples', 'order-to-cash.enterprise.json');
const cli = path.join(repoRoot, 'enterprise', 'bin', 'enterprise.mjs');
const archify = path.join(repoRoot, 'archify', 'bin', 'archify.mjs');
const load = () => JSON.parse(fs.readFileSync(examplePath, 'utf8'));
const codes = (model) => validateModel(model).diagnostics.map((entry) => entry.code);
const file = (files, suffix) => files.find((entry) => entry.path.endsWith(suffix))?.content ?? assert.fail(`missing generated file ${suffix}`);

function assertWellFormed(xml, label) {
  const parser = new SaxesParser({ xmlns: true });
  parser.on('error', (error) => assert.fail(`${label}: ${error.message}`));
  parser.write(xml).close();
}

test('the example model is valid and every element is placed', () => {
  assert.deepEqual(validateModel(load()).diagnostics, []);
});

test('validation reports repairable problems instead of rendering a broken model', () => {
  const dangling = load(); dangling.relationships[0].to = 'missing';
  assert.ok(codes(dangling).includes('enterprise/dangling-reference'));

  const collision = load(); const nodes = collision.views[0].nodes; nodes[1].row = nodes[0].row; nodes[1].col = nodes[0].col;
  assert.ok(codes(collision).includes('enterprise/cell-collision'));

  const cycle = load();
  cycle.relationships.push({ id: 'x1', from: 'CardGateway', to: 'WalletGateway', kind: 'inheritance' }, { id: 'x2', from: 'WalletGateway', to: 'CardGateway', kind: 'inheritance' });
  assert.ok(codes(cycle).includes('enterprise/inheritance-cycle'));

  const unknown = load(); unknown.elements[0].kind = 'widget';
  const result = validateModel(unknown);
  assert.equal(result.ok, false);
  assert.ok(result.diagnostics.every((entry) => entry.message && Array.isArray(entry.supportedFixes)));
});

test('every view renders well-formed SVG that shows each placed element and relationship', () => {
  const model = load();
  for (const view of model.views) {
    for (const theme of ['dark', 'light', 'blueprint']) {
      const { svg } = renderView(model, view.id, { theme });
      assertWellFormed(svg, `${view.id} (${theme})`);
      assert.ok(svg.includes(`data-theme="${theme}"`));
    }
    const { svg, layout } = renderView(model, view.id);
    const placed = view.type === 'sequence' ? view.participants : view.nodes.map((node) => node.ref);
    for (const ref of placed) assert.ok(svg.includes(`data-id="${ref}"`), `${view.id} is missing node ${ref}`);
    if (view.type === 'sequence') assert.equal(layout.messages.length, view.messages.length);
    else assert.ok(layout.edges.length > 0, `${view.id} draws no relationships`);
  }
});

test('one relationship kind keeps one notation in every diagram type', () => {
  const model = load();
  const notation = new Map();
  for (const view of model.views.filter((entry) => entry.type !== 'sequence')) {
    const { svg } = renderView(model, view.id);
    for (const [, kind, body] of svg.matchAll(/<g class="ea-edge" data-id="[^"]+" data-from="[^"]+" data-to="[^"]+" data-kind="([^"]+)">([\s\S]*?)<\/g>/g)) {
      const line = body.match(/class="(ea-line[^"]*)"/)[1];
      const marks = [...body.matchAll(/class="ea-mark ([^"]+)"[^>]* d="([^"]+)"/g)].map((match) => `${match[1]}:${match[2]}`).join('|');
      const signature = `${line}|${marks}`;
      if (!notation.has(kind)) notation.set(kind, { signature, view: view.id });
      assert.equal(signature, notation.get(kind).signature, `${kind} looks different in ${view.id} than in ${notation.get(kind).view}`);
    }
  }
  // Realization appears in ArchiMate and class views; it must stay dashed with a hollow triangle in both.
  assert.match(notation.get('realization').signature, /ea-dashed\|ea-mark-hollow:M-12/);
  assert.ok(notation.size >= 15, `expected the example to exercise most relationship kinds, saw ${notation.size}`);
});

test('relationships attach to the nodes they connect', () => {
  const model = load();
  for (const view of model.views.filter((entry) => entry.type !== 'sequence')) {
    const { layout } = renderView(model, view.id);
    const byId = new Map(layout.nodes.map((node) => [node.id, node]));
    const onBorder = (point, node) => point[0] >= node.x - 0.5 && point[0] <= node.x + node.w + 0.5 && point[1] >= node.y - 0.5 && point[1] <= node.y + node.h + 0.5;
    for (const edge of layout.edges) {
      assert.ok(onBorder(edge.points[0], byId.get(edge.from)), `${view.id}/${edge.id} does not start on ${edge.from}`);
      assert.ok(onBorder(edge.points.at(-1), byId.get(edge.to)), `${view.id}/${edge.id} does not end on ${edge.to}`);
      for (let index = 1; index < edge.points.length; index += 1) {
        const [a, b] = [edge.points[index - 1], edge.points[index]];
        assert.ok(Math.abs(a[0] - b[0]) < 0.5 || Math.abs(a[1] - b[1]) < 0.5, `${view.id}/${edge.id} has a diagonal segment`);
      }
    }
  }
});

test('code generation carries structure from the model into each target', () => {
  const model = load();
  const order = classifierModel(model).find((type) => type.id === 'Order');
  assert.deepEqual(order.fields.filter((field) => field.source !== 'attribute').map((field) => [field.name, field.type]), [['lines', 'OrderLine[]'], ['payments', 'Payment[]']]);

  const ts = generateCode(model, 'typescript');
  assert.match(file(ts, 'card-gateway.ts'), /export class CardGateway implements PaymentGateway \{/);
  assert.match(file(ts, 'order.ts'), /lines: OrderLine\[\];/);
  assert.match(file(ts, 'order-status.ts'), /export enum OrderStatus \{\n {2}DRAFT = 'DRAFT'/);

  assert.match(file(generateCode(model, 'java'), 'CardGateway.java'), /public class CardGateway implements PaymentGateway \{[\s\S]*@Override\n {4}public boolean authorise\(Payment payment\)/);
  assert.match(file(generateCode(model, 'python'), 'orders.py'), /class PaymentGateway\(Protocol\):\n {4}def authorise\(self, payment: Payment\) -> bool:/);

  const sql = file(generateCode(model, 'sql'), 'schema.sql');
  assert.match(sql, /CREATE TABLE "order_line" \([\s\S]*"order_id" UUID NOT NULL\n\);/);
  assert.match(sql, /FOREIGN KEY \("order_id"\) REFERENCES "order" \("id"\) ON DELETE CASCADE;/);
  assert.doesNotMatch(sql, /CREATE TABLE "order" \([^;]*order_line_id/, 'the key belongs on the many side');

  const machine = file(generateCode(model, 'statemachine'), 'order-lifecycle.ts');
  assert.match(machine, /PLACED: \{ PAY: 'PAID', CANCEL: 'CANCELLED' \}/);
  assert.match(machine, /Initial: OrderLifecycleState = 'DRAFT'/);

  assert.match(file(generateCode(model, 'openapi'), 'order-api.yaml'), /"\$ref": "#\/components\/schemas\/Order"/);
});

test('exchange formats are well-formed and keep every flow and relationship', () => {
  const model = load();
  const bpmn = file(generateCode(model, 'bpmn'), 'order-fulfilment-process.bpmn');
  assertWellFormed(bpmn, 'bpmn');
  assert.equal(bpmn.match(/<bpmn:sequenceFlow /g).length, 12);
  assert.equal(bpmn.match(/<bpmndi:BPMNEdge /g).length, 12);
  assert.match(bpmn, /<bpmn:serviceTask id="p_check" name="Check stock">/);
  assert.match(bpmn, /<bpmn:lane id="Lane_fulfilment_bpmn_1" name="Warehouse">/);

  const exchange = file(generateCode(model, 'archimate'), '.archimate.xml');
  assertWellFormed(exchange, 'archimate');
  assert.match(exchange, /<element identifier="id-order_svc" xsi:type="ApplicationComponent">/);
  assert.match(exchange, /<relationship identifier="id-r_order_svc_as" source="id-order_svc" target="id-as_order" xsi:type="Realization">/);
  assert.doesNotMatch(exchange, /xsi:type="(Entity|Class|Task)"/, 'only ArchiMate concepts belong in the exchange file');
});

test('tasks are ordered by the relationships in the model', () => {
  const model = load();
  const plan = generateTasks(model);
  const byId = new Map(plan.tasks.map((task) => [task.id, task]));
  const forElement = (id, type) => plan.tasks.find((task) => task.trace.element === id && (!type || task.type === type));
  assert.deepEqual(plan.droppedDependencies, []);
  for (const task of plan.tasks) {
    for (const dep of task.dependsOn) assert.ok(byId.get(dep).wave < task.wave, `${task.id} must come after ${dep}`);
    assert.ok(task.acceptance.length > 0 && task.title && task.phaseLabel);
  }
  // Serving: the consumer waits for the provider.
  assert.ok(forElement('order_svc').dependsOn.includes(forElement('ai_pay_api').id));
  // Requirements are verified after the element that realises them is built.
  assert.ok(forElement('req_pay', 'verify').dependsOn.includes(forElement('payment_svc').id));
  assert.equal(forElement('req_pay', 'verify').phase, 'G');
  // Deployment follows both the build and the platform.
  const deploy = plan.tasks.find((task) => task.title === 'Deploy payment-service.jar to Kubernetes cluster');
  assert.deepEqual(deploy.dependsOn, [forElement('art_pay').id, forElement('k8s').id].sort());
  assert.deepEqual(plan.phases.map((phase) => phase.id), ['P', 'A', 'B', 'C', 'D', 'E', 'F', 'G']);

  assert.equal(tasksCsv(plan).trim().split('\n').length, plan.tasks.length + 1);
  assert.ok(tasksMarkdown(plan).includes(`- [ ] **${deploy.id}** ${deploy.title}`));
  const goal = tasksGoal(plan);
  assert.equal(file(goal, 'targets.pl').match(/^done\('T-\d+'\)\.$/gm).length, plan.tasks.length);
  assert.ok(file(goal, 'tasks.pl').includes(`requires('${deploy.id}', '${forElement('k8s').id}').`));
});

test('a dependency cycle is reported and still yields a complete plan', () => {
  const model = load();
  model.relationships.push({ id: 'loop', from: 'order_svc', to: 'ai_pay_api', kind: 'serving' });
  const plan = generateTasks(model);
  assert.equal(plan.droppedDependencies.length, 1);
  assert.equal(plan.tasks.length, generateTasks(load()).tasks.length);
});

test('token runs follow guards, forks, and joins', () => {
  const model = load();
  const labels = (run) => run.log.map((entry) => entry.node);
  const challenged = runToCompletion(createRun(model, 'payment_activity', { amount: 320 }));
  assert.ok(challenged.done && labels(challenged).includes('a_3ds'));
  const direct = runToCompletion(createRun(model, 'payment_activity', { amount: 10 }));
  assert.ok(direct.done && !labels(direct).includes('a_3ds'));
  assert.ok(labels(direct).indexOf('a_join') > Math.max(labels(direct).indexOf('a_capture'), labels(direct).indexOf('a_receipt')), 'the join waits for both branches');

  const backorder = runToCompletion(createRun(model, 'fulfilment_bpmn', { inStock: false }));
  assert.deepEqual(labels(backorder).slice(-2), ['p_backorder', 'p_end_cancel']);

  // A state with several exits and no guards needs an explicit choice.
  const states = createRun(model, 'order_states');
  fire(states, 's_draft');
  const placed = enabled(states).find((entry) => entry.node === 's_placed');
  assert.deepEqual(placed.choices.sort(), ['t_cancel_placed', 't_pay']);
  assert.throws(() => fire(states, 's_placed'), /needs a choice/);
  fire(states, 's_placed', 't_cancel_placed');
  assert.deepEqual(states.tokens, ['t_cancel_placed']);

  assert.throws(() => createRun(model, 'domain_classes'), /not executable/);
});

test('compiled views are accepted by the native Archify validators', () => {
  const directory = createScratchDirectory(path.join(os.tmpdir(), 'archify-enterprise-native-'));
  const compiled = compileNative(load());
  assert.deepEqual([...new Set(compiled.map((entry) => entry.type))].sort(), ['architecture', 'class', 'lifecycle', 'sequence']);
  for (const entry of compiled) {
    const input = path.join(directory, path.basename(entry.path));
    fs.writeFileSync(input, JSON.stringify(entry.diagram));
    const result = spawnSync(process.execPath, [archify, 'validate', entry.type, input], { cwd: directory, encoding: 'utf8' });
    assert.equal(result.status, 0, `${entry.path}\n${result.stdout}\n${result.stderr}`);
  }
});

test('the CLI builds every output and refuses an invalid model', () => {
  const directory = createScratchDirectory(path.join(os.tmpdir(), 'archify-enterprise-cli-'));
  const built = spawnSync(process.execPath, [cli, 'build', examplePath, '--out', path.join(directory, 'out')], { encoding: 'utf8' });
  assert.equal(built.status, 0, built.stderr);
  for (const expected of ['diagrams/cross_layer.svg', 'code/typescript/index.ts', 'code/sql/schema.sql', 'tasks/plan.md', 'goal/plan.mod2g', 'archify/domain_classes.class.json']) {
    assert.ok(fs.statSync(path.join(directory, 'out', expected)).size > 0, expected);
  }

  const broken = load(); broken.views[0].nodes[0].ref = 'missing';
  const input = path.join(directory, 'broken.json'); fs.writeFileSync(input, JSON.stringify(broken));
  const refused = spawnSync(process.execPath, [cli, 'build', input, '--out', path.join(directory, 'never')], { encoding: 'utf8' });
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /enterprise\/dangling-reference/);
  assert.equal(fs.existsSync(path.join(directory, 'never')), false);

  const run = spawnSync(process.execPath, [cli, 'simulate', examplePath, 'payment_activity', '--var', 'amount=10', '--json'], { encoding: 'utf8' });
  assert.equal(JSON.parse(run.stdout).done, true);
});

test('the committed Studio page matches its sources', () => {
  assert.equal(fs.readFileSync(path.join(repoRoot, 'enterprise', 'studio.html'), 'utf8'), buildStudio(), 'run: node enterprise/scripts/build-studio.mjs');
});
