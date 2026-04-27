#!/usr/bin/env bash
set -euo pipefail

# ── Resolve project root (where this script lives) ──
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MCP_SERVER="$SCRIPT_DIR/.ai/context/mcp-project-memory-server.mjs"
NODE_BIN="$(command -v node 2>/dev/null || echo /usr/bin/node)"

# ── Colors ──
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; }
info() { echo -e "  ${BLUE}→${NC} $1"; }
warn() { echo -e "  ${YELLOW}!${NC} $1"; }

echo ""
echo -e "${BLUE}━━━ MCP project-memory installer ━━━${NC}"
echo -e "  Projeto: $SCRIPT_DIR"
echo -e "  Server:  $MCP_SERVER"
echo ""

# ── Pre-checks ──
if [ ! -f "$MCP_SERVER" ]; then
  fail "Servidor MCP nao encontrado: $MCP_SERVER"
  exit 1
fi

if ! command -v node &>/dev/null; then
  fail "Node.js nao encontrado. Instale antes de continuar."
  exit 1
fi

CHECK_ONLY=false
if [[ "${1:-}" == "--check" ]]; then
  CHECK_ONLY=true
  echo -e "${YELLOW}Modo verificacao (--check)${NC}"
  echo ""
fi

INSTALLED=0
FAILED=0

# ══════════════════════════════════════
# 1. Claude Code
# ══════════════════════════════════════
echo -e "${BLUE}[1/3] Claude Code${NC}"

if command -v claude &>/dev/null; then
  if $CHECK_ONLY; then
    if claude mcp list 2>/dev/null | grep -q "project-memory"; then
      ok "project-memory conectado"
    else
      fail "project-memory NAO encontrado"
      ((FAILED++)) || true
    fi
  else
    # Remove existing to avoid duplicates
    claude mcp remove -s project project-memory 2>/dev/null || true
    claude mcp add -s project project-memory "$NODE_BIN" "$MCP_SERVER" 2>/dev/null
    if claude mcp list 2>/dev/null | grep -q "project-memory"; then
      ok "Registrado e conectado"
      ((INSTALLED++)) || true
    else
      fail "Registro falhou"
      ((FAILED++)) || true
    fi
  fi
else
  warn "claude CLI nao encontrado — pulando"
fi

# ══════════════════════════════════════
# 2. Codex
# ══════════════════════════════════════
echo -e "${BLUE}[2/3] Codex${NC}"

if command -v codex &>/dev/null; then
  if $CHECK_ONLY; then
    if codex mcp list 2>/dev/null | grep -q "project-memory"; then
      ok "project-memory conectado"
    else
      fail "project-memory NAO encontrado"
      ((FAILED++)) || true
    fi
  else
    # Remove existing to avoid duplicates
    codex mcp remove project-memory 2>/dev/null || true
    codex mcp add project-memory \
      --env "PROJECT_ROOT=$SCRIPT_DIR" \
      -- node "$MCP_SERVER" 2>/dev/null
    if codex mcp list 2>/dev/null | grep -q "project-memory"; then
      ok "Registrado e conectado"
      ((INSTALLED++)) || true
    else
      fail "Registro falhou"
      ((FAILED++)) || true
    fi
  fi
else
  warn "codex CLI nao encontrado — pulando"
fi

# ══════════════════════════════════════
# 3. OpenClaw / Antigravity
# ══════════════════════════════════════
echo -e "${BLUE}[3/3] OpenClaw / Antigravity${NC}"

CONTAINER="openclaw-gateway"
CONTAINER_PATH="/home/node/.openclaw/workspace/multi_agent_context"

if command -v docker &>/dev/null && docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${CONTAINER}$"; then
  if $CHECK_ONLY; then
    if timeout 10 docker exec "$CONTAINER" openclaw mcp list 2>/dev/null | grep -q "project-memory"; then
      ok "project-memory conectado no container"
    else
      fail "project-memory NAO encontrado no container"
      ((FAILED++)) || true
    fi
  else
    # Copy .ai/ into the container
    info "Copiando .ai/ para o container..."
    docker exec "$CONTAINER" mkdir -p "$CONTAINER_PATH" 2>/dev/null || true
    docker cp "$SCRIPT_DIR/.ai" "$CONTAINER:$CONTAINER_PATH/.ai"

    # Register MCP inside the container
    MCP_CONFIG="{\"command\":\"node\",\"args\":[\"$CONTAINER_PATH/.ai/context/mcp-project-memory-server.mjs\"],\"env\":{\"PROJECT_ROOT\":\"$CONTAINER_PATH\"}}"
    timeout 15 docker exec "$CONTAINER" openclaw mcp set project-memory "$MCP_CONFIG" >/dev/null 2>&1 || true

    # Verify via config file (openclaw mcp list pode travar)
    if docker exec "$CONTAINER" grep -q "project-memory" /home/node/.openclaw/openclaw.json 2>/dev/null; then
      ok "Registrado e conectado no container"
      ((INSTALLED++)) || true
    else
      fail "Registro falhou no container"
      ((FAILED++)) || true
    fi
  fi
else
  if ! command -v docker &>/dev/null; then
    warn "docker nao encontrado — pulando"
  else
    warn "container '$CONTAINER' nao esta rodando — pulando"
  fi
fi

# ── Summary ──
echo ""
echo -e "${BLUE}━━━ Resultado ━━━${NC}"
if $CHECK_ONLY; then
  if [ "$FAILED" -eq 0 ]; then
    ok "Todos os ambientes detectados estao conectados"
  else
    fail "$FAILED ambiente(s) sem conexao"
  fi
else
  if [ "$INSTALLED" -gt 0 ]; then
    ok "$INSTALLED ambiente(s) configurado(s) com sucesso"
  fi
  if [ "$FAILED" -gt 0 ]; then
    fail "$FAILED ambiente(s) falharam"
  fi
  if [ "$INSTALLED" -eq 0 ] && [ "$FAILED" -eq 0 ]; then
    warn "Nenhum ambiente detectado para instalar"
  fi
fi
echo ""
