#!/usr/bin/env node

/**
 * 自动化发布脚本
 *
 * 功能：
 * 1. 更新版本号
 * 2. 更新 CHANGELOG.md
 * 3. Git commit 和 tag
 * 4. 推送到 GitHub 触发自动构建
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function error(message) {
  log(`❌ ${message}`, 'red');
  process.exit(1);
}

function success(message) {
  log(`✅ ${message}`, 'green');
}

function info(message) {
  log(`ℹ️  ${message}`, 'cyan');
}

function warning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// 执行命令
function exec(command, options = {}) {
  try {
    return execSync(command, {
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options
    });
  } catch (err) {
    if (!options.ignoreError) {
      error(`命令执行失败: ${command}\n${err.message}`);
    }
    return null;
  }
}

// 检查 git 状态
function checkGitStatus() {
  info('检查 Git 工作区状态...');

  const status = exec('git status --porcelain', { silent: true });
  if (status && status.trim()) {
    warning('工作区有未提交的更改:');
    console.log(status);

    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      readline.question('是否继续发布? (y/N): ', (answer) => {
        readline.close();
        if (answer.toLowerCase() !== 'y') {
          error('发布已取消');
        }
        resolve();
      });
    });
  }

  success('工作区干净');
}

// 获取当前版本
function getCurrentVersion() {
  const packagePath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  return packageJson.version;
}

// 更新版本号
function updateVersion(newVersion) {
  const packagePath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

  packageJson.version = newVersion;
  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');

  success(`版本号已更新: ${packageJson.version} → ${newVersion}`);
}

// 创建 git tag
function createTag(version) {
  info(`创建 Git tag: v${version}`);

  exec(`git add .`);
  exec(`git commit -m "chore: release v${version}"`);
  exec(`git tag -a v${version} -m "Release v${version}"`);

  success(`Tag v${version} 创建成功`);
}

// 推送到 GitHub
function pushToGitHub() {
  info('推送到 GitHub...');

  exec('git push origin main');
  exec('git push origin --tags');

  success('推送成功！GitHub Actions 将自动构建并发布');
}

// 主流程
async function main() {
  const args = process.argv.slice(2);

  log('\n🚀 MultiTodo 发布脚本\n', 'bright');

  // 获取新版本号
  const currentVersion = getCurrentVersion();
  info(`当前版本: v${currentVersion}`);

  let newVersion = args[0];

  if (!newVersion) {
    // 自动递增补丁版本
    const parts = currentVersion.split('.');
    parts[2] = String(Number(parts[2]) + 1);
    newVersion = parts.join('.');

    info(`未指定版本号，将自动递增到: v${newVersion}`);
  } else {
    // 移除可能的 v 前缀
    newVersion = newVersion.replace(/^v/, '');
  }

  // 验证版本号格式
  if (!/^\d+\.\d+\.\d+$/.test(newVersion)) {
    error('版本号格式错误！请使用 x.y.z 格式');
  }

  log(`\n准备发布版本: ${colors.bright}v${newVersion}${colors.reset}\n`);

  // 检查 git 状态
  await checkGitStatus();

  // 更新版本号
  updateVersion(newVersion);

  // 创建 tag
  createTag(newVersion);

  // 推送到 GitHub
  pushToGitHub();

  log(`\n${colors.green}${colors.bright}🎉 发布成功！${colors.reset}\n`);
  info(`访问 GitHub Actions 查看构建进度:`);
  console.log(`   https://github.com/bulubulu138/MultiTodoApp/actions\n`);
  info(`构建完成后，Release 将自动创建:`);
  console.log(`   https://github.com/bulubulu138/MultiTodoApp/releases/tag/v${newVersion}\n`);
}

// 错误处理
process.on('unhandledRejection', (err) => {
  error(`未处理的错误: ${err.message}`);
});

// 运行
main().catch((err) => {
  error(err.message);
});
