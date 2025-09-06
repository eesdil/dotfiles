-- Autocmds are automatically loaded on the VeryLazy event
-- Default autocmds that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/autocmds.lua
--
-- Add any additional autocmds here
-- with `vim.api.nvim_create_autocmd`
--
-- Or remove existing autocmds by their group name (which is prefixed with `lazyvim_` for the defaults)
-- e.g. vim.api.nvim_del_augroup_by_name("lazyvim_wrap_spell")

local function get_last_two_parts(path)
  local parts = vim.split(path, "/")
  return table.concat({ parts[#parts - 1], parts[#parts] }, "/")
end

vim.api.nvim_create_autocmd("BufRead", {
  callback = function(event)
    local cwd = vim.fn.getcwd()
    local name = get_last_two_parts(cwd)
    local emoji = " 🚀 "
    if string.sub(cwd, -9) == "dexter-ds" then
      emoji = " 🐍 "
    end
    vim.opt.titlestring = emoji .. name
  end,
})

vim.api.nvim_create_autocmd("FileType", {
  pattern = "floaterm",
  callback = function(event)
    vim.keymap.set("t", "<C-j>", "<cmd>FloatermNext<cr>", { noremap = true, silent = true })
    vim.keymap.set("t", "<C-k>", "<cmd>FloatermPrev<cr>", { noremap = true, silent = true })
    vim.keymap.set("t", "<C-t>", "<cmd>FloatermNew<CR>", { noremap = true, silent = true })
  end,
})
