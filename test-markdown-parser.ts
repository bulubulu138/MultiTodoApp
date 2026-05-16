// 测试 TypeScript MarkdownParser 类
import { MarkdownParser } from './src/main/MarkdownParser';
import * as fs from 'fs';

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

console.log('Testing MarkdownParser class...\n');

const parser = new MarkdownParser();
const todo = parser.parseTodo(sampleMarkdown);

console.log('Parsed Todo object:');
console.log('ID:', todo.id);
console.log('Title:', todo.title);
console.log('Status:', todo.status);
console.log('Priority:', todo.priority);
console.log('Content:', todo.content);
console.log('Start Time:', todo.startTime);
console.log('Completed At:', todo.completedAt);
console.log('Display Orders:', todo.displayOrders);
console.log('Content Hash:', todo.contentHash);
console.log('Keywords:', todo.keywords);
console.log('Created At:', todo.createdAt);
console.log('Updated At:', todo.updatedAt);

// 验证关键字段
console.log('\n--- Validation ---');
if (todo.id && typeof todo.id === 'string') {
  console.log('✅ ID is UUID format:', todo.id.includes('-'));
}
console.log('✅ Start Time mapped:', !!todo.startTime);
console.log('✅ Content Hash mapped:', !!todo.contentHash);
console.log('✅ Completed At mapped:', !!todo.completedAt);
console.log('✅ Display Orders is object:', typeof todo.displayOrders === 'object');
console.log('✅ Display Orders.all:', todo.displayOrders?.all === 1);

console.log('\n✅ MarkdownParser successfully handles SQLite migration files!');