#!/usr/bin/env node

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

const PROJECT_ROOT = path.resolve(
  process.env.PROJECT_ROOT || path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..")
);
// When PROJECT_ROOT is the canonical root (e.g. /root/prompt), tools accept an
// optional "project" argument to select a subdirectory. When PROJECT_ROOT is
// already a single project dir, "project" is ignored and stays backwards-compatible.
const DEBUG_LOG = process.env.MCP_DEBUG_LOG || "";
const TOOL_PREFIX = process.env.TOOL_PREFIX || "";
const MEMORY_READ_ONLY = /^(1|true|yes)$/i.test(process.env.MEMORY_READ_ONLY || "");
let debugChunkCount = 0;
let debugDelimiterMissCount = 0;

function debugLog(message) {
  if (!DEBUG_LOG) {
    return;
  }
  try {
    const line = `${new Date().toISOString()} ${message}\n`;
    fs.appendFileSync(DEBUG_LOG, line, "utf8");
  } catch {
    // ignore debug log failures
  }
}

const PROJECT_PROP = {
  project: {
    type: "string",
    description: "Subdirectory name inside PROJECT_ROOT (e.g. 'multi_agent_context'). Required when PROJECT_ROOT is the canonical root; omit when PROJECT_ROOT is already a single project dir."
  }
};

const TOOL_DEFS = [
  {
    name: "get_project_state",
    description: "Return .ai/state/current-state.json",
    inputSchema: {
      type: "object",
      properties: { ...PROJECT_PROP }
    }
  },
  {
    name: "get_active_task",
    description: "Return .ai/state/active-task.json",
    inputSchema: {
      type: "object",
      properties: { ...PROJECT_PROP }
    }
  },
  {
    name: "get_recent_decisions",
    description: "Return recent bullet entries from .ai/memory/decisions.md",
    inputSchema: {
      type: "object",
      properties: {
        ...PROJECT_PROP,
        limit: { type: "integer", minimum: 1, maximum: 50 }
      },
      additionalProperties: false
    }
  },
  {
    name: "save_task_log",
    description: "Create or append a task markdown file in .ai/tasks.",
    inputSchema: {
      type: "object",
      properties: {
        ...PROJECT_PROP,
        task_id: { type: "string" },
        owner_agent: { type: "string" },
        summary: { type: "string" },
        content: { type: "string" }
      },
      required: ["task_id", "content"],
      additionalProperties: false
    }
  },
  {
    name: "save_handoff",
    description: "Create or overwrite a handoff markdown file in .ai/handoffs.",
    inputSchema: {
      type: "object",
      properties: {
        ...PROJECT_PROP,
        handoff_id: { type: "string" },
        owner: { type: "string" },
        status: { type: "string" },
        purpose: { type: "string" },
        content: { type: "string" },
        related_files: {
          type: "array",
          items: { type: "string" }
        }
      },
      required: ["handoff_id", "content"],
      additionalProperties: false
    }
  },
  {
    name: "search_context",
    description: "Search text across .ai/ and return line-level matches.",
    inputSchema: {
      type: "object",
      properties: {
        ...PROJECT_PROP,
        query: { type: "string" },
        max_results: { type: "integer", minimum: 1, maximum: 200 }
      },
      required: ["query"],
      additionalProperties: false
    }
  },
  {
    name: "list_projects",
    description: "List available project subdirectories under PROJECT_ROOT that contain a .ai/ directory.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  }
];

let buffer = Buffer.alloc(0);
let transportMode = "framed";

process.stdin.on("data", (chunk) => {
  const chunkBuffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, "utf8");
  if (debugChunkCount < 20) {
    debugChunkCount += 1;
    debugLog(`stdin chunk bytes=${chunkBuffer.length}`);
    if (debugChunkCount <= 3) {
      const preview = chunkBuffer
        .slice(0, 1200)
        .toString("utf8")
        .replace(/\r/g, "\\r")
        .replace(/\n/g, "\\n");
      debugLog(`stdin preview=${preview}`);
    }
  }
  buffer = Buffer.concat([buffer, chunkBuffer]);
  consume();
});
process.stdin.on("end", () => process.exit(0));
debugLog(`server_start pid=${process.pid} cwd=${process.cwd()} project_root=${PROJECT_ROOT}`);

