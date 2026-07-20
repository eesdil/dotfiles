-- Lualine theme for amiga (Workbench: dark ink / white-on-blue accents)
local gray = "#AAAAAA"
local black = "#000000"
local blue = "#0055AA"
local white = "#FFFFFF"
local surface = "#999999"
local ink = "#8B4500"

return {
  normal = {
    a = { fg = white, bg = blue, gui = "bold" },
    b = { fg = black, bg = surface },
    c = { fg = black, bg = gray },
  },
  insert = {
    a = { fg = white, bg = "#007700", gui = "bold" },
    b = { fg = black, bg = surface },
    c = { fg = black, bg = gray },
  },
  visual = {
    a = { fg = black, bg = "#FF8800", gui = "bold" },
    b = { fg = black, bg = surface },
    c = { fg = black, bg = gray },
  },
  replace = {
    a = { fg = white, bg = "#AA0000", gui = "bold" },
    b = { fg = black, bg = surface },
    c = { fg = black, bg = gray },
  },
  command = {
    a = { fg = black, bg = ink, gui = "bold" },
    b = { fg = black, bg = surface },
    c = { fg = black, bg = gray },
  },
  terminal = {
    a = { fg = white, bg = "#006666", gui = "bold" },
    b = { fg = black, bg = surface },
    c = { fg = black, bg = gray },
  },
  inactive = {
    a = { fg = "#555555", bg = gray },
    b = { fg = "#555555", bg = gray },
    c = { fg = "#555555", bg = gray },
  },
}
