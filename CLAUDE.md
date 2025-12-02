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

### Configuration Files
- **TypeScript Configs**: `tsconfig.json` (base), `tsconfig.main.json` (main process), renderer uses webpack ts-loader
- **Webpack Config**: `webpack.renderer.config.js` - targets web environment with Node.js polyfills, filesystem caching enabled
- **Build Config**: electron-builder configuration in `package.json` with platform-specific settings

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
- **Local-First Architecture**: 100% client-side SQLite with optional AI features, no external dependencies
- **IPC-First Communication**: All data operations go through main process with secure contextBridge

### Core Components Structure

#### Main Process Services (`src/main/`)
- `DatabaseManager.ts` (`src/main/database/`): SQLite database operations using better-sqlite3 with automatic migrations, indexing, and batch operations
- `AIService.ts` (`src/main/services/`): Multi-provider AI integration for keyword extraction and smart recommendations (Kimi, DeepSeek, Doubao, custom)
- `KeywordExtractor.ts` (`src/main/services/`): Chinese text segmentation and keyword processing using `segment` library
- `ImageManager.ts` (`src/main/utils/`): Image handling, validation, and base64 conversion with file path sanitization
- `BackupManager.ts` (`src/main/utils/`): Automated data backup and restoration with retention policies

#### Renderer Components (`src/renderer/components/`)
- `App.tsx`: Main application with tab management, global state, and routing
- `TodoList.tsx`: Virtualized task list using react-window for 1000+ todo performance
- `VirtualizedTodoList.tsx`: Advanced virtualization with grouping and sorting
- `TodoForm.tsx`: Task creation/editing with rich text editor and validation
- `RichTextEditor.tsx`: Quill-based rich text editing with image upload and paste support
- `ContentFocusView.tsx`: Distraction-free writing mode with optimistic updates
- `CalendarDrawer.tsx`: Calendar visualization of tasks with multiple view sizes
- `WeeklyReport.tsx`, `DailyReport.tsx`, `MonthlyReport.tsx`: Enhanced report generation with quality scoring
- `RelationsModal.tsx`: Task relationship management (dependencies, backgrounds, parallels)
- `SettingsModal.tsx`: App configuration, AI provider setup, and theme management
- `CustomTabManager.tsx`: Multi-tab interface with independent state per tab
- `Toolbar.tsx`: Global controls for search, view modes, and bulk operations

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
- **Dual TypeScript compilation**: Separate configs for main (`tsconfig.main.json`) and renderer processes (via webpack ts-loader)
- **Webpack 5** for renderer bundling with Node.js polyfills, file system caching, cheap source maps, and web target environment
- **electron-builder** for cross-platform packaging with platform-specific configs (Windows NSIS, macOS DMG)
- **Native module support**: `better-sqlite3` requires `npm run rebuild` after installation, verification via `npm run verify`
- **Pre-build checks**: `npm run prebuild` validates native modules before building
- **Optimization**: Production builds remove development logs and enable webpack optimizations
- **Asset handling**: Icons and resources in `assets/` directory with platform-specific formats (ICO, ICNS, PNG)

#### Security & Privacy Architecture
- **Sandboxing**: Production-mode CSP with relaxed dev mode
- **100% local storage**: SQLite database in app's user data directory
- **Content hashing**: SHA256-based deduplication system
- **Optional AI**: Completely disableable AI features through settings

### Development Notes

#### Critical Development Patterns
- **Always use batch operations** when updating multiple todos to maintain performance - use `DatabaseManager.batchUpdateTodos()`
- **Implement proper memoization** for expensive computations in list components - use `React.memo`, `useMemo`, `useCallback`
- **Use content hashing** when creating todos to prevent duplicates - hash includes title + content + timestamp
- **Test with large datasets** (>1000 todos) to verify performance optimizations
- **Animation performance monitoring** - conditionally disable animations on low-end devices using `EnhancedAnimations.tsx`
- **Search optimization patterns** - implement LRU caching, title matching priority, and debounced filtering (200ms)
- **Iterative algorithms** - avoid recursion for large datasets to prevent stack overflow (see grouping algorithms)
- **IPC channel patterns** - use consistent naming: `todos:getAll`, `todos:create`, `todos:update`, `todos:delete`

#### Native Dependencies
- `better-sqlite3`: Requires rebuild after installation (`npm run rebuild`), verify with `npm run verify`
- Database files stored in app's user data directory:
  - Windows: `%APPDATA%\MultiTodo\database.db`
  - macOS: `~/Library/Application Support/MultiTodo/database.db`
- Native module pre-build verification in `scripts/verify-native-modules.js` and `scripts/prebuild-check.js`

