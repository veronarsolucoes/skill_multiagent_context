---
title: TASK-009
purpose: Push geral dos projetos e correção de sincronia com OpenClaw.
status: active
owner: Codex
last_updated: 2026-04-29
related_files:
  - .ai/state/current-state.json
  - .ai/state/active-task.json
  - .ai/state/roadmap.json
  - .ai/handoffs/HANDOFF-009.md
  - .ai/context/github-openclaw-memory-architecture.md
  - .ai/context/github-memory-push-runner.mjs
  - .ai/context/project-memory-cli.mjs
  - .ai/context/mcp-project-memory-server.mjs
  - memory
tags:
  - task
  - push
  - sync
  - openclaw
  - maintenance
---

# TASK-009 - Push geral dos projetos e correção de sincronia com OpenClaw

## Contexto

Existe uma demanda operacional nova para consolidar o estado dos projetos, organizar um push geral e investigar um bug de sincronia com o runtime OpenClaw.

## Objetivo tecnico

1. Identificar quais projetos precisam de push ou alinhamento de estado.
2. Reproduzir e isolar o bug de sincronia com OpenClaw.
3. Definir a ordem correta de execução para evitar divergencia entre memoria local, MCP e runtime.
4. Registrar um procedimento repetivel para o agendamento/push geral.
5. Projetar o push automatico para GitHub usando uma unica raiz canonica de memoria.

## Escopo inicial

- inventariar projetos sob `/root/prompt`
- verificar o estado de memoria de cada projeto relevante
- localizar a origem da divergencia com OpenClaw
- preparar o fluxo de push/agendamento sem quebrar a continuidade atual

## Proximo passo recomendado

Levantar o inventario dos projetos afetados e coletar evidencias da falha de sincronia com OpenClaw antes de qualquer push.

## Sugestao analisada

O usuario propos salvar a segunda memoria no GitHub com push automatico e resolver a divergencia entre a memoria em `/root` e a copia dentro do sandbox OpenClaw. A sugestao de usar MCP para OpenClaw acessar fora do sandbox e valida, mas depende de uma restricao tecnica: se o MCP roda dentro do container, ele so acessa o host se houver bind mount ou um gateway executado fora do container.

## Arquitetura proposta

- fonte de verdade unica: `/root/prompt/<projeto>`
- OpenClaw acessa a fonte canonica via MCP apontado para um caminho montado no container, por exemplo `/mnt/project-memory/<projeto>`
- a copia em `/home/node/.openclaw/workspace/<projeto>` deixa de ser fonte de escrita e pode ficar somente leitura
- GitHub recebe snapshot versionado por runner agendado no host
- divergencia remota no GitHub nao deve ser resolvida automaticamente por `pull`, `reset` ou `rebase`; o runner deve parar e exigir resolucao manual

Artefatos registrados:

- `.ai/context/github-openclaw-memory-architecture.md`
- `.ai/context/github-memory-push-runner.mjs`
- ajuste em `.ai/context/mcp-project-memory-server.mjs` para suportar `MEMORY_READ_ONLY=1`

## Esboco de execucao

```bash
# dry-run do push
node .ai/context/github-memory-push-runner.mjs --project-root /root/prompt/<projeto> --dry-run

# execucao real apos validar remote/branch
node .ai/context/github-memory-push-runner.mjs --project-root /root/prompt/<projeto> --remote origin --branch main --push
```

## Validacao inicial

- `node --check .ai/context/github-memory-push-runner.mjs`
- `node --check .ai/context/mcp-project-memory-server.mjs`
- JSON validado para `.ai/state/current-state.json` e `.ai/state/active-task.json`
- `obsidian-sync-runner` executado para gerar espelhos de `TASK-009` e `HANDOFF-009`
- `workflow-hardening-runner --dry-run` aprovado com 41/41 checks
- `github-memory-push-runner --dry-run` aprovado com hardening padrao e sem commit/push

## Handoff

- proximo agente sugerido: Codex
- arquivos prioritarios:
  - `.ai/state/current-state.json`
  - `.ai/state/active-task.json`
  - `.ai/state/roadmap.json`
  - `.ai/handoffs/HANDOFF-009.md`
  - `README.md`

## Encerramento da tarefa

- resultado: em andamento
## MCP update 2026-04-30T03:09:01.239Z
Summary: Runner ajustado para ignorar log operacional no snapshot GitHub
## Atualização 2026-04-30 03:09 UTC

- Ajustado `.ai/context/github-memory-push-runner.mjs` para excluir `.ai/logs/github-push.log` por padrão usando pathspec `:(exclude)`.
- Adicionado suporte a `--exclude <path>` no runner.
- Validação executada: `node --check` passou e dry-run passou listando apenas o runner como mudança incluída.
- Push real ainda pendente de confirmação explícita do usuário.
## MCP update 2026-04-30T03:13:20.264Z
Summary: Push real bloqueado por autenticação GitHub ausente
## Atualização 2026-04-30 03:13 UTC

- Usuário autorizou push real.
- Tentativa de push do submodule `multi_agent_context` para `https://github.com/veronarsolucoes/skill_multiagent_context.git` falhou antes de qualquer escrita remota.
- Erro: `fatal: could not read Username for 'https://github.com': No such device or address`.
- Diagnóstico: sem `credential.helper`, sem `gh`, sem `GH_TOKEN/GITHUB_TOKEN` e sem chave SSH pública em `/home/node/.ssh` para autenticar no GitHub.
- Estado local preservado: commit `4436fad chore: exclude github push operational log` existe localmente; repo raiz ainda precisa atualizar ponteiro do submodule após push remoto.
