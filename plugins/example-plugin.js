const fs = require('fs').promises;
const path = require('path');
const glob = require('glob');

class ExamplePlugin {
  constructor(config = {}) {
    this.config = config;
    this.variableUsage = new Map(); // Store variable usage information
  }

  // Scan files for environment variable usage
  async scanFiles() {
    console.log('Scanning files with patterns:', this.config.scan.patterns);
    const patterns = this.config.scan?.patterns || ['**/*.{js,jsx,ts,tsx}'];
    const ignore = this.config.scan?.ignore || ['node_modules/**', 'dist/**'];
    
    const files = await this.findFiles(patterns, ignore);
    
    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf8');
        await this.scanFileContent(content, file);
      } catch (error) {
        console.error(`Error scanning file ${file}:`, error.message);
      }
    }
  }

  // Find files based on patterns
  findFiles(patterns, ignore) {
    return new Promise((resolve, reject) => {
      const files = new Set();
      patterns.forEach(pattern => {
        glob.sync(pattern, { ignore }).forEach(file => files.add(file));
      });
      resolve(Array.from(files));
    });
  }

  // Scan file content for environment variable usage
  scanFileContent(content, filePath) {
    console.log('Scanning file:', filePath);
    // Common patterns for env variable usage
    const patterns = [
      /process\.env\.([A-Z_][A-Z0-9_]*)/g,  // process.env.VARIABLE
      /\$\{process\.env\.([A-Z_][A-Z0-9_]*)\}/g,  // ${process.env.VARIABLE}
      /dotenv\.config\(\)\.([A-Z_][A-Z0-9_]*)/g,  // dotenv.config().VARIABLE
    ];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const varName = match[1];
        if (!this.variableUsage.has(varName)) {
          this.variableUsage.set(varName, new Set());
        }
        this.variableUsage.get(varName).add(filePath);
      }
    });
  }

  // Process variables and add usage information
  async processVariables(variables) {
    await this.scanFiles();
    console.log('Variable usage:', Object.fromEntries(this.variableUsage));

    Object.entries(variables).forEach(([key, data]) => {
      const usage = this.variableUsage.get(key);
      if (usage) {
        data.usage = {
          count: usage.size,
          files: Array.from(usage).map(file => path.relative(process.cwd(), file))
        };
      } else {
        data.usage = {
          count: 0,
          files: []
        };
      }
    });

    return variables;
  }

  // Enhanced markdown generation
  processMarkdown(markdown, variables) {
    let processedMarkdown = `# Environment Variables Documentation\n\n`;
    
    // Add table of contents
    processedMarkdown += `## Table of Contents\n\n`;
    Object.entries(variables).forEach(([filename, vars]) => {
      const sectionName = path.basename(filename);
      processedMarkdown += `- [${sectionName}](#${sectionName.toLowerCase().replace(/\./g, '')})\n`;
    });
    processedMarkdown += `\n---\n\n`;

    // Process each env file
    Object.entries(variables).forEach(([filename, vars]) => {
      const sectionName = path.basename(filename);
      processedMarkdown += `## ${sectionName}\n\n`;

      // Add summary table
      processedMarkdown += `### Summary\n\n`;
      processedMarkdown += `| Variable | Description | Default Value | Usage Count |\n`;
      processedMarkdown += `|----------|-------------|---------------|-------------|\n`;
      
      Object.entries(vars).forEach(([key, data]) => {
        const description = data.description?.split('\n')[0] || 'No description';
        const value = data.value || 'Not set';
        const usageCount = data.usage?.count || 0;
        processedMarkdown += `| \`${key}\` | ${description} | \`${value}\` | ${usageCount} |\n`;
      });

      processedMarkdown += `\n### Detailed Information\n\n`;

      // Add detailed information for each variable
      Object.entries(vars).forEach(([key, data]) => {
        processedMarkdown += `#### \`${key}\`\n\n`;

        // Description section
        if (data.description) {
          processedMarkdown += `**Description:**\n${data.description}\n\n`;
        }

        // Default value
        processedMarkdown += `**Default Value:** \`${data.value || 'Not set'}\`\n\n`;

        // Usage information
        if (data.usage) {
          processedMarkdown += `**Usage Statistics:**\n`;
          processedMarkdown += `- Found in ${data.usage.count} file${data.usage.count !== 1 ? 's' : ''}\n`;
          
          if (data.usage.count > 0) {
            processedMarkdown += `\n**Referenced in:**\n`;
            data.usage.files.forEach(file => {
              processedMarkdown += `- \`${file}\`\n`;
            });
          }
        }

        // Add validation rules if they exist
        if (this.getValidationRules(key)) {
          processedMarkdown += `\n**Validation Rules:**\n`;
          processedMarkdown += `- ${this.getValidationRules(key)}\n`;
        }

        processedMarkdown += `\n---\n\n`;
      });
    });

    return processedMarkdown;
  }

  // Add validation rules based on variable names
  getValidationRules(variableName) {
    const rules = {
      URL: 'Must be a valid URL',
      PORT: 'Must be a valid port number (0-65535)',
      EMAIL: 'Must be a valid email address',
      PATH: 'Must be a valid file system path',
      PASSWORD: 'Should be at least 8 characters long',
      KEY: 'Should be a valid API key format',
      TOKEN: 'Should be a valid authentication token',
      TIMEOUT: 'Must be a positive integer (in milliseconds)',
      HOST: 'Must be a valid hostname',
      IP: 'Must be a valid IP address'
    };

    for (const [key, rule] of Object.entries(rules)) {
      if (variableName.includes(key)) {
        return rule;
      }
    }
    return null;
  }

  // Hook method that will be called by the main program
  apply(compiler) {
    compiler.hooks.beforeParse.tap('ExamplePlugin', async (variables) => {
      return await this.processVariables(variables);
    });

    compiler.hooks.beforeOutput.tap('ExamplePlugin', (markdown, variables) => {
      return this.processMarkdown(markdown, variables);
    });
  }

  parseEnvFile(content) {
    // Parse env file content
    return {
      variables: [],
      comments: {}
    };
  }
}

module.exports = ExamplePlugin; 