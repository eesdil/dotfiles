local ok, colors_mod = pcall(require, "tokyonight.colors")
local util_ok, util = pcall(require, "tokyonight.util")

return {
  {
    "petertriho/nvim-scrollbar",
    config = function()
      local opts = { handle = { blend = 40 } }
      if ok and util_ok then
        local colors = colors_mod.setup()
        opts.handle.color = util.lighten(colors.bg_highlight, 0.8)
      end
      require("scrollbar").setup(opts)
    end,
  },
}
