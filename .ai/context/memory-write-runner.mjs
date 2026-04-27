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
    manifest: "",
    dryRun: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--project-root") {
      out.projectRoot = path.resolve(argv[i + 1] || "");
      i += 1;
      continue;
    }
    if (arg === "--manifest") {
      out.manifest = argv[i + 1] || "";
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

  if (!out.manifest) {
    printHelpAndExit(1, "Missing required argument: --manifest <path>");
  }

  out.manifest = path.resolve(out.manifest);
  return out;
}

function printHelpAndExit(code, message = "") {
  if (message) {
    console.error(message);
  }
  console.error(
    [
      "Usage:",
      "  node .ai/context/memory-write-runner.mjs --manifest <file> [--project-root <dir>] [--dry-run]",
      "",
      "What it updates:",
      "  - .ai/state/current-state.json",
      "  - .ai/state/active-task.json",
      "  - .ai/state/roadmap.json",
      "  - .ai/tasks/TASK-xxx.md (status update and/or generation)",
      "  - .ai/handoffs/HANDOFF-xxx.md (generation)",
      "  - .ai/logs/*.md (append bullets)",
      "  - .ai/memory/*.md (append bullets)"
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

async function readJson(filePath) {
  const raw = await fsp.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

function sortObjectKeys(value) {
  if (Array.isArray(value)) {
    return value.map(sortObjectKeys);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const keys = Object.keys(value);
  const sorted = {};
  for (const key of keys) {
    sorted[key] = sortObjectKeys(value[key]);
  }
  return sorted;
}

async function writeJson(filePath, value, dryRun) {
  const content = `${JSON.stringify(sortObjectKeys(value), null, 2)}\n`;
  if (!dryRun) {
    await fsp.writeFile(filePath, content, "utf8");
  }
}

function appendUnique(existingList, values) {
  const out = Array.isArray(existingList) ? [...existingList] : [];
  const seen = new Set(out.map((v) => String(v)));
  for (const value of values) {
    const item = String(value).trim();
    if (!item || seen.has(item)) {
      continue;
    }
    out.push(item);
    seen.add(item);
  }
  return out;
}

function yamlScalar(value) {
  const str = String(value);
  if (!str) {
    return '""';
  }
  if (/[:#\[\]\{\}\n]|^\s|\s$/.test(str)) {
    return JSON.stringify(str);
  }
  return str;
}

function renderFrontmatter(frontmatter) {
  const lines = ["---"];
  for (const [key, value] of Object.entries(frontmatter)) {
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - ${yamlScalar(item)}`);
      }
      continue;
    }
    lines.push(`${key}: ${yamlScalar(value)}`);
  }
  lines.push("---", "");
  return lines.join("\n");
}

function renderSection(section) {
  const lines = [`## ${section.title}`];
  if (typeof section.text === "string" && section.text.trim()) {
    lines.push("", section.text.trim());
  }
  if (Array.isArray(section.bullets) && section.bullets.length > 0) {
    lines.push("");
    for (const bullet of section.bullets) {
      lines.push(`- ${bullet}`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

function renderDocument(spec) {
  const frontmatter = renderFrontmatter(spec.frontmatter || {});
  const lines = [frontmatter, `# ${spec.heading || spec.frontmatter?.title || "Document"}`, ""];
  for (const section of spec.sections || []) {
    lines.push(renderSection(section));
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

function upsertFrontmatterField(markdown, field, value) {
  const frontmatterMatch = markdown.match(/^---\n([\s\S]*?)\n---\n/);
  if (!frontmatterMatch) {
    throw new Error(`File has no frontmatter for field update: ${field}`);
  }
  const block = frontmatterMatch[1];
  const pattern = new RegExp(`^${field}:\\s*.*$`, "m");
  const rendered = `${field}: ${yamlScalar(value)}`;
  let updatedBlock;
  if (pattern.test(block)) {
    updatedBlock = block.replace(pattern, rendered);
  } else {
    updatedBlock = `${block}\n${rendered}`;
  }
  return markdown.replace(frontmatterMatch[0], `---\n${updatedBlock}\n---\n`);
}

function appendSectionIfMissing(markdown, section) {
  const marker = `## ${section.title}`;
  if (markdown.includes(marker)) {
    return markdown;
  }
  const rendered = renderSection(section);
  return `${markdown.trimEnd()}\n\n${rendered}`;
}

function defaultHeadingFor(relativePath) {
  const file = path.basename(relativePath, path.extname(relativePath));
  if (file === "codex") return "# Codex Log\n";
  if (file === "timeline") return "# Timeline\n";
  if (file === "claude-code") return "# Claude Code Log\n";
  if (file === "antigravity") return "# Antigravity Log\n";
  if (file === "decisions") return "# Decisions\n";
  if (file === "blockers") return "# Blockers\n";
  if (file === "assumptions") return "# Assumptions\n";
  if (file === "patterns") return "# Patterns\n";
  return `# ${file}\n`;
}

async function appendBullets(projectRoot, relativePath, lines, dryRun) {
  if (!Array.isArray(lines) || lines.length === 0) {
    return false;
  }

  const filePath = projectFile(projectRoot, relativePath);
  let content = "";
  if (fs.existsSync(filePath)) {
    content = await fsp.readFile(filePath, "utf8");
  } else {
    content = `${defaultHeadingFor(relativePath)}\n`;
  }

  const existing = new Set(
    content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("- "))
      .map((line) => line.slice(2))
  );

  const additions = [];
  for (const line of lines) {
    const value = String(line).trim();
    if (!value || existing.has(value)) {
      continue;
    }
    additions.push(`- ${value}`);
    existing.add(value);
  }

  if (additions.length === 0) {
    return false;
  }

  let updated = content;
  if (!updated.endsWith("\n")) {
    updated += "\n";
  }
  updated += `${additions.join("\n")}\n`;
  if (!dryRun) {
    await fsp.writeFile(filePath, updated, "utf8");
  }
  return true;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifest = await readJson(args.manifest);
  const changedFiles = [];

  const currentStatePath = projectFile(args.projectRoot, ".ai/state/current-state.json");
  const activeTaskPath = projectFile(args.projectRoot, ".ai/state/active-task.json");
  const roadmapPath = projectFile(args.projectRoot, ".ai/state/roadmap.json");

  const currentState = await readJson(currentStatePath);
  const activeTask = await readJson(activeTaskPath);
  const roadmap = await readJson(roadmapPath);

  if (manifest.update_current_state && typeof manifest.update_current_state === "object") {
    Object.assign(currentState, manifest.update_current_state);
  }
  if (manifest.append_current_state_arrays && typeof manifest.append_current_state_arrays === "object") {
    for (const [key, values] of Object.entries(manifest.append_current_state_arrays)) {
      currentState[key] = appendUnique(currentState[key], Array.isArray(values) ? values : []);
    }
  }
  if (manifest.replace_current_state_arrays && typeof manifest.replace_current_state_arrays === "object") {
    for (const [key, values] of Object.entries(manifest.replace_current_state_arrays)) {
      currentState[key] = Array.isArray(values) ? values : [];
    }
  }

  if (manifest.update_active_task && typeof manifest.update_active_task === "object") {
    for (const [key, value] of Object.entries(manifest.update_active_task)) {
      activeTask[key] = value;
    }
  }

  if (manifest.roadmap_phase_status && typeof manifest.roadmap_phase_status === "object") {
    for (const detail of roadmap.phase_details || []) {
      if (Object.prototype.hasOwnProperty.call(manifest.roadmap_phase_status, detail.id)) {
        detail.status = manifest.roadmap_phase_status[detail.id];
      }
    }
  }

  await writeJson(currentStatePath, currentState, args.dryRun);
  await writeJson(activeTaskPath, activeTask, args.dryRun);
  await writeJson(roadmapPath, roadmap, args.dryRun);
  changedFiles.push(".ai/state/current-state.json", ".ai/state/active-task.json", ".ai/state/roadmap.json");

  if (Array.isArray(manifest.status_updates)) {
    for (const update of manifest.status_updates) {
      const relPath = String(update.path || "").trim();
      if (!relPath) continue;
      const filePath = projectFile(args.projectRoot, relPath);
      let markdown = await fsp.readFile(filePath, "utf8");
      if (update.frontmatter && typeof update.frontmatter === "object") {
        for (const [field, value] of Object.entries(update.frontmatter)) {
          markdown = upsertFrontmatterField(markdown, field, value);
        }
      }
      if (Array.isArray(update.append_sections)) {
        for (const section of update.append_sections) {
          markdown = appendSectionIfMissing(markdown, section);
        }
      }
      if (!args.dryRun) {
        await fsp.writeFile(filePath, `${markdown.trimEnd()}\n`, "utf8");
      }
      changedFiles.push(relPath);
    }
  }

  if (Array.isArray(manifest.documents)) {
    for (const doc of manifest.documents) {
      const relPath = String(doc.path || "").trim();
      if (!relPath) continue;
      const fullPath = projectFile(args.projectRoot, relPath);
      const rendered = renderDocument(doc);
      if (!args.dryRun) {
        await fsp.mkdir(path.dirname(fullPath), { recursive: true });
        await fsp.writeFile(fullPath, rendered, "utf8");
      }
      changedFiles.push(relPath);
    }
  }

  if (manifest.append_logs && typeof manifest.append_logs === "object") {
    for (const [name, lines] of Object.entries(manifest.append_logs)) {
      const relPath = `.ai/logs/${name}.md`;
      const changed = await appendBullets(args.projectRoot, relPath, lines, args.dryRun);
      if (changed) {
        changedFiles.push(relPath);
      }
    }
  }

  if (manifest.append_memory && typeof manifest.append_memory === "object") {
    for (const [name, lines] of Object.entries(manifest.append_memory)) {
      const relPath = `.ai/memory/${name}.md`;
      const changed = await appendBullets(args.projectRoot, relPath, lines, args.dryRun);
      if (changed) {
        changedFiles.push(relPath);
      }
    }
  }

  const finalValidation = {
    current_state_ok: true,
    active_task_ok: true,
    roadmap_ok: true
  };
  JSON.parse(await fsp.readFile(currentStatePath, "utf8"));
  JSON.parse(await fsp.readFile(activeTaskPath, "utf8"));
  JSON.parse(await fsp.readFile(roadmapPath, "utf8"));

  console.log(
    JSON.stringify(
      {
        ok: true,
        dry_run: args.dryRun,
        manifest: path.relative(args.projectRoot, args.manifest),
        changed_files: [...new Set(changedFiles)].sort(),
        validation: finalValidation
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

