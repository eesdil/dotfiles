return {
  {
    "sindrets/diffview.nvim",
    opts = {
      enhanced_diff_hl = true,
      view = {
        x = {
          layout = "diff3_mixed",
        },
      },
      file_panel = {
        listing_style = "list",
        win_config = {
          type = "split",
          position = "right",
        },
      },
    },
  },
}
