#!/usr/bin/env node

const { program } = require('commander');
const { scanEnvUsage } = require('../src/index');
const chalk = require('chalk');

program
  .version('2.0.0')
  .option('-e, --env <path>', 'custom .env file path')
  .option('-o, --output <type>', 'output format (md/json/html)', 'md')
  .option('-i, --ignore <patterns>', 'additional ignore patterns (comma-separated)')
  .parse(process.argv);

const options = program.opts();

scanEnvUsage(options)
  .then(() => {
    console.log(chalk.green('✨ Environment variables documentation generated successfully!'));
  })
  .catch((error) => {
    console.error(chalk.red('Error:'), error.message);
    process.exit(1);
  }); 