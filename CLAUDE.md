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

This is an Electron desktop application with a React frontend for task management with AI features.

### Process Architecture
- **Main Process** (`src/main/`): Electron main process handling window management, system tray, global shortcuts, IPC communication, database operations, and AI services
- **Renderer Process** (`src/renderer/`): React frontend with Ant Design UI components
- **Preload Script** (`src/main/preload.ts`): Secure IPC bridge between main and renderer

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
- **todos**: Core task data with content hashes for deduplication
- **todo_relations**: Task relationships (extends, background, parallel)
- **notes**: Separate notes system for work reflections
- **settings**: Application configuration

#### Performance Optimizations
- React virtualization for large task lists using react-window
- Debounced search with caching (200ms debounce)
- Database indexes on title, content, and time fields
- Iterative algorithms instead of recursive to prevent stack overflow
- Component memoization with useMemo and useCallback

#### State Management
- React hooks-based state management
- Context API for theme and settings
- IPC-based communication for database operations

#### Build System
- TypeScript compilation for both processes
- Webpack 5 for renderer bundling with Node.js polyfills
- electron-builder for cross-platform packaging
- Separate tsconfig files for main and renderer processes

### Development Notes

#### Native Dependencies
- `better-sqlite3`: Requires rebuild after installation (`npm run rebuild`)
- Database files stored in app's user data directory

#### AI Features
- Optional AI integration for keyword extraction and recommendations
- Supports multiple providers (Kimi, DeepSeek, Doubao, custom endpoints)
- Can be completely disabled in settings

#### Styling and Theming
- Ant Design component library with Chinese localization
- Custom theme system with light/dark modes
- CSS variables for dynamic theming

#### Data Storage
- 100% local SQLite database for privacy
- No cloud sync or data collection
- Export functionality for data portability

## Important Development Considerations

- The app supports both Windows and macOS with platform-specific configurations
- Global hotkey (`Ctrl/Cmd+Shift+T`) requires system permissions
- Image handling converts files to base64 for database storage
- Rich text content is stored as HTML with sanitization
- Task relationships support complex dependency graphs
- Search functionality works across titles, content, and metadata