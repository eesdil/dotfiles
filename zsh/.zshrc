HOMEBREW_PREFIX="/opt/homebrew"
PATH="$HOMEBREW_PREFIX/opt/python@3/libexec/bin:$PATH"
PATH="$HOMEBREW_PREFIX/bin:$PATH"
PATH="$HOMEBREW_PREFIX/opt/libpq/bin:$PATH"
PATH="$PATH:$HOME/.local/bin"

### MANAGED BY RANCHER DESKTOP START (DO NOT EDIT)
export PATH="/Users/ckorosi002/.rd/bin:$PATH"
### MANAGED BY RANCHER DESKTOP END (DO NOT EDIT)

export XDG_CONFIG_HOME="$HOME/.config"

# export VISUAL="nvim"
# export EDITOR="nvim"

# The next line updates PATH for the Google Cloud SDK.
if [ -f "$HOME/google-cloud-sdk/path.zsh.inc" ]; then . "$HOME/google-cloud-sdk/path.zsh.inc"; fi

# The next line enables shell command completion for gcloud.
if [ -f "$HOME/google-cloud-sdk/completion.zsh.inc" ]; then . "$HOME/google-cloud-sdk/completion.zsh.inc"; fi

# zsh

setopt COMPLETE_ALIASES
setopt APPEND_HISTORY
setopt EXTENDED_HISTORY
setopt HIST_EXPIRE_DUPS_FIRST
setopt HIST_IGNORE_ALL_DUPS
setopt HIST_IGNORE_DUPS
setopt HIST_IGNORE_SPACE
setopt HIST_REDUCE_BLANKS
setopt HIST_SAVE_NO_DUPS
setopt HIST_VERIFY

HISTSIZE=100000
SAVEHIST=100000
HISTFILE=$ZSH_CACHE_DIR/.zsh_history


source $HOMEBREW_PREFIX/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh
# source $HOMEBREW_PREFIX/share/zsh-autocomplete/zsh-autocomplete.plugin.zsh
# source $(brew --prefix)/opt/zsh-vi-mode/share/zsh-vi-mode/zsh-vi-mode.plugin.zsh

# Autosugeest 

source $HOMEBREW_PREFIX/share/zsh-autosuggestions/zsh-autosuggestions.zsh

ZSH_AUTOSUGGEST_CLEAR_WIDGETS+=(buffer-empty bracketed-paste accept-line push-line-or-edit)
ZSH_AUTOSUGGEST_STRATEGY=(history completion)
ZSH_AUTOSUGGEST_USE_ASYNC=true

# Apps

eval "$(mise activate zsh)"
source <(fzf --zsh)
export ATUIN_NOBIND="true"
eval "$(atuin init zsh)"
eval "$(starship init zsh)"
eval "$(zoxide init zsh)"

# custom

atuin_cwd_run_widget() {
  local selected cwd cmd
  selected=$(atuin search --format '{directory}\t{command}' | fzf --delimiter='\t')
  cwd=${selected%%$'\t'*}
  cmd=${selected#*$'\t'}
  if [[ -n "$cmd" ]]; then
    if [[ "$cwd" == "unknown" || -z "$cwd" ]]; then
      BUFFER="$cmd"
    else
      BUFFER="cd $cwd; $cmd"
    fi
    # zle accept-line
    zle end-of-line;
  fi
}
zle -N atuin_cwd_run_widget

atuin_cwd_run_prevdir() {
  local selected cwd cmd
  selected=$(atuin search --format '{command}' | fzf)
  cmd=${selected}
  if [[ -n "$cmd" ]]; then
    BUFFER="$cmd"
    zle end-of-line;
  fi
}
zle -N atuin_cwd_run_prevdir

# Save current directory whenever it changes
function chpwd() {
  echo "$PWD" > ~/.last_dir
}

# Restore last directory on shell start
if [ -f ~/.last_dir ]; then
  cd "$(cat ~/.last_dir)"
fi

alias ls="eza -all --icons=always"
alias knx="kill -9 $(ps aux | grep -e "nx.*serve" | awk '{ print $2 }')"

# Keys

bindkey '^O' atuin_cwd_run_widget
bindkey '^r' atuin_cwd_run_prevdir
bindkey '^[[Z' autosuggest-accept
