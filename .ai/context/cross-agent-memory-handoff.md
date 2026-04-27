# Cross-Agent Memory Handoff

Este guia mostra como continuar em um agente o trabalho iniciado em outro.

## Setup rápido (uma vez)

Registra o MCP `project-memory` em Claude Code, Codex e OpenClaw/Antigravity de uma só vez:

```bash
cd /root/prompt/multi_agent_context
./install.sh
./install.sh --check    # verificação
```

Idempotente — pode rodar de novo sem duplicar registro.

## Caso comum: sair do Claude e continuar no Codex

Entre na pasta do projeto:

```bash
cd /root/prompt/multi_agent_context
```

Confirme que o MCP esta registrado no Codex:

```bash
codex mcp list | grep project-memory
```

Leia os arquivos ancora:

```bash
sed -n '1,220p' .ai/state/current-state.json
sed -n '1,220p' .ai/state/active-task.json
sed -n '1,260p' .ai/handoffs/HANDOFF-007.md
sed -n '1,260p' README.md
```

## Prompt pronto para colar no Codex

```text
Estou continuando este projeto vindo do Claude.

Leia a memoria em /root/prompt/multi_agent_context usando .ai/ como fonte de verdade.

Comece por:
1. .ai/state/current-state.json
2. .ai/state/active-task.json
3. .ai/handoffs/HANDOFF-007.md
4. README.md
5. .ai/context/architecture.md

Depois me diga:
- em que estado o projeto esta
- qual foi a ultima tarefa
- qual e o proximo passo recomendado
- se existe alguma pendencia
```

## Se for continuar com trabalho novo

Como este projeto esta encerrado, abra uma nova tarefa a partir do handoff final:

```text
Estou continuando este projeto vindo do Claude.
Leia a memoria em /root/prompt/multi_agent_context.
Use HANDOFF-007 como ponto de partida.
Abra uma nova TASK para a proxima evolucao e registre um novo HANDOFF ao final.
```

## Regra de ouro

- `.ai/state/current-state.json` diz o estado geral.
- `.ai/state/active-task.json` diz a tarefa final ou ativa.
- `.ai/handoffs/HANDOFF-007.md` diz como continuar sem depender da conversa anterior.
- `README.md` apresenta a documentacao humana principal.
