-- require("luasnip.loaders.from_vscode").load({ include = { "sql", "python", "js", "ts" } })
-- require("luasnip.loaders.from_vscode").load({ paths = { "./my-snippets" } })

-- local ls = require("luasnip")
--
-- ls.snippers = {
--   all = {
--     ls.parser.parse_snippet("expand", "hello"),
--   },
--   lua = {
--
--     ls.parser.parse_snippet("lfunc", "local #1 = function $0 end"),
--   },
-- }
--
return {
  { "rafamadriz/friendly-snippets" },
}
