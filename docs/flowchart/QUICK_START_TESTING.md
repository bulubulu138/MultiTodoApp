# Quick Start: Testing Tasks 12-14

## 🚀 Start the Application
```bash
cd MultiTodoApp
npm start
```

## 📋 Quick Test Checklist

### 1. Test Sharing (Task 12) - 2 minutes
1. Open the app and click "流程图" button
2. Create a flowchart with 3-5 nodes
3. Click "分享" button → "生成分享链接"
4. ✅ Check: Message shows "分享链接已复制到剪贴板"
5. Paste the link somewhere to verify it's in clipboard
6. Click "分享" → "导出为图片"
7. ✅ Check: PNG file downloads

### 2. Test Performance Monitoring (Task 13) - 1 minute
1. Open browser DevTools (F12)
2. Go to Console tab
3. Create a flowchart with 10+ nodes
4. Type: `PerformanceMonitor.getReport()`
5. ✅ Check: See performance metrics displayed

### 3. Test Error Handling (Task 13) - 1 minute
1. Try to export before creating any nodes
2. ✅ Check: Friendly error message appears
3. Create 100+ nodes (if possible)
4. ✅ Check: Warning about large flowchart in console

### 4. Test Large Flowchart Warning - 30 seconds
1. Create a flowchart with many nodes
2. Check console for warnings
3. ✅ Check: Performance suggestions appear

## 🎯 Expected Results

### Sharing Works
- ✅ Link copied to clipboard
- ✅ PNG export downloads
- ✅ No errors in console

### Performance Monitoring Works
- ✅ `PerformanceMonitor.getReport()` shows data
- ✅ Warnings for large flowcharts
- ✅ Performance suggestions logged

### Error Handling Works
- ✅ Friendly error messages (not technical)
- ✅ App doesn't crash
- ✅ Can recover from errors

## 🐛 If Something Doesn't Work

1. Check browser console for errors
2. Check if pako is installed: `npm list pako`
3. Rebuild: `npm run build`
4. Clear cache and restart

## 📊 Performance Benchmarks

Run in console after using the app:
```javascript
PerformanceMonitor.getReport()
```

Expected metrics:
- Save: < 500ms
- Export: < 2000ms
- Layout: < 1500ms

## ✅ All Tests Pass?

If all tests pass, tasks 12-14 are complete! 🎉

## 📝 Report Issues

If you find any issues, please note:
- What you were doing
- Error message (if any)
- Browser console output
- Steps to reproduce
