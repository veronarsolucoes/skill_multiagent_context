#!/usr/bin/env node

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
const PROMPT_ROOT = "/root/prompt";
const MCP_SERVER = path.join(SCRIPT_DIR, "mcp-project-memory-server.mjs");
const DEFAULT_MCP_NAME = "project-memory";

const SKIP_DIRS = new Set([".git", "node_modules", "obsidian-vault", "__pycache__"]);

function printHelp() {
  console.log(
    [
      "Usage:",
      "  ./memory load [project]",
      "  ./memory use <project> [--name <mcp-name>] [--dry-run]",
      "  ./memory add <project> [--name <mcp-name>] [--dry-run]",
      "  ./memory list [base-dir]",
      "  ./memory state [project]",
      "  ./memory task [project]",
      "  ./memory decisions [project] [limit]",
      "  ./memory search <project> <query> [max-results]",
      "",
      "Main flow:",
      "  ./memory load assistente_secretari_ribeiro",
      "  ./memory use assistente_secretari_ribeiro",
      "",
      "After './memory use', restart Codex and call:",
      "  mcp__project_memory__.get_project_state",
      "",
      "Notes:",
      "  - 'use' switches the stable Codex MCP name project-memory to a project.",
      "  - 'add' registers a separate Codex MCP, defaulting to the project folder name.",
      "  - Project can be an absolute path, a path relative to cwd, or a folder under /root/prompt."
    ].join("\n")
  );
}

function fail(message, code = 1) {
  console.error(`Error: ${message}`);
  process.exit(code);
}

