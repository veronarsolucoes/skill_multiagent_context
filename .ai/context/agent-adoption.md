# Agent Adoption

Este documento define como executar e comprovar a adocao da fase 5.

## Runner

- `.ai/context/agent-adoption-runner.mjs`

## Objetivo

Validar que os tres ambientes principais conseguem enxergar o MCP `project-memory`:
- Codex
- Claude Code (escopo do projeto)
- OpenClaw/Antigravity runtime

## Uso

Dry-run:

```bash
node .ai/context/agent-adoption-runner.mjs --dry-run
```

Execucao com relatorio:

```bash
node .ai/context/agent-adoption-runner.mjs
```

Relatorio padrao:
- `.ai/state/agent-adoption-report.json`

## Criterios de sucesso

- `current_phase` em `agent_adoption`
- tarefa ativa alinhada (`TASK-007`)
- handoff ativo presente em `current-state.key_files`
- `codex mcp list` contendo `project-memory`
- `claude mcp list` no projeto com `project-memory` conectado
- `openclaw mcp list` no container com `project-memory`

## Regra operacional

- executar este runner no inicio e no fechamento da fase 5
- anexar resumo dos resultados em `TASK-007` e `HANDOFF-007`
- manter o relatorio atualizado em `.ai/state/agent-adoption-report.json`
