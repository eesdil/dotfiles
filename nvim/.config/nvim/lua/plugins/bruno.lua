local bruno_home = os.getenv("BRUNO_HOME") or "~/.bruno"

return {
  {
    "romek-codes/bruno.nvim",
    dependencies = {
      "nvim-lua/plenary.nvim",
      {
        "folke/snacks.nvim",
        opts = { picker = { enabled = true } },
      },
    },
    config = function()
      require("bruno").setup({
        -- Paths to your bruno collections.
        collection_paths = {
          { name = "Main", path = bruno_home },
        },
        picker = "snacks",
        show_formatted_output = true,
        -- If formatting fails for whatever reason, don't show error message (will always fallback to unformatted output).
        suppress_formatting_errors = false,
      })
    end,
  },
}