async function pathExists(targetPath) {
  try {
    await fsp.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function isDirectory(targetPath) {
  try {
    return (await fsp.stat(targetPath)).isDirectory();
  } catch {
    return false;
  }
}

async function hasAiDir(projectRoot) {
  return isDirectory(path.join(projectRoot, ".ai"));
}

async function findNearestProjectRoot(startDir) {
  let current = path.resolve(startDir);
  while (true) {
    if (await hasAiDir(current)) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return "";
    }
    current = parent;
  }
}

function expandHome(inputPath) {
  if (inputPath === "~") {
    return process.env.HOME || "/root";
  }
  if (inputPath.startsWith("~/")) {
    return path.join(process.env.HOME || "/root", inputPath.slice(2));
  }
  return inputPath;
}

async function resolveProjectRoot(input) {
  if (!input) {
    const nearest = await findNearestProjectRoot(process.cwd());
    if (nearest) {
      return nearest;
    }
    return REPO_ROOT;
  }

  const raw = expandHome(String(input).trim());
  const candidates = [];

  if (path.isAbsolute(raw)) {
    candidates.push(raw);
  } else {
    candidates.push(path.resolve(process.cwd(), raw));
    candidates.push(path.resolve(PROMPT_ROOT, raw));
    candidates.push(path.resolve("/root", raw));
  }

  for (const candidate of candidates) {
    if (await hasAiDir(candidate)) {
      return path.resolve(candidate);
    }
  }

  fail(
    [
      `project with .ai/ not found for '${input}'.`,
      "Checked:",
      ...candidates.map((candidate) => `  - ${candidate}`)
    ].join("\n")
  );
}

function projectFile(projectRoot, relativePath) {
  return path.join(projectRoot, relativePath);
}

async function readTextIfExists(filePath) {
  try {
    return await fsp.readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

async function readJsonIfExists(filePath) {
  const raw = await readTextIfExists(filePath);
  if (!raw.trim()) {
    return {};
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    fail(`invalid JSON at ${filePath}: ${error.message}`);
  }
}

async function latestMatchingFile(dirPath, regex) {
  try {
    const names = await fsp.readdir(dirPath);
    const matches = names
      .filter((name) => regex.test(name))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    if (!matches.length) {
      return "";
    }
    return path.join(dirPath, matches[matches.length - 1]);
  } catch {
    return "";
  }
}

function relative(projectRoot, targetPath) {
  if (!targetPath) {
    return "(none)";
  }
  return path.relative(projectRoot, targetPath) || ".";
}

function mcpNamespace(name) {
  return String(name).replace(/[^A-Za-z0-9_]/g, "_");
}

function defaultProjectMcpName(projectRoot) {
  return path.basename(projectRoot).replace(/[^A-Za-z0-9_.-]/g, "_");
}

function parseOptions(argv) {
  const values = [];
  const options = {
    dryRun: false,
    name: ""
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--name") {
      options.name = argv[i + 1] || "";
      i += 1;
      continue;
    }
    values.push(arg);
  }

  return { values, options };
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    cwd: options.cwd || process.cwd(),
    env: options.env || process.env
  });

  const stdout = String(result.stdout || "").trim();
  const stderr = String(result.stderr || "").trim();
  if (result.error && !options.allowFailure) {
    fail(`${command} failed: ${result.error.message}`);
  }
  if (result.status !== 0 && !options.allowFailure) {
    fail(`${command} ${args.join(" ")} failed\n${stderr || stdout}`);
  }
  return {
    ok: result.status === 0 && !result.error,
    status: result.status,
    stdout,
    stderr
  };
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

async function registerCodexMcp(projectRoot, name, dryRun) {
  if (!(await pathExists(MCP_SERVER))) {
    fail(`MCP server not found: ${MCP_SERVER}`);
  }
  if (!/^[A-Za-z0-9_.-]+$/.test(name)) {
    fail(`invalid MCP name '${name}'. Use letters, numbers, dots, hyphens or underscores.`);
  }

  const removeArgs = ["mcp", "remove", name];
  const addArgs = [
    "mcp",
    "add",
    name,
    "--env",
    `PROJECT_ROOT=${projectRoot}`,
    "--",
    "node",
    MCP_SERVER
  ];

  if (dryRun) {
    console.log("Dry run. Commands that would be executed:");
    console.log(`  codex ${removeArgs.map(shellQuote).join(" ")}`);
    console.log(`  codex ${addArgs.map(shellQuote).join(" ")}`);
    return;
  }

  run("codex", removeArgs, { allowFailure: true });
  run("codex", addArgs);
}

async function commandList(argv) {
  const baseDir = path.resolve(expandHome(argv[0] || PROMPT_ROOT));
  const found = [];

  async function walk(dirPath, depth) {
    if (depth < 0) {
      return;
    }
    if (await hasAiDir(dirPath)) {
      found.push(dirPath);
      return;
    }

    let entries = [];
    try {
      entries = await fsp.readdir(dirPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || SKIP_DIRS.has(entry.name)) {
        continue;
      }
      await walk(path.join(dirPath, entry.name), depth - 1);
    }
  }

  await walk(baseDir, 3);
  if (!found.length) {
    console.log(`No .ai projects found under ${baseDir}`);
    return;
  }
  for (const projectRoot of found.sort()) {
    const state = await readJsonIfExists(projectFile(projectRoot, ".ai/state/current-state.json"));
    const name = state.project_name || path.basename(projectRoot);
    const phase = state.current_phase || "(phase unknown)";
    console.log(`${projectRoot}  ${name}  ${phase}`);
  }
}

async function commandLoad(argv) {
  const projectRoot = await resolveProjectRoot(argv[0]);
  const state = await readJsonIfExists(projectFile(projectRoot, ".ai/state/current-state.json"));
  const activeTask = await readJsonIfExists(projectFile(projectRoot, ".ai/state/active-task.json"));
  const latestHandoff = await latestMatchingFile(projectFile(projectRoot, ".ai/handoffs"), /^HANDOFF-\d+\.md$/);
  const latestTask = await latestMatchingFile(projectFile(projectRoot, ".ai/tasks"), /^TASK-\d+\.md$/);

  console.log(`Project: ${state.project_name || path.basename(projectRoot)}`);
  if (state.alias) {
    console.log(`Alias: ${state.alias}`);
  }
  console.log(`Path: ${projectRoot}`);
  console.log(`Phase: ${state.current_phase || "(unknown)"}`);
  console.log(`Goal: ${state.current_goal || activeTask.summary || "(empty)"}`);
  console.log(`Active task: ${state.active_task_id || activeTask.task_id || "(none)"}${activeTask.status ? ` (${activeTask.status})` : ""}`);
  console.log(`Next step: ${state.next_recommended_step || activeTask.next_step || "(none)"}`);
  console.log(`Recommended agent: ${state.recommended_agent || activeTask.owner_agent || "(none)"}`);
  console.log(`Latest handoff: ${relative(projectRoot, latestHandoff)}`);
  console.log(`Latest task: ${relative(projectRoot, latestTask)}`);
  console.log("");
  console.log("Easy Codex MCP flow:");
  console.log(`  cd ${shellQuote(REPO_ROOT)}`);
  console.log(`  ./memory use ${shellQuote(projectRoot)}`);
  console.log("  restart Codex");
  console.log("  mcp__project_memory__.get_project_state");
}

async function commandState(argv) {
  const projectRoot = await resolveProjectRoot(argv[0]);
  const raw = await readTextIfExists(projectFile(projectRoot, ".ai/state/current-state.json"));
  process.stdout.write(raw || "{}\n");
}

async function commandTask(argv) {
  const projectRoot = await resolveProjectRoot(argv[0]);
  const raw = await readTextIfExists(projectFile(projectRoot, ".ai/state/active-task.json"));
  process.stdout.write(raw || "{}\n");
}

async function commandDecisions(argv) {
  const projectRoot = await resolveProjectRoot(argv[0]);
  const limit = Math.max(1, Number(argv[1] || 10));
  const raw = await readTextIfExists(projectFile(projectRoot, ".ai/memory/decisions.md"));
  const decisions = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/.test(line))
    .map((line) => line.replace(/^[-*]\s+/, ""));

  for (const decision of decisions.slice(-limit)) {
    console.log(`- ${decision}`);
  }
}

