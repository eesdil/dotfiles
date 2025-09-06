### MANAGED BY RANCHER DESKTOP START (DO NOT EDIT)
PATH="$HOME/.rd/bin:$PATH"
### MANAGED BY RANCHER DESKTOP END (DO NOT EDIT)

PATH=~/.console-ninja/.bin:$PATH

export PATH

HISTCONTROL=ignoreboth
shopt -s histappend
HISTSIZE=1000
HISTFILESIZE=2000

# Apps

source <(fzf --bash)
eval "$(mise activate bash)"
eval "$(starship init bash)"
eval "$(zoxide init bash)"

alias docker="podman"
alias ls="eza -all --icons=always"
