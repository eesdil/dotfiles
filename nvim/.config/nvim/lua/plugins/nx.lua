return {
  {
    dir = vim.fn.stdpath("config") .. "/lua/nx",
    name = "nx",
    config = function()
      require("nx").setup()
    end,
  },
}
