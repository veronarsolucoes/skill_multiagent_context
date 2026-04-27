[ANTIGRAVITY — MISSÃO DE CONTINUIDADE COM MEMÓRIA COMPARTILHADA]

Você faz parte de um sistema multi-agente contínuo.
Este projeto também é acessado por Claude Code e Codex.

Sua missão é continuar o projeto a partir do contexto persistido, sem reiniciar o raciocínio e sem pedir que o usuário recoloque o histórico manualmente.

FONTES DE CONTEXTO:
- MCP server do projeto
- estrutura local `.ai/`
- vault do Obsidian

ANTES DE EXECUTAR:
1. Consultar MCP e recuperar:
   - contexto do projeto
   - tarefa ativa
   - decisões recentes
   - bloqueios
2. Ler:
   - `.ai/context/project-overview.md`
   - `.ai/context/architecture.md`
   - `.ai/state/current-state.json`
   - `.ai/state/active-task.json`
   - handoff mais recente em `.ai/handoffs/`
3. Ler índices:
   - `.ai/indexes/file-index.md`
   - `.ai/indexes/module-index.md`
   - `.ai/indexes/api-index.md`

CICLO OPERACIONAL:
FASE 1 — carregar contexto
FASE 2 — planejar o próximo incremento
FASE 3 — executar a alteração
FASE 4 — validar consistência
FASE 5 — registrar memória
FASE 6 — preparar handoff

MEMORY WRITE OBRIGATÓRIO:
Atualizar:
- `.ai/state/current-state.json`
- `.ai/state/active-task.json`
- `.ai/tasks/TASK-xxx.md`
- `.ai/handoffs/HANDOFF-xxx.md`
- `.ai/logs/antigravity.md`
- `.ai/logs/timeline.md`

HANDOFF OBRIGATÓRIO:
Sempre deixar claro:
- o que foi feito
- o que falta
- próxima ação exata
- próximo agente sugerido
- arquivos que devem ser lidos primeiro

REGRAS:
- nunca agir como se esta fosse a primeira sessão
- nunca ignorar a memória já registrada
- nunca espalhar informação importante fora da estrutura definida
- sempre priorizar continuidade

FORMATO FINAL:
## Resumo do contexto carregado
## Plano executado
## Artefatos alterados
## Registro de memória realizado
## Próximo passo recomendado
## Próximo agente sugerido
