---
title: GitHub + OpenClaw Memory Architecture
purpose: Proposta para push automatico da memoria e eliminacao de divergencia entre raiz canonica e sandbox OpenClaw.
status: proposed
owner: Codex
last_updated: 2026-04-29
related_files:
  - .ai/tasks/TASK-009.md
  - .ai/handoffs/HANDOFF-009.md
  - .ai/context/github-memory-push-runner.mjs
  - .ai/context/mcp-project-memory-server.mjs
  - .ai/context/integration-map.md
tags:
  - github
  - openclaw
  - mcp
  - sync
  - architecture
---

# GitHub + OpenClaw Memory Architecture

## Diagnostico

O problema central nao e o push para GitHub em si. O gargalo e a existencia de duas memorias gravaveis:

- raiz canonica no host, por exemplo `/root/prompt/<projeto>`
- copia no sandbox/runtime OpenClaw, por exemplo `/home/node/.openclaw/workspace/<projeto>`

Quando as duas gravam `.ai/`, surgem divergencias de `current-state`, `active-task`, handoffs, tasks e logs. O GitHub so deve receber uma fonte de verdade; caso contrario ele apenas preserva a divergencia.

## Decisao proposta

Adotar uma unica memoria canonica e tratar o GitHub como snapshot/backup versionado.

Fluxo principal:

1. A memoria canonica fica no host em `/root/prompt/<projeto>`.
2. OpenClaw acessa essa memoria via MCP apontado para a raiz canonica montada no container.
3. A copia dentro do sandbox deixa de ser fonte de verdade. Ela pode ser removida, ignorada ou marcada como espelho somente leitura.
4. O push automatico roda no host, valida `.ai/`, commita apenas artefatos rastreados e executa `git push`.

## Arquitetura logica

```text
Codex / Claude
  -> MCP project-memory
  -> /root/prompt/<projeto>/.ai
        |
        | git commit + git push agendado
        v
      GitHub

OpenClaw
  -> MCP project-memory dentro do runtime
  -> /mnt/project-memory/<projeto>/.ai
        |
        | bind mount do host
        v
     /root/prompt/<projeto>/.ai
```

## Ponto critico do sandbox

Se o processo MCP roda dentro do container OpenClaw, ele nao consegue acessar `/root` do host sem uma das duas opcoes:

- bind mount do host para dentro do container
- gateway MCP executado no host e exposto ao OpenClaw por transporte suportado

A opcao mais simples e robusta e o bind mount. Exemplo conceitual:

```bash
# o caminho exato depende de como o openclaw-gateway e iniciado
docker run \
  -v /root/prompt:/mnt/project-memory \
  ...
```

Depois, o MCP do OpenClaw deve apontar para a raiz montada, nao para a copia do workspace:

```bash
openclaw mcp set project-memory '{
  "command":"node",
  "args":["/mnt/project-memory/multi_agent_context/.ai/context/mcp-project-memory-server.mjs"],
  "env":{
    "PROJECT_ROOT":"/mnt/project-memory/multi_agent_context"
  }
}'
```

Se for necessario manter uma copia no sandbox, configure o MCP dessa copia com:

```json
{
  "env": {
    "PROJECT_ROOT": "/home/node/.openclaw/workspace/multi_agent_context",
    "MEMORY_READ_ONLY": "1"
  }
}
```

Assim, leituras continuam funcionando, mas escritas de task/handoff sao bloqueadas.

## Runner de push automatico

Runner inicial criado:

```bash
node .ai/context/github-memory-push-runner.mjs --dry-run
node .ai/context/github-memory-push-runner.mjs --push
```

Com projeto explicito:

```bash
node /root/prompt/multi_agent_context/.ai/context/github-memory-push-runner.mjs \
  --project-root /root/prompt/assistente_secretari_ribeiro \
  --remote origin \
  --branch main \
  --dry-run
```

Modo real:

```bash
node /root/prompt/multi_agent_context/.ai/context/github-memory-push-runner.mjs \
  --project-root /root/prompt/assistente_secretari_ribeiro \
  --remote origin \
  --branch main \
  --push
```

O runner:

- valida JSONs principais de `.ai/state`
- executa `workflow-hardening-runner` quando existir
- inclui `.ai/`, `obsidian-vault/`, `README.md` e `memory` por padrao
- usa dry-run por padrao
- nao executa `pull`, `reset` ou `rebase`
- falha se o `git push` encontrar divergencia remota
- usa lock em `/tmp` para evitar duas execucoes simultaneas no mesmo projeto

## Agendamento recomendado

Usar cron no host para cada projeto canonico:

```cron
*/15 * * * * cd /root/prompt/multi_agent_context && node .ai/context/github-memory-push-runner.mjs --project-root /root/prompt/assistente_secretari_ribeiro --push >> /root/prompt/assistente_secretari_ribeiro/.ai/logs/github-push.log 2>&1
```

Para projetos sensiveis, prefira intervalo maior ou push por evento ao final de task.

## Regras de consistencia

1. Apenas a raiz canonica pode ser gravavel.
2. GitHub recebe snapshot da raiz canonica, nunca da copia sandbox.
3. OpenClaw deve escrever por MCP na raiz canonica montada.
4. A copia sandbox, se existir, e leitura ou cache descartavel.
5. Em caso de divergencia GitHub, o runner para e exige resolucao manual.

## Proximo passo tecnico

1. Descobrir como `openclaw-gateway` e criado.
2. Adicionar bind mount `/root/prompt:/mnt/project-memory`.
3. Reconfigurar `project-memory` no OpenClaw para apontar para `/mnt/project-memory/<projeto>`.
4. Rodar `github-memory-push-runner.mjs --dry-run` em cada projeto.
5. Configurar cron/systemd timer para os projetos aprovados.
