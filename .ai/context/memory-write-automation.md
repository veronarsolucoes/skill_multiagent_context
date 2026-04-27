# Memory Write Automation

Este documento define o fluxo da Fase 2 para escrita automatizada de memoria operacional.

## Arquivos

- runner: `.ai/context/memory-write-runner.mjs`
- manifestos: `.ai/context/manifests/*.json`

## Objetivo

Aplicar atualizacoes de fase de forma repetivel e rastreavel, sem editar manualmente varios arquivos.

## O que o runner atualiza

- `.ai/state/current-state.json`
- `.ai/state/active-task.json`
- `.ai/state/roadmap.json`
- arquivos `TASK-*` e `HANDOFF-*`
- `.ai/logs/*.md`
- `.ai/memory/*.md`

## Uso

```bash
node .ai/context/memory-write-runner.mjs \
  --manifest .ai/context/manifests/<manifesto>.json
```

Dry-run:

```bash
node .ai/context/memory-write-runner.mjs \
  --manifest .ai/context/manifests/<manifesto>.json \
  --dry-run
```

Manifestos atuais:
- `phase-2-complete.json`
- `phase-3-complete.json`
- `phase-4-complete.json`
- `phase-5-applied.json`
- `phase-5-complete.json`

## Convenções

- manifesto deve declarar claramente:
  - atualizacao de estado
  - transicao de task/handoff
  - atualizacao de roadmap
  - append de logs/memoria
- `.ai/state/*` permanece como fonte de verdade.
- Obsidian continua como espelho legivel e deve ser sincronizado em fase propria.
