#!/usr/bin/env bash
# deploy.sh — Smart parallel deploy: build → git push + firebase deploy

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
info "Etapa 1/3 — ${BOLD}Build${NC}"
divider

if ! npm run build 2>&1; then
  error "Build falhou. Deploy abortado."
  exit 1
fi

success "Build concluído."

# ─── Step 2: Detectar targets Firebase ─────────────────────────────────────────
divider
info "Etapa 2/3 — ${BOLD}Detectando targets do Firebase${NC}"
divider

# Arquivos alterados no último commit (funciona mesmo no primeiro commit)
CHANGED=$(git diff-tree --no-commit-id -r --name-only HEAD 2>/dev/null || true)

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

info "Arquivos alterados no último commit:"
if [ -n "$CHANGED" ]; then
  echo "$CHANGED" | while IFS= read -r f; do
    echo -e "   ${DIM}•${NC} ${f}"
  done
else
  echo -e "   ${DIM}(nenhum arquivo rastreado alterado)${NC}"
fi

echo ""
info "Firebase targets detectados: ${BOLD}${YELLOW}${TARGETS}${NC}"

# ─── Step 3: Git Push + Firebase Deploy em paralelo ────────────────────────────
divider
info "Etapa 3/3 — ${BOLD}git push${NC} + ${BOLD}firebase deploy --only ${TARGETS}${NC} ${DIM}(paralelo)${NC}"
divider

# Diretório de logs temporários
LOG_DIR=$(mktemp -d)
GIT_LOG="${LOG_DIR}/git.log"
FB_LOG="${LOG_DIR}/firebase.log"

# Job: git push
(
  git push 2>&1 | prefix_lines "$MAGENTA" " GIT  "
  echo "${PIPESTATUS[0]}" > "${LOG_DIR}/git_exit"
) &
GIT_PID=$!

# Job: firebase deploy
(
  firebase deploy --only "$TARGETS" 2>&1 | prefix_lines "$CYAN" "FIREBASE"
  echo "${PIPESTATUS[0]}" > "${LOG_DIR}/fb_exit"
) &
FB_PID=$!

# Aguarda ambos terminarem
wait $GIT_PID
wait $FB_PID

# Lê exit codes reais capturados dentro dos subshells
GIT_EXIT=$(cat "${LOG_DIR}/git_exit" 2>/dev/null || echo "1")
FB_EXIT=$(cat "${LOG_DIR}/fb_exit" 2>/dev/null || echo "1")

rm -rf "$LOG_DIR"

# ─── Resultado final ────────────────────────────────────────────────────────────
divider
OVERALL_OK=true

if [ "$GIT_EXIT" -eq 0 ]; then
  success "git push concluído."
else
  error "git push falhou (exit ${GIT_EXIT})."
  OVERALL_OK=false
fi

if [ "$FB_EXIT" -eq 0 ]; then
  success "firebase deploy [${TARGETS}] concluído."
else
  error "firebase deploy falhou (exit ${FB_EXIT})."
  OVERALL_OK=false
fi

divider
if $OVERALL_OK; then
  success "${BOLD}Deploy completo! 🚀${NC}"
  exit 0
else
  error "${BOLD}Deploy concluído com erros.${NC}"
  exit 1
fi
