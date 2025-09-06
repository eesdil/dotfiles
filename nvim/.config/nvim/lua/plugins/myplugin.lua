return {
  {
    dir = vim.fn.stdpath("config") .. "/lua/myplugin",
    name = "myplugin",
    config = function()
      require("myplugin").setup()
    end,
  },
}
