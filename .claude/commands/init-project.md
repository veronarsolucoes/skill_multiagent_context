---
description: Cria um novo projeto a partir do template multi_agent_context, limpa o state e registra o MCP.
argument-hint: <nome-do-projeto>
allowed-tools: Bash, Read, Write, Edit
---

Você vai inicializar um projeto novo chamado **$ARGUMENTS** usando o template multi_agent_context.

## Passo 1 — Criar a estrutura

Execute os passos abaixo (bash):

!`set -e
NOME="$ARGUMENTS"
if [ -z "$NOME" ]; then echo "ERRO: informe o nome do projeto: /init-project <nome>"; exit 1; fi
DEST="/root/${NOME}"
if [ -e "$DEST" ]; then echo "ERRO: $DEST já existe"; exit 1; fi
cp -r /root/prompt/multi_agent_context "$DEST"
cd "$DEST"
rm -f .ai/state/*.json .ai/tasks/TASK-*.md .ai/handoffs/HANDOFF-*.md .ai/logs/*.md .mcp.json
./install.sh
echo "---"
echo "Projeto criado em: $DEST"`

## Passo 2 — Pergunte ao usuário

Antes de prosseguir, pergunte ao usuário em uma frase:
> "Qual é o objetivo deste projeto (2-3 linhas)? E qual é o stack principal (linguagem, framework)?"

Aguarde a resposta.

## Passo 3 — Inicializar memória

Com a resposta:

1. Crie `/root/$ARGUMENTS/.ai/state/current-state.json` com o estado inicial (projeto: $ARGUMENTS, fase: inicial, data atual).
2. Crie `/root/$ARGUMENTS/.ai/state/active-task.json` apontando para `TASK-001`.
3. Crie `/root/$ARGUMENTS/.ai/tasks/TASK-001.md` com o objetivo informado e subtarefas iniciais.
4. Atualize `/root/$ARGUMENTS/.ai/context/project-overview.md` substituindo o conteúdo pelo resumo do novo projeto.
5. Crie `/root/$ARGUMENTS/.ai/handoffs/HANDOFF-001.md` com o próximo passo e o próximo agente sugerido.

## Passo 4 — Reportar

Termine com o formato padrão:

## Resumo do contexto carregado
## Plano executado
## Artefatos alterados
## Registro de memória realizado
## Próximo passo recomendado
## Próximo agente sugerido
