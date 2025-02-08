#!/usr/bin/env node

const { program } = require('commander');
const fs = require('fs').promises;
const path = require('path');
const dotenv = require('dotenv');
const glob = require('glob');

// Version from package.json
const { version } = require('./package.json');

// Add after other requires
class Compiler {
  constructor() {
    this.hooks = {
      beforeParse: {
        tap: (name, fn) => {
          this.beforeParseFn = fn;
        }
      },
      beforeOutput: {
        tap: (name, fn) => {
          this.beforeOutputFn = fn;
        }
      }
    };
  }

  async runBeforeParse(variables) {
    if (this.beforeParseFn) {
      return this.beforeParseFn(variables);
    }
    return variables;
  }

  async runBeforeOutput(markdown, variables) {
    if (this.beforeOutputFn) {
      return this.beforeOutputFn(markdown, variables);
    }
    return markdown;
  }
}

program
  .version(version)
  .description('Generate documentation for environment variables')
  .option('-c, --config <path>', 'path to config file', './env-doc.config.json')
  .option('-o, --output <path>', 'output directory', './docs')
  .parse(process.argv);

const options = program.opts();

// Load config
const loadConfig = () => {
  try {
    const configPath = path.resolve(options.config);
    return require(configPath);
  } catch (error) {
    console.error('Error loading config file:', error.message);
    process.exit(1);
  }
};

// Find all env files based on patterns
const findEnvFiles = (patterns) => {
  return new Promise((resolve, reject) => {
    const files = new Set();
    patterns.forEach(pattern => {
      glob.sync(pattern).forEach(file => files.add(file));
    });
    resolve(Array.from(files));
  });
};

// Parse env file and extract variables with comments
const parseEnvFile = async (filePath) => {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.split('\n');
    const variables = {};
    let currentComment = [];

    lines.forEach(line => {
      line = line.trim();
      
      // Collect comments
      if (line.startsWith('#')) {
        currentComment.push(line.slice(1).trim());
        return;
      }

      // Parse variable definitions
      if (line.includes('=')) {
        const [key, ...valueParts] = line.split('=');
        const value = valueParts.join('=');
        
        variables[key.trim()] = {
          value: value.trim(),
          description: currentComment.join('\n')
        };
        
        currentComment = [];
      }
    });

    return variables;
  } catch (error) {
    console.error(`Error parsing ${filePath}:`, error.message);
    return {};
  }
};

// Generate markdown documentation
const generateMarkdown = (envData) => {
  let markdown = '# Environment Variables Documentation\n\n';

  Object.entries(envData).forEach(([filename, variables]) => {
    markdown += `## ${path.basename(filename)}\n\n`;
    
    Object.entries(variables).forEach(([key, data]) => {
      markdown += `### ${key}\n\n`;
      if (data.description) {
        markdown += `${data.description}\n\n`;
      }
      markdown += `**Default:** \`${data.value || 'Not set'}\`\n\n`;
    });
  });

  return markdown;
};

// Main function
const generateDocs = async () => {
  const config = loadConfig();
  const envData = {};
  
  // Initialize compiler for plugin system
  const compiler = new Compiler();
  
  // Load and initialize plugins
  const plugins = config.plugins || [];
  for (const plugin of plugins) {
    try {
      const Plugin = require(`./plugins/${plugin}`);
      const instance = new Plugin(config);
      instance.apply(compiler);
    } catch (error) {
      console.error(`Error loading plugin ${plugin}:`, error.message);
    }
  }

  // Find and process env files
  const patterns = [...(config.input.files || []), ...(config.input.patterns || [])];
  const files = await findEnvFiles(patterns);

  // Process each file
  for (const file of files) {
    let variables = await parseEnvFile(file);
    
    // Run plugins' beforeParse hooks
    variables = await compiler.runBeforeParse(variables);
    
    // Filter excluded variables
    if (config.exclude) {
      for (const pattern of config.exclude) {
        Object.keys(variables).forEach(key => {
          if (key.match(new RegExp(pattern.replace('*', '.*')))) {
            delete variables[key];
          }
        });
      }
    }

    envData[file] = variables;
  }

  // Generate initial markdown
  let markdown = generateMarkdown(envData);
  
  // Run plugins' beforeOutput hooks
  markdown = await compiler.runBeforeOutput(markdown, envData);

  // Ensure output directory exists
  const outputDir = path.resolve(options.output);
  await fs.mkdir(outputDir, { recursive: true });

  // Write output file
  const outputFile = path.join(outputDir, config.output.file || 'ENV.md');
  await fs.writeFile(outputFile, markdown);

  console.log(`Documentation generated successfully at ${outputFile}`);
};

generateDocs().catch(console.error); 