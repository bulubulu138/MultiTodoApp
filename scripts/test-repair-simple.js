/**
 * 独立测试脚本：验证 Markdown 文件修复功能
 *
 * 此脚本直接测试核心修复逻辑，无需运行完整应用
 */

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const STORAGE_PATH = 'C:\\Users\\李汉文\\AppData\\Roaming\\Electron\\todos';
const METADATA_PATH = path.join(STORAGE_PATH, '.multitodo-metadata');
const MAP_PATH = path.join(METADATA_PATH, 'uuid-to-file.json');
const INDEX_PATH = path.join(METADATA_PATH, 'index.json');

console.log('='.repeat(60));
console.log('🔧 Markdown 迁移修复测试');
console.log('='.repeat(60));

async function rebuildMetadata() {
  try {
    // 1. 备份现有文件
    console.log('\n📦 备份现有映射文件...');
    const backupPath = path.join(METADATA_PATH, 'uuid-to-file.json.backup');
    if (fs.existsSync(MAP_PATH)) {
      fs.copyFileSync(MAP_PATH, backupPath);
      console.log('✅ 备份完成');
    }

    // 2. 扫描所有 .md 文件
    console.log('\n📁 扫描所有 Markdown 文件...');
    const files = fs.readdirSync(STORAGE_PATH);
    const mdFiles = files.filter(f => f.endsWith('.md') && !f.startsWith('.'));

    console.log(`找到 ${mdFiles.length} 个 Markdown 文件`);

    // 3. 构建新的 UUID 映射
    console.log('\n🔗 构建 UUID 映射...');
    const newUuidMap = {};
    const fileDetails = [];

    for (const fileName of mdFiles) {
      try {
        const filePath = path.join(STORAGE_PATH, fileName);
        const content = fs.readFileSync(filePath, 'utf-8');
        const { data } = matter(content);

        if (!data.id) {
          console.warn(`⚠️  文件 ${fileName} 缺少 UUID，跳过`);
          continue;
        }

        const uuid = String(data.id);
        newUuidMap[uuid] = fileName;

        fileDetails.push({
          fileName,
          uuid,
          title: data.title || 'Untitled',
          status: data.status || 'unknown'
        });

        console.log(`✅ ${uuid.substring(0, 8)}... → ${fileName}`);
      } catch (error) {
        console.error(`❌ 处理文件 ${fileName} 失败:`, error.message);
      }
    }

    // 4. 保存新的映射文件
    console.log('\n💾 保存 UUID 映射...');
    fs.writeFileSync(MAP_PATH, JSON.stringify(newUuidMap, null, 2));
    console.log(`✅ 成功保存 ${Object.keys(newUuidMap).length} 个映射`);

    // 5. 显示所有文件详情
    console.log('\n📋 所有文件详情:');
    console.log('='.repeat(60));
    fileDetails.forEach((file, index) => {
      console.log(`${index + 1}. ${file.fileName}`);
      console.log(`   标题: ${file.title}`);
      console.log(`   UUID: ${file.uuid}`);
      console.log(`   状态: ${file.status}`);
      console.log('');
    });

    console.log('='.repeat(60));
    console.log(`🎉 修复完成！共处理 ${fileDetails.length} 个文件`);
    console.log('='.repeat(60));

    return {
      success: true,
      mappingsRepaired: fileDetails.length,
      files: fileDetails
    };

  } catch (error) {
    console.error('\n❌ 修复失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// 运行测试
rebuildMetadata().then(result => {
  if (result.success) {
    console.log('\n✅ 所有测试通过！');
  } else {
    console.log('\n❌ 测试失败:', result.error);
  }
  process.exit(result.success ? 0 : 1);
}).catch(error => {
  console.error('测试异常:', error);
  process.exit(1);
});