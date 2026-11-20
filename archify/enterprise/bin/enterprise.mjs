#!/usr/bin/env node
// Archify Enterprise CLI: validate a model, render its views, and generate
// code, tasks, and native Archify typed JSON.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateModel } from '../lib/model.mjs';
import { renderView } from '../lib/render.mjs';
import { CODE_TARGETS, generateCode } from '../lib/codegen.mjs';
import { generateTasks, taskFiles } from '../lib/tasks.mjs';
import { compileNative, compileView } from '../lib/native.mjs';
import { createRun, runToCompletion } from '../lib/simulate.mjs';
import { THEMES } from '../lib/notation.mjs';

const USAGE = `Usage:
  enterprise validate <model.json> [--json]
  enterprise render   <model.json> [--out dir] [--view id] [--theme dark|light|blueprint]
  enterprise code     <model.json> [--out dir] [--target ${Object.keys(CODE_TARGETS).join('|')}|all]
  enterprise tasks    <model.json> [--out dir]
  enterprise archify  <model.json> [--out dir]
  enterprise simulate <model.json> <view> [--var name=value ...] [--json]
  enterprise build    <model.json> [--out dir]

render writes one SVG per view. code and tasks write generated files. archify
writes native Archify typed JSON for views that have a native diagram type;
render those with "archify render <type> <file>". build runs all four.`;

function parseArgs(argv) {
  const positional = []; const flags = { var: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) { positional.push(arg); continue; }
    const name = arg.slice(2);
    if (name === 'json') flags.json = true;
    else if (name === 'var') flags.var.push(argv[index += 1]);
    else flags[name] = argv[index += 1];
  }
  return { positional, flags };
}

function fail(message, code = 1) {
  console.error(message);
  process.exit(code);
}

function loadModel(file) {
  if (!file) fail(USAGE, 2);
  let model;
  try { model = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (error) { fail(`Cannot read model ${file}: ${error.message}`); }
  return model;
}

function requireValid(model) {
  const result = validateModel(model);
  for (const entry of result.diagnostics) console.error(`${entry.severity}: [${entry.code}] ${entry.message}`);
  if (!result.ok) fail('The model is invalid; nothing was generated.');
}

function writeFiles(outDir, files) {
  for (const file of files) {
    const target = path.join(outDir, file.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, file.content);
  }
  return files.map((file) => path.join(outDir, file.path));
}

function renderFiles(model, flags) {
  const theme = flags.theme || 'dark';
  if (!THEMES[theme]) fail(`Unknown theme "${theme}". Use one of: ${Object.keys(THEMES).join(', ')}.`, 2);
  const views = (model.views || []).filter((view) => !flags.view || view.id === flags.view);
  if (!views.length) fail(`No view matches "${flags.view}".`);
  return views.map((view) => ({ path: `diagrams/${view.id}.svg`, content: `${renderView(model, view.id, { theme }).svg}\n` }));
}

function codeFiles(model, flags) {
  const target = flags.target || 'all';
  const targets = target === 'all' ? Object.keys(CODE_TARGETS) : [target];
  for (const name of targets) if (!CODE_TARGETS[name]) fail(`Unknown code target "${name}". Use one of: ${Object.keys(CODE_TARGETS).join(', ')}, all.`, 2);
  return targets.flatMap((name) => generateCode(model, name).map((file) => ({ ...file, path: `code/${file.path}` })));
}

function nativeFiles(model) {
  // Say what the native compile changed or could not carry over.
  for (const view of model.views || []) for (const note of compileView(model, view.id)?.notes || []) console.error(`note: [${view.id}] ${note}`);
  return compileNativeFiles(model);
}
const compileNativeFiles = (model) => compileNative(model).map((entry) => ({ path: entry.path, content: `${JSON.stringify(entry.diagram, null, 2)}\n` }));

export function main(argv) {
  const { positional, flags } = parseArgs(argv);
  const [command, file, extra] = positional;
  if (!command || command === 'help' || flags.help) { console.log(USAGE); return; }
  const model = loadModel(file);
  const outDir = flags.out || 'enterprise-out';
  const report = (files) => { for (const written of writeFiles(outDir, files)) console.log(written); };

  if (command === 'validate') {
    const result = validateModel(model);
    if (flags.json) console.log(JSON.stringify(result, null, 2));
    else {
      for (const entry of result.diagnostics) console.log(`${entry.severity}: [${entry.code}] ${entry.message}`);
      console.log(result.ok ? `OK: ${model.elements?.length || 0} elements, ${model.relationships?.length || 0} relationships, ${model.views?.length || 0} views.` : 'Invalid model.');
    }
    if (!result.ok) process.exit(1);
    return;
  }
  requireValid(model);
  if (command === 'render') report(renderFiles(model, flags));
  else if (command === 'code') report(codeFiles(model, flags));
  else if (command === 'tasks') report(taskFiles(generateTasks(model)));
  else if (command === 'archify') report(nativeFiles(model));
  else if (command === 'build') report([...renderFiles(model, flags), ...codeFiles(model, {}), ...taskFiles(generateTasks(model)), ...nativeFiles(model)]);
  else if (command === 'simulate') {
    if (!extra) fail(USAGE, 2);
    const vars = Object.fromEntries(flags.var.map((pair) => {
      const [name, ...rest] = String(pair).split('='); const raw = rest.join('=');
      return [name, raw === 'true' ? true : raw === 'false' ? false : /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : raw];
    }));
    let run;
    try { run = runToCompletion(createRun(model, extra, vars)); } catch (error) { fail(error.message); }
    if (flags.json) console.log(JSON.stringify({ view: run.view, done: run.done, steps: run.steps, vars: run.vars, log: run.log }, null, 2));
    else {
      for (const entry of run.log) console.log(`${String(entry.step).padStart(3)}  ${entry.label}`);
      console.log(run.done ? `Completed in ${run.steps} steps.` : `Stopped after ${run.steps} steps with tokens waiting on: ${run.tokens.join(', ')}.`);
    }
    if (!run.done) process.exit(1);
  } else fail(USAGE, 2);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
