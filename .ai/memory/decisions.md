# Decisions

- 2026-04-14: `.ai/` definida como estrutura principal de memória operacional.
- 2026-04-14: Obsidian definido como espelho legível do contexto.
- 2026-04-17: evolução do starter será conduzida por fases rastreáveis, começando por extração/leitura, depois MCP, automação, Obsidian, endurecimento e adoção pelos agentes.
- 2026-04-17: cada fase concluída deve atualizar estado, tarefa, handoff, logs, timeline e memória aplicável.
- 2026-04-17: MCP local será mantido sem dependências externas para reduzir atrito de setup.
- 2026-04-17: nome padrão do servidor MCP no Codex: `project-memory`.
- 2026-04-17: manter o servidor compatível com clientes que usam framed e clientes que usam json por linha.
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
