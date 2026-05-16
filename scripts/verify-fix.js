/**
 * 最终验证脚本
 *
 * 验证所有修复是否成功应用
 */

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const STORAGE_PATH = 'C:\\Users\\李汉文\\AppData\\Roaming\\Electron\\todos';
const METADATA_PATH = path.join(STORAGE_PATH, '.multitodo-metadata');
const MAP_PATH = path.join(METADATA_PATH, 'uuid-to-file.json');
const INDEX_PATH = path.join(METADATA_PATH, 'index.json');

console.log('='.repeat(70));
console.log('📊 最终验证：Markdown 迁移兼容性修复');
console.log('='.repeat(70));

function verifyMapping() {
  console.log('\n1️⃣ 验证 UUID 映射文件\n');

  if (!fs.existsSync(MAP_PATH)) {
    console.log('❌ UUID 映射文件不存在');
    return false;
  }

  const mapContent = fs.readFileSync(MAP_PATH, 'utf-8');
  const uuidMap = JSON.parse(mapContent);
  const mappingCount = Object.keys(uuidMap).length;

  console.log(`✅ UUID 映射文件存在`);
  console.log(`📊 映射条目数量: ${mappingCount}`);

  // 扫描实际文件数量
  const files = fs.readdirSync(STORAGE_PATH);
  const mdFileCount = files.filter(f => f.endsWith('.md') && !f.startsWith('.')).length;

  console.log(`📄 Markdown 文件数量: ${mdFileCount}`);

  if (mappingCount === mdFileCount) {
    console.log('✅ 映射完整（所有文件都有映射）');
    return true;
  } else {
    console.log(`⚠️  映射不完整：${mappingCount}/${mdFileCount}`);
    return false;
  }
}

function verifyIndex() {
  console.log('\n2️⃣ 验证索引文件\n');

  if (!fs.existsSync(INDEX_PATH)) {
    console.log('❌ 索引文件不存在');
    return false;
  }

  const indexContent = fs.readFileSync(INDEX_PATH, 'utf-8');
  const index = JSON.parse(indexContent);

  console.log(`✅ 索引文件存在`);
  console.log(`📊 索引版本: ${index.metadata.version}`);
  console.log(`📊 索引中的待办数量: ${index.metadata.todoCount}`);

  const mappingCount = Object.keys(JSON.parse(fs.readFileSync(MAP_PATH, 'utf-8'))).length;

  if (index.metadata.todoCount === mappingCount) {
    console.log('✅ 索引数量与映射数量一致');
    return true;
  } else {
    console.log(`⚠️  索引数量不匹配：${index.metadata.todoCount} vs ${mappingCount}`);
    return false;
  }
}

function verifyAllFiles() {
  console.log('\n3️⃣ 验证所有文件格式\n');

  const files = fs.readdirSync(STORAGE_PATH);
  const mdFiles = files.filter(f => f.endsWith('.md') && !f.startsWith('.'));

  let validCount = 0;
  let invalidFiles = [];

  for (const fileName of mdFiles) {
    try {
      const filePath = path.join(STORAGE_PATH, fileName);
      const content = fs.readFileSync(filePath, 'utf-8');
      const { data } = matter(content);

      // 验证必需字段
      const requiredFields = ['id', 'title', 'status', 'priority'];
      const missingFields = requiredFields.filter(field => !data[field]);

      if (missingFields.length > 0) {
        invalidFiles.push({
          fileName,
          reason: `缺失字段: ${missingFields.join(', ')}`
        });
      } else {
        validCount++;
      }
    } catch (error) {
      invalidFiles.push({
        fileName,
        reason: `解析失败: ${error.message}`
      });
    }
  }

  console.log(`📄 总文件数: ${mdFiles.length}`);
  console.log(`✅ 有效文件数: ${validCount}`);
  console.log(`❌ 无效文件数: ${invalidFiles.length}`);

  if (invalidFiles.length > 0) {
    console.log('\n❌ 无效文件列表:');
    invalidFiles.forEach(file => {
      console.log(`   - ${file.fileName}: ${file.reason}`);
    });
  }

  return invalidFiles.length === 0;
}

function showFileList() {
  console.log('\n4️⃣ 显示所有已识别文件\n');

  const mapContent = fs.readFileSync(MAP_PATH, 'utf-8');
  const uuidMap = JSON.parse(mapContent);

  const files = fs.readdirSync(STORAGE_PATH);
  const mdFiles = files.filter(f => f.endsWith('.md') && !f.startsWith('.'));

  console.log('📋 所有文件列表:');
  console.log('='.repeat(70));

  mdFiles.forEach((fileName, index) => {
    try {
      const filePath = path.join(STORAGE_PATH, fileName);
      const content = fs.readFileSync(filePath, 'utf-8');
      const { data } = matter(content);

      const statusIcon = {
        'pending': '⏳',
        'in_progress': '🔄',
        'completed': '✅',
        'paused': '⏸️'
      }[data.status] || '❓';

      console.log(`${index + 1}. ${statusIcon} ${data.title}`);
      console.log(`    文件: ${fileName}`);
      console.log(`    UUID: ${data.id}`);
      console.log('');
    } catch (error) {
      console.log(`${index + 1}. ❌ ${fileName} - 解析失败`);
      console.log('');
    }
  });
}

// 运行所有验证
console.log('\n🔍 开始验证...\n');

const results = {
  mapping: verifyMapping(),
  index: verifyIndex(),
  files: verifyAllFiles()
};

showFileList();

console.log('='.repeat(70));
console.log('📊 验证结果总结');
console.log('='.repeat(70));

console.log(`\n1. UUID 映射: ${results.mapping ? '✅ 通过' : '❌ 失败'}`);
console.log(`2. 索引文件: ${results.index ? '✅ 通过' : '❌ 失败'}`);
console.log(`3. 文件格式: ${results.files ? '✅ 通过' : '❌ 失败'}`);

const allPassed = results.mapping && results.index && results.files;

if (allPassed) {
  console.log('\n🎉 所有验证通过！修复成功！');
} else {
  console.log('\n⚠️  部分验证失败，请检查上述问题');
}

console.log('\n' + '='.repeat(70));

process.exit(allPassed ? 0 : 1);