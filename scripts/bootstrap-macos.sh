#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${SOLO_SUPERMAN_REPO_URL:-https://github.com/bee-community-master/solo_superman.git}"
DEFAULT_TARGET_DIR="${SOLO_SUPERMAN_DIR:-solo_superman}"
PNPM_VERSION="${SOLO_SUPERMAN_PNPM_VERSION:-11.0.4}"
RUN_SMOKE="${SOLO_SUPERMAN_RUN_SMOKE:-1}"
START_LOCAL="${SOLO_SUPERMAN_START_LOCAL:-1}"
BOOTSTRAP_COMMAND='/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/bee-community-master/solo_superman/main/scripts/bootstrap-macos.sh)"'
MIN_NODE_MAJOR=24

info() {
  printf '\n==> %s\n' "$1"
}

warn() {
  printf '\nWARN: %s\n' "$1" >&2
}

print_recovery_hint() {
  printf '\n다시 시도하려면 새 터미널에서 아래 한 줄을 그대로 붙여넣으세요:\n%s\n' "$BOOTSTRAP_COMMAND" >&2
  printf '네트워크/회사 보안 정책/관리자 권한이 막는 경우에는 정책을 우회하지 않고 여기서 멈춥니다.\n' >&2
}

fail() {
  printf '\nERROR: %s\n' "$1" >&2
  print_recovery_hint
  exit 1
}

has_command() {
  command -v "$1" >/dev/null 2>&1
}

load_brew_path() {
  if has_command brew; then
    return 0
  fi

  if [ -x /opt/homebrew/bin/brew ]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [ -x /usr/local/bin/brew ]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi
}

ensure_homebrew() {
  load_brew_path
  if has_command brew; then
    return 0
  fi

  info "Homebrew가 없어 설치를 시도합니다. macOS가 암호를 요청할 수 있습니다."
  NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  load_brew_path
  has_command brew || fail "Homebrew 설치 후에도 brew를 찾지 못했습니다. 새 터미널에서 README의 한 줄 설치 명령을 다시 실행하세요."
}

ensure_git() {
  if has_command git; then
    info "git already installed: $(git --version 2>/dev/null | head -n 1)"
    return 0
  fi

  ensure_homebrew
  info "git 설치: brew install git"
  brew install git
  has_command git || fail "git 설치 후에도 명령을 찾지 못했습니다. 새 터미널에서 README의 한 줄 설치 명령을 다시 실행하세요."
}

node_major() {
  if ! has_command node; then
    printf '0\n'
    return 0
  fi

  node -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || printf '0\n'
}

ensure_node() {
  local major
  major="$(node_major)"
  if [ "$major" -ge "$MIN_NODE_MAJOR" ]; then
    info "node already installed: $(node --version)"
    return 0
  fi

  ensure_homebrew
  if has_command node; then
    warn "현재 node 버전이 너무 낮아 업그레이드를 시도합니다: $(node --version)"
    brew upgrade node || brew install node
  else
    info "node 설치: brew install node"
    brew install node
  fi

  load_brew_path
  major="$(node_major)"
  if [ "$major" -lt "$MIN_NODE_MAJOR" ]; then
    fail "Node $MIN_NODE_MAJOR 이상이 필요합니다. 새 터미널에서 README의 한 줄 설치 명령을 다시 실행하세요."
  fi
  info "node ready: $(node --version)"
}

ensure_pnpm() {
  if has_command corepack; then
    info "pnpm@$PNPM_VERSION 활성화"
    if corepack enable && corepack prepare "pnpm@$PNPM_VERSION" --activate && has_command pnpm; then
      pnpm --version
      return 0
    fi
    warn "Corepack pnpm 활성화가 실패해 npm global 설치로 fallback합니다."
  else
    warn "corepack을 찾지 못해 npm global pnpm 설치로 fallback합니다."
  fi

  has_command npm || fail "npm을 찾지 못했습니다. Node 24 이상 설치 후 새 터미널에서 README의 한 줄 설치 명령을 다시 실행하세요."
  npm install -g "pnpm@$PNPM_VERSION"
  has_command pnpm || fail "pnpm 설치에 실패했습니다. 새 터미널에서 README의 한 줄 설치 명령을 다시 실행하세요."
  pnpm --version
}

