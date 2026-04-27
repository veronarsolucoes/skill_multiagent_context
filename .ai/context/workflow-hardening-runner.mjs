#!/usr/bin/env node

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PROJECT_ROOT = path.resolve(SCRIPT_DIR, "../..");
const DEFAULT_REPORT_RELATIVE = ".ai/state/workflow-hardening-report.json";

function parseArgs(argv) {
  const out = {
    projectRoot: DEFAULT_PROJECT_ROOT,
    dryRun: false,
    reportPath: ""
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
      "  node .ai/context/workflow-hardening-runner.mjs [--project-root <dir>] [--report <file>] [--dry-run]",
      "",
      "What it validates:",
      "  - required files and JSON parsing",
      "  - current-state <-> active-task <-> roadmap consistency",
      "  - task/handoff naming and active artifacts",
      "  - file/api indexes references",
      "  - Obsidian mirrors for active task and handoff",
      "",
      "Output:",
      "  - prints JSON report",
      `  - writes report to ${DEFAULT_REPORT_RELATIVE} (unless --dry-run)`
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

async function fileExists(filePath) {
  try {
    await fsp.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function readText(filePath) {
  return fsp.readFile(filePath, "utf8");
}

async function readJsonSafe(filePath) {
  try {
    const raw = await readText(filePath);
    return { ok: true, value: JSON.parse(raw) };
  } catch (error) {
    return { ok: false, error };
  }
}

function extractIdFromFileName(fileName, kind) {
  const pattern = kind === "task" ? /^TASK-(\d{3})\.md$/ : /^HANDOFF-(\d{3})\.md$/;
  const match = fileName.match(pattern);
  if (!match) {
    return null;
  }
  return Number(match[1]);
}

function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) {
    return {};
  }
  const lines = match[1].split("\n");
  const out = {};
  let currentArrayKey = "";
  for (const line of lines) {
    if (/^\s*-\s+/.test(line) && currentArrayKey) {
      if (!Array.isArray(out[currentArrayKey])) {
        out[currentArrayKey] = [];
      }
      out[currentArrayKey].push(line.replace(/^\s*-\s+/, "").trim());
      continue;
    }
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!m) {
      continue;
    }
    const key = m[1];
    const raw = m[2].trim();
    if (raw === "") {
      currentArrayKey = key;
      out[key] = [];
      continue;
    }
    currentArrayKey = "";
    out[key] = raw.replace(/^"(.*)"$/, "$1");
  }
  return out;
}

async function listMarkdownFiles(dirPath) {
  const entries = await fsp.readdir(dirPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name)
    .sort();
}

function addCheck(checks, id, status, message, details = "") {
  checks.push({
    id,
    status,
    message,
    details: details || undefined
  });
}

function statusText(values) {
  return values.map((v) => `${v.name}:${v.status}`).join(", ");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const checks = [];
  let terminalCompletion = false;

  const requiredFiles = [
    "README.md",
    ".mcp.json",
    ".ai/state/current-state.json",
    ".ai/state/active-task.json",
    ".ai/state/roadmap.json",
    ".ai/indexes/file-index.md",
    ".ai/indexes/api-index.md"
  ];

  for (const relativePath of requiredFiles) {
    const fullPath = projectFile(args.projectRoot, relativePath);
    const exists = await fileExists(fullPath);
    addCheck(
      checks,
      `required:${relativePath}`,
      exists ? "pass" : "fail",
      exists ? `Arquivo encontrado: ${relativePath}` : `Arquivo ausente: ${relativePath}`
    );
  }

  const currentStatePath = projectFile(args.projectRoot, ".ai/state/current-state.json");
  const activeTaskPath = projectFile(args.projectRoot, ".ai/state/active-task.json");
  const roadmapPath = projectFile(args.projectRoot, ".ai/state/roadmap.json");
  const fileIndexPath = projectFile(args.projectRoot, ".ai/indexes/file-index.md");
  const apiIndexPath = projectFile(args.projectRoot, ".ai/indexes/api-index.md");
  const readmePath = projectFile(args.projectRoot, "README.md");
  const mcpPath = projectFile(args.projectRoot, ".mcp.json");

  const parsedCurrentState = await readJsonSafe(currentStatePath);
  const parsedActiveTask = await readJsonSafe(activeTaskPath);
  const parsedRoadmap = await readJsonSafe(roadmapPath);

  addCheck(
    checks,
    "json:current-state",
    parsedCurrentState.ok ? "pass" : "fail",
    parsedCurrentState.ok ? "current-state.json valido" : "current-state.json invalido",
    parsedCurrentState.ok ? "" : String(parsedCurrentState.error?.message || parsedCurrentState.error)
  );
  addCheck(
    checks,
    "json:active-task",
    parsedActiveTask.ok ? "pass" : "fail",
    parsedActiveTask.ok ? "active-task.json valido" : "active-task.json invalido",
    parsedActiveTask.ok ? "" : String(parsedActiveTask.error?.message || parsedActiveTask.error)
  );
  addCheck(
    checks,
    "json:roadmap",
    parsedRoadmap.ok ? "pass" : "fail",
    parsedRoadmap.ok ? "roadmap.json valido" : "roadmap.json invalido",
    parsedRoadmap.ok ? "" : String(parsedRoadmap.error?.message || parsedRoadmap.error)
  );

  let currentState = {};
  let activeTask = {};
  let roadmap = {};

  if (parsedCurrentState.ok) currentState = parsedCurrentState.value || {};
  if (parsedActiveTask.ok) activeTask = parsedActiveTask.value || {};
  if (parsedRoadmap.ok) roadmap = parsedRoadmap.value || {};

  if (parsedCurrentState.ok && parsedActiveTask.ok) {
    const currentActiveId = String(currentState.active_task_id || "");
    const activeTaskId = String(activeTask.task_id || "");
    const same = currentActiveId && currentActiveId === activeTaskId;
    addCheck(
      checks,
      "state:active-task-id",
      same ? "pass" : "fail",
      same
        ? `active_task_id consistente: ${currentActiveId}`
        : "active_task_id divergente entre current-state e active-task",
      same ? "" : `current-state=${currentActiveId || "(vazio)"} active-task=${activeTaskId || "(vazio)"}`
    );

    const idPattern = /^TASK-\d{3}$/;
    const idValid = idPattern.test(currentActiveId);
    addCheck(
      checks,
      "state:active-task-id-format",
      idValid ? "pass" : "fail",
      idValid ? "Formato do active_task_id valido" : "Formato do active_task_id invalido",
      idValid ? "" : `valor=${currentActiveId || "(vazio)"}`
    );

    const readme = await readText(readmePath);
    const hasTaskInReadme = readme.includes(`.ai/tasks/${currentActiveId}.md`);
    addCheck(
      checks,
      "docs:readme-active-task",
      hasTaskInReadme ? "pass" : "warn",
      hasTaskInReadme
        ? "README referencia a tarefa ativa"
        : "README nao referencia explicitamente a tarefa ativa atual"
    );
  }

  if (parsedCurrentState.ok && parsedRoadmap.ok) {
    const currentPhase = String(currentState.current_phase || "");
    const phases = Array.isArray(roadmap.phases) ? roadmap.phases : [];
    const details = Array.isArray(roadmap.phase_details) ? roadmap.phase_details : [];

    const phaseExists = phases.includes(currentPhase);
    addCheck(
      checks,
      "roadmap:current-phase-in-phases",
      phaseExists ? "pass" : "fail",
      phaseExists ? "current_phase existe em roadmap.phases" : "current_phase nao encontrado em roadmap.phases",
      phaseExists ? "" : `current_phase=${currentPhase || "(vazio)"}`
    );

    const detailNames = details.map((d) => String(d.name || ""));
    const detailMatch = detailNames.includes(currentPhase);
    addCheck(
      checks,
      "roadmap:current-phase-in-details",
      detailMatch ? "pass" : "fail",
      detailMatch
        ? "current_phase existe em roadmap.phase_details"
        : "current_phase nao encontrado em roadmap.phase_details",
      detailMatch ? "" : `phase_details=${detailNames.join(", ")}`
    );

    const inProgress = details.filter((d) => String(d.status || "") === "in_progress");
    const allCompleted = details.length > 0 && details.every((d) => String(d.status || "") === "completed");
    const inProgressOk = inProgress.length === 1 || allCompleted;
    terminalCompletion = allCompleted;
    addCheck(
      checks,
      "roadmap:single-in-progress",
      inProgressOk ? "pass" : "fail",
      allCompleted
        ? "Roadmap finalizado com todas as fases completed"
        : inProgressOk
          ? "Roadmap possui exatamente uma fase in_progress"
          : "Roadmap deve ter exatamente uma fase in_progress",
      statusText(details.map((d) => ({ name: String(d.name || ""), status: String(d.status || "") })))
    );

    if (inProgress.length === 1) {
      const inProgressName = String(inProgress[0].name || "");
      const samePhase = inProgressName === currentPhase;
      addCheck(
        checks,
        "roadmap:in-progress-equals-current-phase",
        samePhase ? "pass" : "fail",
        samePhase
          ? "Fase in_progress coincide com current_phase"
          : "Fase in_progress difere de current_phase",
        samePhase ? "" : `in_progress=${inProgressName} current_phase=${currentPhase}`
      );
    }

    if (allCompleted) {
      const lastPhaseName = String(details[details.length - 1]?.name || "");
      const terminalPhaseMatch = currentPhase === lastPhaseName;
      addCheck(
        checks,
        "roadmap:terminal-phase-alignment",
        terminalPhaseMatch ? "pass" : "warn",
        terminalPhaseMatch
          ? "current_phase alinhada com fase final em estado terminal"
          : "current_phase nao corresponde a fase final em estado terminal",
        `current_phase=${currentPhase || "(vazio)"} final=${lastPhaseName || "(vazio)"}`
      );
    }
  }

  const tasksDir = projectFile(args.projectRoot, ".ai/tasks");
  const handoffsDir = projectFile(args.projectRoot, ".ai/handoffs");
  const taskFiles = await listMarkdownFiles(tasksDir);
  const handoffFiles = await listMarkdownFiles(handoffsDir);

  const nonStandardTasks = taskFiles.filter((name) => !/^TASK-\d{3}\.md$/.test(name));
  const nonStandardHandoffs = handoffFiles.filter((name) => !/^HANDOFF-\d{3}\.md$/.test(name));

  addCheck(
    checks,
    "naming:tasks",
    nonStandardTasks.length === 0 ? "pass" : "warn",
    nonStandardTasks.length === 0
      ? "Nomenclatura TASK-* valida"
      : "Arquivos de task fora do padrao detectados",
    nonStandardTasks.join(", ")
  );
  addCheck(
    checks,
    "naming:handoffs",
    nonStandardHandoffs.length === 0 ? "pass" : "warn",
    nonStandardHandoffs.length === 0
      ? "Nomenclatura HANDOFF-* valida"
      : "Arquivos de handoff fora do padrao detectados",
    nonStandardHandoffs.join(", ")
  );

  const taskIds = taskFiles.map((name) => extractIdFromFileName(name, "task")).filter((v) => Number.isFinite(v));
  const handoffIds = handoffFiles
    .map((name) => extractIdFromFileName(name, "handoff"))
    .filter((v) => Number.isFinite(v));

  const latestTaskNumber = taskIds.length > 0 ? Math.max(...taskIds) : null;
  const latestHandoffNumber = handoffIds.length > 0 ? Math.max(...handoffIds) : null;
  const latestTaskId = Number.isFinite(latestTaskNumber) ? `TASK-${String(latestTaskNumber).padStart(3, "0")}` : "";
  const latestHandoffId = Number.isFinite(latestHandoffNumber)
    ? `HANDOFF-${String(latestHandoffNumber).padStart(3, "0")}`
    : "";

  if (parsedCurrentState.ok && parsedActiveTask.ok) {
    const currentActiveId = String(currentState.active_task_id || "");
    const activeTaskPath = projectFile(args.projectRoot, `.ai/tasks/${currentActiveId}.md`);
    const activeTaskExists = currentActiveId ? await fileExists(activeTaskPath) : false;
    addCheck(
      checks,
      "task:active-exists",
      activeTaskExists ? "pass" : "fail",
      activeTaskExists ? "Arquivo da tarefa ativa encontrado" : "Arquivo da tarefa ativa nao encontrado",
      `.ai/tasks/${currentActiveId}.md`
    );

    if (activeTaskExists) {
      const markdown = await readText(activeTaskPath);
      const frontmatter = parseFrontmatter(markdown);
      const titleMatch = String(frontmatter.title || "") === currentActiveId;
      const activeStatus = String(frontmatter.status || "");
      const statusMatch =
        activeStatus === "active" || activeStatus === "in_progress" || (terminalCompletion && activeStatus === "completed");
      addCheck(
        checks,
        "task:active-frontmatter-title",
        titleMatch ? "pass" : "warn",
        titleMatch ? "Frontmatter da tarefa ativa com title consistente" : "Frontmatter da tarefa ativa com title divergente",
        `title=${frontmatter.title || "(vazio)"}`
      );
      addCheck(
        checks,
        "task:active-frontmatter-status",
        statusMatch ? "pass" : "warn",
        statusMatch ? "Status da tarefa ativa no markdown consistente" : "Status da tarefa ativa no markdown inesperado",
        `status=${activeStatus || "(vazio)"}`
      );
    }

    const activeIsLatest = currentActiveId === latestTaskId;
    addCheck(
      checks,
      "task:active-is-latest",
      activeIsLatest ? "pass" : "warn",
      activeIsLatest
        ? "Tarefa ativa coincide com ultimo TASK-*"
        : "Tarefa ativa nao e o ultimo TASK-*",
      `active=${currentActiveId || "(vazio)"} latest=${latestTaskId || "(nenhum)"}`
    );
  }

  if (parsedCurrentState.ok) {
    const keyFiles = Array.isArray(currentState.key_files) ? currentState.key_files : [];
    const handoffPathFromState = keyFiles.find((item) => /HANDOFF-\d{3}\.md$/.test(String(item)));
    const handoffIdFromState = handoffPathFromState
      ? path.basename(String(handoffPathFromState), ".md")
      : "";
    const handoffInState = Boolean(handoffIdFromState);

    addCheck(
      checks,
      "state:handoff-in-key-files",
      handoffInState ? "pass" : "fail",
      handoffInState
        ? "current-state.key_files referencia handoff"
        : "current-state.key_files nao referencia handoff ativo",
      handoffPathFromState || ""
    );

    if (handoffInState) {
      const activeHandoffPath = projectFile(args.projectRoot, `.ai/handoffs/${handoffIdFromState}.md`);
      const activeHandoffExists = await fileExists(activeHandoffPath);
      addCheck(
        checks,
        "handoff:active-exists",
        activeHandoffExists ? "pass" : "fail",
        activeHandoffExists ? "Arquivo do handoff ativo encontrado" : "Arquivo do handoff ativo nao encontrado",
        `.ai/handoffs/${handoffIdFromState}.md`
      );

      const isLatest = handoffIdFromState === latestHandoffId;
      addCheck(
        checks,
        "handoff:state-is-latest",
        isLatest ? "pass" : "warn",
        isLatest
          ? "Handoff em current-state coincide com ultimo HANDOFF-*"
          : "Handoff em current-state nao e o ultimo HANDOFF-*",
        `state=${handoffIdFromState || "(vazio)"} latest=${latestHandoffId || "(nenhum)"}`
      );

      if (activeHandoffExists) {
        const markdown = await readText(activeHandoffPath);
        const frontmatter = parseFrontmatter(markdown);
        const titleMatch = String(frontmatter.title || "") === handoffIdFromState;
        addCheck(
          checks,
          "handoff:active-frontmatter-title",
          titleMatch ? "pass" : "warn",
          titleMatch
            ? "Frontmatter do handoff ativo com title consistente"
            : "Frontmatter do handoff ativo com title divergente",
          `title=${frontmatter.title || "(vazio)"}`
        );
      }

      if (parsedActiveTask.ok) {
        const activeTaskId = String(activeTask.task_id || "");
        const taskNum = activeTaskId.match(/^TASK-(\d{3})$/)?.[1] || "";
        const handoffNum = handoffIdFromState.match(/^HANDOFF-(\d{3})$/)?.[1] || "";
        const sameNum = Boolean(taskNum && handoffNum && taskNum === handoffNum);
        addCheck(
          checks,
          "handoff:task-number-alignment",
          sameNum ? "pass" : "warn",
          sameNum
            ? "Numero de TASK e HANDOFF ativos alinhado"
            : "Numero de TASK e HANDOFF ativos desalinhado",
          `task=${activeTaskId || "(vazio)"} handoff=${handoffIdFromState || "(vazio)"}`
        );
      }
    }
  }

  const fileIndex = await readText(fileIndexPath);
  const apiIndex = await readText(apiIndexPath);
  const readme = await readText(readmePath);
  const mcpRaw = await readText(mcpPath);

  const activeTaskId = String(activeTask.task_id || currentState.active_task_id || "");
  const handoffPathFromState = Array.isArray(currentState.key_files)
    ? currentState.key_files.find((item) => /HANDOFF-\d{3}\.md$/.test(String(item)))
    : "";
  const activeHandoffId = handoffPathFromState ? path.basename(String(handoffPathFromState), ".md") : "";

  if (activeTaskId) {
    addCheck(
      checks,
      "indexes:file-index-active-task",
      fileIndex.includes(activeTaskId) ? "pass" : "warn",
      fileIndex.includes(activeTaskId)
        ? "file-index referencia a tarefa ativa"
        : "file-index nao referencia a tarefa ativa",
      activeTaskId
    );
  }

  if (activeHandoffId) {
    addCheck(
      checks,
      "indexes:file-index-active-handoff",
      fileIndex.includes(activeHandoffId) ? "pass" : "warn",
      fileIndex.includes(activeHandoffId)
        ? "file-index referencia o handoff ativo"
        : "file-index nao referencia o handoff ativo",
      activeHandoffId
    );
  }

  addCheck(
    checks,
    "indexes:file-index-hardening-runner",
    fileIndex.includes(".ai/context/workflow-hardening-runner.mjs") ? "pass" : "warn",
    fileIndex.includes(".ai/context/workflow-hardening-runner.mjs")
      ? "file-index referencia workflow-hardening-runner"
      : "file-index nao referencia workflow-hardening-runner"
  );

  addCheck(
    checks,
    "indexes:api-index-hardening",
    /hardening/i.test(apiIndex) ? "pass" : "warn",
    /hardening/i.test(apiIndex)
      ? "api-index registra automacao/validacao de hardening"
      : "api-index ainda nao registra automacao de hardening"
  );

  addCheck(
    checks,
    "docs:readme-active-handoff",
    activeHandoffId && readme.includes(`.ai/handoffs/${activeHandoffId}.md`) ? "pass" : "warn",
    activeHandoffId && readme.includes(`.ai/handoffs/${activeHandoffId}.md`)
      ? "README referencia handoff ativo"
      : "README nao referencia explicitamente o handoff ativo",
    activeHandoffId
  );

  addCheck(
    checks,
    "mcp:project-memory-present",
    /project-memory/.test(mcpRaw) ? "pass" : "warn",
    /project-memory/.test(mcpRaw)
      ? ".mcp.json contem project-memory"
      : ".mcp.json nao contem project-memory"
  );

  if (activeTaskId) {
    const taskMirrorPath = projectFile(args.projectRoot, `obsidian-vault/02-tasks/${activeTaskId}.md`);
    const taskMirrorExists = await fileExists(taskMirrorPath);
    addCheck(
      checks,
      "obsidian:task-mirror-exists",
      taskMirrorExists ? "pass" : "fail",
      taskMirrorExists ? "Espelho Obsidian da tarefa ativa encontrado" : "Espelho Obsidian da tarefa ativa ausente",
      `obsidian-vault/02-tasks/${activeTaskId}.md`
    );

    if (taskMirrorExists) {
      const mirror = await readText(taskMirrorPath);
      addCheck(
        checks,
        "obsidian:task-mirror-heading",
        mirror.includes(`# ${activeTaskId}`) ? "pass" : "warn",
        mirror.includes(`# ${activeTaskId}`)
          ? "Heading do espelho de task consistente"
          : "Heading do espelho de task divergente"
      );
    }
  }

  if (activeHandoffId) {
    const handoffMirrorPath = projectFile(args.projectRoot, `obsidian-vault/04-handoffs/${activeHandoffId}.md`);
    const handoffMirrorExists = await fileExists(handoffMirrorPath);
    addCheck(
      checks,
      "obsidian:handoff-mirror-exists",
      handoffMirrorExists ? "pass" : "fail",
      handoffMirrorExists ? "Espelho Obsidian do handoff ativo encontrado" : "Espelho Obsidian do handoff ativo ausente",
      `obsidian-vault/04-handoffs/${activeHandoffId}.md`
    );

    if (handoffMirrorExists) {
      const mirror = await readText(handoffMirrorPath);
      addCheck(
        checks,
        "obsidian:handoff-mirror-heading",
        mirror.includes(`# ${activeHandoffId}`) ? "pass" : "warn",
        mirror.includes(`# ${activeHandoffId}`)
          ? "Heading do espelho de handoff consistente"
          : "Heading do espelho de handoff divergente"
      );
    }
  }

  if (parsedCurrentState.ok) {
    const snapshotPath = projectFile(args.projectRoot, "obsidian-vault/05-reference/state-snapshot.md");
    const snapshotExists = await fileExists(snapshotPath);
    addCheck(
      checks,
      "obsidian:snapshot-exists",
      snapshotExists ? "pass" : "fail",
      snapshotExists ? "State snapshot do Obsidian encontrado" : "State snapshot do Obsidian ausente"
    );
    if (snapshotExists) {
      const snapshot = await readText(snapshotPath);
      const phaseLine = `- phase: ${currentState.current_phase}`;
      const taskLine = `- active_task_id: ${currentState.active_task_id}`;
      addCheck(
        checks,
        "obsidian:snapshot-phase",
        snapshot.includes(phaseLine) ? "pass" : "warn",
        snapshot.includes(phaseLine)
          ? "State snapshot reflete current_phase"
          : "State snapshot nao reflete current_phase"
      );
      addCheck(
        checks,
        "obsidian:snapshot-active-task",
        snapshot.includes(taskLine) ? "pass" : "warn",
        snapshot.includes(taskLine)
          ? "State snapshot reflete active_task_id"
          : "State snapshot nao reflete active_task_id"
      );
    }
  }

  const summary = {
    total_checks: checks.length,
    passed: checks.filter((item) => item.status === "pass").length,
    warnings: checks.filter((item) => item.status === "warn").length,
    failed: checks.filter((item) => item.status === "fail").length
  };

  const report = {
    ok: summary.failed === 0,
    dry_run: args.dryRun,
    generated_at: new Date().toISOString(),
    summary,
    policy: {
      source_of_truth: ".ai/",
      on_failure: "corrigir .ai/state e TASK/HANDOFF; depois rerodar sync do Obsidian",
      on_warning: "ajustar docs/indexes e rerodar validacao"
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
