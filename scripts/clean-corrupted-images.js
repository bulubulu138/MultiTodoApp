#!/usr/bin/env node

/**
 * 数据清理脚本 - 清理Markdown文件中损坏的图片路径
 * 用法: node scripts/clean-corrupted-images.js
 */

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const STORAGE_PATH = 'D:/multitodo/新建文件夹'; // 根据实际存储路径调整

/**
 * 检查HTML内容中是否包含损坏的图片路径
 */
function hasCorruptedImagePaths(html) {
  const corruptedPatterns = [
    /<img[^>]*src=["']\/\/:0["'][^>]*>/gi,
    /<img[^>]*src=["']\/["'][^>]*>/gi,
    /<img[^>]*src=["']:0["'][^>]*>/gi,
  ];

  for (const pattern of corruptedPatterns) {
    if (pattern.test(html)) {
      return true;
    }
  }
  return false;
}

/**
 * 清理HTML内容中的损坏图片路径
 */
function cleanCorruptedImagePaths(html) {
  let cleanedHtml = html;

  // 移除包含损坏路径的img标签
  cleanedHtml = cleanedHtml.replace(/<img[^>]*src=["']\/\/:0["'][^>]*>/gi, '');
  cleanedHtml = cleanedHtml.replace(/<img[^>]*src=["']\/["'][^>]*>/gi, '');
  cleanedHtml = cleanedHtml.replace(/<img[^>]*src=["']:0["'][^>]*>/gi, '');

  return cleanedHtml;
}

/**
 * 处理单个Markdown文件
 */
function processMarkdownFile(filePath) {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const { data, content } = matter(fileContent);

    // 检查内容部分是否有损坏的图片路径
    if (hasCorruptedImagePaths(content)) {
      console.log(`✅ 发现损坏路径: ${path.basename(filePath)}`);

      // 清理内容
      const cleanedContent = cleanCorruptedImagePaths(content);

      // 重新组装Markdown
      const cleanedMarkdown = matter.stringify(cleanedContent, data);

      // 备份原文件
      const backupPath = filePath + '.backup';
      fs.copyFileSync(filePath, backupPath);
      console.log(`  💾 已备份: ${path.basename(backupPath)}`);

      // 写入清理后的内容
      fs.writeFileSync(filePath, cleanedMarkdown);
      console.log(`  🧹 已清理损坏路径`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`❌ 处理文件失败 ${filePath}:`, error.message);
    return false;
  }
}

/**
 * 主函数
 */
function main() {
  console.log('🚀 开始清理Markdown文件中的损坏图片路径...');
  console.log(`📂 存储路径: ${STORAGE_PATH}`);

  if (!fs.existsSync(STORAGE_PATH)) {
    console.error(`❌ 存储路径不存在: ${STORAGE_PATH}`);
    process.exit(1);
  }

  const files = fs.readdirSync(STORAGE_PATH);
  const mdFiles = files.filter(f => f.endsWith('.md') && !f.startsWith('.'));

  console.log(`📄 找到 ${mdFiles.length} 个Markdown文件`);

  let cleanedCount = 0;
  let processedCount = 0;

  for (const file of mdFiles) {
    const filePath = path.join(STORAGE_PATH, file);
    processedCount++;

    if (processMarkdownFile(filePath)) {
      cleanedCount++;
    }
  }

  console.log('\n📊 清理结果:');
  console.log(`  - 处理文件: ${processedCount}`);
  console.log(`  - 清理文件: ${cleanedCount}`);
  console.log(`  - 正常文件: ${processedCount - cleanedCount}`);

  if (cleanedCount > 0) {
    console.log('\n✅ 清理完成！已为所有修改的文件创建备份。');
    console.log('💡 如果清理结果不满意，可以使用 .backup 文件恢复原内容。');
  } else {
    console.log('\n✅ 没有发现需要清理的文件！');
  }
}

// 运行主函数
main();