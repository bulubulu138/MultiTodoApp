const Database = require('better-sqlite3');
const path = require('path');
const app = require('electron').app || { getPath: () => process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + '/.config') };

// 获取数据库路径
const userDataPath = process.env.APPDATA || (process.platform === 'darwin'
  ? path.join(process.env.HOME, 'Library', 'Application Support')
  : path.join(process.env.HOME, '.config'));

const dbPath = path.join(userDataPath, 'MultiTodo', 'todo_app.db');

console.log('数据库路径:', dbPath);

try {
  const db = new Database(dbPath, { readonly: true });

  // 查询所有settings
  console.log('\n=== 所有Settings ===');
  const allSettings = db.prepare('SELECT key, value FROM settings').all();
  allSettings.forEach(setting => {
    console.log(`${setting.key} = ${setting.value}`);
  });

  // 专门查询AI相关配置
  console.log('\n=== AI相关配置 ===');
  const aiSettings = db.prepare("SELECT key, value FROM settings WHERE key LIKE 'ai%'").all();
  if (aiSettings.length === 0) {
    console.log('❌ 没有找到AI配置！');
  } else {
    aiSettings.forEach(setting => {
      console.log(`${setting.key} = ${setting.value}`);
    });
  }

  db.close();
} catch (error) {
  console.error('错误:', error.message);
  process.exit(1);
}
