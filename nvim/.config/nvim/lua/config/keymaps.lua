-- Keymaps are automatically loaded on the VeryLazy event
-- Default keymaps that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/keymaps.lua
-- Add any additional keymaps here

vim.api.nvim_set_keymap(
  "n",
  "<leader>nt",
  "<cmd>lua require('package-info').toggle()<cr>",
  { silent = true, noremap = true }
)

vim.api.nvim_set_keymap("n", "<leader>gs", "<cmd>Neogit kind=floating<cr>", { silent = true, noremap = true })
vim.api.nvim_set_keymap("n", "<leader>gc", "<cmd>Neogit commit<cr>", { silent = true, noremap = true })
vim.api.nvim_set_keymap("n", "<leader>gh", "<cmd>DiffviewFileHistory<cr>", { silent = true, noremap = true })
vim.api.nvim_set_keymap("n", "<c-/>", "<cmd>FloatermToggle<cr>", { silent = true, noremap = true })
-- vim.api.nvim_set_keymap("v", "Y", "<Plug>(DBUI_ExecuteQuery)", { silent = true, noremap = true })
vim.api.nvim_set_keymap("v", "<leader>r", "<Plug>(DBUI_ExecuteQuery)", { silent = true, noremap = true })
vim.api.nvim_set_keymap("n", "<leader>r", "<Plug>(DBUI_ExecuteQuery)", { silent = true, noremap = true })
vim.api.nvim_set_keymap("t", "<esc><esc>", "<C-\\><C-n>", { noremap = true, silent = true })

-- vim.api.nvim_set_keymap("n", "<leader>gs", "<cmd>DiffviewOpen<cr>", { silent = true, noremap = true })
