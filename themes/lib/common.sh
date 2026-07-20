#!/usr/bin/env bash
# Shared helpers for the theme switcher.

THEMES_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PALETTES_DIR="$THEMES_ROOT/palettes"
OVERRIDES_DIR="$THEMES_ROOT/overrides"
APPS_DIR="$THEMES_ROOT/apps"
CURRENT_FILE="$THEMES_ROOT/current"

theme_list() {
  local f
  for f in "$PALETTES_DIR"/*.toml; do
    [[ -f "$f" ]] || continue
    basename "$f" .toml
  done | sort
}

theme_exists() {
  local id="$1"
  [[ -f "$PALETTES_DIR/$id.toml" ]]
}

theme_current() {
  if [[ -f "$CURRENT_FILE" ]]; then
    tr -d '[:space:]' <"$CURRENT_FILE"
  fi
}

theme_set_current() {
  local id="$1"
  printf '%s\n' "$id" >"$CURRENT_FILE"
}

# Load a palette TOML into THEME_* env vars (simple key = "value" / key = #hex).
theme_load_palette() {
  local id="$1"
  local file="$PALETTES_DIR/$id.toml"
  local line key value

  if [[ ! -f "$file" ]]; then
    echo "theme: palette not found: $id" >&2
    return 1
  fi

  unset THEME_bg THEME_fg THEME_cursor THEME_cursor_text \
    THEME_selection_bg THEME_selection_fg THEME_accent \
    THEME_surface0 THEME_surface1
  local i
  for i in $(seq 0 15); do
    unset "THEME_color$i"
  done

  while IFS= read -r line || [[ -n "$line" ]]; do
    # Trim whitespace
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"
    # Full-line comments / blanks
    [[ -z "$line" || "$line" == \#* ]] && continue
    [[ "$line" == *=* ]] || continue

    key="${line%%=*}"
    value="${line#*=}"
    key="${key%"${key##*[![:space:]]}"}"
    key="${key#"${key%%[![:space:]]*}"}"
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"
    # Strip surrounding quotes
    if [[ "$value" == \"*\" ]]; then
      value="${value:1:${#value}-2}"
    fi

    case "$key" in
      bg|fg|cursor|cursor_text|selection_bg|selection_fg|accent|surface0|surface1|vim_background|cursorline_solid|color[0-9]|color1[0-5])
        export "THEME_$key=$value"
        ;;
    esac
  done <"$file"
}

# Path to an override file if present: overrides/<id>/<app>.<ext>
theme_override() {
  local id="$1" app="$2" ext="$3"
  local path="$OVERRIDES_DIR/$id/$app.$ext"
  if [[ -f "$path" ]]; then
    printf '%s\n' "$path"
    return 0
  fi
  return 1
}

theme_log() {
  printf '  %s\n' "$*"
}

theme_warn() {
  printf '  ! %s\n' "$*" >&2
}
