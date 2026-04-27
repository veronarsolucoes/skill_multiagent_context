# Decisions

Espelho do arquivo `.ai/memory/decisions.md`.

Atualizacao 2026-04-18:
- 2026-04-17: usar `.mcp.json` para compartilhamento de configuração MCP no Claude por projeto.
- 2026-04-17: adotar transicao de fase baseada em manifesto para reduzir atualizacao manual.
- 2026-04-17: manter o runner local como caminho padrao para escrita de memoria operacional.
- 2026-04-17: adotar runner dedicado para espelhamento do Obsidian.
- 2026-04-17: encerrar fases com execucao automatica + validacao JSON.
- 2026-04-17: tornar workflow-hardening-runner obrigatorio antes de fechamento de fase.
- 2026-04-17: persistir relatorio de integridade em .ai/state/workflow-hardening-report.json.
- 2026-04-17: validar adocao de agentes por comando real (`mcp list`) em cada ambiente.
- 2026-04-17: manter relatorio da fase 5 em .ai/state/agent-adoption-report.json.
- 2026-04-17: considerar o projeto concluido quando roadmap estiver 100% completed e validacoes finais aprovadas.
