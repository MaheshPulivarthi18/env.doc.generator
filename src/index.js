const fs = require('fs').promises;
const path = require('path');
const dotenv = require('dotenv');
const glob = require('glob');
const chalk = require('chalk');

async function scanEnvUsage(options = {}) {
  // Handle custom .env path
  const envPath = options.env 
    ? path.resolve(options.env)
    : path.join(process.cwd(), '.env');
  
  let envContent;
  
  try {
    envContent = await fs.readFile(envPath, 'utf-8');
  } catch (error) {
    throw new Error(`ENV file not found at: ${envPath}`);
  }

  // Parse .env file
  const envConfig = dotenv.parse(envContent);
  const variables = Object.keys(envConfig);
  
  // Initialize usage tracking
  const variableUsage = {};
  variables.forEach(variable => {
    variableUsage[variable] = {
      description: envConfig[variable],
      occurrences: [],
      count: 0
    };
  });

  // Handle custom ignore patterns
  const defaultIgnore = ['node_modules/**', '.git/**', '*.md', '*.env*'];
  const customIgnore = options.ignore ? options.ignore.split(',') : [];
  const ignorePatterns = [...defaultIgnore, ...customIgnore];

  // Scan all files
  const files = await glob('**/*.*', {
    ignore: ignorePatterns,
    nodir: true
  });

  // Search for variable usage in each file
  for (const file of files) {
    const content = await fs.readFile(file, 'utf-8');
    
    variables.forEach(variable => {
      // Enhanced regex to catch more usage patterns
      const patterns = [
        `process\\.env\\.${variable}`,
        `process\\['env'\\]\\['${variable}'\\]`,
        `process\\["env"\\]\\["${variable}"\\]`,
        `process\\['env'\\]\.${variable}`,
        `process\.env\\['${variable}'\\]`,
        `require\\('dotenv'\\)\\.config\\(\\)\.${variable}`,
        `config\\(\\)\.${variable}`
      ];
      const regex = new RegExp(patterns.join('|'), 'g');
      const matches = content.match(regex);
      
      if (matches) {
        variableUsage[variable].count += matches.length;
        variableUsage[variable].occurrences.push({
          file,
          count: matches.length
        });
      }
    });
  }

  // Generate documentation based on format
  let output;
  switch (options.output?.toLowerCase()) {
    case 'json':
      output = generateJSON(variableUsage);
      await fs.writeFile('env-usage.json', output);
      break;
    case 'html':
      output = generateHTML(variableUsage);
      await fs.writeFile('env-usage.html', output);
      break;
    default:
      output = generateMarkdown(variableUsage);
      await fs.writeFile('env-usage.md', output);
  }
}

function generateMarkdown(variableUsage) {
  let markdown = '# Environment Variables Usage Documentation\n\n';
  
  Object.entries(variableUsage).forEach(([variable, usage]) => {
    markdown += `## ${variable}\n\n`;
    markdown += `**Description:** ${usage.description}\n\n`;
    markdown += `**Total Usage Count:** ${usage.count}\n\n`;
    
    if (usage.occurrences.length > 0) {
      markdown += '### Usage Locations:\n\n';
      usage.occurrences.forEach(({ file, count }) => {
        markdown += `- ${file} (${count} occurrences)\n`;
      });
      markdown += '\n';
    } else {
      markdown += '⚠️ This variable is defined but not used in the project.\n\n';
    }
  });
  
  return markdown;
}

function generateJSON(variableUsage) {
  return JSON.stringify(variableUsage, null, 2);
}

function generateHTML(variableUsage) {
  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Environment Variables Usage</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .variable { margin-bottom: 30px; }
        .warning { color: #856404; background-color: #fff3cd; padding: 10px; border-radius: 4px; }
        .locations { margin-left: 20px; }
      </style>
    </head>
    <body>
      <h1>Environment Variables Usage Documentation</h1>
  `;

  Object.entries(variableUsage).forEach(([variable, usage]) => {
    html += `
      <div class="variable">
        <h2>${variable}</h2>
        <p><strong>Description:</strong> ${usage.description}</p>
        <p><strong>Total Usage Count:</strong> ${usage.count}</p>
    `;

    if (usage.occurrences.length > 0) {
      html += '<h3>Usage Locations:</h3><div class="locations">';
      usage.occurrences.forEach(({ file, count }) => {
        html += `<p>• ${file} (${count} occurrences)</p>`;
      });
      html += '</div>';
    } else {
      html += '<p class="warning">⚠️ This variable is defined but not used in the project.</p>';
    }

    html += '</div>';
  });

  html += '</body></html>';
  return html;
}

module.exports = { scanEnvUsage }; 