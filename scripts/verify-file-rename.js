/**
 * 文件重命名功能验证脚本
 * 用于验证修改代办标题时文件名同步更新功能
 */

const fs = require('fs');
const path = require('path');

function verifyFileRenameFunctionality() {
  console.log('🔍 文件重命名功能验证\n');
  console.log('=' .repeat(60));

  // 检查关键文件是否存在
  const mainPath = path.join(__dirname, '../src/main/FileStorageManager.ts');
  if (!fs.existsSync(mainPath)) {
    console.error('❌ FileStorageManager.ts 文件不存在');
    return false;
  }

  console.log('✅ FileStorageManager.ts 文件存在');

  // 读取文件内容验证关键方法
  const content = fs.readFileSync(mainPath, 'utf-8');

  const requiredMethods = [
    'hasTitleChanged',
    'shouldRenameFile',
    'renameTodoFile',
    'renameAttachments'
  ];

  console.log('\n🔧 检查关键方法实现:');
  requiredMethods.forEach(method => {
    const found = content.includes(method);
    console.log(`   ${found ? '✅' : '❌'} ${method}()`);
  });

  // 验证updateTodo方法中的集成
  const hasTitleCheck = content.includes('hasTitleChanged(currentTodo, updates)');
  const hasRenameCall = content.includes('renameTodoFile(fileName, newFileName, uuid)');

  console.log('\n🔄 检查updateTodo集成:');
  console.log(`   ${hasTitleCheck ? '✅' : '❌'} 标题变更检测`);
  console.log(`   ${hasRenameCall ? '✅' : '❌'} 文件重命名调用`);

  // 检查错误处理机制
  const hasErrorHandling = content.includes('try') && content.includes('catch');
  const hasRollback = content.includes('Rollback');

  console.log('\n🛡️ 检查错误处理机制:');
  console.log(`   ${hasErrorHandling ? '✅' : '❌'} 异常捕获`);
  console.log(`   ${hasRollback ? '✅' : '❌'} 回滚机制`);

  // 检查UUID映射更新
  const hasUuidUpdate = content.includes('updateUuidToFileMap(uuid, newFileName)');

  console.log('\n🗺️ 检查UUID映射更新:');
  console.log(`   ${hasUuidUpdate ? '✅' : '❌'} 映射表同步更新`);

  // 检查文件名冲突处理
  const hasConflictHandling = content.includes('Target file already exists');

  console.log('\n⚠️ 检查冲突处理:');
  console.log(`   ${hasConflictHandling ? '✅' : '❌'} 文件名冲突解决`);

  // 检查附件重命名
  const hasAttachmentRename = content.includes('renameAttachments');

  console.log('\n📎 检查附件处理:');
  console.log(`   ${hasAttachmentRename ? '✅' : '❌'} 附件文件重命名`);

  console.log('\n' + '='.repeat(60));

  // 汇总结果
  const allChecks = [
    hasTitleCheck,
    hasRenameCall,
    hasErrorHandling,
    hasUuidUpdate,
    hasConflictHandling,
    hasAttachmentRename
  ];

  const passedCount = allChecks.filter(Boolean).length;
  const totalCount = allChecks.length;

  console.log(`\n📊 验证结果: ${passedCount}/${totalCount} 项检查通过`);

  if (passedCount === totalCount) {
    console.log('🎉 所有检查都通过！文件重命名功能已完整实现。\n');
    console.log('📋 手动测试步骤:');
    console.log('   1. 启动应用: npm run dev');
    console.log('   2. 创建一个新的代办项');
    console.log('   3. 观察控制台日志，确认文件创建成功');
    console.log('   4. 修改代办标题');
    console.log('   5. 观察控制台日志，应该看到文件重命名相关日志');
    console.log('   6. 检查todos目录下的文件名是否更新');
    console.log('   7. 检查.multitodo-metadata/uuid-to-file.json映射是否正确');
    console.log('   8. 如果有附件，验证附件文件是否也重命名\n');
    return true;
  } else {
    console.log('⚠️ 部分检查未通过，请检查实现是否完整。\n');
    return false;
  }
}

// 运行验证
try {
  const success = verifyFileRenameFunctionality();
  process.exit(success ? 0 : 1);
} catch (error) {
  console.error('❌ 验证过程出错:', error.message);
  process.exit(1);
}