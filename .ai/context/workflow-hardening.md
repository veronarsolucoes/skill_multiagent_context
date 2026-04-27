# Workflow Hardening

Este documento define as validacoes e a politica operacional da Fase 4.

## Runner

- `.ai/context/workflow-hardening-runner.mjs`

## Objetivo

Validar consistencia minima entre:
- `.ai/state/current-state.json`
- `.ai/state/active-task.json`
- `.ai/state/roadmap.json`
- `TASK-*` e `HANDOFF-*` ativos
- indices (`.ai/indexes/`)
- espelhos do `obsidian-vault/`

## Uso

Dry-run:

```bash
node .ai/context/workflow-hardening-runner.mjs --dry-run
```

Execucao com relatorio persistido:

```bash
node .ai/context/workflow-hardening-runner.mjs
```

Relatorio padrao:
- `.ai/state/workflow-hardening-report.json`

## Checklist de aprovacao da fase

- zero falhas (`failed: 0`) no relatorio
- `current-state`, `active-task` e `roadmap` parseando em JSON valido
- `active_task_id` consistente com `active-task.task_id`
- fase `in_progress` do roadmap igual a `current_phase`
- tarefa e handoff ativos presentes em `.ai/` e no Obsidian
- indices atualizados com runners e artefatos recentes

## Politica de divergencia

1. fonte de verdade: `.ai/`
2. se houver `fail`, interromper fechamento da fase
3. corrigir primeiro `.ai/state` e `TASK/HANDOFF` envolvidos
4. rerodar `obsidian-sync-runner` para atualizar o espelho
5. rerodar `workflow-hardening-runner` ate `failed: 0`
6. somente depois executar manifesto de fechamento da fase

## Regra operacional

- executar hardening antes de concluir qualquer fase
- manter o relatorio mais recente em `.ai/state/workflow-hardening-report.json`
- registrar em handoff quando houver warn/fail relevante e como foi resolvido
