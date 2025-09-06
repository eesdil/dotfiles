function filename(item, picker)
  ---@type snacks.picker.Highlight[]
  local ret = {}
  if not item.file then
    return ret
  end
  local path = Snacks.picker.util.path(item) or item.file
  path = Snacks.picker.util.truncpath(path, picker.opts.formatters.file.truncate or 40, { cwd = picker:cwd() })
  local name, cat = path, "file"
  if item.buf and vim.api.nvim_buf_is_loaded(item.buf) then
    name = vim.bo[item.buf].filetype
    cat = "filetype"
  elseif item.dir then
    cat = "directory"
  end

  if picker.opts.icons.files.enabled ~= false then
    local icon, hl = Snacks.util.icon(name, cat, {
      fallback = picker.opts.icons.files,
    })
    if item.dir and item.open then
      icon = picker.opts.icons.files.dir_open
    end
    icon = Snacks.picker.util.align(icon, picker.opts.formatters.file.icon_width or 2)
    ret[#ret + 1] = { icon, hl, virtual = true }
  end

  local base_hl = item.dir and "SnacksPickerDirectory" or "SnacksPickerFile"
  local function is(prop)
    local it = item
    while it do
      if it[prop] then
        return true
      end
      it = it.parent
    end
  end

  if is("ignored") then
    base_hl = "SnacksPickerPathIgnored"
  elseif is("hidden") then
    base_hl = "SnacksPickerPathHidden"
  elseif item.filename_hl then
    base_hl = item.filename_hl
  end
  local dir_hl = "SnacksPickerDir"

  if picker.opts.formatters.file.filename_only then
    path = vim.fn.fnamemodify(item.file, ":t")
    ret[#ret + 1] = { path, base_hl, field = "file" }
  else
    local dir, base = path:match("^(.*)/(.+)$")
    if base and dir then
      if picker.opts.formatters.file.filename_first then
        local filename_x = picker.opts.formatters.file.filename(dir, base)
        ret[#ret + 1] = { filename_x, base_hl, field = "file" }
        ret[#ret + 1] = { " " }
        ret[#ret + 1] = { dir, dir_hl, field = "file" }
      else
        ret[#ret + 1] = { dir .. "/", dir_hl, field = "file" }
        ret[#ret + 1] = { base, base_hl, field = "file" }
      end
    else
      ret[#ret + 1] = { path, base_hl, field = "file" }
    end
  end
  if item.pos and item.pos[1] > 0 then
    ret[#ret + 1] = { ":", "SnacksPickerDelim" }
    ret[#ret + 1] = { tostring(item.pos[1]), "SnacksPickerRow" }
    if item.pos[2] > 0 then
      ret[#ret + 1] = { ":", "SnacksPickerDelim" }
      ret[#ret + 1] = { tostring(item.pos[2]), "SnacksPickerCol" }
    end
  end
  ret[#ret + 1] = { " " }
  -- FIXME: later
  -- if item.type == "link" then
  --   local real = uv.fs_realpath(item.file)
  --   local broken = not real
  --   real = real or uv.fs_readlink(item.file)
  --   if real then
  --     ret[#ret + 1] = { "-> ", "SnacksPickerDelim" }
  --     ret[#ret + 1] =
  --       { Snacks.picker.util.truncpath(real, 20), broken and "SnacksPickerLinkBroken" or "SnacksPickerLink" }
  --     ret[#ret + 1] = { " " }
  --   end
  -- end
  return ret
end

local function file2(item, picker)
  ---@type snacks.picker.Highlight[]
  local original = Snacks.picker.format.filename
  Snacks.picker.format.filename = filename
  local file = Snacks.picker.format.file
  local ret = file(item, picker)
  Snacks.picker.format.filename = original
  return ret
end

return {
  {
    "folke/snacks.nvim",
    priority = 1000,
    lazy = false,
    ---@type snacks.Config
    opts = {
      formatters = {},
      dashboard = {
        enabled = false,
        preset = {
          theme = "",
          header = [[
                   █████████         
               █████████████████     
             █████████████████████   
            ███████████████████████  
            ██████    ███    ██████  
           ███████    ███    ███████ 
          ███████████████████████████
          ████     ██     ██     ████
          ███  ███    ███    ███  ███
          ███████████████████████████
          ████  ██████   ██████  ████
          ██      ████   ████      ██
          ]],
        },
      },
      picker = {
        win = {
          input = {
            keys = {
              ["J"] = { "preview_scroll_down", mode = { "i", "n" } },
              ["K"] = { "preview_scroll_up", mode = { "i", "n" } },
              ["H"] = { "preview_scroll_left", mode = { "i", "n" } },
              ["L"] = { "preview_scroll_right", mode = { "i", "n" } },
            },
          },
        },
        -- layout = "dropdown",
        sources = {
          explorer = {
            layout = {
              layout = {
                position = "right",
              },
            },
          },
        },
        formatters = {
          file = {
            filename_first = true,
            truncate = 80,
            filename = function(dir, name)
              if name == "main.ts" then
                local folder = dir:match("([^/]+)/[^/]+$")
                return folder .. " (" .. name .. ")"
              end
              if name ~= "index.tsx" then
                return name
              end
              local folder = dir:match("([^/]+)$")
              return folder .. " (" .. name .. ")"
            end,
          },
        },
      },
    },
    keys = {
      {
        "<leader><space>",
        function()
          Snacks.picker.smart({
            multi = { "recent", "buffers", "git_files" },
            format = file2, -- use `file` format for all sources
            matcher = {
              history_bonus = true,
              cwd_bonus = true, -- boost cwd matches
              frecency = true, -- use frecency boosting
              sort_empty = true, -- sort even when the filter is empty
            },
            transform = "unique_file",
          })
        end,
        desc = "Smart Find Files",
      },
      {
        "<leader>sk",
        function()
          Snacks.picker.keymaps({})
        end,
        desc = "Keymaps",
      },
    },
  },
}
