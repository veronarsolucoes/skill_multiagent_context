#!/usr/bin/env node

import fsp from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PROJECT_ROOT = path.resolve(SCRIPT_DIR, "../..");
const DEFAULT_REPORT_RELATIVE = ".ai/state/agent-adoption-report.json";

function parseArgs(argv) {
  const out = {
    projectRoot: DEFAULT_PROJECT_ROOT,
    dryRun: false,
    reportPath: "",
    openclawContainer: "openclaw-gateway"
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--project-root") {
      out.projectRoot = path.resolve(argv[i + 1] || "");
      i += 1;
      continue;
    }
    if (arg === "--report") {
      out.reportPath = argv[i + 1] || "";
      i += 1;
      continue;
    }
    if (arg === "--openclaw-container") {
      out.openclawContainer = argv[i + 1] || "openclaw-gateway";
      i += 1;
      continue;
    }
    if (arg === "--dry-run") {
      out.dryRun = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printHelpAndExit(0);
    }
  }

  if (!out.reportPath) {
    out.reportPath = path.resolve(out.projectRoot, DEFAULT_REPORT_RELATIVE);
  } else {
    out.reportPath = path.resolve(out.reportPath);
  }
  return out;
}

function printHelpAndExit(code) {
  console.error(
    [
      "Usage:",
      "  node .ai/context/agent-adoption-runner.mjs [--project-root <dir>] [--report <file>] [--openclaw-container <name>] [--dry-run]",
      "",
      "Checks:",
      "  - codex mcp list",
      "  - claude mcp list (project root)",
      "  - openclaw mcp list (inside container)",
      "  - continuity anchors (current-state, active-task, handoff, report files)",
      "",
      `Output report: ${DEFAULT_REPORT_RELATIVE}`
    ].join("\n")
  );
  process.exit(code);
}

function ensureInsideRoot(projectRoot, targetPath) {
  const resolved = path.resolve(targetPath);
  if (!resolved.startsWith(projectRoot)) {
    throw new Error(`Path escapes project root: ${resolved}`);
  }
  return resolved;
}

function projectFile(projectRoot, relativePath) {
  return ensureInsideRoot(projectRoot, path.resolve(projectRoot, relativePath));
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    timeout: options.timeoutMs || 30000,
    cwd: options.cwd || process.cwd(),
    env: options.env || process.env
  });

  const stdout = String(result.stdout || "").trim();
  const stderr = String(result.stderr || "").trim();
  const errorMessage = result.error ? String(result.error.message || result.error) : "";

  return {
    ok: result.status === 0 && !result.error,
    command: `${command} ${args.join(" ")}`.trim(),
    status: result.status,
    stdout,
    stderr,
    error: errorMessage
  };
}

