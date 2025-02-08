#!/usr/bin/env node

const { program } = require('commander');
const fs = require('fs').promises;
const path = require('path');
const dotenv = require('dotenv');
const glob = require('glob');

// ... (rest of your current index.js code) ...

// Export for programmatic usage
module.exports = {
  generateDocs
};

// Only run CLI if called directly
if (require.main === module) {
  generateDocs().catch(console.error);
} 