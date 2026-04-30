#!/usr/bin/env node

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PROJECT_ROOT = path.resolve(SCRIPT_DIR, "../..");
const DEFAULT_INCLUDES = [".ai", "obsidian-vault", "README.md", "memory"];
const DEFAULT_EXCLUDES = [".ai/logs/github-push.log"];

function printHelp() {
  console.log(
    [
      "Usage:",
      "  node .ai/context/github-memory-push-runner.mjs [options]",
      "",
      "Options:",
      "  --project-root <dir>   Project root with .ai/ (default: current starter root)",
      "  --remote <name>        Git remote (default: origin)",
      "  --branch <name>        Target branch (default: current branch)",
      "  --include <path>       Path to stage; can be repeated",
      "  --exclude <path>       Path to exclude from staging; can be repeated",
      "  --message <text>       Commit message",
      "  --skip-hardening       Do not run workflow-hardening-runner when available",
      "  --dry-run              Print actions only (default)",
      "  --push                 Commit and push changes",
      "",
      "Safety:",
      "  - dry-run is the default; use --push for real execution.",
      "  - operational push logs are excluded by default.",
      "  - the runner never pulls, resets, rebases or resolves remote divergence.",
      "  - if git push fails, fix the repository manually and rerun."
    ].join("\n")
  );
}

function fail(message, code = 1) {
  console.error(`Error: ${message}`);
  process.exit(code);
}

