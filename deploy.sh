#!/usr/bin/env bash
# deploy.sh — Smart local deploy: build → tests → git push → firebase deploy

set -uo pipefail

# ─── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# ─── Helpers ───────────────────────────────────────────────────────────────────
log()     { echo -e "${DIM}[$(date +%H:%M:%S)]${NC} $*"; }
success() { echo -e "${GREEN}${BOLD}✔${NC}  $*"; }
error()   { echo -e "${RED}${BOLD}✘${NC}  $*" >&2; }
info()    { echo -e "${CYAN}▸${NC}  $*"; }
divider() { echo -e "${DIM}────────────────────────────────────────────────${NC}"; }

# Prefix each line of stdin with a colored tag
prefix_lines() {
  local color="$1"
  local label="$2"
  while IFS= read -r line; do
    echo -e "${color}${BOLD}[${label}]${NC} ${line}"
  done
}

# ─── Step 1: Build ─────────────────────────────────────────────────────────────
divider
info "Etapa 1/5 — ${BOLD}Build${NC}"
divider

if ! npm run build 2>&1; then
  error "Build falhou. Deploy abortado."
  exit 1
fi

success "Build concluído."

# ─── Step 2: Security rules tests ──────────────────────────────────────────────
divider
info "Etapa 2/5 — ${BOLD}Testes de regras de segurança${NC}"
divider

if ! npm run test:rules 2>&1; then
  error "Testes de regras falharam. Deploy abortado."
  exit 1
fi

success "Testes de regras aprovados."

# ─── Step 3: Functions/callables tests ─────────────────────────────────────────
divider
info "Etapa 3/5 — ${BOLD}Testes de functions/callables${NC}"
divider

if ! npm run test:functions 2>&1; then
  error "Testes de functions/callables falharam. Deploy abortado."
  exit 1
fi

success "Testes de functions/callables aprovados."

# ─── Step 4: Detectar targets Firebase ─────────────────────────────────────────
divider
info "Etapa 4/5 — ${BOLD}Detectando targets do Firebase${NC}"
divider

# Arquivos alterados em todos os commits ainda não enviados ao remote.
# Fallback para o último commit quando ainda não existe branch remoto (primeiro push).
if git rev-parse "@{u}" >/dev/null 2>&1; then
  CHANGED=$(git diff "@{u}"...HEAD --name-only)
else
  CHANGED=$(git diff-tree --no-commit-id -r --name-only HEAD 2>/dev/null || true)
fi

TARGETS="hosting"

if echo "$CHANGED" | grep -q "^functions/"; then
  TARGETS="${TARGETS},functions"
fi

if echo "$CHANGED" | grep -qE "^(firestore\.rules|firestore\.indexes\.json)$"; then
  TARGETS="${TARGETS},firestore"
fi

if echo "$CHANGED" | grep -q "^storage\.rules$"; then
  TARGETS="${TARGETS},storage"
fi

info "Arquivos alterados nos commits não enviados:"
if [ -n "$CHANGED" ]; then
  echo "$CHANGED" | while IFS= read -r f; do
    echo -e "   ${DIM}•${NC} ${f}"
  done
else
  echo -e "   ${DIM}(nenhum arquivo rastreado alterado)${NC}"
fi

echo ""
info "Firebase targets detectados: ${BOLD}${YELLOW}${TARGETS}${NC}"

# ─── Step 5: Git Push ──────────────────────────────────────────────────────────
divider
info "Etapa 5/6 — ${BOLD}git push${NC}"
divider

if ! git push 2>&1 | prefix_lines "$MAGENTA" " GIT  "; then
  error "git push falhou. Deploy abortado."
  exit 1
fi

success "git push concluído."

# ─── Step 6: Firebase Deploy ───────────────────────────────────────────────────
divider
info "Etapa 6/6 — ${BOLD}firebase deploy${NC} ${DIM}(--only ${TARGETS})${NC}"
divider

if ! firebase deploy --only "$TARGETS" 2>&1 | prefix_lines "$CYAN" "FIREBASE"; then
  error "firebase deploy falhou. Deploy abortado."
  exit 1
fi

success "firebase deploy [${TARGETS}] concluído."

# ─── Resultado final ────────────────────────────────────────────────────────────
divider
success "${BOLD}Deploy completo! 🚀${NC}"
exit 0
