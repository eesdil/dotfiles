-- Prefer dedicated lualine themes (matrix/amiga); otherwise keep LazyVim "auto".
local ok, active = pcall(require, "config.active-theme")
local name = (ok and active and active.colorscheme) or vim.g.colors_name or "auto"
local dedicated = { matrix = true, amiga = true }
local theme = dedicated[name] and name or "auto"

return {
  {
    "nvim-lualine/lualine.nvim",
    opts = function(_, opts)
      opts.options = opts.options or {}
      opts.options.theme = theme
      return opts
    end,
    config = function(_, opts)
      require("lualine").setup(opts)
      -- Reload theme when colorscheme changes (e.g. via `theme` switcher)
      vim.api.nvim_create_autocmd("ColorScheme", {
        group = vim.api.nvim_create_augroup("ThemeLualineRefresh", { clear = true }),
        callback = function(ev)
          local cs = ev.match
          local t = dedicated[cs] and cs or "auto"
          local o = vim.deepcopy(opts)
          o.options = o.options or {}
          o.options.theme = t
          pcall(require("lualine").setup, o)
        end,
      })
    end,
  },
}
