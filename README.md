# Multi-Agent Context Starter

Este pacote contém:
- prompts prontos para Claude Code, Codex e Antigravity
- estrutura `.ai/` para memória compartilhada
- espelho inicial para Obsidian

## Arquivos principais
- `SYSTEM-CLAUDE.md`
- `SKILL.md`
- `MISSION-ANTIGRAVITY.md`
- `.ai/state/current-state.json`
- `.ai/state/active-task.json`
- `.ai/state/workflow-hardening-report.json`
- `.ai/state/agent-adoption-report.json`
- `.ai/handoffs/HANDOFF-008.md`
- `.mcp.json`
- `.ai/context/memory-write-runner.mjs`
- `.ai/context/obsidian-sync-runner.mjs`
- `.ai/context/workflow-hardening-runner.mjs`
- `.ai/context/agent-adoption-runner.mjs`
- `.ai/context/project-memory-cli.mjs`
- `memory`

## Ordem de leitura recomendada para qualquer agente
1. `.ai/state/current-state.json`
2. `.ai/state/active-task.json`
3. `.ai/handoffs/HANDOFF-008.md`
4. `.ai/context/architecture.md`
5. `.ai/context/project-overview.md`

## Modo rápido de usar

### 0. Atalho simples para memória MCP

Use o comando `./memory` para não precisar montar chamadas longas de MCP manualmente.

```bash
cd /root/prompt/multi_agent_context

# listar projetos com .ai/ em /root/prompt
./memory list

# carregar um resumo da memória de outro projeto
./memory load assistente_secretari_ribeiro

# apontar o MCP fixo project-memory para esse projeto
./memory use assistente_secretari_ribeiro
```

Depois de `./memory use`, reinicie o Codex. A chamada no chat fica sempre a mesma:

```text
mcp__project_memory__.get_project_state
```

Para manter vários projetos registrados ao mesmo tempo, use `add`:

```bash
./memory add assistente_secretari_ribeiro --name assistente_secretari_ribeiro
```

Depois de reiniciar o Codex, o namespace será:

```text
mcp__assistente_secretari_ribeiro__.get_project_state
```

Outros comandos úteis:

```bash
./memory state assistente_secretari_ribeiro
./memory task assistente_secretari_ribeiro
./memory decisions assistente_secretari_ribeiro 5
./memory search assistente_secretari_ribeiro quick_reply 10
```

### 1. Setup (uma vez por máquina/container)

Um script único registra o MCP `project-memory` em Claude Code, Codex e OpenClaw/Antigravity:

```bash
cd /root/prompt/multi_agent_context
./install.sh            # instala e conecta
./install.sh --check    # só verifica se está conectado
```

O script detecta quais CLIs estão disponíveis (`claude`, `codex`, `docker`+container `openclaw-gateway`) e pula os ausentes. Ele é idempotente — pode rodar de novo sem duplicar registro.

### 2. Continuar em qualquer agente

Entre na pasta e confira o MCP (uma linha por agente):

```bash
cd /root/prompt/multi_agent_context
claude mcp list | grep project-memory
codex mcp list  | grep project-memory
docker exec openclaw-gateway cat /home/node/.openclaw/openclaw.json | grep project-memory
```

Prompt rápido para colar em Claude Code, Codex ou Antigravity:

```text
Estou continuando este projeto.
Leia a memoria em /root/prompt/multi_agent_context usando .ai/ como fonte de verdade.
Comece por .ai/state/current-state.json, .ai/state/active-task.json, .ai/handoffs/HANDOFF-008.md, README.md e .ai/context/architecture.md.
Depois me diga o estado atual, a ultima tarefa, o proximo passo recomendado e se existe alguma pendencia.
```

Guia detalhado: `.ai/context/cross-agent-memory-handoff.md`

### 3. Slash commands (Claude Code)

Dois comandos prontos em `.claude/commands/`:

- **`/init-project <nome>`** — copia o template para `/root/<nome>`, limpa state antigo, roda `./install.sh`, pergunta o objetivo e cria `TASK-001` + `HANDOFF-001` inicial.
- **`/load-project <caminho>`** — carrega um projeto existente a partir do caminho absoluto, valida MCP (`./install.sh --check`) e reporta estado + próximo passo.
- **`/load-memory`** — lê state + último handoff + última task do diretório atual e reporta em até 10 linhas.

Dentro do Claude Code: `/init-project meu_app`, `/load-project /root/meu_app` ou `/load-memory`.

