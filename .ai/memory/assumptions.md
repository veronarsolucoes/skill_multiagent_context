# Assumptions

- MCP estará disponível para os três agentes.
- O vault do Obsidian estará acessível localmente.
- Até o MCP ser validado, a pasta `.ai/` será tratada como fonte de verdade operacional.
- O espelho Obsidian deve permanecer resumido e legível para humanos.
- O comando de registro MCP pode ser replicado em outros agentes que suportam stdio.
- Se o MCP do OpenClaw roda dentro do container, acesso a `/root/prompt` do host exige bind mount ou gateway MCP executado fora do sandbox.
