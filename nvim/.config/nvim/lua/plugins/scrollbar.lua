local colors = require("tokyonight.colors").setup()
local util = require("tokyonight.util")

return {
  {
    "petertriho/nvim-scrollbar",
    config = function()
      require("scrollbar").setup({
        handle = {
          blend = 40,
          color = util.lighten(colors.bg_highlight, 0.8),
        },
      })
    end,
  },
}
