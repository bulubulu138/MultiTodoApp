/**
 * 测试脚本：验证 Markdown 文件迁移修复
 *
 * 用途：
 * 1. 验证所有 .md 文件都能被正确识别
 * 2. 修复缺失的 UUID 映射
 * 3. 重建完整的索引
 *
 * 使用方法：
 *   npm run test:repair
 */

const { FileStorageManager } = require('./dist/main/FileStorageManager');

async function testRepair() {
  console.log('='.repeat(60));
  console.log('🔧 Markdown 迁移修复测试');
  console.log('='.repeat(60));

  const fileStorageManager = new FileStorageManager();

  try {
    // 等待初始化完成
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('\n📊 运行数据完整性验证...\n');
    const integrity = await fileStorageManager.verifyDataIntegrity();
    console.log('完整性检查结果:', integrity);

    if (!integrity.isValid) {
      console.log('\n❌ 发现问题:', integrity.issues);
      console.log('\n🔧 尝试修复...\n');
    }

    // 重建所有元数据
    console.log('='.repeat(60));
    console.log('🛠️ 开始重建所有元数据');
    console.log('='.repeat(60));
    const rebuildResult = await fileStorageManager.rebuildAllMetadata();
    console.log('\n重建结果:', rebuildResult);

    if (!rebuildResult.success) {
      console.log('\n❌ 重建失败:', rebuildResult.errors);
      return;
    }

    console.log(`\n✅ 成功修复 ${rebuildResult.mappingsRepaired} 个映射\n`);

    // 获取所有待办
    console.log('='.repeat(60));
    console.log('📋 获取所有待办事项');
    console.log('='.repeat(60));
    const todos = await fileStorageManager.getAllTodos();

    console.log(`\n✅ 成功加载 ${todos.length} 个待办:\n`);

    todos.forEach((todo, index) => {
      console.log(`${index + 1}. ${todo.title}`);
      console.log(`   ID: ${todo.id}`);
      console.log(`   状态: ${todo.status}`);
      console.log(`   优先级: ${todo.priority}`);
      console.log('');
    });

    // 最终验证
    console.log('='.repeat(60));
    console.log('🔍 最终验证');
    console.log('='.repeat(60));
    const finalIntegrity = await fileStorageManager.verifyDataIntegrity();
    console.log('\n最终完整性检查:', finalIntegrity);

    if (finalIntegrity.isValid) {
      console.log('\n🎉 所有测试通过！数据迁移修复成功！');
    } else {
      console.log('\n⚠️ 仍有问题:', finalIntegrity.issues);
    }

  } catch (error) {
    console.error('\n❌ 测试失败:', error);
  }
}

// 运行测试
testRepair().then(() => {
  console.log('\n测试完成');
  process.exit(0);
}).catch(error => {
  console.error('测试异常:', error);
  process.exit(1);
});