run_pnpm() {
  CI=true pnpm "$@"
}

get_origin_remote() {
  local dir="$1"
  git -C "$dir" remote get-url origin 2>/dev/null || true
}

is_expected_repo() {
  local dir="$1"
  local remote

  [ -d "$dir/.git" ] || return 1
  remote="$(get_origin_remote "$dir")"
  case "$remote" in
    "$REPO_URL"|*bee-community-master/solo_superman*|*bee-community-master/solo_superman.git*|*HearingOffice/solo_superman*|*HearingOffice/solo_superman.git*) return 0 ;;
    *) return 1 ;;
  esac
}

sync_origin_remote() {
  local dir="$1"
  local remote

  remote="$(get_origin_remote "$dir")"
  if [ -n "$remote" ] && [ "$remote" != "$REPO_URL" ]; then
    info "origin remote update: $remote -> $REPO_URL"
    git -C "$dir" remote set-url origin "$REPO_URL"
  fi
}

safe_update_existing_checkout() {
  local dir="$1"
  local status
  local current_branch
  local default_branch
  local remote_ref
  local head_sha
  local remote_sha

  status="$(git -C "$dir" status --porcelain 2>/dev/null || true)"
  if [ -n "$status" ]; then
    warn "기존 checkout에 local 변경/untracked 파일이 있어 자동 업데이트를 건너뜁니다. 사용자 파일을 덮어쓰지 않고 계속 진행합니다."
    return 0
  fi

  current_branch="$(git -C "$dir" symbolic-ref --quiet --short HEAD 2>/dev/null || true)"
  if [ -z "$current_branch" ]; then
    warn "기존 checkout이 detached HEAD 상태라 자동 업데이트를 건너뜁니다."
    return 0
  fi

  default_branch="$(git -C "$dir" symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null | sed 's#^origin/##' || true)"
  if [ -z "$default_branch" ]; then
    default_branch="main"
  fi
  remote_ref="origin/$default_branch"

  if [ "$current_branch" != "$default_branch" ]; then
    warn "현재 branch가 $current_branch 이라 자동 업데이트를 건너뜁니다. 기본 branch($default_branch)는 원격에서만 확인했습니다."
    return 0
  fi

  if ! git -C "$dir" rev-parse --verify --quiet "$remote_ref" >/dev/null; then
    warn "$remote_ref ref를 확인하지 못해 자동 업데이트를 건너뜁니다."
    return 0
  fi

  if ! git -C "$dir" merge-base --is-ancestor HEAD "$remote_ref"; then
    warn "기존 checkout이 $remote_ref 와 diverged 상태라 자동 업데이트를 건너뜁니다. 사용자 변경을 덮어쓰지 않습니다."
    return 0
  fi

  head_sha="$(git -C "$dir" rev-parse --short HEAD)"
  remote_sha="$(git -C "$dir" rev-parse --short "$remote_ref")"
  if [ "$head_sha" = "$remote_sha" ]; then
    info "checkout already up to date: $remote_ref@$remote_sha"
    return 0
  fi

  info "safe fast-forward update: $head_sha -> $remote_sha"
  if ! git -C "$dir" merge --ff-only "$remote_ref"; then
    warn "safe fast-forward update가 실패해 기존 checkout으로 계속 진행합니다."
  fi
}

