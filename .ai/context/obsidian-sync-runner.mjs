#!/usr/bin/env node

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PROJECT_ROOT = path.resolve(SCRIPT_DIR, "../..");

function parseArgs(argv) {
  const out = {
    projectRoot: DEFAULT_PROJECT_ROOT,
    dryRun: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--project-root") {
      out.projectRoot = path.resolve(argv[i + 1] || "");
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
  return out;
}

function printHelpAndExit(code) {
  console.error(
    [
      "Usage:",
      "  node .ai/context/obsidian-sync-runner.mjs [--project-root <dir>] [--dry-run]",
      "",
      "Sync targets:",
      "  - obsidian-vault/02-tasks/TASK-*.md",
      "  - obsidian-vault/04-handoffs/HANDOFF-*.md",
      "  - obsidian-vault/01-context/project-overview.md",
      "  - obsidian-vault/01-context/architecture.md",
      "  - obsidian-vault/03-decisions/decisions.md",
      "  - obsidian-vault/05-reference/state-snapshot.md"
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

async function readText(filePath) {
  return fsp.readFile(filePath, "utf8");
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

function extractSectionBullets(markdown, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`## ${escaped}\\n([\\s\\S]*?)(\\n## |$)`);
  const match = markdown.match(regex);
  if (!match) {
    return [];
  }
  return match[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2));
}

function extractSummaryBullets(markdown, maxItems = 3) {
  const lines = markdown
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2));
  return lines.slice(0, maxItems);
}

async function listFiles(dirPath, prefix) {
  const entries = await fsp.readdir(dirPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.startsWith(prefix) && entry.name.endsWith(".md"))
    .map((entry) => entry.name)
    .sort();
}

async function writeIfChanged(filePath, content, dryRun) {
  let previous = "";
  if (fs.existsSync(filePath)) {
    previous = await fsp.readFile(filePath, "utf8");
  }
  if (previous === content) {
    return false;
  }
  if (!dryRun) {
    await fsp.mkdir(path.dirname(filePath), { recursive: true });
    await fsp.writeFile(filePath, content, "utf8");
  }
  return true;
}

function buildTaskMirror(name, frontmatter, markdown) {
  const summary = extractSummaryBullets(markdown, 3);
  const nextStep = extractSectionBullets(markdown, "Proximo passo recomendado");
  const lines = [
    `# ${name}`,
    "",
    `Espelho do arquivo \`.ai/tasks/${name}.md\`.`,
    "",
    `Status: ${frontmatter.status || "unknown"}`,
    `Objetivo: ${frontmatter.purpose || "n/a"}`,
    ""
  ];
  if (summary.length > 0) {
    lines.push("Resumo operacional:", "");
    for (const item of summary) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }
  if (nextStep.length > 0) {
    lines.push("Proximo passo:", "");
    for (const item of nextStep.slice(0, 2)) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

function buildHandoffMirror(name, frontmatter, markdown) {
  const current = extractSectionBullets(markdown, "Estado atual");
  const next = extractSectionBullets(markdown, "Proxima acao recomendada");
  const lines = [
    `# ${name}`,
    "",
    `Espelho do arquivo \`.ai/handoffs/${name}.md\`.`,
    "",
    `Status: ${frontmatter.status || "unknown"}`,
    `Purpose: ${frontmatter.purpose || "n/a"}`,
    ""
  ];
  if (current.length > 0) {
    lines.push("Estado:", "");
    for (const item of current.slice(0, 3)) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }
  if (next.length > 0) {
    lines.push("Proximo passo:", "");
    for (const item of next.slice(0, 2)) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

async function syncTaskMirrors(projectRoot, dryRun, changedFiles) {
  const tasksDir = projectFile(projectRoot, ".ai/tasks");
  const vaultDir = projectFile(projectRoot, "obsidian-vault/02-tasks");
  const taskFiles = await listFiles(tasksDir, "TASK-");
  for (const name of taskFiles) {
    const sourcePath = path.join(tasksDir, name);
    const markdown = await readText(sourcePath);
    const frontmatter = parseFrontmatter(markdown);
    const mirrorContent = buildTaskMirror(path.basename(name, ".md"), frontmatter, markdown);
    const mirrorPath = path.join(vaultDir, name);
    const changed = await writeIfChanged(mirrorPath, mirrorContent, dryRun);
    if (changed) {
      changedFiles.push(path.relative(projectRoot, mirrorPath));
    }
  }
}

async function syncHandoffMirrors(projectRoot, dryRun, changedFiles) {
  const handoffsDir = projectFile(projectRoot, ".ai/handoffs");
  const vaultDir = projectFile(projectRoot, "obsidian-vault/04-handoffs");
  const handoffFiles = await listFiles(handoffsDir, "HANDOFF-");
  for (const name of handoffFiles) {
    const sourcePath = path.join(handoffsDir, name);
    const markdown = await readText(sourcePath);
    const frontmatter = parseFrontmatter(markdown);
    const mirrorContent = buildHandoffMirror(path.basename(name, ".md"), frontmatter, markdown);
    const mirrorPath = path.join(vaultDir, name);
    const changed = await writeIfChanged(mirrorPath, mirrorContent, dryRun);
    if (changed) {
      changedFiles.push(path.relative(projectRoot, mirrorPath));
    }
  }
}

async function syncContextMirrors(projectRoot, dryRun, changedFiles) {
  const currentState = JSON.parse(await readText(projectFile(projectRoot, ".ai/state/current-state.json")));
  const activeTask = JSON.parse(await readText(projectFile(projectRoot, ".ai/state/active-task.json")));
  const today = new Date().toISOString().slice(0, 10);

  const projectOverviewContent = [
    "# Project Overview",
    "",
    "Espelho do arquivo `.ai/context/project-overview.md`.",
    "",
    `Atualizacao ${today}:`,
    `- fase atual: \`${currentState.current_phase}\``,
    `- objetivo atual: ${currentState.current_goal}`,
    `- tarefa ativa: \`${currentState.active_task_id}\``,
    `- handoff recomendado: \`${currentState.key_files?.find((f) => String(f).includes("HANDOFF-")) || ".ai/handoffs/"}\``,
    `- resumo da tarefa ativa: ${activeTask.summary || "n/a"}`,
    ""
  ].join("\n");

  const architectureContent = [
    "# Architecture",
    "",
    "Espelho do arquivo `.ai/context/architecture.md`.",
    "",
    `Atualizacao ${today}:`,
    "- fonte de verdade: `.ai/state/current-state.json`, `.ai/state/active-task.json`, handoff mais recente",
    "- MCP `project-memory` ativo para leitura/escrita operacional",
    "- espelhamento Obsidian sincronizado por `obsidian-sync-runner.mjs`",
    `- fase em execucao: \`${currentState.current_phase}\``,
    ""
  ].join("\n");

  const projectOverviewPath = projectFile(projectRoot, "obsidian-vault/01-context/project-overview.md");
  const architecturePath = projectFile(projectRoot, "obsidian-vault/01-context/architecture.md");

  if (await writeIfChanged(projectOverviewPath, projectOverviewContent, dryRun)) {
    changedFiles.push(path.relative(projectRoot, projectOverviewPath));
  }
  if (await writeIfChanged(architecturePath, architectureContent, dryRun)) {
    changedFiles.push(path.relative(projectRoot, architecturePath));
  }
}

async function syncDecisionMirror(projectRoot, dryRun, changedFiles) {
  const decisionsMarkdown = await readText(projectFile(projectRoot, ".ai/memory/decisions.md"));
  const bullets = decisionsMarkdown
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .slice(-10);
  const today = new Date().toISOString().slice(0, 10);

  const content = [
    "# Decisions",
    "",
    "Espelho do arquivo `.ai/memory/decisions.md`.",
    "",
    `Atualizacao ${today}:`,
    ...bullets,
    ""
  ].join("\n");

  const mirrorPath = projectFile(projectRoot, "obsidian-vault/03-decisions/decisions.md");
  if (await writeIfChanged(mirrorPath, content, dryRun)) {
    changedFiles.push(path.relative(projectRoot, mirrorPath));
  }
}

async function syncReferenceSnapshot(projectRoot, dryRun, changedFiles) {
  const currentState = JSON.parse(await readText(projectFile(projectRoot, ".ai/state/current-state.json")));
  const activeTask = JSON.parse(await readText(projectFile(projectRoot, ".ai/state/active-task.json")));
  const roadmap = JSON.parse(await readText(projectFile(projectRoot, ".ai/state/roadmap.json")));
  const today = new Date().toISOString();

  const phaseDetails = (roadmap.phase_details || [])
    .map((item) => `- ${item.id} | ${item.name} | ${item.status}`)
    .join("\n");

  const content = [
    "# State Snapshot",
    "",
    `Gerado em: ${today}`,
    "",
    "## Current State",
    `- phase: ${currentState.current_phase}`,
    `- goal: ${currentState.current_goal}`,
    `- active_task_id: ${currentState.active_task_id}`,
    `- last_completed_task_id: ${currentState.last_completed_task_id}`,
    "",
    "## Active Task",
    `- task_id: ${activeTask.task_id}`,
    `- title: ${activeTask.title}`,
    `- status: ${activeTask.status}`,
    `- next_step: ${activeTask.next_step}`,
    "",
    "## Roadmap",
    phaseDetails,
    ""
  ].join("\n");

  const snapshotPath = projectFile(projectRoot, "obsidian-vault/05-reference/state-snapshot.md");
  if (await writeIfChanged(snapshotPath, content, dryRun)) {
    changedFiles.push(path.relative(projectRoot, snapshotPath));
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const changedFiles = [];

  await syncTaskMirrors(args.projectRoot, args.dryRun, changedFiles);
  await syncHandoffMirrors(args.projectRoot, args.dryRun, changedFiles);
  await syncContextMirrors(args.projectRoot, args.dryRun, changedFiles);
  await syncDecisionMirror(args.projectRoot, args.dryRun, changedFiles);
  await syncReferenceSnapshot(args.projectRoot, args.dryRun, changedFiles);

  console.log(
    JSON.stringify(
      {
        ok: true,
        dry_run: args.dryRun,
        changed_files: [...new Set(changedFiles)].sort()
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(String(error?.stack || error?.message || error));
  process.exit(1);
});

