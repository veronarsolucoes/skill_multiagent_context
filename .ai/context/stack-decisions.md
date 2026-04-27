# Stack Decisions

- Linguagem do broker/contexto: definir entre TypeScript ou Rust
- Memória operacional: arquivos em `.ai/`
- Espelho legível: Obsidian vault
- Integração de contexto: MCP
- Implementação MCP inicial: Node.js sem dependências externas
- Transporte MCP adotado no Codex: stdio via `codex mcp add`
- Compatibilidade de cliente: suporte a framed + json por linha
- Automação de fase/memória: `memory-write-runner` + manifestos
- Automação de espelho legível: `obsidian-sync-runner`
- Endurecimento de fluxo: `workflow-hardening-runner` com relatorio em `.ai/state/workflow-hardening-report.json`
- Adoção cross-agent: `agent-adoption-runner` com relatorio em `.ai/state/agent-adoption-report.json`
