---
description: Carrega a memória do projeto (current-state, active-task, último handoff) e reporta o estado atual.
allowed-tools: Bash, Read
---

Carregue a memória deste projeto e reporte o estado.

## Passo 1 — Ler arquivos-âncora

!`echo "=== current-state.json ==="
cat .ai/state/current-state.json 2>/dev/null || echo "(vazio)"
echo ""
echo "=== active-task.json ==="
cat .ai/state/active-task.json 2>/dev/null || echo "(vazio)"
echo ""
echo "=== último HANDOFF ==="
LAST_HANDOFF=$(ls -1 .ai/handoffs/HANDOFF-*.md 2>/dev/null | sort -V | tail -n 1)
if [ -n "$LAST_HANDOFF" ]; then
  echo "Arquivo: $LAST_HANDOFF"
  echo ""
  cat "$LAST_HANDOFF"
else
  echo "(nenhum handoff)"
fi
echo ""
echo "=== última TASK ==="
LAST_TASK=$(ls -1 .ai/tasks/TASK-*.md 2>/dev/null | sort -V | tail -n 1)
if [ -n "$LAST_TASK" ]; then
  echo "Arquivo: $LAST_TASK"
  echo ""
  cat "$LAST_TASK"
else
  echo "(nenhuma task)"
fi`

## Passo 2 — Reportar

Com base no que foi lido, responda em no máximo 10 linhas:

- **Projeto:** nome e fase atual
- **Última tarefa:** ID + status
- **Próximo passo recomendado:** vindo do último HANDOFF
- **Pendências/bloqueios:** se houver
- **Próximo agente sugerido:** se indicado
