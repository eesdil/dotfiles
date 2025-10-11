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

-- make floarterm keys

vim.api.nvim_create_autocmd("FileType", {
  pattern = "floaterm",
  callback = function(event)
    vim.keymap.set("t", "<C-j>", "<cmd>FloatermNext<cr>", { noremap = true, silent = true })
    vim.keymap.set("t", "<C-k>", "<cmd>FloatermPrev<cr>", { noremap = true, silent = true })
    vim.keymap.set("t", "<C-t>", "<cmd>FloatermNew<CR>", { noremap = true, silent = true })
  end,
})

-- change colors for diffing

vim.api.nvim_set_hl(0, "DiffDelete", { fg = "#24283b", bg = "#1a1b26" })
vim.api.nvim_set_hl(0, "DiffAdd", { bg = "#202d38" })
vim.api.nvim_set_hl(0, "DiffText", { bg = "#33406b" })
vim.api.nvim_set_hl(0, "Folded", { bg = "#171822" })
vim.api.nvim_set_hl(0, "CursorLine", { bg = "#1e202e" })
vim.api.nvim_set_hl(0, "DiffviewDiffAddAsDelete", { bg = "#34222b" })

-- Remove cursor line when window is not focused

local cl_var = "auto_cursorline"

vim.api.nvim_create_autocmd({ "WinEnter", "FocusGained" }, {
  group = vim.api.nvim_create_augroup("enable_auto_cursorline", { clear = true }),
  callback = function()
    local ok, cl = pcall(vim.api.nvim_win_get_var, 0, cl_var)
    if ok and cl then
      vim.api.nvim_win_del_var(0, cl_var)
      vim.o.cursorline = true
    end
  end,
})

vim.api.nvim_create_autocmd({ "WinLeave", "FocusLost" }, {
  group = vim.api.nvim_create_augroup("disable_auto_cursorline", { clear = true }),
  callback = function()
    local cl = vim.o.cursorline
    if cl then
      vim.api.nvim_win_set_var(0, cl_var, cl)
      vim.o.cursorline = false
    end
  end,
})
