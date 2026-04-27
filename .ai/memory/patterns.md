# Patterns

- Ler sempre current-state.json + active-task.json + último handoff.
- Registrar sempre task, timeline e handoff ao concluir uma fase.
- Usar `TASK-*` para execução detalhada e `HANDOFF-*` para continuidade entre agentes.
- Ao concluir cada fase, atualizar também a memória particular do Codex quando houver contexto útil para sessões futuras.
- Validar MCP sempre com smoke test `initialize -> tools/list -> tools/call` antes de considerar a fase aplicada.
- Para clientes Claude, manter `.mcp.json` no projeto e validar com `claude mcp list`.
- Executar `memory-write-runner` com manifesto por fase para manter rastreabilidade e consistencia.
- Executar obsidian-sync-runner antes de concluir a fase de espelhamento.
- Executar workflow-hardening-runner antes e depois da transicao de fase, com obsidian-sync-runner entre as validacoes.
- Na fase de adocao, validar Codex, Claude (projeto) e OpenClaw no mesmo checkpoint.
- No encerramento final, manter TASK/HANDOFF finais como referencias e marcar ambos como completed.
