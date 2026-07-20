## Getting started

```sh
xcode-select --install
git clone https://github.com/eesdil/dotfiles.git ~/.dotfiles
cd ~/.dotfiles; source setup.sh
```

## Theme switcher

Shared CLI themes for Ghostty, tmux, Neovim, and Herdr live under `themes/`.

```sh
# symlink once (setup already puts ~/.local/bin on PATH)
ln -sf ~/.dotfiles/themes/bin/theme ~/.local/bin/theme

theme              # fzf picker
theme matrix       # apply
theme tokyonight
theme list
theme current
```

- **New theme:** add `themes/palettes/<name>.toml` plus optional files under `themes/overrides/<name>/`.
- **New app:** add `themes/apps/<app>.sh` defining `apply <theme_id>`.