function parseArgs(argv) {
  const out = {
    projectRoot: DEFAULT_PROJECT_ROOT,
    remote: "origin",
    branch: "",
    includes: [],
    excludes: [],
    message: "",
    skipHardening: false,
    dryRun: true
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    if (arg === "--project-root") {
      out.projectRoot = path.resolve(argv[i + 1] || "");
      i += 1;
      continue;
    }
    if (arg === "--remote") {
      out.remote = argv[i + 1] || "origin";
      i += 1;
      continue;
    }
    if (arg === "--branch") {
      out.branch = argv[i + 1] || "";
      i += 1;
      continue;
    }
    if (arg === "--include") {
      out.includes.push(argv[i + 1] || "");
      i += 1;
      continue;
    }
    if (arg === "--exclude") {
      out.excludes.push(argv[i + 1] || "");
      i += 1;
      continue;
    }
    if (arg === "--message") {
      out.message = argv[i + 1] || "";
      i += 1;
      continue;
    }
    if (arg === "--skip-hardening") {
      out.skipHardening = true;
      continue;
    }
    if (arg === "--dry-run") {
      out.dryRun = true;
      continue;
    }
    if (arg === "--push") {
      out.dryRun = false;
      continue;
    }
    fail(`unknown option: ${arg}`);
  }

  out.includes = out.includes.filter(Boolean);
  out.excludes = out.excludes.filter(Boolean);
  return out;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || process.cwd(),
    env: options.env || process.env,
    encoding: "utf8"
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

function git(projectRoot, args, options = {}) {
  return run("git", ["-C", projectRoot, ...args], options);
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function printCommand(command, args) {
  console.log(`  ${command} ${args.map(shellQuote).join(" ")}`);
}

function excludePathspec(relativePath) {
  return `:(exclude)${relativePath}`;
}

function buildPathspecs(includes, excludes) {
  return [...includes, ...excludes.map(excludePathspec)];
}

function ensureInsideProject(projectRoot, relativePath) {
  const resolved = path.resolve(projectRoot, relativePath);
  if (!resolved.startsWith(projectRoot)) {
    fail(`path escapes project root: ${relativePath}`);
  }
  return resolved;
}

async function readJson(projectRoot, relativePath) {
  const full = ensureInsideProject(projectRoot, relativePath);
  try {
    return JSON.parse(await fsp.readFile(full, "utf8"));
  } catch (error) {
    fail(`invalid JSON at ${relativePath}: ${error.message}`);
  }
}

async function validateProject(projectRoot) {
  const aiRoot = path.join(projectRoot, ".ai");
  if (!fs.existsSync(aiRoot)) {
    fail(`.ai/ not found at ${projectRoot}`);
  }

  const state = await readJson(projectRoot, ".ai/state/current-state.json");
  const activeTask = await readJson(projectRoot, ".ai/state/active-task.json");
  await readJson(projectRoot, ".ai/state/roadmap.json");

  return { state, activeTask };
}

function currentBranch(projectRoot) {
  const result = git(projectRoot, ["rev-parse", "--abbrev-ref", "HEAD"]);
  if (!result.stdout || result.stdout === "HEAD") {
    fail("cannot infer current branch; pass --branch explicitly.");
  }
  return result.stdout;
}

function acquireLock(projectRoot) {
  const hash = crypto.createHash("sha256").update(projectRoot).digest("hex").slice(0, 16);
  const lockPath = path.join("/tmp", `github-memory-push-${hash}.lock`);
  try {
    const fd = fs.openSync(lockPath, "wx");
    fs.writeFileSync(fd, JSON.stringify({ projectRoot, pid: process.pid, started_at: new Date().toISOString() }));
    fs.closeSync(fd);
    return () => {
      try {
        fs.unlinkSync(lockPath);
      } catch {
        // ignore cleanup failures
      }
    };
  } catch {
    fail(`push lock already exists: ${lockPath}`);
  }
}

function runHardeningIfAvailable(projectRoot, skipHardening) {
  if (skipHardening) {
    return { ok: true, skipped: true };
  }
  const runner = path.join(projectRoot, ".ai/context/workflow-hardening-runner.mjs");
  if (!fs.existsSync(runner)) {
    return { ok: true, skipped: true };
  }
  return run("node", [runner, "--project-root", projectRoot, "--dry-run"], { cwd: projectRoot });
}

function defaultMessage(state, activeTask) {
  const projectName = state.project_name || "project-memory";
  const task = state.active_task_id || activeTask.task_id || "memory";
  return `memory: sync ${projectName} ${task} ${new Date().toISOString()}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const projectRoot = path.resolve(args.projectRoot);
  const includes = args.includes.length > 0 ? args.includes : DEFAULT_INCLUDES;
  const excludes = args.excludes.length > 0 ? args.excludes : DEFAULT_EXCLUDES;
  const pathspecs = buildPathspecs(includes, excludes);
  const { state, activeTask } = await validateProject(projectRoot);
  const branch = args.branch || currentBranch(projectRoot);
  const message = args.message || defaultMessage(state, activeTask);

  git(projectRoot, ["rev-parse", "--is-inside-work-tree"]);
  const hardening = runHardeningIfAvailable(projectRoot, args.skipHardening);
  if (!hardening.ok) {
    fail(`workflow hardening failed\n${hardening.stderr || hardening.stdout}`);
  }

  const status = git(projectRoot, ["status", "--porcelain", "--", ...pathspecs]).stdout;
  if (!status) {
    console.log("No included changes to push.");
    return;
  }

  console.log(`Project: ${state.project_name || path.basename(projectRoot)}`);
  console.log(`Root: ${projectRoot}`);
  console.log(`Remote: ${args.remote}`);
  console.log(`Branch: ${branch}`);
  console.log(`Mode: ${args.dryRun ? "dry-run" : "push"}`);
  console.log("Changed files:");
  console.log(status);

  if (args.dryRun) {
    console.log("");
    console.log("Commands that would run:");
    printCommand("git", ["-C", projectRoot, "add", "--", ...pathspecs]);
    printCommand("git", ["-C", projectRoot, "commit", "-m", message]);
    printCommand("git", ["-C", projectRoot, "push", args.remote, `HEAD:${branch}`]);
    return;
  }

  const releaseLock = acquireLock(projectRoot);
  try {
    for (const includePath of includes) {
      ensureInsideProject(projectRoot, includePath);
    }
    for (const excludePath of excludes) {
      ensureInsideProject(projectRoot, excludePath);
    }
    git(projectRoot, ["add", "--", ...pathspecs]);
    const staged = git(projectRoot, ["diff", "--cached", "--quiet"], { allowFailure: true });
    if (staged.status === 0) {
      console.log("No staged changes after applying include filters.");
      return;
    }
    git(projectRoot, ["commit", "-m", message]);
    git(projectRoot, ["push", args.remote, `HEAD:${branch}`]);
    console.log("Memory pushed to GitHub remote.");
  } finally {
    releaseLock();
  }
}

main().catch((error) => fail(error.stack || error.message || String(error)));
