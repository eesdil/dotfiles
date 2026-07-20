-- Colorscheme plugins + LazyVim colorscheme from theme switcher.
-- `theme` writes lua/config/active-theme.lua with { colorscheme = "..." }.

local ok, active = pcall(require, "config.active-theme")
if not ok or type(active) ~= "table" then
  active = { colorscheme = "tokyonight" }
end

local colorscheme = active.colorscheme or "tokyonight"

return {
  {
    "folke/tokyonight.nvim",
    lazy = true,
    opts = { style = "night", transparent = true },
  },
  {
    "LazyVim/LazyVim",
    opts = {
      colorscheme = colorscheme,
    },
  },
}
