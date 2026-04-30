# API Index

## MCP esperado
- get_project_state
- get_active_task
- get_recent_decisions
- save_task_log
- save_handoff
- search_context

## MCP implementado no Codex
- server: `project-memory`
- arquivo: `.ai/context/mcp-project-memory-server.mjs`
- status: `enabled`
- transportes: `Content-Length` e json por linha

## Automacao de escrita de memoria
- runner: `.ai/context/memory-write-runner.mjs`
- manifestos: `.ai/context/manifests/*.json`
- uso padrao:
  - `node .ai/context/memory-write-runner.mjs --manifest <manifesto>`

## Automacao de sync Obsidian
- runner: `.ai/context/obsidian-sync-runner.mjs`
- uso padrao:
  - `node .ai/context/obsidian-sync-runner.mjs`

## Automacao de hardening
- runner: `.ai/context/workflow-hardening-runner.mjs`
- relatorio padrao: `.ai/state/workflow-hardening-report.json`
- uso padrao:
  - `node .ai/context/workflow-hardening-runner.mjs --dry-run`
  - `node .ai/context/workflow-hardening-runner.mjs`

## Automacao de adocao de agentes
- runner: `.ai/context/agent-adoption-runner.mjs`
- relatorio padrao: `.ai/state/agent-adoption-report.json`
- uso padrao:
  - `node .ai/context/agent-adoption-runner.mjs --dry-run`
  - `node .ai/context/agent-adoption-runner.mjs`

## Atalho de memoria MCP por projeto
- wrapper: `./memory`
- CLI: `.ai/context/project-memory-cli.mjs`
- comandos principais:
  - `./memory load <projeto>`
  - `./memory use <projeto>`
  - `./memory add <projeto> --name <nome>`
  - `./memory search <projeto> <consulta>`

## Push automatico de memoria para GitHub
- runner: `.ai/context/github-memory-push-runner.mjs`
- dry-run:
  - `node .ai/context/github-memory-push-runner.mjs --project-root <projeto> --dry-run`
- push real:
  - `node .ai/context/github-memory-push-runner.mjs --project-root <projeto> --remote origin --branch main --push`
- politica:
  - dry-run por padrao
  - nao executa pull/reset/rebase
  - falha em divergencia remota para evitar perda de memoria
