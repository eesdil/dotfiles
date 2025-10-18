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
          require("neotest-vitest")({
            cwd = function(testFilePath)
              return vim.fs.root(testFilePath, "package.json")
            end,
            filter_dir = function(name, rel_path, root)
              local excluded = { dist = true, node_modules = true, build = true }
              return not excluded[name]
            end,
          }),
          -- require("neotest-jest")({
          --   -- jestCommand = "yarn nx test",
          --   -- jestArguments = function(defaultArguments, context)
          --   --   return defaultArguments
          --   -- end,
          --   -- jestConfigFile = "custom.jest.config.ts",
          --   env = { CI = true },
          --   -- jestConfigFile = function(path)
          --   --   return require("utils.path").get_project_root(path) .. "jest.config.ts"
          --   -- end,
          --   jest_test_discovery = true,
          --   -- cwd = function(path)
          --   --   return require("utils.path").get_project_root(path)
          --   -- end,
          --   isTestFile = require("neotest-jest.jest-util").defaultIsTestFile,
          -- }),
        },
      })
    end,
  },
}
