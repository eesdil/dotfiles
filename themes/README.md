# Theme switcher

```sh
theme              # fzf menu
theme <name>       # apply
theme list
theme current
```

## Add a theme

1. Create `palettes/<name>.toml` with shared keys (`bg`, `fg`, `accent`, `color0`–`color15`, …).
2. Optionally add overrides under `overrides/<name>/`:
   - `ghostty.conf`, `tmux.conf`, `nvim.lua`, `herdr.toml`

## Add an app

1. Create `apps/<app>.sh` defining `apply() { local id="$1"; ... }`.
2. Use `theme_override "$id" <app> <ext>` for override files, or `THEME_*` from the loaded palette.
3. Prefer writing a drop-in config file and live-reloading when the app supports it.