function createCheck(id, pass, message, details = "") {
  return {
    id,
    status: pass ? "pass" : "fail",
    message,
    details: details || undefined
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const checks = [];

  const currentStatePath = projectFile(args.projectRoot, ".ai/state/current-state.json");
  const activeTaskPath = projectFile(args.projectRoot, ".ai/state/active-task.json");

  const currentState = JSON.parse(await fsp.readFile(currentStatePath, "utf8"));
  const activeTask = JSON.parse(await fsp.readFile(activeTaskPath, "utf8"));

  checks.push(
    createCheck(
      "state:phase-is-agent-adoption",
      String(currentState.current_phase || "") === "agent_adoption",
      String(currentState.current_phase || "") === "agent_adoption"
        ? "current_phase em agent_adoption"
        : "current_phase nao esta em agent_adoption",
      `current_phase=${currentState.current_phase || "(vazio)"}`
    )
  );

  checks.push(
    createCheck(
      "state:task-is-task-007",
      String(currentState.active_task_id || "") === "TASK-007" && String(activeTask.task_id || "") === "TASK-007",
      String(currentState.active_task_id || "") === "TASK-007" && String(activeTask.task_id || "") === "TASK-007"
        ? "Tarefa ativa em TASK-007"
        : "Tarefa ativa nao esta em TASK-007",
      `current-state=${currentState.active_task_id || "(vazio)"} active-task=${activeTask.task_id || "(vazio)"}`
    )
  );

  const handoffPath = Array.isArray(currentState.key_files)
    ? currentState.key_files.find((item) => /HANDOFF-\d{3}\.md$/.test(String(item)))
    : "";
  checks.push(
    createCheck(
      "state:handoff-present",
      Boolean(handoffPath),
      handoffPath ? "Handoff ativo referenciado em key_files" : "Handoff ativo ausente em key_files",
      handoffPath || ""
    )
  );

  const codexResult = runCommand("codex", ["mcp", "list"]);
  const codexHasProjectMemory = codexResult.ok && /project-memory/.test(codexResult.stdout);
  checks.push(
    createCheck(
      "agent:codex-project-memory",
      codexHasProjectMemory,
      codexHasProjectMemory ? "Codex MCP com project-memory visivel" : "Codex MCP sem project-memory visivel",
      codexResult.command
    )
  );

  const claudeResult = runCommand("claude", ["mcp", "list"], { cwd: args.projectRoot });
  const claudeHasProjectMemory =
    claudeResult.ok && /project-memory/.test(claudeResult.stdout) && /(Connected|✓ Connected)/.test(claudeResult.stdout);
  checks.push(
    createCheck(
      "agent:claude-project-memory",
      claudeHasProjectMemory,
      claudeHasProjectMemory
        ? "Claude MCP (escopo projeto) com project-memory conectado"
        : "Claude MCP (escopo projeto) sem project-memory conectado",
      claudeResult.command
    )
  );

  const dockerInspect = runCommand("docker", ["ps", "--format", "{{.Names}}"]);
  const hasContainer =
    dockerInspect.ok &&
    dockerInspect.stdout
      .split("\n")
      .map((line) => line.trim())
      .includes(args.openclawContainer);
  checks.push(
    createCheck(
      "agent:openclaw-container-running",
      hasContainer,
      hasContainer
        ? `Container ${args.openclawContainer} encontrado`
        : `Container ${args.openclawContainer} nao encontrado`,
      "docker ps --format {{.Names}}"
    )
  );

  let openclawResult = {
    ok: false,
    command: `docker exec ${args.openclawContainer} openclaw mcp list`,
    status: null,
    stdout: "",
    stderr: "",
    error: "container_not_available"
  };
  if (hasContainer) {
    openclawResult = runCommand("docker", ["exec", args.openclawContainer, "openclaw", "mcp", "list"], {
      timeoutMs: 45000
    });
  }

  const openclawHasProjectMemory = openclawResult.ok && /project-memory/.test(openclawResult.stdout);
  checks.push(
    createCheck(
      "agent:openclaw-project-memory",
      openclawHasProjectMemory,
      openclawHasProjectMemory
        ? "OpenClaw MCP com project-memory visivel"
        : "OpenClaw MCP sem project-memory visivel",
      openclawResult.command
    )
  );

  const report = {
    ok: checks.every((item) => item.status === "pass"),
    dry_run: args.dryRun,
    generated_at: new Date().toISOString(),
    summary: {
      total_checks: checks.length,
      passed: checks.filter((item) => item.status === "pass").length,
      failed: checks.filter((item) => item.status === "fail").length
    },
    commands: {
      codex_mcp_list: {
        ok: codexResult.ok,
        status: codexResult.status,
        stdout: codexResult.stdout,
        stderr: codexResult.stderr || undefined,
        error: codexResult.error || undefined
      },
      claude_mcp_list: {
        ok: claudeResult.ok,
        status: claudeResult.status,
        stdout: claudeResult.stdout,
        stderr: claudeResult.stderr || undefined,
        error: claudeResult.error || undefined
      },
      openclaw_mcp_list: {
        ok: openclawResult.ok,
        status: openclawResult.status,
        stdout: openclawResult.stdout,
        stderr: openclawResult.stderr || undefined,
        error: openclawResult.error || undefined
      }
    },
    checks
  };

  if (!args.dryRun) {
    await fsp.mkdir(path.dirname(args.reportPath), { recursive: true });
    await fsp.writeFile(args.reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }

  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 2);
}

main().catch((error) => {
  console.error(String(error?.stack || error?.message || error));
  process.exit(1);
});
