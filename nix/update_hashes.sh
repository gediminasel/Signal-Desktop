#!/usr/bin/env bash
# nix-update-hashes.sh
#
# Automatically fixes hashes in .nix files by replacing each one with a unique
# random sentinel, running `nix build`, and patching each mismatch in-place.
#
# Because every sentinel is unique, grep finds exactly the right file+line
# for each hash — no ambiguity even with hundreds of packages.
#
# AI generated

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
MAX_ITERATIONS=10
NIX_BUILD_CMD="nix build"
SEARCH_DIR="nix/"
BUILD_TARGET="."

# Hash attrs to randomise
HASH_ATTRS=(
  sha256
  hash
  cargoHash
  cargoSha256
  vendorHash
  pnpmDepsHash
)

# File to record sentinel→file→line mappings so we can restore on interruption
SENTINEL_MAP=$(mktemp /tmp/nix-sentinels.XXXXXX)

# ── Colors ────────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
RESET='\033[0m'

log()  { echo -e "${CYAN}[nix-update-hashes]${RESET} $*"; }
ok()   { echo -e "${GREEN}✔${RESET} $*"; }
warn() { echo -e "${YELLOW}⚠${RESET} $*"; }
err()  { echo -e "${RED}✖${RESET} $*" >&2; }

# ── Arg parsing ───────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dir)      SEARCH_DIR="$2"; shift 2 ;;
    --help|-h)
      grep '^#' "$0" | grep -v '#!/' | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *)          BUILD_TARGET="$1"; shift ;;
  esac
done

# ── Generate a unique valid SRI sha256 sentinel ───────────────────────────────
random_sentinel() {
  echo "sha256-$(dd if=/dev/urandom bs=32 count=1 2>/dev/null | base64 | tr -d '\n')"
}

trap 'rm -f "$SENTINEL_MAP"' EXIT

# ── Step 1: Replace every hash value with a unique random sentinel ────────────
stamp_sentinels() {
  log "Stamping unique random sentinels into all .nix files under $SEARCH_DIR ..."
  local count=0

  while IFS= read -r file; do
    for attr in "${HASH_ATTRS[@]}"; do
      # Find line numbers that have this attr with a quoted value or lib.fake*
      while IFS= read -r line_no; do
        local sentinel
        sentinel=$(random_sentinel)

        # Replace quoted hash value on this exact line
        sed -i "${line_no}s|\"[^\"]*\"|\"${sentinel}\"|" "$file"
        # Also handle lib.fakeHash / lib.fakeSha256
        sed -i "${line_no}s|lib\.fake[A-Za-z0-9]*|\"${sentinel}\"|" "$file"

        # Record sentinel → file → line for later lookup
        printf '%s\t%s\t%s\n' "$sentinel" "$file" "$line_no" >> "$SENTINEL_MAP"
        (( count++ )) || true
      done < <(grep -n "${attr}\s*=" "$file" \
                 | grep -E '(=\s*"[^"]*"|lib\.fake)' \
                 | cut -d: -f1)
    done
  done < <(find "$SEARCH_DIR" -name "*.nix" -type f)

  local file_count
  file_count=$(cut -f2 "$SENTINEL_MAP" | sort -u | wc -l)
  log "Stamped $count sentinel(s) across $file_count file(s)."
}

# ── Step 2: Parse hash mismatches from nix build output ──────────────────────
parse_mismatches() {
  local build_log="$1"
  python3 - "$build_log" <<'PYEOF'
import sys, re

text = open(sys.argv[1]).read()
HASH_RE = r'(?:sha256|sha512|md5)-[A-Za-z0-9+/=]+'

pairs = re.findall(
    r'specified:\s*(' + HASH_RE + r').*?got:\s*(' + HASH_RE + r')',
    text, re.DOTALL
)

seen = set()
for wrong, correct in pairs:
    if (wrong, correct) not in seen:
        seen.add((wrong, correct))
        print(f"{wrong}\t{correct}")
PYEOF
}

# ── Step 3: Patch a single mismatch ──────────────────────────────────────────
patch_hash() {
  local sentinel="$1"
  local correct="$2"

  # Look up which file+line owns this exact sentinel
  local record
  record=$(grep -F "$sentinel" "$SENTINEL_MAP" 2>/dev/null | head -1 || true)

  if [[ -z "$record" ]]; then
    # Not in our map — could be a transitive dep hash we didn't stamp.
    # Fall back to grepping all .nix files.
    local files
    files=$(grep -rl --include="*.nix" -- "$sentinel" "$SEARCH_DIR" 2>/dev/null || true)
    if [[ -z "$files" ]]; then
      warn "Cannot locate sentinel, skipping: ${sentinel:0:48}…"
      return
    fi
    for f in $files; do
      sed -i "s|$sentinel|$correct|g" "$f"
      ok "Patched (fallback) $f"
    done
    return
  fi

  local file line_no
  file=$(echo "$record"   | cut -f2)
  line_no=$(echo "$record" | cut -f3)

  sed -i "${line_no}s|${sentinel}|${correct}|" "$file"

  local rel
  rel=$(realpath --relative-to=. "$file")
  ok "Patched $rel:$line_no"
  echo "       ${sentinel:0:48}…"
  echo "    →  ${correct:0:48}…"
}

# ── Main loop ─────────────────────────────────────────────────────────────────
main() {
  stamp_sentinels

  if [[ ! -s "$SENTINEL_MAP" ]]; then
    ok "No hashes found to update."
    exit 0
  fi

  local build_args=("--no-link" "--keep-going")
  [[ -n "$BUILD_TARGET" ]] && build_args+=("$BUILD_TARGET")

  local tmp_log
  tmp_log=$(mktemp /tmp/nix-build-log.XXXXXX)

  log "Starting iterative hash-fix loop (max $MAX_ITERATIONS rounds)..."

  local iteration=0
  while (( iteration < MAX_ITERATIONS )); do
    (( iteration++ )) || true
    log "Round $iteration — running: $NIX_BUILD_CMD ${build_args[*]}"

    set +e
    $NIX_BUILD_CMD "${build_args[@]}" >"$tmp_log" 2>&1
    local exit_code=$?
    set -e

    if ! grep -q "got:" "$tmp_log"; then
      if [[ $exit_code -eq 0 ]]; then
        echo ""
        ok "All hashes correct — build succeeded!"
        exit 0
      else
        err "Build failed (not a hash mismatch). Output:"
        cat "$tmp_log"
        exit $exit_code
      fi
    fi

    local found=0
    while IFS=$'\t' read -r wrong correct; do
      [[ -z "$wrong" || -z "$correct" ]] && continue
      patch_hash "$wrong" "$correct"
      (( found++ )) || true
    done < <(parse_mismatches "$tmp_log")

    if (( found == 0 )); then
      warn "Saw 'got:' in output but couldn't parse hash pairs. Build log:"
      cat "$tmp_log"
      exit 1
    fi
  done

  err "Reached max iterations ($MAX_ITERATIONS) without a clean build."
  cat "$tmp_log"
  exit 1
}

main "$@"