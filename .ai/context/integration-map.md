# Integration Map

- Claude Code -> MCP + .ai/ + Obsidian
- Codex -> MCP + .ai/ + Skill + Obsidian
- Antigravity -> MCP + .ai/ + Obsidian

## MCP server local do projeto
- arquivo: `.ai/context/mcp-project-memory-server.mjs`
- server name: `project-memory`
- root: `PROJECT_ROOT=/root/prompt/multi_agent_context`
- transporte suportado:
  - framed (`Content-Length`)
  - json por linha (`\\n`)

## Comando aplicado no Codex
`codex mcp add project-memory --env PROJECT_ROOT=/root/prompt/multi_agent_context -- node /root/prompt/multi_agent_context/.ai/context/mcp-project-memory-server.mjs`

## Comando aplicado no Claude Code
`claude mcp add -s project project-memory /usr/bin/node /root/prompt/multi_agent_context/.ai/context/mcp-project-memory-server.mjs`

## OpenClaw/Antigravity runtime
- pacote espelhado para: `/home/node/.openclaw/workspace/multi_agent_context`
- MCP registrado com:
`openclaw mcp set project-memory '{"command":"node","args":["/home/node/.openclaw/workspace/multi_agent_context/.ai/context/mcp-project-memory-server.mjs"],"env":{"PROJECT_ROOT":"/home/node/.openclaw/workspace/multi_agent_context"}}'`

## Validacao minima por agente
1. `tools/list` deve retornar 6 ferramentas.
2. `get_project_state` deve ler `.ai/state/current-state.json`.
3. `get_active_task` deve ler `.ai/state/active-task.json`.
4. `search_context` deve retornar resultados para uma consulta conhecida.
5. `save_task_log` e `save_handoff` devem gerar artefatos em `.ai/`.

## Continuar memoria entre agentes

Para sair do Claude e continuar no Codex:

```bash
cd /root/prompt/multi_agent_context
codex mcp list
sed -n '1,220p' .ai/state/current-state.json
sed -n '1,220p' .ai/state/active-task.json
sed -n '1,260p' .ai/handoffs/HANDOFF-007.md
```

Guia dedicado:
- `.ai/context/cross-agent-memory-handoff.md`

## Fluxo operacional automatizado
- transicao de fase e escrita de memoria:
  - `node .ai/context/memory-write-runner.mjs --manifest <manifesto>`
- sincronizacao do Obsidian:
  - `node .ai/context/obsidian-sync-runner.mjs`
- validacao de hardening:
  - `node .ai/context/workflow-hardening-runner.mjs --dry-run`
  - `node .ai/context/workflow-hardening-runner.mjs`
- validacao de adocao de agentes:
  - `node .ai/context/agent-adoption-runner.mjs --dry-run`
  - `node .ai/context/agent-adoption-runner.mjs`

## Ordem recomendada de fechamento de fase
1. executar `workflow-hardening-runner` para validar fase atual
2. aplicar transicao com `memory-write-runner` (manifesto de fase)
3. sincronizar espelhos com `obsidian-sync-runner`
4. rerodar `workflow-hardening-runner` para confirmar o novo estado
5. se houver `fail`, corrigir `.ai/` primeiro e repetir o fluxo

## Ordem recomendada para fase 5 (adocao)
1. executar `agent-adoption-runner` (dry-run e real)
2. registrar resultado em `TASK-007` e `HANDOFF-007`
3. atualizar estado com manifesto de checkpoint (`phase-5-applied`)
4. aplicar encerramento formal com `phase-5-complete`
5. sincronizar Obsidian
