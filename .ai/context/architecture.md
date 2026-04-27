---
title: Architecture
purpose: Arquitetura técnica e fluxo operacional entre agentes, MCP e Obsidian.
status: active
owner: shared
last_updated: 2026-04-17
related_files:
  - .ai/context/project-overview.md
  - .ai/state/current-state.json
  - .ai/indexes/api-index.md
tags:
  - architecture
  - mcp
  - obsidian
---

# Architecture

## Componentes
- MCP Server: camada central de contexto
- MCP local (`project-memory`): servidor stdio para leitura/escrita em `.ai/`
- `.ai/`: estrutura principal de memória operacional
- `obsidian-vault/`: espelho legível e navegável do contexto
- Claude Code / Codex / Antigravity: agentes consumidores e produtores de contexto

## Fluxo
1. Agente carrega contexto do MCP
2. Agente lê current-state.json e active-task.json
3. Agente lê o handoff mais recente
4. Agente executa tarefa incremental
5. Agente atualiza memória, logs e handoff

## Fonte de verdade
1. `.ai/state/current-state.json`
2. `.ai/state/active-task.json`
3. handoff mais recente
4. logs e arquivos de contexto

## Implementacao atual da Fase 1
- servidor MCP implementado em `.ai/context/mcp-project-memory-server.mjs`
- servidor registrado no Codex como `project-memory`
- servidor registrado no Claude Code via `.mcp.json`
- servidor configurado no OpenClaw/Antigravity runtime via `openclaw mcp set`
- ferramentas disponíveis:
  - `get_project_state`
  - `get_active_task`
  - `get_recent_decisions`
  - `save_task_log`
  - `save_handoff`
  - `search_context`
- compatibilidade de transporte:
  - framed (`Content-Length`)
  - json por linha (`\\n`)

## Implementacao atual da Fase 2
- runner de escrita de memoria em `.ai/context/memory-write-runner.mjs`
- transicao de fase orientada por manifesto:
  - `.ai/context/manifests/phase-2-complete.json`
- artefatos atualizados automaticamente:
  - `current-state.json`
  - `active-task.json`
  - `roadmap.json`
  - `TASK-*`
  - `HANDOFF-*`
  - logs e memoria

## Implementacao atual da Fase 3
- runner de sync do Obsidian em `.ai/context/obsidian-sync-runner.mjs`
- sincronizacao aplicada para:
  - `obsidian-vault/02-tasks/`
  - `obsidian-vault/04-handoffs/`
  - `obsidian-vault/01-context/`
  - `obsidian-vault/03-decisions/`
  - `obsidian-vault/05-reference/state-snapshot.md`
- transicao de fase orientada por manifesto:
  - `.ai/context/manifests/phase-3-complete.json`

## Implementacao atual da Fase 4
- runner de validacao em `.ai/context/workflow-hardening-runner.mjs`
- politica operacional documentada em `.ai/context/workflow-hardening.md`
- validacoes cobertas:
  - arquivos obrigatorios e parse JSON
  - consistencia entre `current-state`, `active-task` e `roadmap`
  - alinhamento de `TASK-*`/`HANDOFF-*` ativos
  - referencias nos indices
  - espelhos ativos no Obsidian
- relatorio persistido em:
  - `.ai/state/workflow-hardening-report.json`

## Implementacao atual da Fase 5
- runner de adocao em `.ai/context/agent-adoption-runner.mjs`
- guia operacional em `.ai/context/agent-adoption.md`
- encerramento formal aplicado por manifesto:
  - `.ai/context/manifests/phase-5-complete.json`
- validacoes cobertas:
  - `codex mcp list` com `project-memory`
  - `claude mcp list` no escopo do projeto com `project-memory` conectado
  - `openclaw mcp list` no container de runtime com `project-memory`
  - alinhamento de `current-state`, `active-task` e handoff ativo
- relatorio persistido em:
  - `.ai/state/agent-adoption-report.json`
