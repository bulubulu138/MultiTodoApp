# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Setup and Dependencies
```bash
npm install                    # Install dependencies
npm run rebuild               # Rebuild native modules (better-sqlite3)
npm run verify                # Verify native modules
```

### Development
```bash
npm run dev                   # Start development with hot reload (main + renderer)
npm run dev:main              # Compile and run main process only
npm run dev:renderer          # Start webpack dev server for renderer
```

### Building
```bash
npm run build                 # Build both main and renderer processes
npm run build:main            # Compile TypeScript main process
npm run build:renderer        # Bundle renderer with webpack
npm run prebuild              # Run pre-build checks
```

### Distribution and Packaging
```bash
npm run pack                  # Build and create unpacked distribution
npm run dist                  # Build and create platform-specific installers
npm run dist:win              # Build Windows installer
npm run dist:mac              # Build macOS DMG
```

### Testing and Quality
```bash
npm run lint                  # Run ESLint (if configured)
```

## Architecture Overview

This is an Electron desktop application with a React frontend for task management with AI features, featuring a sophisticated local-first architecture with SQLite database and optional AI integration.

### Process Architecture
- **Main Process** (`src/main/`): Electron main process handling window management, system tray, global shortcuts, IPC communication, database operations, and AI services
- **Renderer Process** (`src/renderer/`): React frontend with Ant Design UI components
- **Preload Script** (`src/main/preload.ts`): Secure IPC bridge between main and renderer

### Key Architectural Patterns
- **Database-First**: SQLite with better-sqlite3, automatic migrations, content hashing for deduplication
- **Service-Oriented**: Modular services in `src/main/services/` (DatabaseManager, AIService, KeywordExtractor)
- **Performance-Optimized**: React virtualization, LRU caching, debounced search, batch database operations
- **Hybrid View Architecture**: Separate render paths for card view vs. content focus mode with optimistic updates

### Core Components Structure

#### Main Process Services
- `DatabaseManager.ts`: SQLite database operations using better-sqlite3
- `AIService.ts`: AI integration for keyword extraction and smart recommendations
- `KeywordExtractor.ts`: Chinese text segmentation and keyword processing
- `ImageManager.ts`: Image handling and base64 conversion
- `BackupManager.ts`: Data backup and restoration

#### Renderer Components
- `App.tsx`: Main application with tab management, state, and routing
- `TodoList.tsx`: Task list with virtualization for performance
- `TodoForm.tsx`: Task creation/editing with rich text editor
- `RichTextEditor.tsx`: Quill-based rich text editing with image support
- `ContentFocusView.tsx`: Distraction-free writing mode
- `CalendarDrawer.tsx`: Calendar visualization of tasks
- `WeeklyReport.tsx`, `DailyReport.tsx`, `MonthlyReport.tsx`: Report generation
- `RelationsModal.tsx`: Task relationship management (dependencies, parallels)
- `SettingsModal.tsx`: App configuration and AI provider setup

### Key Technical Details

#### Database Schema
```sql
todos: {
  id, title, content, status, priority, tags,
  imageUrl, images, startTime, deadline,
  displayOrder, displayOrders, contentHash, keywords,
  completedAt, createdAt, updatedAt
}

todo_relations: {
  id, source_id, target_id, relation_type,
  created_at (extends, background, parallel)
}

notes: Separate notes system for work reflections
settings: Key-value configuration storage
```

#### Performance Optimizations
- **React virtualization** for large task lists using react-window
- **Debounced search** with LRU caching (200ms debounce)
- **Database indexes** on title, content, and time fields for 3x query speed improvement
- **Iterative algorithms** instead of recursive to prevent stack overflow with large datasets
- **Component memoization** with useMemo and useCallback
- **Batch operations** for multi-todo updates to reduce database round trips

#### State Management
- **Local React state** with hooks-based state management
- **Context API** for theme and settings global state
- **IPC-based communication** for all database operations
- **Optimistic updates** in content focus mode with backend sync

#### Build System
- **TypeScript compilation** for both processes with separate tsconfig files
- **Webpack 5** for renderer bundling with Node.js polyfills
- **electron-builder** for cross-platform packaging with platform-specific configs
- **Native module support** requiring `npm run rebuild` for better-sqlite3

#### Security & Privacy Architecture
- **Sandboxing**: Production-mode CSP with relaxed dev mode
- **100% local storage**: SQLite database in app's user data directory
- **Content hashing**: SHA256-based deduplication system
- **Optional AI**: Completely disableable AI features through settings

### Development Notes

#### Critical Development Patterns
- **Always use batch operations** when updating multiple todos to maintain performance
- **Implement proper memoization** for expensive computations in list components
- **Use content hashing** when creating todos to prevent duplicates
- **Test with large datasets** (>1000 todos) to verify performance optimizations

#### Native Dependencies
- `better-sqlite3`: Requires rebuild after installation (`npm run rebuild`)
- Database files stored in app's user data directory:
  - Windows: `%APPDATA%\MultiTodo\`
  - macOS: `~/Library/Application Support/MultiTodo/`

#### AI Integration Architecture
- **Multi-provider abstraction** in `AIService.ts` with pluggable providers
- **Async keyword extraction** with queuing system to avoid blocking
- **Optional AI features** - completely disableable through settings
- **Supported providers**: Kimi, DeepSeek, Doubao, custom endpoints

#### Unique UI Architecture
- **Hybrid view system**: Card view for browsing, Content focus view for writing
- **Multi-tab interface**: Status-based tabs + custom user-defined tag tabs
- **Per-tab state**: Independent sorting, filtering, and display order per tab
- **Global shortcut system**: `Cmd/Ctrl+Shift+T` for quick todo creation

#### Data Flow Patterns
- **IPC-first architecture**: All data operations go through main process
- **Optimistic updates**: Content focus mode updates local state immediately
- **Content hashing**: SHA256-based duplicate detection system
- **Export system**: JSON and plain text export formats

#### Extension Points
- **Add AI providers**: Extend `AIService.ts` with new provider classes
- **Custom export formats**: Extend export functionality in `ExportModal.tsx`
- **Theme development**: Add themes in `src/renderer/theme/themes.ts`
- **Relation types**: Expand `TodoRelation` interface for new relationship types

## Important Development Considerations

- The app supports both Windows and macOS with platform-specific configurations
- Global hotkey (`Ctrl/Cmd+Shift+T`) requires system permissions
- Image handling converts files to base64 for database storage
- Rich text content is stored as HTML with sanitization
- Task relationships support complex dependency graphs
- Search functionality works across titles, content, and metadata