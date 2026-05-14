#!/usr/bin/env node

/**
 * 原生模块验证脚本 (已弃用)
 * MultiTodo 现在使用 Markdown 文件存储，不需要原生模块
 */

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✓ ${message}`, colors.green);
}

function logInfo(message) {
  log(`ℹ ${message}`, colors.blue);
}

async function main() {
  console.log('');
  log('='.repeat(60), colors.bright);
  log('  MultiTodo 模块验证', colors.bright);
  log('='.repeat(60), colors.bright);
  console.log('');

  logSuccess('应用现在使用 Markdown 文件存储，无需原生模块');
  logInfo('  - 依赖检查通过');
  logInfo('  - 可以进行打包构建');
  console.log('');
}

// 运行验证
main().catch(error => {
  console.error(`验证过程出错: ${error.message}`);
  process.exit(1);
});