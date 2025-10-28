#!/usr/bin/env node

/**
 * 构建前检查脚本
 * 验证构建环境是否满足要求
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✓ ${message}`, colors.green);
}

function logError(message) {
  log(`✗ ${message}`, colors.red);
}

function logWarning(message) {
  log(`⚠ ${message}`, colors.yellow);
}

function logInfo(message) {
  log(`ℹ ${message}`, colors.blue);
}

/**
 * 检查 Node.js 版本
 */
function checkNodeVersion() {
  const requiredMajor = 16;
  const currentVersion = process.version;
  const major = parseInt(currentVersion.slice(1).split('.')[0]);

  logInfo(`检查 Node.js 版本...`);
  
  if (major >= requiredMajor) {
    logSuccess(`Node.js 版本: ${currentVersion} (要求: >= ${requiredMajor}.x)`);
    return true;
  } else {
    logError(`Node.js 版本过低: ${currentVersion} (要求: >= ${requiredMajor}.x)`);
    return false;
  }
}

/**
 * 检查 npm 版本
 */
function checkNpmVersion() {
  logInfo(`检查 npm 版本...`);
  
  try {
    const npmVersion = execSync('npm --version', { encoding: 'utf-8' }).trim();
    logSuccess(`npm 版本: ${npmVersion}`);
    return true;
  } catch (error) {
    logError(`无法获取 npm 版本`);
    return false;
  }
}

/**
 * 检查必要的构建工具 (仅 Windows)
 */
function checkBuildTools() {
  if (process.platform !== 'win32') {
    return true;
  }

  logInfo(`检查 Windows 构建工具...`);
  
  try {
    // 检查 node-gyp
    execSync('node-gyp --version', { encoding: 'utf-8', stdio: 'pipe' });
    logSuccess(`node-gyp 已安装`);
  } catch (error) {
    logWarning(`node-gyp 未找到，将使用 npm 内置版本`);
  }

  // 检查 Visual Studio Build Tools
  try {
    const vsWhere = 'C:\\Program Files (x86)\\Microsoft Visual Studio\\Installer\\vswhere.exe';
    if (fs.existsSync(vsWhere)) {
      logSuccess(`Visual Studio Build Tools 已安装`);
    } else {
      logWarning(`未检测到 Visual Studio Build Tools`);
      logWarning(`如果构建失败，请安装: https://visualstudio.microsoft.com/zh-hans/downloads/`);
    }
  } catch (error) {
    logWarning(`无法检测 Visual Studio Build Tools`);
  }

  return true;
}

/**
 * 检查 macOS Xcode Command Line Tools
 */
function checkXcode() {
  if (process.platform !== 'darwin') {
    return true;
  }

  logInfo(`检查 Xcode Command Line Tools...`);
  
  try {
    execSync('xcode-select -p', { encoding: 'utf-8', stdio: 'pipe' });
    logSuccess(`Xcode Command Line Tools 已安装`);
    return true;
  } catch (error) {
    logError(`Xcode Command Line Tools 未安装`);
    logError(`请运行: xcode-select --install`);
    return false;
  }
}

/**
 * 检查 node_modules
 */
function checkNodeModules() {
  logInfo(`检查依赖安装...`);
  
  const nodeModulesPath = path.join(__dirname, '..', 'node_modules');
  
  if (!fs.existsSync(nodeModulesPath)) {
    logError(`node_modules 目录不存在`);
    logError(`请先运行: npm install`);
    return false;
  }

  // 检查关键依赖
  const criticalDeps = [
    'electron',
    'better-sqlite3',
    'nodejieba',
    'electron-builder',
    'electron-rebuild'
  ];

  let allInstalled = true;

  for (const dep of criticalDeps) {
    const depPath = path.join(nodeModulesPath, dep);
    if (fs.existsSync(depPath)) {
      logSuccess(`${dep} 已安装`);
    } else {
      logError(`${dep} 未安装`);
      allInstalled = false;
    }
  }

  return allInstalled;
}

