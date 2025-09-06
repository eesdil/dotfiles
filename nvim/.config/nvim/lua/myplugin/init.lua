local M = {}

function M.setup()
  vim.api.nvim_create_user_command("HelloLazyVim", function()
    print("Hello, LazyVim!")
  end, {})

  -- vim.keymap.set("n", "<leader>xn", ":HelloLazyVim<CR>", { desc = "Say Hello from LazyVim" })
end

return M
