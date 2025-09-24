-- local function find_nearest_node_modules_dir()
--   local current_dir = vim.fn.expand("%:p:h") -- current buffer dir
--   while current_dir ~= "/" do
--     if vim.fn.isdirectory(current_dir .. "/node_modules") == 1 then
--       return current_dir
--     end
--     current_dir = vim.fn.fnamemodify(current_dir, ":h")
--   end
--   return nil
-- end
--
-- local function get_root_dir()
--   local original_cwd = vim.fn.getcwd()
--   local node_modules_dir = find_nearest_node_modules_dir()
--   return node_modules_dir or original_cwd
-- end

return {
  {
    "nvim-neotest/neotest",
    dependencies = {
      "marilari88/neotest-vitest",
      "nvim-neotest/neotest-jest",
      "nvim-neotest/nvim-nio",
      "nvim-lua/plenary.nvim",
      "antoinemadec/FixCursorHold.nvim",
      "nvim-treesitter/nvim-treesitter",
    },
    config = function()
      require("neotest").setup({
        adapters = {
          require("neotest-python")({
            python = ".venv/bin/python",
          }),
          -- require("neotest-vitest")({
          --   -- Filter directories when searching for test files. Useful in large projects (see Filter directories notes).
          --   -- cwd = get_root_dir(),
          --   cwd = "/Users/ckorosi002/Projects/Dexter/dexter-apps",
          --   filter_dir = function(name, rel_path, root)
          --     local excluded = { dist = true, node_modules = true, build = true }
          --     return not excluded[name]
          --   end,
          -- }),
          require("neotest-jest")({
            -- jestCommand = "yarn nx test",
            -- jestArguments = function(defaultArguments, context)
            --   return defaultArguments
            -- end,
            -- jestConfigFile = "custom.jest.config.ts",
            env = { CI = true },
            -- jestConfigFile = function(path)
            --   return require("utils.path").get_project_root(path) .. "jest.config.ts"
            -- end,
            jest_test_discovery = true,
            -- cwd = function(path)
            --   return require("utils.path").get_project_root(path)
            -- end,
            isTestFile = require("neotest-jest.jest-util").defaultIsTestFile,
          }),
        },
      })
    end,
  },
}
