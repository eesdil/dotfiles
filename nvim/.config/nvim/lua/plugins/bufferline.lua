-- Theme-aware bufferline: selected tab white-on-blue (amiga) / green-on-black (matrix).
-- Selected icons must use the tab foreground (not filetype blue on blue).

local function theme_highlights(name)
  if name == "amiga" then
    local gray, ink, blue, white = "#AAAAAA", "#8B4500", "#0055AA", "#FFFFFF"
    local surface = "#999999"
    return {
      fill = { fg = ink, bg = gray },
      background = { fg = ink, bg = gray },
      buffer_visible = { fg = ink, bg = gray },
      buffer_selected = { fg = white, bg = blue, bold = true, italic = true },
      close_button = { fg = ink, bg = gray },
      close_button_visible = { fg = ink, bg = gray },
      close_button_selected = { fg = white, bg = blue },
      indicator_selected = { fg = white, bg = blue },
      indicator_visible = { fg = ink, bg = gray },
      modified = { fg = ink, bg = gray },
      modified_visible = { fg = ink, bg = gray },
      modified_selected = { fg = white, bg = blue },
      duplicate = { fg = "#555555", bg = gray, italic = true },
      duplicate_visible = { fg = "#555555", bg = gray, italic = true },
      duplicate_selected = { fg = white, bg = blue, italic = true },
      separator = { fg = gray, bg = gray },
      separator_visible = { fg = gray, bg = gray },
      separator_selected = { fg = blue, bg = blue },
      tab = { fg = ink, bg = gray },
      tab_selected = { fg = white, bg = blue, bold = true },
      tab_close = { fg = ink, bg = gray },
      numbers = { fg = ink, bg = gray },
      numbers_visible = { fg = ink, bg = gray },
      numbers_selected = { fg = white, bg = blue, bold = true },
      diagnostic = { fg = ink, bg = gray },
      diagnostic_visible = { fg = ink, bg = gray },
      diagnostic_selected = { fg = white, bg = blue },
      hint = { fg = ink, bg = gray },
      hint_visible = { fg = ink, bg = gray },
      hint_selected = { fg = white, bg = blue },
      hint_diagnostic = { fg = ink, bg = gray },
      hint_diagnostic_visible = { fg = ink, bg = gray },
      hint_diagnostic_selected = { fg = white, bg = blue },
      info = { fg = ink, bg = gray },
      info_visible = { fg = ink, bg = gray },
      info_selected = { fg = white, bg = blue },
      info_diagnostic = { fg = ink, bg = gray },
      info_diagnostic_visible = { fg = ink, bg = gray },
      info_diagnostic_selected = { fg = white, bg = blue },
      warning = { fg = ink, bg = gray },
      warning_visible = { fg = ink, bg = gray },
      warning_selected = { fg = white, bg = blue },
      warning_diagnostic = { fg = ink, bg = gray },
      warning_diagnostic_visible = { fg = ink, bg = gray },
      warning_diagnostic_selected = { fg = white, bg = blue },
      error = { fg = ink, bg = gray },
      error_visible = { fg = ink, bg = gray },
      error_selected = { fg = white, bg = blue },
      error_diagnostic = { fg = ink, bg = gray },
      error_diagnostic_visible = { fg = ink, bg = gray },
      error_diagnostic_selected = { fg = white, bg = blue },
      offset_separator = { fg = surface, bg = gray },
    }
  end

  if name == "matrix" then
    local black, green, dim, bright, surface = "#0D0D0D", "#00FF41", "#00CC33", "#39FF14", "#0D1A0D"
    return {
      fill = { fg = dim, bg = black },
      background = { fg = dim, bg = black },
      buffer_visible = { fg = dim, bg = black },
      buffer_selected = { fg = bright, bg = surface, bold = true, italic = true },
      close_button = { fg = dim, bg = black },
      close_button_visible = { fg = dim, bg = black },
      close_button_selected = { fg = bright, bg = surface },
      indicator_selected = { fg = green, bg = surface },
      modified = { fg = dim, bg = black },
      modified_visible = { fg = dim, bg = black },
      modified_selected = { fg = bright, bg = surface },
      separator = { fg = black, bg = black },
      separator_visible = { fg = black, bg = black },
      separator_selected = { fg = surface, bg = surface },
      numbers_selected = { fg = bright, bg = surface, bold = true },
      diagnostic_selected = { fg = bright, bg = surface },
      hint_selected = { fg = bright, bg = surface },
      info_selected = { fg = bright, bg = surface },
      warning_selected = { fg = bright, bg = surface },
      error_selected = { fg = bright, bg = surface },
    }
  end

  return nil
end

local function active_name()
  local ok, active = pcall(require, "config.active-theme")
  if ok and type(active) == "table" and active.colorscheme then
    return active.colorscheme
  end
  return vim.g.colors_name
end

local patched = false

--- Force selected-tab icons to use the tab fg (white on amiga), not filetype color.
local function patch_icon_highlights()
  if patched then
    return
  end
  local ok, highlights = pcall(require, "bufferline.highlights")
  if not ok then
    return
  end
  local constants = require("bufferline.constants")
  local orig = highlights.set_icon_highlight
  highlights.set_icon_highlight = function(state, hls, base_hl)
    local icon_hl = orig(state, hls, base_hl)
    if state == constants.visibility.SELECTED and hls.buffer_selected then
      local sel = hls.buffer_selected
      -- Force override (themable default=true would otherwise keep filetype blue)
      vim.api.nvim_set_hl(0, icon_hl, {
        fg = sel.fg,
        bg = sel.bg,
        ctermfg = sel.ctermfg,
        ctermbg = sel.ctermbg,
        default = false,
        bold = false,
        italic = false,
      })
    end
    return icon_hl
  end
  patched = true
end

local function icon_fetcher(o)
  local path = o.path or o.filename or ""
  local ok, devicons = pcall(require, "nvim-web-devicons")
  if ok then
    local icon, hl = devicons.get_icon(vim.fn.fnamemodify(path, ":t"), nil, { default = true })
    if icon then
      return icon, hl
    end
  end
  local ft_icon = LazyVim.config.icons.ft[o.filetype]
  if ft_icon then
    return ft_icon, "Normal"
  end
end

local function apply(opts)
  patch_icon_highlights()

  local highlights = theme_highlights(active_name())
  opts = vim.deepcopy(opts or {})
  opts.options = opts.options or {}
  opts.options.get_element_icon = icon_fetcher
  -- Keep color_icons true so inactive tabs stay tinted; selected is forced white via patch.
  opts.options.color_icons = true
  if highlights then
    opts.highlights = highlights
  end

  require("bufferline").setup(opts)
  pcall(function()
    require("bufferline.highlights").reset_icon_hl_cache()
  end)
  -- Trigger a redraw so icon highlights are rebuilt through our patch.
  pcall(vim.cmd.redrawtabline)
end

return {
  {
    "akinsho/bufferline.nvim",
    opts = function(_, opts)
      local highlights = theme_highlights(active_name())
      if highlights then
        opts.highlights = highlights
      end
      opts.options = opts.options or {}
      opts.options.get_element_icon = icon_fetcher
      opts.options.color_icons = true
      return opts
    end,
    config = function(_, opts)
      apply(opts)
      vim.api.nvim_create_autocmd("ColorScheme", {
        group = vim.api.nvim_create_augroup("ThemeBufferlineRefresh", { clear = true }),
        callback = function()
          vim.schedule(function()
            apply(opts)
          end)
        end,
      })
    end,
  },
}