function consume() {
  while (true) {
    let delimiter = Buffer.from("\r\n\r\n");
    let headerEnd = buffer.indexOf(delimiter);
    let delimiterLength = 4;
    if (headerEnd === -1) {
      delimiter = Buffer.from("\n\n");
      headerEnd = buffer.indexOf(delimiter);
      delimiterLength = 2;
    }
    if (headerEnd === -1) {
      const newlineIdx = buffer.indexOf(0x0a);
      if (newlineIdx !== -1) {
        const lineBuffer = buffer.slice(0, newlineIdx);
        buffer = buffer.slice(newlineIdx + 1);
        const line = lineBuffer.toString("utf8").trim();
        if (!line) {
          continue;
        }
        let lineMessage;
        try {
          lineMessage = JSON.parse(line);
        } catch (error) {
          debugLog(`line_json_parse_error=${String(error?.message || error)}`);
          continue;
        }
        transportMode = "line";
        debugLog(`received_line method=${lineMessage.method || ""} id=${String(lineMessage.id ?? "")}`);
        handleMessage(lineMessage).catch((error) => {
          debugLog(`handle_error=${String(error?.message || error)}`);
          if (lineMessage && Object.prototype.hasOwnProperty.call(lineMessage, "id")) {
            send({
              jsonrpc: "2.0",
              id: lineMessage.id,
              error: {
                code: -32000,
                message: String(error?.message || error)
              }
            });
          }
        });
        continue;
      }
      if (debugDelimiterMissCount < 5 && buffer.length > 0) {
        debugDelimiterMissCount += 1;
        const preview = buffer
          .slice(0, 220)
          .toString("utf8")
          .replace(/\r/g, "\\r")
          .replace(/\n/g, "\\n");
        debugLog(`no_header_delimiter buffer_bytes=${buffer.length} preview=${preview}`);
      }
      return;
    }

    const header = buffer.slice(0, headerEnd).toString("utf8");
    const lenMatch = header.match(/content-length:\s*(\d+)/i);
    if (!lenMatch) {
      buffer = Buffer.alloc(0);
      return;
    }

    const bodyStart = headerEnd + delimiterLength;
    const contentLength = Number(lenMatch[1]);
    if (buffer.length < bodyStart + contentLength) {
      return;
    }

    const body = buffer.slice(bodyStart, bodyStart + contentLength).toString("utf8");
    buffer = buffer.slice(bodyStart + contentLength);
    transportMode = "framed";

    let message;
    try {
      message = JSON.parse(body);
    } catch (error) {
      debugLog(`json_parse_error=${String(error?.message || error)}`);
      continue;
    }

    debugLog(`received method=${message.method || ""} id=${String(message.id ?? "")}`);
    handleMessage(message).catch((error) => {
      debugLog(`handle_error=${String(error?.message || error)}`);
      if (message && Object.prototype.hasOwnProperty.call(message, "id")) {
        send({
          jsonrpc: "2.0",
          id: message.id,
          error: {
            code: -32000,
            message: String(error?.message || error)
          }
        });
      }
    });
  }
}

function send(payload) {
  const json = JSON.stringify(payload);
  debugLog(`sending id=${String(payload.id ?? "")} hasError=${Boolean(payload.error)}`);
  if (transportMode === "line") {
    process.stdout.write(`${json}\n`);
    return;
  }
  const message = `Content-Length: ${Buffer.byteLength(json, "utf8")}\r\n\r\n${json}`;
  process.stdout.write(message);
}

