module.exports = {
  plugins: ["core-plugin"],
  input: {
    files: [".env.example", ".env.development", ".env.production"],
    patterns: ["**/.env*"]
  },
  output: {
    format: "markdown",
    file: "ENV.md"
  },
  scan: {
    patterns: [
      "**/*.js",
      "**/*.jsx",
      "**/*.ts",
      "**/*.tsx",
      "**/*.css",
      "**/*.html",
      "**/*.json",
      "**/*.md",
      "**/*.yaml",
      "**/*.yml",
      "**/*.txt",
      "**/*.xml",
      "**/*.toml",
      "**/*.ini",
      "**/*.php",
      "**/*.py",
      "**/*.rb"
    ],
    ignore: [
      "node_modules/**",
      "dist/**",
      "build/**"
    ]
  }
}; 