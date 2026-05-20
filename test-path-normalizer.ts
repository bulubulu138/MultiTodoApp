/**
 * 路径标准化工具测试
 */

import {
  normalizeFileProtocolPath,
  isValidFileProtocolPath,
  repairCorruptedPath,
  normalizeImagePath
} from './src/main/utils/pathNormalizer';

console.log('=== 路径标准化工具测试 ===\n');

// 测试用例 1: 标准的 Windows file:// 路径
const testCase1 = 'file://D:/multitodo/新建文件夹/12312312312312_content_1.png';
console.log('测试用例 1: 标准的 Windows file:// 路径');
console.log('输入:', testCase1);
const result1 = normalizeFileProtocolPath(testCase1);
console.log('输出:', result1);
console.log('验证:', result1 === testCase1 ? '✅ 通过' : '❌ 失败');
console.log('');

// 测试用例 2: 带额外斜杠的 Windows file:/// 路径
const testCase2 = 'file:///D:/multitodo/新建文件夹/12312312312312_content_1.png';
console.log('测试用例 2: 带额外斜杠的 Windows file:/// 路径');
console.log('输入:', testCase2);
const result2 = normalizeFileProtocolPath(testCase2);
console.log('输出:', result2);
console.log('验证:', result2 === 'file://D:/multitodo/新建文件夹/12312312312312_content_1.png' ? '✅ 通过' : '❌ 失败');
console.log('');

// 测试用例 3: 损坏的路径 //:0
const testCase3 = '//:0';
console.log('测试用例 3: 损坏的路径 //:0');
console.log('输入:', testCase3);
const isValid3 = isValidFileProtocolPath(testCase3);
console.log('有效性检查:', isValid3 ? '❌ 错误 - 应该无效' : '✅ 正确 - 被判断为无效');
console.log('');

// 测试用例 3.1: 损坏路径 //
const testCase31 = '//';
console.log('测试用例 3.1: 损坏路径 //');
console.log('输入:', testCase31);
const isValid31 = isValidFileProtocolPath(testCase31);
console.log('有效性检查:', isValid31 ? '❌ 错误 - 应该无效' : '✅ 正确 - 被判断为无效');
console.log('');

// 测试用例 4: 相对路径转换
const testCase4 = './12312312312312_content_1.png';
console.log('测试用例 4: 相对路径转换');
console.log('输入:', testCase4);
const result4 = normalizeImagePath(testCase4, 'D:/multitodo/新建文件夹');
console.log('输出:', result4);
console.log('预期:', 'file://D:/multitodo/新建文件夹/12312312312312_content_1.png');
console.log('验证:', result4 === 'file://D:/multitodo/新建文件夹/12312312312312_content_1.png' ? '✅ 通过' : '❌ 失败');
console.log('');

// 测试用例 5: http:// 协议路径（应该保持不变）
const testCase5 = 'http://example.com/image.png';
console.log('测试用例 5: http:// 协议路径');
console.log('输入:', testCase5);
const result5 = normalizeImagePath(testCase5);
console.log('输出:', result5);
console.log('验证:', result5 === testCase5 ? '✅ 通过' : '❌ 失败');
console.log('');

// 测试用例 6: 修复损坏的 file:/// 路径
const testCase6 = 'file:///D:/test/image.png';
console.log('测试用例 6: 修复损坏的 file:/// 路径');
console.log('输入:', testCase6);
const result6 = repairCorruptedPath(testCase6);
console.log('输出:', result6);
console.log('预期:', 'file://D:/test/image.png');
console.log('验证:', result6 === 'file://D:/test/image.png' ? '✅ 通过' : '❌ 失败');
console.log('');

console.log('=== 测试完成 ===\n');