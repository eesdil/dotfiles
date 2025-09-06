local projects_cache = nil
local cached_nx_file = nil

local M = {}

local notify = vim.notify or function(msg)
  vim.api.nvim_echo({ { msg } }, false, {})
end

local function terminal_exists(name)
  for _, buf in ipairs(vim.api.nvim_list_bufs()) do
    if vim.api.nvim_buf_is_loaded(buf) then
      if vim.api.nvim_buf_get_option(buf, "buftype") == "terminal" then
        if vim.b[buf].terminal_title == name then
          return true, buf
        end
      end
    end
  end
  return false
end

local function switch_or_create_tab(tab_name)
  local tabpages = vim.api.nvim_list_tabpages()
  for i, tabpage in ipairs(tabpages) do
    local ok, name = pcall(function()
      return vim.api.nvim_tabpage_get_var(tabpage, "tab_name")
    end)
    if ok and name == tab_name then
      vim.cmd("tabnext " .. i)
      return
    end
  end
  vim.cmd("tabnew")
  vim.t.tab_name = tab_name
end

local function tab_term(cmd, dir, name)
  cmd = cmd or os.getenv("SHELL")
  local folder_name = vim.fn.fnamemodify(dir, ":t")
  local curtab = vim.api.nvim_get_current_tabpage()
  switch_or_create_tab(folder_name)
  if dir then
    vim.cmd("lcd " .. vim.fn.fnameescape(dir))
  end
  vim.cmd("terminal " .. cmd)
  vim.b.terminal_title = name
  if dir then
    vim.b.terminal_cwd = dir
  end
  vim.cmd("tabnext " .. curtab)
end

local function stop_project(item)
  local bufnr = vim.fn.bufnr(item.text)
  if bufnr ~= -1 then
    local chan_id = vim.b[bufnr].terminal_job_id
    if chan_id then
      vim.fn.jobstop(chan_id)
    end
    vim.api.nvim_buf_delete(bufnr, { force = true })
  end
end

local function run_project(item)
  notify("Selected project " .. item.text, vim.log.levels.INFO)
  local bufnr = vim.fn.bufnr(item.text)
  print("Buffer exist" .. bufnr)
  if bufnr ~= -1 then
    vim.cmd("buffer " .. bufnr)
  else
    local my_cmd = string.format("npx nx serve %s", item.text)
    tab_term(my_cmd, item.root_dir, item.text)
  end
end

local function find_nx_file()
  if cached_nx_file then
    return cached_nx_file
  end
  local handle = io.popen("find . -name nx.json -print -quit")
  if handle then
    local result = handle:read("*a")
    handle:close()
    result = result and result:gsub("%s+$", "")
    if result ~= "" then
      cached_nx_file = result
      return cached_nx_file
    end
  end
  return nil
end

local function get_projects(target_dir)
  if projects_cache then
    return projects_cache
  end
  local handle = io.popen("cd " .. target_dir .. " && npx nx show projects --type=app")
  local result = handle:read("*a")
  handle:close()
  projects_cache = result
  return result
end

function M.setup()
  local function get_nx_projects()
    local git_root = vim.fn.systemlist("git rev-parse --show-toplevel")[1]
    -- local git_root = Snacks.git.get_root()
    local nx_file = find_nx_file()
    if not nx_file then
      return {}
    end
    local target_dir = vim.fn.fnamemodify(nx_file, ":p:h")

    local result = get_projects(target_dir)

    if not result or result == "" then
      return {}
    end
    local names = {}
    local idx = 1
    for name in string.gmatch(result, "([^,%s]+)") do
      local exists, bufnr = terminal_exists(name)
      local filename = nil
      if exists and bufnr then
        filename = vim.api.nvim_buf_get_name(bufnr)
      end
      table.insert(
        names,
        { text = name, col = idx, cwd = target_dir, file = filename, root_dir = target_dir, running = exists }
      )
      idx = idx + 1
    end
    return names
  end

  local function open_nx_picker()
    local projects = get_nx_projects()
    Snacks.picker.pick({
      actions = {
        start = function(picker, item)
          if not item then
            return
          end
          run_project(item)
          picker:find()
        end,
        stop = function(picker, item)
          if not item then
            return
          end
          stop_project(item)
          picker:find()
        end,
        restart = function(picker, item)
          if not item then
            return
          end
          stop_project(item)
          run_project(item)
          picker:find()
        end,
      },
      win = {
        input = {
          keys = {
            ["s"] = { "start", mode = { "n" }, desc = "Start project" },
            ["dd"] = { "stop", mode = { "n" }, desc = "Stop project" },
            ["r"] = { "restart", mode = { "n" }, desc = "Restart project" },
          },
        },
      },
      multiselect = true,
      source = "nx",
      items = projects,
      format = function(item)
        local formatted_item = {}
        formatted_item[#formatted_item + 1] = {
          -- item.text,
          string.format("%s  %s", item.running and "" or " ", item.text),
          item.score,
          item.icon or "",
          -- item.running and "" or " ",
        }
        return formatted_item
      end,
      -- layout = {
      --   preset = "vscode",
      -- },
      preview = "file",
      confirm = function(picker, item)
        picker:close()

        run_project(item)
      end,
    })
  end

  vim.keymap.set("n", "<leader>xn", open_nx_picker, { desc = "Nx: Open project picker" })
end

-- local ok, choice = pcall(vim.fn.confirm, ("Restart project %q?"):format(item.text), "&Yes\n&No\n&Cancel")
-- if not ok or choice == 0 or choice == 3 then -- 0 for <Esc>/<C-c> and 3 for Cancel
--   return
-- end
-- if choice == 1 then
-- end

return M
