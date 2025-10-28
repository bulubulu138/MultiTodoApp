#!/usr/bin/env node

/**
 * 原生模块验证脚本
 * 验证 better-sqlite3 和 nodejieba 是否正确加载
 */

const path = require('path');

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

function logInfo(message) {
  log(`ℹ ${message}`, colors.blue);
}

/**
 * 验证 better-sqlite3
 */
async function verifyBetterSqlite3() {
  logInfo('验证 better-sqlite3...');
  
  try {
    const Database = require('better-sqlite3');
    
    // 创建内存数据库测试
    const db = new Database(':memory:');
    
    // 创建测试表
    db.exec(`
      CREATE TABLE test (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL
      )
    `);
    
    // 插入测试数据
    const insert = db.prepare('INSERT INTO test (name) VALUES (?)');
    insert.run('test1');
    insert.run('test2');
    
    // 查询测试数据
    const rows = db.prepare('SELECT * FROM test').all();
    
    if (rows.length === 2) {
      logSuccess(`better-sqlite3 加载成功，功能正常`);
      logInfo(`  - 数据库创建: ✓`);
      logInfo(`  - 表操作: ✓`);
      logInfo(`  - 数据插入: ✓`);
      logInfo(`  - 数据查询: ✓ (${rows.length} 条记录)`);
      
      db.close();
      return true;
    } else {
      logError(`better-sqlite3 功能异常: 预期2条记录，实际${rows.length}条`);
      db.close();
      return false;
    }
  } catch (error) {
    logError(`better-sqlite3 验证失败: ${error.message}`);
    logError(`错误详情: ${error.stack}`);
    return false;
  }
}

/**
 * 验证 nodejieba
 */
async function verifyNodeJieba() {
  logInfo('验证 nodejieba...');
  
  try {
    const nodejieba = require('nodejieba');
    
    // 测试分词
    const testText = '我来到北京清华大学学习自然语言处理';
    const words = nodejieba.cut(testText);
    
    if (words && words.length > 0) {
      logSuccess(`nodejieba 加载成功，功能正常`);
      logInfo(`  - 分词功能: ✓`);
      logInfo(`  - 测试文本: "${testText}"`);
      logInfo(`  - 分词结果: [${words.join(', ')}]`);
      logInfo(`  - 词数: ${words.length}`);
      
      // 测试关键词提取
      const keywords = nodejieba.extract(testText, 5);
      if (keywords && keywords.length > 0) {
        logInfo(`  - 关键词提取: ✓`);
        logInfo(`  - 关键词: [${keywords.map(k => k.word).join(', ')}]`);
      }
      
      return true;
    } else {
      logError(`nodejieba 功能异常: 分词结果为空`);
      return false;
    }
  } catch (error) {
    logError(`nodejieba 验证失败: ${error.message}`);
    logError(`错误详情: ${error.stack}`);
    
    // 提供详细的错误诊断
    if (error.message.includes('MODULE_NOT_FOUND')) {
      logError(`模块未找到，可能需要重新安装`);
      logInfo(`尝试运行: npm run rebuild`);
    } else if (error.message.includes('找不到指定的模块')) {
      logError(`原生模块编译失败或不匹配`);
      logInfo(`尝试运行: npm run rebuild`);
    }
    
    return false;
  }
}

/**
 * 获取模块信息
 */
function getModuleInfo() {
  logInfo('获取模块信息...');
  
  try {
    const pkg = require('../package.json');
    const betterSqlite3Version = pkg.dependencies['better-sqlite3'];
    const nodejiebaVersion = pkg.dependencies['nodejieba'];
    const electronVersion = pkg.devDependencies['electron'];
    
    logInfo(`当前配置:`);
    logInfo(`  - Electron: ${electronVersion}`);
    logInfo(`  - better-sqlite3: ${betterSqlite3Version}`);
    logInfo(`  - nodejieba: ${nodejiebaVersion}`);
    logInfo(`  - Node.js: ${process.version}`);
    logInfo(`  - 平台: ${process.platform}-${process.arch}`);
  } catch (error) {
    logError(`无法获取模块信息: ${error.message}`);
  }
}

/**
 * 检查原生模块二进制文件
 */
function checkBinaryFiles() {
  logInfo('检查原生模块二进制文件...');
  
  const fs = require('fs');
  const nodeModulesPath = path.join(__dirname, '..', 'node_modules');
  
  const modules = [
    {
      name: 'better-sqlite3',
      binary: 'better_sqlite3.node',
      path: path.join(nodeModulesPath, 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node')
    },
    {
      name: 'nodejieba',
      binary: 'nodejieba.node',
      path: path.join(nodeModulesPath, 'nodejieba', 'build', 'Release', 'nodejieba.node')
    }
  ];
  
  for (const module of modules) {
    if (fs.existsSync(module.path)) {
      const stats = fs.statSync(module.path);
      const sizeInMB = (stats.size / 1024 / 1024).toFixed(2);
      logSuccess(`${module.name} 二进制文件存在`);
      logInfo(`  - 路径: ${module.path}`);
      logInfo(`  - 大小: ${sizeInMB} MB`);
      logInfo(`  - 修改时间: ${stats.mtime.toLocaleString()}`);
    } else {
      logError(`${module.name} 二进制文件不存在`);
      logError(`  - 预期路径: ${module.path}`);
      logInfo(`请运行: npm run rebuild`);
    }
  }
}

/**
 * 主验证流程
 */
async function main() {
  console.log('');
  log('='.repeat(60), colors.bright);
  log('  MultiTodo 原生模块验证', colors.bright);
  log('='.repeat(60), colors.bright);
  console.log('');

  // 获取模块信息
  getModuleInfo();
  console.log('');

  // 检查二进制文件
  checkBinaryFiles();
  console.log('');

  // 验证模块
  const results = [];
  
  results.push({
    name: 'better-sqlite3',
    passed: await verifyBetterSqlite3()
  });
  console.log('');
  
  results.push({
    name: 'nodejieba',
    passed: await verifyNodeJieba()
  });
  console.log('');

  // 总结
  log('='.repeat(60), colors.bright);
  
  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  
  if (passedCount === totalCount) {
    logSuccess(`所有原生模块验证通过！(${passedCount}/${totalCount})`);
    log('='.repeat(60), colors.bright);
    console.log('');
    logInfo('✓ 可以安全使用关键词提取和数据库功能');
    logInfo('✓ 可以进行打包构建');
  } else {
    logError(`部分模块验证失败 (${passedCount}/${totalCount})`);
    log('='.repeat(60), colors.bright);
    console.log('');
    logError('请按照上述提示修复问题后重试');
    logInfo('常见解决方法:');
    logInfo('  1. 运行: npm run rebuild');
    logInfo('  2. 删除 node_modules 后重新安装: rm -rf node_modules && npm install');
    logInfo('  3. 确保安装了必要的构建工具');
    
    process.exit(1);
  }

  console.log('');
}

// 运行验证
main().catch(error => {
  logError(`验证过程出错: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});

