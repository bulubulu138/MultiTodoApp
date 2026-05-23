# Image Auto-Removal Fix - Test Scenarios

## Overview
This document outlines test scenarios to validate the fix for the image auto-removal bug.

## Pre-Test Setup
1. Backup existing todo data
2. Clear application cache
3. Enable detailed logging (set `NODE_ENV=development`)

## Test Scenarios

### Scenario 1: Base64 Image Insertion and Persistence
**Steps:**
1. Create a new todo
2. Insert a base64 encoded image
3. Save the todo
4. Wait for file watcher to process (2-3 seconds)
5. Refresh the application or reload the todo
6. Verify the image is still present

**Expected Result:** Image should persist after refresh

**Logs to Check:**
- `[MarkdownParser] ✓ Strategy 0: Found images_extracted: true marker, skipping reprocessing`
- `[startFileWatcher] Skipping X - written Yms ago (within cooldown)`

---

### Scenario 2: Todo Editing with Existing Images
**Steps:**
1. Create a todo with an image
2. Edit the todo title (not the content)
3. Save the todo
4. Verify the image is still present in the markdown file

**Expected Result:** Image should not be removed when editing todo title

**Logs to Check:**
- `[MarkdownParser] ✓ Strategy 0: Found images_extracted: true marker, skipping reprocessing`

---

### Scenario 3: Batch Todo Updates
**Steps:**
1. Create multiple todos with images
2. Perform a batch update operation (e.g., bulk status change)
3. Verify all images are still present

**Expected Result:** No images should be removed during batch updates

---

### Scenario 4: Legacy Markdown Files
**Steps:**
1. Use an old markdown file without `images_extracted` marker
2. Load and save the file
3. Verify existing images are not removed

**Expected Result:** Should fall back to other detection strategies and preserve images

**Logs to Check:**
- `[MarkdownParser] Strategy 0: No images_extracted marker found`
- `[MarkdownParser] ✓ Strategy 3: Found valid relative path images`

---

### Scenario 5: Mixed Content with Multiple Image Formats
**Steps:**
1. Create a todo with:
   - Base64 encoded image
   - Relative path image
   - HTTP URL image
2. Save the todo
3. Reload and verify all images are present

**Expected Result:** All image formats should be preserved

---

### Scenario 6: Concurrent Operations
**Steps:**
1. Quickly create multiple todos with images
2. Verify no race conditions occur
3. Check all images are present

**Expected Result:** No images should be lost due to concurrent processing

**Logs to Check:**
- No error messages about file locking or conflicts
- All `images_extracted` markers set correctly

---

### Scenario 7: Large Dataset Performance
**Steps:**
1. Create 1000+ todos with images
2. Perform file operations
3. Monitor performance and memory usage

**Expected Result:** No significant performance degradation

**Metrics to Check:**
- Memory usage should remain stable
- File watcher processing time should be reasonable
- Cache hit rate should be high

---

## Rollback Procedure

If issues occur during testing:

1. Stop the application
2. Restore from backup: `cp -r backup/* MultitTodoApp/`
3. Clear cache: `rm -rf MultitTodoApp/.multitodo-metadata/index.json`
4. Restart application
5. Rebuild index: Trigger a full rebuild from the application

## Success Criteria

All scenarios must pass with:
- No images lost during any operation
- No performance degradation
- No errors in console logs
- All defensive measures working correctly (errors caught and handled)

## Known Limitations

1. Very large markdown files (>1MB) will skip image reference processing to avoid performance issues
2. Extremely rapid successive edits (<1 second apart) may trigger cooldown mechanism
3. Corrupted image paths will be removed (this is intentional)

## Post-Test Cleanup

1. Verify all test data is cleaned up
2. Check for any memory leaks in the application
3. Monitor file watcher stability over extended period
4. Archive test logs for future reference