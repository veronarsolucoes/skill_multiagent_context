# Decisions

Espelho do arquivo `.ai/memory/decisions.md`.

Atualizacao 2026-04-30:
- 2026-04-17: adotar runner dedicado para espelhamento do Obsidian.
- 2026-04-17: encerrar fases com execucao automatica + validacao JSON.
- 2026-04-17: tornar workflow-hardening-runner obrigatorio antes de fechamento de fase.
- 2026-04-17: persistir relatorio de integridade em .ai/state/workflow-hardening-report.json.
- 2026-04-17: validar adocao de agentes por comando real (`mcp list`) em cada ambiente.
- 2026-04-17: manter relatorio da fase 5 em .ai/state/agent-adoption-report.json.
- 2026-04-17: considerar o projeto concluido quando roadmap estiver 100% completed e validacoes finais aprovadas.
- 2026-04-29: para resolver divergencia OpenClaw, adotar uma memoria canonica em `/root/prompt/<projeto>` e tratar copias sandbox como espelhos ou caches somente leitura.
- 2026-04-29: GitHub deve receber snapshots da memoria canonica por runner agendado; o runner nao deve resolver divergencia remota automaticamente com pull/reset/rebase.
- 2026-04-29: OpenClaw deve acessar a memoria fora do sandbox por MCP apontado para bind mount da raiz canonica ou por gateway host equivalente.
