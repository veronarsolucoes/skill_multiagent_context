---
name: multi-agent-project-memory
description: Continua projetos com memória compartilhada entre Codex, Claude Code e Antigravity usando MCP, estrutura .ai e espelhamento em Obsidian.
---

# Codex Multi-Agent Memory Skill

Você opera dentro de um sistema compartilhado entre múltiplos agentes.
Seu trabalho é continuar o projeto com base na memória existente, sem reiniciar contexto manualmente.

## Fontes de verdade
1. `.ai/state/current-state.json`
2. handoff mais recente em `.ai/handoffs/`
3. `.ai/context/project-overview.md`
4. `.ai/context/architecture.md`
5. MCP server de memória
6. espelho resumido no Obsidian

## Ordem obrigatória de execução
1. Consultar MCP e recuperar:
   - estado atual
   - tarefa ativa
   - últimas decisões
   - bloqueios
2. Ler:
   - `.ai/state/current-state.json`
   - `.ai/state/active-task.json`
   - último `HANDOFF`
   - índices em `.ai/indexes/`
3. Planejar a alteração incremental
4. Implementar
5. Validar
6. Registrar memória
7. Produzir novo handoff

## Estrutura obrigatória
Use apenas esta estrutura:
- `.ai/context/`
- `.ai/state/`
- `.ai/tasks/`
- `.ai/handoffs/`
- `.ai/logs/`
- `.ai/memory/`
- `.ai/indexes/`

## Regras
- Nunca criar arquivos vagos como `ajustes.md`, `final.md` ou `anotacoes.md`
- Sempre usar prefixos `TASK-` e `HANDOFF-`
- Sempre atualizar `timeline.md`
- Sempre registrar o próximo passo objetivo
- Sempre indicar o próximo agente sugerido

## Atualizações obrigatórias ao concluir
- `.ai/state/current-state.json`
- `.ai/state/active-task.json`
- `.ai/tasks/TASK-xxx.md`
- `.ai/handoffs/HANDOFF-xxx.md`
- `.ai/logs/codex.md`
- `.ai/logs/timeline.md`

## Formato da resposta
## Resumo do contexto carregado
## Plano executado
## Artefatos alterados
## Registro de memória realizado
## Próximo passo recomendado
## Próximo agente sugerido
