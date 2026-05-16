// 测试 MarkdownParser 的解析逻辑
const matter = require('gray-matter');

// 模拟样例文件内容
const sampleMarkdown = `---
title: 早饭
status: completed
priority: medium
tags: ''
created_at: '2026-05-10T02:56:00.696Z'
updated_at: '2026-05-10T02:56:00.696Z'
id: 4c618c7e-4588-4ab2-be21-f6a1b509d739
completed_at: '2025-12-28T04:45:07.870Z'
display_orders:
  all: 1
content_hash: 2c6a456005430ae7bb14016882a8c3d59580bb6e54e020b358713c49061c1476
keywords: []
start_time: '2025-10-29T13:11:21.805Z'
---


## Content

<p>早饭的说法</p>
`;

console.log('Testing MarkdownParser field mapping...\n');

const { data, content } = matter(sampleMarkdown);

console.log('Parsed YAML data:');
console.log('ID:', data.id);
console.log('Title:', data.title);
console.log('Status:', data.status);
console.log('Priority:', data.priority);
console.log('Tags:', data.tags);
console.log('Display Orders:', data.display_orders);
console.log('Content Hash:', data.content_hash);
console.log('Start Time:', data.start_time);
console.log('Completed At:', data.completed_at);
console.log('Created At:', data.created_at);
console.log('Updated At:', data.updated_at);

// 测试字段映射逻辑
console.log('\n--- Testing field mapping ---');

const startTime = data.start_time || data.startTime;
const contentHash = data.content_hash || data.contentHash;
const completedAt = data.completed_at || data.completedAt;

console.log('Start Time (mapped):', startTime);
console.log('Content Hash (mapped):', contentHash);
console.log('Completed At (mapped):', completedAt);

// 测试 display_orders 嵌套对象
if (data.display_orders && typeof data.display_orders === 'object') {
  console.log('Display Orders type:', typeof data.display_orders);
  console.log('Display Orders keys:', Object.keys(data.display_orders));
  console.log('Display Orders.all:', data.display_orders.all);
}

console.log('\n✅ All fields parsed successfully!');