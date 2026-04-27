# Obsidian Sync Automation

Este documento define o fluxo de espelhamento do Obsidian (Fase 3).

## Runner

- `.ai/context/obsidian-sync-runner.mjs`

## Objetivo

Sincronizar o `obsidian-vault` com a memoria operacional em `.ai/`, mantendo leitura humana simples sem substituir a fonte de verdade.

## O que o runner sincroniza

- `obsidian-vault/02-tasks/TASK-*.md`
- `obsidian-vault/04-handoffs/HANDOFF-*.md`
- `obsidian-vault/01-context/project-overview.md`
- `obsidian-vault/01-context/architecture.md`
- `obsidian-vault/03-decisions/decisions.md`
- `obsidian-vault/05-reference/state-snapshot.md`

## Uso

```bash
node .ai/context/obsidian-sync-runner.mjs
```

Dry-run:

```bash
node .ai/context/obsidian-sync-runner.mjs --dry-run
```

## Regra operacional

- Executar o sync antes de concluir a Fase 3.
- Ao abrir nova fase (via manifesto), executar sync novamente para refletir `TASK/HANDOFF` novos.
- Em caso de divergencia, corrigir primeiro `.ai/` e depois rerodar o sync.