#### AI Integration Architecture
- **Multi-provider abstraction** in `AIService.ts` with pluggable providers
- **Async keyword extraction** with queuing system to avoid blocking
- **Optional AI features** - completely disableable through settings
- **Supported providers**: Kimi, DeepSeek, Doubao, custom endpoints

#### Unique UI Architecture
- **Hybrid view system**: Card view for browsing with comprehensive information, Content focus view for distraction-free writing with optimistic updates
- **Multi-tab interface**: Status-based tabs (Pending, In Progress, Completed, Paused) + custom user-defined tag tabs
- **Per-tab state**: Independent sorting, filtering, and display order per tab using `displayOrders` object in database
- **Global shortcut system**: `Cmd/Ctrl+Shift+T` for quick todo creation with clipboard integration
- **Virtualized rendering**: Uses react-window for handling 1000+ todos without performance degradation
- **Animation system**: Performance-aware animations with automatic disabling on low-end devices

#### Data Flow Patterns
- **IPC-first architecture**: All data operations go through main process via secure contextBridge
- **Optimistic updates**: Content focus mode updates local state immediately with backend sync
- **Content hashing**: SHA256-based duplicate detection system using title + content + timestamp
- **Export system**: JSON and plain text export formats with batch processing
- **Image pipeline**: File upload → validation → base64 conversion → database storage
- **AI processing queue**: Async keyword extraction with non-blocking queuing system
- **Database connection pooling**: Single SQLite connection with WAL mode for concurrent access

#### Extension Points
- **Add AI providers**: Extend `AIService.ts` with new provider classes implementing the `AIProvider` interface, add to `AI_PROVIDERS` mapping
- **Custom export formats**: Extend export functionality in `ExportModal.tsx` by adding new format handlers to the export switch statement
- **Theme development**: Add themes in `src/renderer/theme/themes.ts` following the existing theme structure with CSS variables
- **Relation types**: Expand `TodoRelation` interface in `src/shared/types.ts` and update `RelationsModal.tsx` UI components
- **Custom components**: Add to `src/renderer/components/` and follow the memoization patterns using `React.memo`
- **Database migrations**: Add new migration functions to `DatabaseManager.ts` following the existing version pattern
- **IPC channels**: Add new handlers to `preload.ts` and corresponding main process handlers with consistent naming

## Important Development Considerations

### Platform-Specific Details
- The app supports both Windows and macOS with platform-specific configurations in `package.json`
- Global hotkey (`Ctrl/Cmd+Shift+T`) requires system permissions and is registered in `main.ts`
- Database files stored in app's user data directory:
  - Windows: `%APPDATA%\MultiTodo\database.db`
  - macOS: `~/Library/Application Support/MultiTodo/database.db`

### File Structure and Key Paths
```
src/
├── main/
│   ├── main.ts                 # App entry point, window management, global shortcuts
│   ├── preload.ts              # IPC bridge, contextBridge setup
│   ├── database/
│   │   └── DatabaseManager.ts  # SQLite operations, migrations, indexing
│   ├── services/
│   │   ├── AIService.ts        # AI provider abstraction and implementation
│   │   ├── KeywordExtractor.ts # Chinese text segmentation
│   │   └── KeywordProcessor.ts # Keyword processing and scoring
│   └── utils/
│       ├── ImageManager.ts     # Image handling and validation
│       ├── hashUtils.ts        # SHA256 content hashing
│       └── BackupManager.ts    # Data backup and restoration
├── renderer/
│   ├── App.tsx                 # Root component with tab management
│   ├── components/             # React components with memoization
│   ├── hooks/
│   │   └── useThemeColors.ts   # Theme management
│   ├── theme/
│   │   └── themes.ts           # Theme definitions and CSS variables
│   └── utils/
│       ├── copyTodo.ts         # Todo duplication functionality
│       ├── reportGenerator.ts  # Report generation logic
│       └── sortWithGroups.ts   # Grouping and sorting algorithms
└── shared/
    └── types.ts                # Shared TypeScript interfaces
```

### Data Handling Patterns
- Image handling converts files to base64 for database storage with size limits and validation
- Rich text content is stored as HTML with sanitization using DOMPurify
- Task relationships support complex dependency graphs with circular reference detection
- Search functionality works across titles, content, and metadata with title matching priority
- Content hash includes title + content + timestamp for SHA256-based duplicate detection

### Performance Considerations
- All database operations use the main process through IPC to maintain data consistency
- Batch operations are critical for multi-todo updates to maintain performance
- Virtual rendering is essential for handling 1000+ todos without performance degradation
- Animation performance monitoring automatically disables effects on low-end devices
- Search uses 200ms debouncing with LRU caching to avoid redundant computations