/**
 * 检查原生模块编译状态
 */
function checkNativeModules() {
  logInfo(`检查原生模块编译状态...`);
  
  const nodeModulesPath = path.join(__dirname, '..', 'node_modules');
  const nativeModules = [
    { name: 'better-sqlite3', binary: 'better_sqlite3.node' },
    { name: 'nodejieba', binary: 'nodejieba.node' }
  ];

  let allCompiled = true;

  for (const module of nativeModules) {
    const buildPath = path.join(nodeModulesPath, module.name, 'build', 'Release');
    const binaryPath = path.join(buildPath, module.binary);

    if (fs.existsSync(binaryPath)) {
      logSuccess(`${module.name} 已编译`);
    } else {
      logWarning(`${module.name} 未编译或编译失败`);
      logWarning(`将在构建过程中自动重新编译`);
      allCompiled = false;
    }
  }

  return allCompiled;
}

/**
 * 检查 dist 目录
 */
function checkDistDirectory() {
  logInfo(`检查 dist 目录...`);
  
  const distPath = path.join(__dirname, '..', 'dist');
  
  if (fs.existsSync(distPath)) {
    const mainJs = path.join(distPath, 'main', 'main.js');
    const rendererJs = path.join(distPath, 'renderer.js');
    
    if (fs.existsSync(mainJs) && fs.existsSync(rendererJs)) {
      logSuccess(`dist 目录存在且包含构建文件`);
      return true;
    } else {
      logWarning(`dist 目录存在但缺少构建文件`);
      logWarning(`将在构建过程中重新生成`);
      return false;
    }
  } else {
    logWarning(`dist 目录不存在`);
    logWarning(`将在构建过程中生成`);
    return false;
  }
}

/**
 * 主检查流程
 */
async function main() {
  console.log('');
  log('='.repeat(50), colors.bright);
  log('  MultiTodo 构建前环境检查', colors.bright);
  log('='.repeat(50), colors.bright);
  console.log('');

  const checks = [
    { name: 'Node.js 版本', fn: checkNodeVersion, required: true },
    { name: 'npm 版本', fn: checkNpmVersion, required: true },
    { name: '构建工具', fn: checkBuildTools, required: false },
    { name: 'Xcode 工具', fn: checkXcode, required: process.platform === 'darwin' },
    { name: '依赖安装', fn: checkNodeModules, required: true },
    { name: '原生模块', fn: checkNativeModules, required: false },
    { name: 'dist 目录', fn: checkDistDirectory, required: false }
  ];

  let passedCount = 0;
  let failedCount = 0;
  let warningCount = 0;

  for (const check of checks) {
    try {
      const result = check.fn();
      if (result === true) {
        passedCount++;
      } else if (result === false && check.required) {
        failedCount++;
      } else if (result === false && !check.required) {
        warningCount++;
      }
    } catch (error) {
      if (check.required) {
        logError(`检查 ${check.name} 时出错: ${error.message}`);
        failedCount++;
      } else {
        logWarning(`检查 ${check.name} 时出错: ${error.message}`);
        warningCount++;
      }
    }
    console.log('');
  }

  // 总结
  log('='.repeat(50), colors.bright);
  log(`检查完成: ${passedCount} 通过, ${failedCount} 失败, ${warningCount} 警告`, colors.bright);
  log('='.repeat(50), colors.bright);
  console.log('');

  if (failedCount > 0) {
    logError(`存在 ${failedCount} 个必须修复的问题`);
    logError(`请解决上述问题后再进行构建`);
    process.exit(1);
  } else if (warningCount > 0) {
    logWarning(`存在 ${warningCount} 个警告，但可以继续构建`);
    logInfo(`构建过程中将尝试自动修复这些问题`);
  } else {
    logSuccess(`所有检查通过！可以开始构建`);
  }

  console.log('');
}

// 运行检查
main().catch(error => {
  logError(`检查过程出错: ${error.message}`);
  process.exit(1);
});

