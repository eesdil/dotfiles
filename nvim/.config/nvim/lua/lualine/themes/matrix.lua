-- Lualine theme for matrix (high-contrast green-on-black)
local black = "#0D0D0D"
local green = "#00FF41"
local dim = "#00CC33"
local bright = "#39FF14"
local surface = "#0D1A0D"
local sel = "#003B00"

return {
  normal = {
    a = { fg = black, bg = green, gui = "bold" },
    b = { fg = green, bg = surface },
    c = { fg = green, bg = black },
  },
  insert = {
    a = { fg = black, bg = dim, gui = "bold" },
    b = { fg = dim, bg = surface },
    c = { fg = green, bg = black },
  },
  visual = {
    a = { fg = black, bg = bright, gui = "bold" },
    b = { fg = bright, bg = surface },
    c = { fg = green, bg = black },
  },
  replace = {
    a = { fg = green, bg = sel, gui = "bold" },
    b = { fg = dim, bg = surface },
    c = { fg = green, bg = black },
  },
  command = {
    a = { fg = black, bg = dim, gui = "bold" },
    b = { fg = dim, bg = surface },
    c = { fg = green, bg = black },
  },
  terminal = {
    a = { fg = black, bg = dim, gui = "bold" },
    b = { fg = dim, bg = surface },
    c = { fg = green, bg = black },
  },
  inactive = {
    a = { fg = dim, bg = black },
    b = { fg = dim, bg = black },
    c = { fg = dim, bg = black },
  },
}