async function walkFiles(dirPath, files = []) {
  let entries = [];
  try {
    entries = await fsp.readdir(dirPath, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) {
      continue;
    }
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      await walkFiles(fullPath, files);
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

async function commandSearch(argv) {
  const projectRoot = await resolveProjectRoot(argv[0]);
  const query = argv[1];
  const maxResults = Math.max(1, Number(argv[2] || 50));
  if (!query) {
    fail("search requires a query: ./memory search <project> <query>");
  }

  const needle = query.toLowerCase();
  const aiRoot = projectFile(projectRoot, ".ai");
  const files = await walkFiles(aiRoot);
  let count = 0;

  for (const filePath of files) {
    const raw = await readTextIfExists(filePath);
    const lines = raw.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      if (!lines[index].toLowerCase().includes(needle)) {
        continue;
      }
      console.log(`${relative(projectRoot, filePath)}:${index + 1}: ${lines[index].trim()}`);
      count += 1;
      if (count >= maxResults) {
        return;
      }
    }
  }
}

async function commandUse(argv) {
  const { values, options } = parseOptions(argv);
  const projectRoot = await resolveProjectRoot(values[0]);
  const name = options.name || DEFAULT_MCP_NAME;
  await registerCodexMcp(projectRoot, name, options.dryRun);
  if (options.dryRun) {
    console.log(`Codex MCP '${name}' would point to: ${projectRoot}`);
  } else {
    console.log(`Codex MCP '${name}' now points to: ${projectRoot}`);
  }
  console.log("Restart Codex to load the refreshed MCP tools.");
  console.log(`Then call: mcp__${mcpNamespace(name)}__.get_project_state`);
}

async function commandAdd(argv) {
  const { values, options } = parseOptions(argv);
  const projectRoot = await resolveProjectRoot(values[0]);
  const name = options.name || defaultProjectMcpName(projectRoot);
  await registerCodexMcp(projectRoot, name, options.dryRun);
  if (options.dryRun) {
    console.log(`Codex MCP '${name}' would be registered for: ${projectRoot}`);
  } else {
    console.log(`Codex MCP '${name}' registered for: ${projectRoot}`);
  }
  console.log("Restart Codex to load the new MCP tools.");
  console.log(`Then call: mcp__${mcpNamespace(name)}__.get_project_state`);
}

async function main() {
  const [command, ...argv] = process.argv.slice(2);
  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "list") {
    await commandList(argv);
    return;
  }
  if (command === "load" || command === "status") {
    await commandLoad(argv);
    return;
  }
  if (command === "state") {
    await commandState(argv);
    return;
  }
  if (command === "task") {
    await commandTask(argv);
    return;
  }
  if (command === "decisions") {
    await commandDecisions(argv);
    return;
  }
  if (command === "search") {
    await commandSearch(argv);
    return;
  }
  if (command === "use") {
    await commandUse(argv);
    return;
  }
  if (command === "add") {
    await commandAdd(argv);
    return;
  }

  fail(`unknown command '${command}'. Run ./memory help.`);
}

main().catch((error) => fail(error.stack || error.message || String(error)));