## Status desta sessão
- Arquivo compactado extraído em: `/root/prompt/multi_agent_context`
- Sessão registrada por: Codex
- Data: 2026-04-29
- Projeto: em manutencao operacional
- Tarefa final de referência: `.ai/tasks/TASK-008.md` (concluída)
- Handoff final: `.ai/handoffs/HANDOFF-008.md` (concluído)
- Task operacional ativa: `.ai/tasks/TASK-009.md`
- Handoff operacional ativo: `.ai/handoffs/HANDOFF-009.md`
- MCP registrado no Codex: `project-memory`
- MCP conectado no Claude Code: `project-memory`
- MCP configurado no OpenClaw/Antigravity runtime: `project-memory`
- Automação de memory write: aplicada com runner + manifesto
- Sync do Obsidian: aplicado com runner dedicado
- Hardening do fluxo: aplicado com runner + relatorio de integridade
- Adoção de agentes: aplicada com runner + relatorio cross-agent
- Atalho de memória MCP: `./memory` criado para `load`, `use`, `add`, `state`, `task`, `decisions` e `search`

## Plano de execução por fases

### Fase 0 — Extração, leitura e planejamento
Status: concluída nesta sessão.

Objetivo:
- extrair o pacote
- ler prompts e arquivos âncora
- documentar plano por fases
- registrar memória local e memória particular do Codex

Arquivos principais:
- `README.md`
- `.ai/state/current-state.json`
- `.ai/state/active-task.json`
- `.ai/tasks/TASK-002.md`
- `.ai/handoffs/HANDOFF-002.md`

### Fase 1 — Conexão e validação do MCP
Status: concluída.

Objetivo:
- configurar o MCP esperado para Codex, Claude Code e Antigravity
- validar leitura de estado, tarefa ativa, decisões e bloqueios
- registrar divergências entre MCP, `.ai/` e Obsidian

Critério de conclusão:
- Codex: concluído.
- Claude Code: concluído.
- OpenClaw/Antigravity runtime: concluído.

Configuração aplicada:
```bash
# Codex
codex mcp add project-memory \
  --env PROJECT_ROOT=/root/prompt/multi_agent_context \
  -- node /root/prompt/multi_agent_context/.ai/context/mcp-project-memory-server.mjs

# Claude (project scope)
claude mcp add -s project project-memory /usr/bin/node /root/prompt/multi_agent_context/.ai/context/mcp-project-memory-server.mjs

# OpenClaw (dentro do container openclaw-gateway)
openclaw mcp set project-memory '{"command":"node","args":["/home/node/.openclaw/workspace/multi_agent_context/.ai/context/mcp-project-memory-server.mjs"],"env":{"PROJECT_ROOT":"/home/node/.openclaw/workspace/multi_agent_context"}}'
```

### Fase 2 — Automação de escrita de memória
Status: concluída.

Objetivo:
- criar rotina padronizada para atualizar `current-state`, `active-task`, `TASK-*`, `HANDOFF-*`, logs e timeline
- reduzir gravações manuais inconsistentes

Critério de conclusão:
- rotina executável criada para atualizar estado, task, handoff, logs e memória.
- transição real de fase executada automaticamente (`TASK-004` -> `TASK-005`).

Automação aplicada:
```bash
node .ai/context/memory-write-runner.mjs \
  --manifest .ai/context/manifests/phase-2-complete.json
```

### Fase 3 — Espelhamento no Obsidian
Status: concluída.

Objetivo:
- sincronizar os registros operacionais principais com `obsidian-vault/`
- manter o vault como leitura humana resumida, sem substituir `.ai/`

Critério de conclusão:
- espelhos sincronizados para tasks, handoffs, contexto e decisões.
- snapshot de estado gerado em `obsidian-vault/05-reference/state-snapshot.md`.

Automação aplicada:
```bash
node .ai/context/obsidian-sync-runner.mjs
```

### Fase 4 — Endurecimento do fluxo
Status: concluida.

Objetivo:
- validar nomes, índices, handoffs e consistência dos estados
- definir política de erro quando MCP, `.ai/` e Obsidian divergirem

Critério de conclusão:
- qualquer agente novo sabe quais arquivos ler, como registrar e como continuar.

Automacao aplicada:
```bash
node .ai/context/workflow-hardening-runner.mjs
```

### Fase 5 — Adoção pelos agentes
Status: concluída.

Objetivo:
- aplicar os prompts em Claude Code, Codex e Antigravity
- testar continuidade entre agentes com uma tarefa real pequena

Critério de conclusão:
- um agente inicia pelo handoff mais recente, executa uma alteração incremental e entrega novo handoff.
- validacao cross-agent concluída com MCP `project-memory` visível em Codex, Claude e OpenClaw.

Automacao aplicada:
```bash
node .ai/context/agent-adoption-runner.mjs
```
