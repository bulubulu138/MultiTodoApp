const fs = require('fs');
const path = require('path');

// 获取应用数据路径
const userDataPath = process.env.APPDATA || (process.platform === 'darwin'
  ? path.join(process.env.HOME, 'Library', 'Application Support')
  : path.join(process.env.HOME, '.config'));

// 检查设置文件
const settingsPath = path.join(userDataPath, 'Electron', 'settings.json');
console.log('设置文件路径:', settingsPath);

// 检查应用配置文件
const appConfigPath = path.join(userDataPath, 'Electron', 'app-config.json');
console.log('应用配置文件路径:', appConfigPath);

try {
  // 检查设置文件
  if (fs.existsSync(settingsPath)) {
    const settingsData = fs.readFileSync(settingsPath, 'utf-8');
    const settings = JSON.parse(settingsData);

    console.log('\n=== 当前设置 ===');
    Object.entries(settings).forEach(([key, value]) => {
      console.log(`${key} = ${JSON.stringify(value)}`);
    });
  } else {
    console.log('❌ 设置文件不存在，应用可能还未运行过');
  }

  // 检查应用配置
  if (fs.existsSync(appConfigPath)) {
    const appConfigData = fs.readFileSync(appConfigPath, 'utf-8');
    const appConfig = JSON.parse(appConfigData);

    console.log('\n=== 应用配置 ===');
    console.log(`首次运行: ${appConfig.firstRun ? '是' : '否'}`);
    console.log(`存储位置类型: ${appConfig.storageLocation?.type || 'default'}`);
    console.log(`自定义路径: ${appConfig.storageLocation?.customPath || '未设置'}`);
  }

  console.log('\n✅ 使用 Markdown 文件存储，无需数据库配置检查');

} catch (error) {
  console.error('❌ 读取配置文件时出错:', error.message);
  process.exit(1);
}