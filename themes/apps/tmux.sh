#!/usr/bin/env bash
# tmux theme adapter

apply() {
  local id="$1"
  local dest="$HOME/.config/tmux/theme.conf"
  local override

  mkdir -p "$(dirname "$dest")"

  if override="$(theme_override "$id" tmux conf)"; then
    cp "$override" "$dest"
  else
    theme_load_palette "$id"
    cat >"$dest" <<EOF
set -g status-bg "${THEME_bg}"
set -g status-fg "${THEME_fg}"
set -g status-left-style "bg=${THEME_accent},fg=${THEME_bg}"
set -g status-right-style "bg=${THEME_accent},fg=${THEME_bg}"
set -g window-status-current-style "bg=${THEME_color6},fg=${THEME_bg}"
set -g window-status-style "bg=${THEME_bg},fg=${THEME_color8}"
set -g pane-border-style "fg=${THEME_color8}"
set -g pane-active-border-style "fg=${THEME_accent}"
set -g mode-style "bg=${THEME_accent},fg=${THEME_bg}"
EOF
  fi
  theme_log "wrote $dest"

  if command -v tmux >/dev/null 2>&1 && tmux list-sessions >/dev/null 2>&1; then
    # Reload theme into every running server
    while IFS= read -r sock; do
      [[ -z "$sock" ]] && continue
      tmux -S "$sock" source-file "$HOME/.config/tmux/tmux.conf" 2>/dev/null \
        || tmux -S "$sock" source-file "$dest" 2>/dev/null \
        || true
    done < <(tmux list-sessions -F '#{socket_path}' 2>/dev/null | sort -u)
    # Also try default server
    tmux source-file "$HOME/.config/tmux/tmux.conf" 2>/dev/null \
      || tmux source-file "$dest" 2>/dev/null \
      || true
    theme_log "reloaded tmux"
  else
    theme_log "tmux not running; theme will apply on next start"
  fi
}
