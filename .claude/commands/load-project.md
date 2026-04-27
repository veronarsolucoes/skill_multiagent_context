---
description: Carrega um projeto existente (baseado em multi_agent_context) a partir do caminho informado, valida MCP e reporta o estado.
argument-hint: <caminho-do-projeto>
allowed-tools: Bash, Read
---

Você vai carregar o contexto do projeto em **$ARGUMENTS** (caminho absoluto) e reportar o estado.

## Passo 1 — Validar caminho e MCP

!`set -e
DIR="$ARGUMENTS"
if [ -z "$DIR" ]; then echo "ERRO: informe o caminho: /load-project <path>"; exit 1; fi
if [ ! -d "$DIR/.ai" ]; then echo "ERRO: $DIR não tem estrutura .ai/ (não é um projeto multi_agent_context)"; exit 1; fi
cd "$DIR"
echo "=== Projeto: $DIR ==="
echo ""
echo "=== MCP project-memory ==="
if [ -f "./install.sh" ]; then
  ./install.sh --check 2>&1 | tail -n 20
else
  echo "(install.sh ausente — pulando check)"
fi`

## Passo 2 — Ler arquivos-âncora

!`set -e
DIR="$ARGUMENTS"
cd "$DIR"
echo "=== current-state.json ==="
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
fi
echo ""
echo "=== project-overview ==="
head -n 40 .ai/context/project-overview.md 2>/dev/null || echo "(vazio)"`

## Passo 3 — Reportar

Responda em no máximo 12 linhas:

- **Projeto:** nome e caminho ($ARGUMENTS)
- **Fase atual:** de current-state
- **Última tarefa:** ID + status
- **Próximo passo recomendado:** do último HANDOFF
- **Pendências/bloqueios:** se houver
- **Próximo agente sugerido:** se indicado
- **MCP:** conectado ou não

Se o usuário quiser seguir trabalhando, avise que os próximos comandos (`Read`, `Edit`) devem usar caminho absoluto prefixado com `$ARGUMENTS`, ou peça para ele rodar `cd $ARGUMENTS` no terminal e reabrir o Claude nessa pasta.
