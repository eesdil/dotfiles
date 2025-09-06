local M = {}

function M.find_root(path)
  local root = path:match("(.-/[^/]+/)src")

  if root then
    return root
  end

  root = path:match("(.-/(projects)/[^/]+)") or path:match("(.-/(apps)/[^/]+)") or path:match("(.-/(libs)/[^/]+)")

  if root then
    return root
  end

  return vim.fn.getcwd()
end

function M.get_absolute_path(path)
  return vim.fn.fnamemodify(path, ":p")
end

function M.get_project_root(file_path)
  return M.get_absolute_path(M.find_root(file_path))
end

function M.current_project_root()
  return M.get_project_root(vim.fn.expand("%"))
end

return M