async function handleMessage(msg) {
  if (!msg || msg.jsonrpc !== "2.0") {
    return;
  }

  const hasId = Object.prototype.hasOwnProperty.call(msg, "id");
  const method = msg.method;

  if (!method) {
    return;
  }

  if (method === "initialize") {
    if (hasId) {
      send({
        jsonrpc: "2.0",
        id: msg.id,
        result: {
          protocolVersion: msg?.params?.protocolVersion || "2024-11-05",
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: "project-memory-mcp",
            version: "0.1.0"
          }
        }
      });
    }
    return;
  }

  if (method === "notifications/initialized") {
    return;
  }

  if (method === "ping") {
    if (hasId) {
      send({ jsonrpc: "2.0", id: msg.id, result: {} });
    }
    return;
  }

  if (method === "tools/list") {
    if (hasId) {
      const tools = TOOL_PREFIX
        ? TOOL_DEFS.map((t) => ({ ...t, name: `${TOOL_PREFIX}${t.name}` }))
        : TOOL_DEFS;
      send({
        jsonrpc: "2.0",
        id: msg.id,
        result: {
          tools
        }
      });
    }
    return;
  }

  if (method === "tools/call") {
    let name = msg?.params?.name;
    if (TOOL_PREFIX && typeof name === "string" && name.startsWith(TOOL_PREFIX)) {
      name = name.slice(TOOL_PREFIX.length);
    }
    const args = msg?.params?.arguments || {};
    const result = await runTool(name, args);
    if (hasId) {
      send({
        jsonrpc: "2.0",
        id: msg.id,
        result: {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        }
      });
    }
    return;
  }

  if (hasId) {
    send({
      jsonrpc: "2.0",
      id: msg.id,
      error: { code: -32601, message: `Method not found: ${method}` }
    });
  }
}

function effectiveRoot(project) {
  if (!project) {
    return PROJECT_ROOT;
  }
  const name = path.basename(project); // strip any path traversal
  const resolved = path.resolve(PROJECT_ROOT, name);
  if (!resolved.startsWith(PROJECT_ROOT + path.sep) && resolved !== PROJECT_ROOT) {
    throw new Error(`Project name escapes root: ${project}`);
  }
  return resolved;
}

function resolveInsideProject(relativePath, project) {
  const root = effectiveRoot(project);
  const resolved = path.resolve(root, relativePath);
  if (!resolved.startsWith(root)) {
    throw new Error("Path escapes project root.");
  }
  return resolved;
}

async function readJson(relativePath, project) {
  const full = resolveInsideProject(relativePath, project);
  const raw = await fsp.readFile(full, "utf8");
  return JSON.parse(raw);
}

async function appendText(relativePath, text, project) {
  const full = resolveInsideProject(relativePath, project);
  await fsp.mkdir(path.dirname(full), { recursive: true });
  await fsp.appendFile(full, text, "utf8");
}

async function writeText(relativePath, text, project) {
  const full = resolveInsideProject(relativePath, project);
  await fsp.mkdir(path.dirname(full), { recursive: true });
  await fsp.writeFile(full, text, "utf8");
}

