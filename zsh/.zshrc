PATH="$(brew --prefix)/opt/python@3/libexec/bin:$PATH"
PATH="$PATH:$HOME/.local/bin"

### MANAGED BY RANCHER DESKTOP START (DO NOT EDIT)
PATH=$HOME/.rd/bin:$PATH
### MANAGED BY RANCHER DESKTOP END (DO NOT EDIT)
#
export PATH

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion

# The next line updates PATH for the Google Cloud SDK.
if [ -f '$HOME/google-cloud-sdk/path.zsh.inc' ]; then . '$HOME/google-cloud-sdk/path.zsh.inc'; fi

# The next line enables shell command completion for gcloud.
if [ -f '$HOME/google-cloud-sdk/completion.zsh.inc' ]; then . '$HOME/google-cloud-sdk/completion.zsh.inc'; fi

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

# zoxide

eval "$(zoxide init zsh)"

# fzf

source <(fzf --zsh)

# atuin

export ATUIN_NOBIND="true"
eval "$(atuin init zsh)"

# starship

eval "$(starship init zsh)"

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
    zle accept-line
  fi
}
zle -N atuin_cwd_run_widget

atuin_cwd_run_prevdir() {
  local selected cwd cmd
  selected=$(atuin search --format '{command}' | fzf)
  cmd=${selected}
  if [[ -n "$cmd" ]]; then
    BUFFER="$cmd"
    zle accept-line
  fi
}
zle -N atuin_cwd_run_prevdir

alias ls="eza"

# Keys

bindkey '^O' atuin_cwd_run_widget
bindkey '^r' atuin_cwd_run_prevdir
bindkey '^[[Z' autosuggest-accept

