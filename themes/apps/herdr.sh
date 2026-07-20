#!/usr/bin/env bash
# herdr theme adapter

apply() {
  local id="$1"
  local config="${HERDR_CONFIG_PATH:-$HOME/.config/herdr/config.toml}"
  local override tmp

  if ! override="$(theme_override "$id" herdr toml)"; then
    theme_warn "no herdr override for $id; skipping"
    return 0
  fi

  mkdir -p "$(dirname "$config")"
  tmp="$(mktemp)"

  if [[ -f "$config" ]]; then
    # Keep everything except [theme] / [theme.custom] sections
    awk '
      /^\[theme(\.custom)?\]/ { skip=1; next }
      /^\[/ { skip=0 }
      !skip { print }
    ' "$config" | awk '
      { lines[NR]=$0 }
      END {
        end=NR
        while (end>0 && lines[end] ~ /^[[:space:]]*$/) end--
        for (i=1; i<=end; i++) print lines[i]
        if (end>0) print ""
      }
    ' >"$tmp"
  else
    printf 'onboarding = false\n\n' >"$tmp"
  fi

  cat "$override" >>"$tmp"
  printf '\n' >>"$tmp"
  mv "$tmp" "$config"
  theme_log "updated theme section in $config"

  if command -v herdr >/dev/null 2>&1; then
    if herdr server reload-config >/dev/null 2>&1; then
      theme_log "reloaded herdr config"
    else
      theme_warn "herdr reload failed (is the server running?)"
    fi
  else
    theme_warn "herdr not on PATH"
  fi
}
