---
title: TASK-008
purpose: Atalho de uso para memoria MCP.
status: completed
owner: Codex
last_updated: 2026-04-17
related_files:
  - README.md
  - memory
  - .ai/context/project-memory-cli.mjs
  - .ai/state/current-state.json
  - .ai/state/active-task.json
  - .ai/state/roadmap.json
  - .ai/handoffs/HANDOFF-008.md
tags:
  - task
  - mcp
  - usability
  - codex
---

# TASK-008 - Atalho de uso para memoria MCP

## Contexto

O uso direto de nomes MCP no Codex ficou verboso para alternar entre projetos. O caso concreto foi acessar a memoria de `/root/prompt/assistente_secretari_ribeiro` sem precisar decorar o comando completo `codex mcp add` nem o namespace resultante.

## Objetivo tecnico

Criar um wrapper simples para:

- listar projetos com `.ai/`
- carregar resumo de memoria local
- ler state/task/decisoes sem reiniciar agente
- buscar texto em `.ai/`
- registrar MCP no Codex com fluxo simples

## Implementacao

- criado `memory` na raiz do starter
- criado `.ai/context/project-memory-cli.mjs`
- documentado no `README.md` o fluxo `./memory load`, `./memory use` e `./memory add`
- `./memory use <projeto>` usa o nome fixo `project-memory`, reduzindo a chamada no chat para `mcp__project_memory__.get_project_state` apos reiniciar Codex
- `./memory add <projeto> --name <nome>` mantém a opcao de registrar multiplos projetos em paralelo
- `roadmap.json` recebeu a fase concluida `post_completion_usability` para manter a validacao de hardening consistente

## Validacao

- `node --check .ai/context/project-memory-cli.mjs`
- `./memory help`
- `./memory list`
- `./memory load assistente_secretari_ribeiro`
- `./memory search assistente_secretari_ribeiro quick_reply 5`
- `./memory decisions assistente_secretari_ribeiro 3`
- `./memory use assistente_secretari_ribeiro --dry-run`
- `./memory add assistente_secretari_ribeiro --name assistente_secretari_ribeiro --dry-run`

## Resultado

Tarefa concluida. O usuario pode carregar memoria de outro projeto com comandos curtos e manter o namespace MCP estavel no Codex usando `./memory use`.

## Proximo passo recomendado

Usar:

```bash
cd /root/prompt/multi_agent_context
./memory load assistente_secretari_ribeiro
./memory use assistente_secretari_ribeiro
```

Depois reiniciar o Codex e chamar:

```text
mcp__project_memory__.get_project_state
```