choose_target_dir() {
  local base="$DEFAULT_TARGET_DIR"
  local candidate
  local i

  if is_expected_repo "$base" || [ ! -e "$base" ]; then
    printf '%s\n' "$base"
    return 0
  fi

  warn "$base 경로가 이미 있어 건드리지 않고 새 경로를 자동 선택합니다."
  i=2
  while [ "$i" -le 99 ]; do
    candidate="${base}-${i}"
    if is_expected_repo "$candidate" || [ ! -e "$candidate" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
    i=$((i + 1))
  done

  fail "사용 가능한 설치 경로를 자동으로 찾지 못했습니다. solo_superman-* 폴더를 정리한 뒤 다시 실행하세요."
}

absolute_target_path() {
  local target="$1"
  local parent
  local name

  parent="$(dirname "$target")"
  name="$(basename "$target")"
  mkdir -p "$parent"
  printf '%s/%s\n' "$(cd "$parent" && pwd)" "$name"
}

pick_free_port() {
  node -e 'const net = require("node:net"); const server = net.createServer(); server.listen(0, "127.0.0.1", () => { console.log(server.address().port); server.close(); }); server.on("error", (error) => { console.error(error.message); process.exit(1); });'
}

run_prod_smoke() {
  if [ "$RUN_SMOKE" = "0" ]; then
    info "내장 설정으로 smoke 검증을 건너뜁니다."
    return 0
  fi

  info "production bundle smoke"
  if run_pnpm verify:prod-bundle; then
    return 0
  fi

  warn "기본 로컬 포트가 사용 중일 수 있어 빈 포트를 자동 선택해 한 번 더 시도합니다."
  local sidecar_port
  local web_port
  sidecar_port="$(pick_free_port)"
  web_port="$(pick_free_port)"
  while [ "$sidecar_port" = "$web_port" ]; do
    web_port="$(pick_free_port)"
  done

  info "production bundle smoke retry: sidecar=$sidecar_port web=$web_port"
  SOLO_PROD_SMOKE_SIDECAR_PORT="$sidecar_port" \
    SOLO_PROD_SMOKE_WEB_PORT="$web_port" \
    run_pnpm verify:prod-bundle
}

run_local_web() {
  if [ "$START_LOCAL" = "0" ]; then
    info "내장 설정으로 local web 자동 실행을 건너뜁니다."
    printf '나중에 실행하려면 아래 명령을 사용하세요:\ncd "%s" && pnpm start:local\n' "$TARGET_PATH"
    return 0
  fi

  info "Solo Superman web 화면을 엽니다. 브라우저가 열리면 이 터미널을 닫지 마세요."
  run_pnpm start:local || fail "로컬 web 자동 실행에 실패했습니다."
}

print_install_summary() {
  info "Solo Superman 설치가 완료됐습니다."
  printf '설치 경로: %s\n' "$TARGET_PATH"
  printf 'macOS 바탕화면 실행파일: 생성하지 않음\n'
  printf '다시 실행 명령: cd "%s" && pnpm start:local\n' "$TARGET_PATH"
  printf '이제 로컬 web을 시작합니다. 사용하는 동안 이 터미널 창을 닫지 마세요. 종료하려면 Ctrl+C를 누르세요.\n'
}

if [ "$(uname -s)" != "Darwin" ]; then
  fail "이 스크립트는 macOS용입니다. Windows에서는 README의 Windows PowerShell 한 줄 설치 명령을 사용하세요."
fi

ensure_git
ensure_node
ensure_pnpm

TARGET_DIR="$(choose_target_dir)"
TARGET_PATH="$(absolute_target_path "$TARGET_DIR")"

if is_expected_repo "$TARGET_PATH"; then
  info "기존 checkout 사용: $TARGET_PATH"
  sync_origin_remote "$TARGET_PATH"
  if git -C "$TARGET_PATH" fetch --prune origin; then
    safe_update_existing_checkout "$TARGET_PATH"
  else
    warn "원격 업데이트 확인에 실패했지만 기존 checkout으로 계속 진행합니다."
  fi
else
  info "repo clone: $REPO_URL -> $TARGET_PATH"
  git clone "$REPO_URL" "$TARGET_PATH"
fi

cd "$TARGET_PATH"
info "dependency install"
run_pnpm install --frozen-lockfile

run_prod_smoke
print_install_summary
run_local_web