async function runTool(name, args) {
  const project = typeof args.project === "string" && args.project.trim() ? args.project.trim() : null;

  if (MEMORY_READ_ONLY && (name === "save_task_log" || name === "save_handoff")) {
    throw new Error("This project-memory MCP is read-only. Point the client to the canonical memory root to write.");
  }

  if (name === "list_projects") {
    const entries = await fsp.readdir(PROJECT_ROOT, { withFileTypes: true });
    const projects = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const aiDir = path.join(PROJECT_ROOT, entry.name, ".ai");
      if (fs.existsSync(aiDir)) {
        projects.push(entry.name);
      }
    }
    return { ok: true, canonical_root: PROJECT_ROOT, projects };
  }

  if (name === "get_project_state") {
    const state = await readJson(".ai/state/current-state.json", project);
    return { ok: true, project: project || path.basename(PROJECT_ROOT), state };
  }

  if (name === "get_active_task") {
    const task = await readJson(".ai/state/active-task.json", project);
    return { ok: true, project: project || path.basename(PROJECT_ROOT), task };
  }

  if (name === "get_recent_decisions") {
    const limit = Number.isInteger(args.limit) ? args.limit : 10;
    const fullPath = resolveInsideProject(".ai/memory/decisions.md", project);
    const raw = await fsp.readFile(fullPath, "utf8");
    const lines = raw
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("- "))
      .map((line) => line.slice(2));
    return { ok: true, decisions: lines.slice(-limit).reverse() };
  }

  if (name === "save_task_log") {
    const taskId = String(args.task_id || "").trim();
    const owner = String(args.owner_agent || "Codex").trim();
    const summary = String(args.summary || "").trim();
    const content = String(args.content || "").trim();
    if (!taskId) throw new Error("task_id is required.");
    if (!content) throw new Error("content is required.");

    const now = new Date().toISOString();
    const filename = taskId.endsWith(".md") ? taskId : `${taskId}.md`;
    const rel = `.ai/tasks/${filename}`;
    const full = resolveInsideProject(rel, project);
    const exists = fs.existsSync(full);

    if (!exists) {
      const initial = [
        "---",
        `title: ${taskId.replace(/\.md$/, "")}`,
        "purpose: Registro criado via MCP save_task_log",
        "status: active",
        `owner: ${owner}`,
        `last_updated: ${now.slice(0, 10)}`,
        "tags:",
        "  - task",
        "  - mcp",
        "---",
        "",
        `# ${taskId.replace(/\.md$/, "")}`,
        ""
      ].join("\n");
      await writeText(rel, initial, project);
    }

    const section = [
      "",
      `## MCP update ${now}`,
      summary ? `Summary: ${summary}` : "",
      content
    ]
      .filter(Boolean)
      .join("\n");

    await appendText(rel, section + "\n", project);
    return { ok: true, file: rel, created: !exists, updated_at: now };
  }

  if (name === "save_handoff") {
    const handoffId = String(args.handoff_id || "").trim();
    const owner = String(args.owner || "Codex").trim();
    const status = String(args.status || "active").trim();
    const purpose = String(args.purpose || "Handoff criado via MCP save_handoff").trim();
    const content = String(args.content || "").trim();
    const related = Array.isArray(args.related_files) ? args.related_files : [];
    if (!handoffId) throw new Error("handoff_id is required.");
    if (!content) throw new Error("content is required.");

    const now = new Date().toISOString();
    const filename = handoffId.endsWith(".md") ? handoffId : `${handoffId}.md`;
    const rel = `.ai/handoffs/${filename}`;
    const title = handoffId.replace(/\.md$/, "");

    const frontMatter = [
      "---",
      `title: ${title}`,
      `purpose: ${purpose}`,
      `status: ${status}`,
      `owner: ${owner}`,
      `last_updated: ${now.slice(0, 10)}`,
      "related_files:"
    ];
    if (related.length === 0) {
      frontMatter.push("  - .ai/state/current-state.json");
      frontMatter.push("  - .ai/state/active-task.json");
    } else {
      for (const item of related) {
        frontMatter.push(`  - ${item}`);
      }
    }
    frontMatter.push("tags:");
    frontMatter.push("  - handoff");
    frontMatter.push("  - mcp");
    frontMatter.push("---");
    frontMatter.push("");
    frontMatter.push(`# ${title}`);
    frontMatter.push("");
    frontMatter.push(content);
    frontMatter.push("");

    await writeText(rel, frontMatter.join("\n"), project);
    return { ok: true, file: rel, updated_at: now };
  }

  if (name === "search_context") {
    const query = String(args.query || "").trim();
    if (!query) throw new Error("query is required.");
    const maxResults = Number.isInteger(args.max_results) ? args.max_results : 20;
    const searchRoots = [
      ".ai/context", ".ai/state", ".ai/tasks",
      ".ai/handoffs", ".ai/memory", ".ai/logs"
    ];
    const root = effectiveRoot(project);
    const matches = [];
    for (const relRoot of searchRoots) {
      const dir = resolveInsideProject(relRoot, project);
      if (!fs.existsSync(dir)) continue;
      const files = await listFiles(dir);
      for (const fullFile of files) {
        if (matches.length >= maxResults) break;
        const content = await fsp.readFile(fullFile, "utf8");
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i += 1) {
          if (lines[i].toLowerCase().includes(query.toLowerCase())) {
            matches.push({
              file: path.relative(root, fullFile),
              line: i + 1,
              preview: lines[i].trim()
            });
            if (matches.length >= maxResults) break;
          }
        }
      }
    }
    return { ok: true, query, matches };
  }

  throw new Error(`Unknown tool: ${name}`);
}

async function listFiles(rootDir) {
  const out = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const dir = stack.pop();
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile()) {
        out.push(full);
      }
    }
  }
  return out;
}
