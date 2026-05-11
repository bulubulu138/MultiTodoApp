import React, { useState, useEffect } from 'react';
import { Modal, Form, Select, Button, Typography, Space, Tabs, Card, Tag, Divider, Input, Switch, Alert, Tooltip, Collapse, Descriptions, Progress, Result, message, Spin } from 'antd';
import { BulbOutlined, FolderOpenOutlined, DatabaseOutlined, TagOutlined, ThunderboltOutlined, RobotOutlined, CheckCircleOutlined, CloseCircleOutlined, ExportOutlined, LinkOutlined, BgColorsOutlined, CloudUploadOutlined, LockOutlined, SyncOutlined, SwapOutlined, ReloadOutlined, FileTextOutlined, PlayCircleOutlined, PauseCircleOutlined, DeleteOutlined, ExclamationCircleOutlined, ToolOutlined } from '@ant-design/icons';
import { App } from 'antd';
import { Todo, CustomTab } from '../../shared/types';
import { ColorTheme } from '../theme/themes';
import TagManagement from './TagManagement';
import BackupSettings from './BackupSettings';
import CustomTabManager from './CustomTabManager';
import URLAuthorizationManager from './URLAuthorizationManager';
import PromptTemplateManager from './PromptTemplateManager';
import MarkdownFileBrowser from './MarkdownFileBrowser';
import StorageDiagnosticModal from './StorageDiagnosticModal';

const { Text } = Typography;

// Color theme selector component
interface ColorThemeSelectorProps {
  value: ColorTheme;
  onChange: (theme: ColorTheme) => void;
}

const ColorThemeSelector: React.FC<ColorThemeSelectorProps> = ({ value, onChange }) => {
  const colors: Array<{ key: ColorTheme; color: string; label: string }> = [
    { key: 'purple', color: '#8B5CF6', label: '紫色' },
    { key: 'blue', color: '#3B82F6', label: '蓝色' },
    { key: 'green', color: '#10B981', label: '绿色' },
    { key: 'orange', color: '#F59E0B', label: '橙色' },
    { key: 'red', color: '#EF4444', label: '红色' },
  ];

  return (
    <Space size={12}>
      {colors.map(({ key, color, label }) => (
        <Tooltip key={key} title={label}>
          <div
            onClick={() => onChange(key)}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              backgroundColor: color,
              cursor: 'pointer',
              border: value === key ? '3px solid var(--ant-colorText)' : '3px solid transparent',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          />
        </Tooltip>
      ))}
    </Space>
  );
};

interface SettingsModalProps {
  visible: boolean;
  settings: Record<string, string>;
  todos?: Todo[];
  onSave: (settings: Record<string, string>) => void;
  onCancel: () => void;
  onReload?: () => Promise<void>;
  customTabs?: CustomTab[];
  onSaveCustomTabs?: (tabs: CustomTab[]) => void;
  existingTags?: string[];
  colorTheme?: ColorTheme;
  onColorThemeChange?: (theme: ColorTheme) => void;
  promptTemplates?: any[];
  onTemplatesChange?: () => Promise<void>;
  onAIConfigUpdate?: (settings: Record<string, string>) => void;
}

// 存储管理组件
const StorageManagement: React.FC = () => {
  const [storageMode, setStorageMode] = useState<'database' | 'file'>('database');
  const [storagePath, setStoragePath] = useState<string>('');
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState<any>(null);

  // 新增：存储位置管理状态
  const [storageLocationConfig, setStorageLocationConfig] = useState<any>(null);
  const [newStoragePath, setNewStoragePath] = useState<string>('');
  const [isMovingStorage, setIsMovingStorage] = useState(false);
  const [moveProgress, setMoveProgress] = useState<any>(null);
  const [pathValidation, setPathValidation] = useState<any>(null);
  const [validatingPath, setValidatingPath] = useState(false);

  // ✅ 新增：存储类型切换状态
  const [hybridStorageConfig, setHybridStorageConfig] = useState<any>(null);
  const [storageStats, setStorageStats] = useState<any>(null);
  const [isSwitchingMode, setIsSwitchingMode] = useState(false);
  const [switchProgress, setSwitchProgress] = useState(0);

  // ✅ 新增：Markdown文件浏览器状态
  const [showMarkdownBrowser, setShowMarkdownBrowser] = useState(false);
  const [mdFileCount, setMdFileCount] = useState(0);

  // ✅ 新增：数据同步服务状态
  const [dataSyncConfig, setDataSyncConfig] = useState<any>(null);
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [syncStats, setSyncStats] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<any>(null);

  // ✅ 新增：文件系统监控器状态
  const [fsWatcherConfig, setFsWatcherConfig] = useState<any>(null);
  const [fsWatcherStatus, setFsWatcherStatus] = useState<any>(null);
  const [fsWatcherStats, setFsWatcherStats] = useState<any>(null);
  const [watchedFiles, setWatchedFiles] = useState<string[]>([]);

  // ✅ 新增：Markdown路径编辑状态
  const [isEditingMarkdownPath, setIsEditingMarkdownPath] = useState(false);
  const [newMarkdownPath, setNewMarkdownPath] = useState('');
  const [markdownPathValidation, setMarkdownPathValidation] = useState<any>(null);
  const [isValidatingMarkdownPath, setIsValidatingMarkdownPath] = useState(false);
  const [isUpdatingMarkdownPath, setIsUpdatingMarkdownPath] = useState(false);

  // 存储诊断相关状态
  const [showDiagnosticModal, setShowDiagnosticModal] = useState(false);

  useEffect(() => {
    loadStorageInfo();
    loadStorageLocationConfig();
    loadHybridStorageConfig(); // ✅ 新增：加载混合存储配置
    loadDataSyncConfig(); // ✅ 新增：加载数据同步配置
    loadDataSyncStatus(); // ✅ 新增：加载数据同步状态
    loadFsWatcherConfig(); // ✅ 新增：加载文件系统监控器配置
    loadFsWatcherStatus(); // ✅ 新增：加载文件系统监控器状态
  }, []);

  // ✅ 新增：监听配置变更事件
  useEffect(() => {
    // 监听配置变更事件
    if (window.electronAPI.hybridStorageEvents) {
      const handleConfigChange = () => {
        console.log('[SettingsModal] Config changed, reloading...');
        loadHybridStorageConfig();
        loadStorageStats();
      };

      const cleanup = window.electronAPI.hybridStorageEvents.onConfigChange(handleConfigChange);
      return cleanup;
    }
  }, []);

  const loadStorageInfo = async () => {
    try {
      const info = await window.electronAPI.storage.getMode();
      setStorageMode(info.mode);
      setStoragePath(info.path || '');
    } catch (error) {
      console.error('Error loading storage info:', error);
    }
  };

  const loadStorageLocationConfig = async () => {
    try {
      const result = await window.electronAPI.storageLocation.getConfig();
      if (result.success && result.config) {
        setStorageLocationConfig(result.config);
      }
    } catch (error) {
      console.error('Error loading storage location config:', error);
    }
  };

  // ✅ 新增：加载混合存储配置
  const loadHybridStorageConfig = async () => {
    try {
      const result = await window.electronAPI.hybridStorage.getConfig();
      if (result.success && result.config) {
        setHybridStorageConfig(result.config);
        // 同步更新storageMode状态
        setStorageMode(result.config.currentMode === 'database' ? 'database' : 'file');
      }
    } catch (error) {
      console.error('Error loading hybrid storage config:', error);
    }
  };

  // ✅ 新增：加载存储统计信息
  const loadStorageStats = async () => {
    try {
      const result = await window.electronAPI.hybridStorage.getStats();
      if (result.success && result.stats) {
        setStorageStats(result.stats);

        // 添加日志帮助调试
        if (!result.stats.filePath) {
          console.warn('[SettingsModal] Storage path not configured');
        }
      }
    } catch (error) {
      console.error('Error loading storage stats:', error);
    }
  };

  // ✅ 新增：处理存储类型切换
  const handleStorageModeSwitch = async (checked: boolean) => {
    const newMode = checked ? 'file' : 'database';

    // 如果模式没有变化，直接返回
    if (hybridStorageConfig?.currentMode === newMode) {
      return;
    }

    setIsSwitchingMode(true);
    setSwitchProgress(0);

    try {
      // 模拟进度
      const progressInterval = setInterval(() => {
        setSwitchProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 100);

      // 切换存储模式
      const result = await window.electronAPI.hybridStorage.switchMode(newMode);

      clearInterval(progressInterval);
      setSwitchProgress(100);

      if (result.success) {
        message.success(`已切换到${newMode === 'database' ? '数据库' : 'Markdown'}存储模式`);

        // 刷新配置
        await loadHybridStorageConfig();
        await loadStorageStats();

        // 提示用户重启应用
        Modal.success({
          title: '切换成功',
          content: '存储模式已成功切换。建议重新启动应用以确保所有功能正常工作。',
          onOk: () => {
            window.location.reload();
          }
        });
      } else {
        message.error(`切换失败: ${result.error}`);
      }
    } catch (error) {
      console.error('Error switching storage mode:', error);
      message.error('切换存储模式失败');
    } finally {
      setIsSwitchingMode(false);
      setSwitchProgress(0);
    }
  };

  // ✅ 新增：处理Markdown文件导入
  const handleImportMarkdownFile = async (filePath: string) => {
    try {
      const result = await window.electronAPI.hybridStorage.importMarkdownFile(filePath);
      if (result.success) {
        message.success(`成功导入文件: ${result.todo.title}`);
        // 刷新存储统计信息
        await loadStorageStats();
      } else {
        message.error(`导入失败: ${result.error}`);
      }
    } catch (error) {
      console.error('Error importing markdown file:', error);
      message.error('导入文件时发生错误');
    }
  };

  // ✅ 新增：刷新Markdown文件列表
  const handleRefreshMarkdownFiles = async () => {
    try {
      await window.electronAPI.hybridStorage.invalidateCache();
      await loadStorageStats();
      await loadHybridStorageConfig();
    } catch (error) {
      console.error('Error refreshing markdown files:', error);
    }
  };

  // ✅ 新增：加载数据同步配置
  const loadDataSyncConfig = async () => {
    try {
      const result = await window.electronAPI.dataSync.getConfig();
      if (result.success && result.config) {
        setDataSyncConfig(result.config);
      }
    } catch (error) {
      console.error('Error loading data sync config:', error);
    }
  };

  // ✅ 新增：加载数据同步状态
  const loadDataSyncStatus = async () => {
    try {
      const result = await window.electronAPI.dataSync.getStatus();
      if (result.success) {
        setSyncStatus(result);
      }
    } catch (error) {
      console.error('Error loading data sync status:', error);
    }
  };

  // ✅ 新增：加载数据同步统计
  const loadDataSyncStats = async () => {
    try {
      const result = await window.electronAPI.dataSync.getStats();
      if (result.success && result.stats) {
        setSyncStats(result.stats);
      }
    } catch (error) {
      console.error('Error loading data sync stats:', error);
    }
  };

  // ✅ 新增：处理手动同步
  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncProgress({ phase: 'starting', current: 0, total: 100, message: '正在启动同步...' });

    try {
      const result = await window.electronAPI.dataSync.manualSync();
      if (result.success && result.result) {
        const syncResult = result.result;
        setSyncProgress({
          phase: 'complete',
          current: 100,
          total: 100,
          message: `同步完成: 成功 ${syncResult.itemsSuccess}, 失败 ${syncResult.itemsFailed}`
        });

        if (syncResult.success) {
          message.success(`同步成功: ${syncResult.itemsSuccess} 个项目已同步`);
        } else {
          message.warning(`同步完成但有错误: ${syncResult.itemsSuccess} 成功, ${syncResult.itemsFailed} 失败`);
        }

        // 刷新状态
        await loadDataSyncStatus();
        await loadDataSyncStats();
      } else {
        message.error(`同步失败: ${result.error}`);
      }
    } catch (error) {
      console.error('Error performing manual sync:', error);
      message.error('同步时发生错误');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncProgress(null), 3000);
    }
  };

  // ✅ 新增：更新数据同步配置
  const handleUpdateSyncConfig = async (updates: any) => {
    try {
      const result = await window.electronAPI.dataSync.updateConfig(updates);
      if (result.success) {
        message.success('同步配置已更新');
        await loadDataSyncConfig();
      } else {
        message.error(`更新配置失败: ${result.error}`);
      }
    } catch (error) {
      console.error('Error updating sync config:', error);
      message.error('更新配置时发生错误');
    }
  };

  // ✅ 新增：加载文件系统监控器配置
  const loadFsWatcherConfig = async () => {
    try {
      const result = await window.electronAPI.filesystemWatcher.getConfig();
      if (result.success && result.config) {
        setFsWatcherConfig(result.config);
      }
    } catch (error) {
      console.error('Error loading filesystem watcher config:', error);
    }
  };

  // ✅ 新增：加载文件系统监控器状态
  const loadFsWatcherStatus = async () => {
    try {
      const [statusResult, statsResult] = await Promise.all([
        window.electronAPI.filesystemWatcher.getStatus(),
        window.electronAPI.filesystemWatcher.getStats()
      ]);

      if (statusResult.success) {
        setFsWatcherStatus(statusResult);
      }
      if (statsResult.success && statsResult.stats) {
        setFsWatcherStats(statsResult.stats);
      }
    } catch (error) {
      console.error('Error loading filesystem watcher status:', error);
    }
  };

  // ✅ 新增：加载监控文件列表
  const loadWatchedFiles = async () => {
    try {
      const result = await window.electronAPI.filesystemWatcher.getWatchedFiles();
      if (result.success && result.files) {
        setWatchedFiles(result.files);
      }
    } catch (error) {
      console.error('Error loading watched files:', error);
    }
  };

  // ✅ 新增：处理监控器启动/停止
  const handleToggleWatcher = async (enabled: boolean) => {
    try {
      const result = enabled
        ? await window.electronAPI.filesystemWatcher.start()
        : await window.electronAPI.filesystemWatcher.stop();

      if (result.success) {
        message.success(enabled ? '文件监控已启动' : '文件监控已停止');
        await loadFsWatcherStatus();
        await loadFsWatcherConfig();
      } else {
        message.error(`${enabled ? '启动' : '停止'}失败: ${result.error}`);
      }
    } catch (error) {
      console.error('Error toggling watcher:', error);
      message.error('操作失败');
    }
  };

  // ✅ 新增：处理监控器暂停/恢复
  const handleToggleWatcherPause = async (paused: boolean) => {
    try {
      const result = paused
        ? await window.electronAPI.filesystemWatcher.pause()
        : await window.electronAPI.filesystemWatcher.resume();

      if (result.success) {
        message.success(paused ? '文件监控已暂停' : '文件监控已恢复');
        await loadFsWatcherStatus();
      } else {
        message.error(`${paused ? '暂停' : '恢复'}失败: ${result.error}`);
      }
    } catch (error) {
      console.error('Error toggling watcher pause:', error);
      message.error('操作失败');
    }
  };

  // ✅ 新增：刷新监控文件列表
  const handleRefreshWatcher = async () => {
    try {
      const result = await window.electronAPI.filesystemWatcher.refresh();
      if (result.success) {
        message.success('监控文件列表已刷新');
        await loadFsWatcherStatus();
        await loadWatchedFiles();
      } else {
        message.error(`刷新失败: ${result.error}`);
      }
    } catch (error) {
      console.error('Error refreshing watcher:', error);
      message.error('刷新失败');
    }
  };

  // ✅ 新增：更新监控器配置
  const handleUpdateWatcherConfig = async (updates: any) => {
    try {
      const result = await window.electronAPI.filesystemWatcher.updateConfig(updates);
      if (result.success) {
        message.success('监控器配置已更新');
        await loadFsWatcherConfig();
      } else {
        message.error(`更新配置失败: ${result.error}`);
      }
    } catch (error) {
      console.error('Error updating watcher config:', error);
      message.error('更新配置时发生错误');
    }
  };

  const handleSelectDirectory = async () => {
    try {
      const result = await window.electronAPI.file.selectDirectory();
      if (result) {
        setStoragePath(result);
      }
    } catch (error) {
      console.error('Error selecting directory:', error);
    }
  };

  // 新增：验证新存储路径
  const validateNewPath = async (path: string) => {
    if (!path) {
      setPathValidation(null);
      return;
    }

    setValidatingPath(true);
    try {
      const result = await window.electronAPI.storageLocation.validatePath(path);
      setPathValidation(result);
    } catch (error) {
      console.error('Error validating path:', error);
      setPathValidation({
        valid: false,
        error: '路径验证失败'
      });
    } finally {
      setValidatingPath(false);
    }
  };

  // 新增：选择新的存储位置
  const handleSelectNewStorageLocation = async () => {
    try {
      const result = await window.electronAPI.storageLocation.selectFolder();
      if (result) {
        setNewStoragePath(result);
        validateNewPath(result);
      }
    } catch (error) {
      console.error('Error selecting storage location:', error);
    }
  };

  // 新增：移动存储到新位置
  const handleMoveStorage = async () => {
    if (!newStoragePath || !pathValidation?.valid) {
      return;
    }

    setIsMovingStorage(true);
    setMoveProgress({ stage: '准备中', percent: 0, message: '正在准备移动存储...' });

    try {
      const result = await window.electronAPI.storageLocation.moveStorage(newStoragePath);

      if (result.success) {
        setMoveProgress({
          stage: '完成',
          percent: 100,
          message: '存储移动成功！'
        });

        // 刷新信息
        await loadStorageInfo();
        await loadStorageLocationConfig();

        Modal.success({
          title: '存储移动成功',
          content: '数据已成功移动到新位置。建议重新启动应用以确保所有更改生效。',
          onOk: () => {
            window.location.reload();
          }
        });
      } else {
        setMoveProgress({
          stage: '失败',
          percent: 0,
          message: result.error || '移动存储失败'
        });
      }
    } catch (error) {
      console.error('Error moving storage:', error);
      setMoveProgress({
        stage: '失败',
        percent: 0,
        message: '移动存储时发生错误'
      });
    } finally {
      setIsMovingStorage(false);
    }
  };

  // 新增：在文件管理器中打开
  const handleOpenInExplorer = async () => {
    try {
      const result = await window.electronAPI.storageLocation.openInExplorer(storagePath);
      if (!result.success) {
        message.error(result.error || '打开失败');
      }
    } catch (error) {
      console.error('Error opening in explorer:', error);
      message.error('打开失败');
    }
  };

  // 新增：在文件管理器中打开Markdown文件夹
  const handleOpenMarkdownFolder = async () => {
    try {
      const markdownPath = storageStats?.filePath;
      if (!markdownPath) {
        message.warning('Markdown存储路径未配置');
        return;
      }

      const result = await window.electronAPI.storageLocation.openInExplorer(markdownPath);
      if (!result.success) {
        message.error(result.error || '打开失败');
      }
    } catch (error) {
      console.error('Error opening markdown folder:', error);
      message.error('打开失败');
    }
  };

  // 新增：选择新的Markdown存储路径
  const handleSelectMarkdownPath = async () => {
    try {
      const result = await window.electronAPI.storageLocation.selectFolder();
      if (result) {
        setNewMarkdownPath(result);
        await validateMarkdownPath(result);
      }
    } catch (error) {
      console.error('Error selecting markdown path:', error);
      message.error('选择路径失败');
    }
  };

  // 新增：验证Markdown存储路径
  const validateMarkdownPath = async (path: string) => {
    if (!path) {
      setMarkdownPathValidation(null);
      return;
    }

    setIsValidatingMarkdownPath(true);
    try {
      const result = await window.electronAPI.storageLocation.validatePath(path);
      setMarkdownPathValidation(result);
    } catch (error) {
      console.error('Error validating markdown path:', error);
      setMarkdownPathValidation({
        valid: false,
        error: '路径验证失败'
      });
    } finally {
      setIsValidatingMarkdownPath(false);
    }
  };

  // 新增：开始编辑Markdown路径
  const handleStartEditMarkdownPath = () => {
    setNewMarkdownPath(storageStats?.filePath || '');
    setIsEditingMarkdownPath(true);
    setMarkdownPathValidation(null);
  };

  // 新增：取消编辑Markdown路径
  const handleCancelEditMarkdownPath = () => {
    setIsEditingMarkdownPath(false);
    setNewMarkdownPath('');
    setMarkdownPathValidation(null);
  };

  // 新增：更新Markdown存储路径
  const handleUpdateMarkdownPath = async () => {
    if (!newMarkdownPath || !markdownPathValidation?.valid) {
      return;
    }

    // 显示确认对话框
    Modal.confirm({
      title: '确认更改存储位置',
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p>您即将将Markdown存储位置更改为：</p>
          <p><Text code>{newMarkdownPath}</Text></p>
          <Alert
            message="重要说明"
            description={
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                <li>此更改只影响新创建的待办文件</li>
                <li>现有Markdown文件将保持在原位置</li>
                <li>如需移动现有文件，请使用文件管理器手动操作</li>
              </ul>
            }
            type="warning"
            showIcon
            style={{ marginTop: 16 }}
          />
        </div>
      ),
      okText: '确认更改',
      cancelText: '取消',
      onOk: async () => {
        setIsUpdatingMarkdownPath(true);
        try {
          // 调用后端API更新路径
          const result = await window.electronAPI.hybridStorage.updatePath(newMarkdownPath);

          if (result.success) {
            message.success('存储位置已成功更新');

            // 刷新配置和统计信息
            await loadHybridStorageConfig();
            await loadStorageStats();

            // 退出编辑模式
            setIsEditingMarkdownPath(false);
            setNewMarkdownPath('');
            setMarkdownPathValidation(null);

            // 提示用户重启应用
            Modal.success({
              title: '更改成功',
              content: '存储位置已成功更改。建议重新启动应用以确保所有功能正常工作。',
              onOk: () => {
                window.location.reload();
              }
            });
          } else {
            message.error(`更改失败: ${result.error || '未知错误'}`);
          }
        } catch (error) {
          console.error('Error updating markdown path:', error);
          message.error('更改存储位置时发生错误');
        } finally {
          setIsUpdatingMarkdownPath(false);
        }
      }
    });
  };

  const handleStartMigration = async () => {
    console.log('[SettingsModal] ===== START MIGRATION CLICKED =====');
    console.log('[SettingsModal] Storage path:', storagePath);

    if (!storagePath) {
      console.warn('[SettingsModal] No storage path, aborting migration');
      return;
    }

    setIsMigrating(true);
    try {
      console.log('[SettingsModal] Calling migration API with path:', storagePath);

      const result = await window.electronAPI.storage.migrate(storagePath, {
        deleteDatabaseAfter: true,
        createBackup: true,
        batchWriteSize: 50,
        verifyAfterMigration: true,
        forceClean: true // 强制清理目标路径的旧数据
      });

      console.log('[SettingsModal] Migration result received:', result);

      if (result.success) {
        setMigrationProgress({
          stage: 'completed',
          result
        });

        // 刷新存储信息
        await loadStorageInfo();

        // 提示用户重启应用
        Modal.success({
          title: '迁移成功',
          content: '数据已成功迁移到 Markdown 文件格式。请重新启动应用以应用更改。',
          onOk: () => {
            window.location.reload();
          }
        });
      } else {
        console.error('[SettingsModal] Migration failed:', result.errors);
        setMigrationProgress({
          stage: 'error',
          error: result.errors?.[0] || '迁移失败'
        });
      }
    } catch (error) {
      console.error('[SettingsModal] Migration exception:', error);
      setMigrationProgress({
        stage: 'error',
        error: String(error)
      });
    } finally {
      setIsMigrating(false);
    }
  };

  // 格式化文件大小
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* ✅ 新增：存储类型切换 */}
        <Card title={<><SwapOutlined /> 存储类型选择</>}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div>
              <Text strong>当前存储类型：</Text>
              <div style={{ marginTop: 8 }}>
                <Switch
                  checked={storageMode === 'file'}
                  onChange={handleStorageModeSwitch}
                  checkedChildren="Markdown"
                  unCheckedChildren="数据库"
                  loading={isSwitchingMode}
                  style={{ minWidth: 120 }}
                />
              </div>
            </div>

            {isSwitchingMode && (
              <div>
                <Text type="secondary">正在切换存储模式...</Text>
                <Progress percent={switchProgress} status="active" style={{ marginTop: 8 }} />
              </div>
            )}

            {storageStats && (
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="当前模式">
                  <Tag color={storageStats.mode === 'database' ? 'blue' : 'green'}>
                    {storageStats.mode === 'database' ? 'SQLite数据库' : 'Markdown文件'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="数据库待办数">
                  {storageStats.databaseCount}
                </Descriptions.Item>
                <Descriptions.Item label="文件待办数">
                  {storageStats.fileCount}
                </Descriptions.Item>
                <Descriptions.Item label="总待办数">
                  {storageStats.totalCount}
                </Descriptions.Item>
                <Descriptions.Item label="数据库路径">
                  <Text ellipsis={{ tooltip: storageStats.databasePath }} style={{ maxWidth: '200px' }}>
                    {storageStats.databasePath}
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label="文件存储路径">
                  <Text ellipsis={{ tooltip: storageStats.filePath }} style={{ maxWidth: '200px' }}>
                    {storageStats.filePath}
                  </Text>
                </Descriptions.Item>
              </Descriptions>
            )}

            {storageMode === 'file' && (
              <Alert
                message="双存储模式说明"
                description={
                  <div>
                    <p>当前启用双存储模式：</p>
                    <ul>
                      <li><strong>新建待办</strong>：保存为Markdown文件</li>
                      <li><strong>数据读取</strong>：同时显示数据库和文件中的待办</li>
                      <li><strong>冲突解决</strong>：自动选择最新修改的数据</li>
                    </ul>
                  </div>
                }
                type="info"
                showIcon
              />
            )}
          </Space>
        </Card>

        {/* ✅ 新增：数据同步服务 */}
        <Card title={<><SyncOutlined spin={syncStatus?.status === 'syncing'} /> 数据同步服务</>}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {/* 同步状态 */}
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="同步状态">
                <Tag color={syncStatus?.status === 'syncing' ? 'processing' :
                         syncStatus?.status === 'error' ? 'error' : 'success'}>
                  {syncStatus?.status === 'syncing' ? '同步中' :
                   syncStatus?.status === 'error' ? '错误' : '空闲'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="自动同步">
                <Switch
                  checked={dataSyncConfig?.enabled || false}
                  onChange={(checked) => handleUpdateSyncConfig({ enabled: checked })}
                  disabled={isSyncing}
                />
              </Descriptions.Item>
              <Descriptions.Item label="同步间隔">
                <Select
                  value={dataSyncConfig?.interval || 60000}
                  onChange={(value) => handleUpdateSyncConfig({ interval: value })}
                  disabled={isSyncing || !dataSyncConfig?.enabled}
                  style={{ width: 150 }}
                >
                  <Select.Option value={30000}>30秒</Select.Option>
                  <Select.Option value={60000}>1分钟</Select.Option>
                  <Select.Option value={300000}>5分钟</Select.Option>
                  <Select.Option value={600000}>10分钟</Select.Option>
                </Select>
              </Descriptions.Item>
              <Descriptions.Item label="切换时自动同步">
                <Switch
                  checked={dataSyncConfig?.autoSyncOnSwitch || false}
                  onChange={(checked) => handleUpdateSyncConfig({ autoSyncOnSwitch: checked })}
                  disabled={isSyncing}
                />
              </Descriptions.Item>
              <Descriptions.Item label="最后同步时间">
                {syncStats?.lastSyncTime ?
                  new Date(syncStats.lastSyncTime).toLocaleString('zh-CN') :
                  '从未同步'}
              </Descriptions.Item>
              <Descriptions.Item label="同步次数">
                {syncStats?.totalSyncs || 0} 次
                (成功: {syncStats?.successfulSyncs || 0}, 失败: {syncStats?.failedSyncs || 0})
              </Descriptions.Item>
            </Descriptions>

            {/* 同步进度 */}
            {syncProgress && (
              <Alert
                message={syncProgress.message}
                type={syncProgress.phase === 'complete' ? 'success' : 'info'}
                showIcon
              />
            )}

            {/* 操作按钮 */}
            <Space>
              <Button
                type="primary"
                icon={<SyncOutlined spin={isSyncing} />}
                onClick={handleManualSync}
                disabled={isSyncing}
                loading={isSyncing}
              >
                立即同步
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  loadDataSyncStatus();
                  loadDataSyncStats();
                }}
                disabled={isSyncing}
              >
                刷新状态
              </Button>
            </Space>

            <Alert
              message="数据同步说明"
              description={
                <div>
                  <p>数据同步服务会在数据库和Markdown文件之间自动同步待办数据：</p>
                  <ul>
                    <li><strong>自动同步</strong>：按照设定的时间间隔自动执行同步</li>
                    <li><strong>切换时同步</strong>：切换存储模式时自动执行同步</li>
                    <li><strong>冲突解决</strong>：自动选择最新修改的数据</li>
                    <li><strong>手动同步</strong>：可以随时手动触发同步操作</li>
                  </ul>
                </div>
              }
              type="info"
              showIcon
            />
          </Space>
        </Card>

        {/* ✅ 新增：文件系统监控器 */}
        <Card title={<><FileTextOutlined /> 文件系统监控器</>}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {/* 监控状态 */}
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="监控状态">
                <Tag color={fsWatcherStatus?.status === 'watching' ? 'success' :
                         fsWatcherStatus?.status === 'paused' ? 'warning' :
                         fsWatcherStatus?.status === 'error' ? 'error' : 'default'}>
                  {fsWatcherStatus?.status === 'watching' ? '监控中' :
                   fsWatcherStatus?.status === 'paused' ? '已暂停' :
                   fsWatcherStatus?.status === 'error' ? '错误' : '空闲'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="监控开关">
                <Switch
                  checked={fsWatcherConfig?.enabled || false}
                  onChange={handleToggleWatcher}
                />
              </Descriptions.Item>
              <Descriptions.Item label="监控路径">
                <Text ellipsis={{ tooltip: fsWatcherStats?.watchPath }} style={{ maxWidth: '200px' }}>
                  {fsWatcherStats?.watchPath || '未配置'}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="监控文件数">
                {fsWatcherStats?.filesWatched || 0}
              </Descriptions.Item>
              <Descriptions.Item label="检测到变化">
                {fsWatcherStats?.changesDetected || 0}
              </Descriptions.Item>
              <Descriptions.Item label="运行时长">
                {fsWatcherStats?.uptime ? Math.floor(fsWatcherStats.uptime / 1000 / 60) + ' 分钟' : '0 分钟'}
              </Descriptions.Item>
              <Descriptions.Item label="自动同步">
                <Switch
                  checked={fsWatcherConfig?.autoSync || false}
                  onChange={(checked) => handleUpdateWatcherConfig({ autoSync: checked })}
                  disabled={!fsWatcherConfig?.enabled}
                />
              </Descriptions.Item>
              <Descriptions.Item label="防抖延迟">
                <Select
                  value={fsWatcherConfig?.debounceDelay || 1000}
                  onChange={(value) => handleUpdateWatcherConfig({ debounceDelay: value })}
                  disabled={!fsWatcherConfig?.enabled}
                  style={{ width: 120 }}
                >
                  <Select.Option value={500}>0.5秒</Select.Option>
                  <Select.Option value={1000}>1秒</Select.Option>
                  <Select.Option value={2000}>2秒</Select.Option>
                  <Select.Option value={5000}>5秒</Select.Option>
                </Select>
              </Descriptions.Item>
            </Descriptions>

            {/* 操作按钮 */}
            <Space>
              <Button
                icon={fsWatcherStatus?.status === 'paused' ? <PlayCircleOutlined /> : <PauseCircleOutlined />}
                onClick={() => handleToggleWatcherPause(fsWatcherStatus?.status !== 'paused')}
                disabled={!fsWatcherConfig?.enabled || fsWatcherStatus?.status === 'idle'}
              >
                {fsWatcherStatus?.status === 'paused' ? '恢复监控' : '暂停监控'}
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={handleRefreshWatcher}
                disabled={!fsWatcherConfig?.enabled || fsWatcherStatus?.status !== 'watching'}
              >
                刷新文件列表
              </Button>
              <Button
                icon={<DeleteOutlined />}
                onClick={async () => {
                  const result = await window.electronAPI.filesystemWatcher.resetStats();
                  if (result.success) {
                    message.success('统计信息已重置');
                    await loadFsWatcherStatus();
                  }
                }}
                disabled={!fsWatcherConfig?.enabled}
              >
                重置统计
              </Button>
            </Space>

            {/* 监控文件列表 */}
            {watchedFiles.length > 0 && (
              <div>
                <Text strong>监控的文件：</Text>
                <div style={{
                  maxHeight: '200px',
                  overflow: 'auto',
                  marginTop: '8px',
                  padding: '8px',
                  background: '#f5f5f5',
                  borderRadius: '4px'
                }}>
                  {watchedFiles.map((file, index) => (
                    <div key={index} style={{ fontSize: '12px', padding: '4px 0' }}>
                      <FileTextOutlined style={{ marginRight: '8px', color: '#52c41a' }} />
                      <Text>{file.split(/[/\\]/).pop() || file}</Text>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Alert
              message="文件监控说明"
              description={
                <div>
                  <p>文件系统监控器会实时监控存储目录中的Markdown文件变化：</p>
                  <ul>
                    <li><strong>实时监控</strong>：检测文件的创建、修改、删除事件</li>
                    <li><strong>自动同步</strong>：检测到变化时自动刷新数据</li>
                    <li><strong>智能过滤</strong>：自动忽略隐藏文件和临时文件</li>
                    <li><strong>防抖处理</strong>：避免频繁变化导致的性能问题</li>
                  </ul>
                </div>
              }
              type="info"
              showIcon
            />
          </Space>
        </Card>

        {/* 新增：存储位置管理 */}
        {storageMode === 'database' && storageLocationConfig && (
          <Card title={<><FolderOpenOutlined /> 存储位置管理</>}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              {/* 当前存储位置 */}
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="存储类型">
                  <Tag color="blue">
                    {storageLocationConfig.storageLocation.type === 'default' ? '默认' :
                     storageLocationConfig.storageLocation.type === 'documents' ? '文档目录' :
                     storageLocationConfig.storageLocation.type === 'home' ? '主目录' : '自定义'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="数据库路径">
                  <Space>
                    <Text ellipsis={{ tooltip: storagePath }} style={{ maxWidth: '300px' }}>
                      {storagePath || '默认位置'}
                    </Text>
                    <Button
                      type="text"
                      size="small"
                      icon={<FolderOpenOutlined />}
                      onClick={handleOpenInExplorer}
                    >
                      打开
                    </Button>
                  </Space>
                </Descriptions.Item>
                <Descriptions.Item label="最后更新">
                  {storageLocationConfig.storageLocation.lastUpdated ?
                    new Date(storageLocationConfig.storageLocation.lastUpdated).toLocaleString('zh-CN') :
                    '未知'}
                </Descriptions.Item>
              </Descriptions>

              {/* 更改存储位置 */}
              <div>
                <Text strong>更改存储位置：</Text>
                <Space.Compact style={{ width: '100%', marginTop: 8 }}>
                  <Input
                    value={newStoragePath}
                    onChange={(e) => {
                      setNewStoragePath(e.target.value);
                      validateNewPath(e.target.value);
                    }}
                    placeholder="选择新的存储位置"
                  />
                  <Button
                    icon={<FolderOpenOutlined />}
                    onClick={handleSelectNewStorageLocation}
                    disabled={isMovingStorage}
                  >
                    浏览
                  </Button>
                </Space.Compact>
              </div>

              {/* 路径验证结果 */}
              {validatingPath && (
                <div style={{ textAlign: 'center' }}>
                  <Spin size="small" />
                  <Text type="secondary" style={{ marginLeft: 8 }}>
                    正在验证路径...
                  </Text>
                </div>
              )}

              {pathValidation && !validatingPath && (
                <Alert
                  message={pathValidation.valid ? '路径验证通过' : '路径验证失败'}
                  description={pathValidation.error || (pathValidation.warnings?.join(', '))}
                  type={pathValidation.valid ? 'success' : 'error'}
                  showIcon
                />
              )}

              {/* 移动进度 */}
              {moveProgress && (
                <Card size="small">
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    <Space>
                      {isMovingStorage ? <Spin size="small" /> : <CheckCircleOutlined />}
                      <Text strong>{moveProgress.stage}</Text>
                    </Space>
                    <Progress
                      percent={moveProgress.percent}
                      status={isMovingStorage ? 'active' : 'success'}
                    />
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {moveProgress.message}
                    </Text>
                  </Space>
                </Card>
              )}

              {/* 操作按钮 */}
              <Space>
                <Button
                  type="primary"
                  onClick={handleMoveStorage}
                  disabled={!newStoragePath || !pathValidation?.valid || isMovingStorage}
                  loading={isMovingStorage}
                >
                  移动存储
                </Button>
                <Button
                  onClick={() => {
                    setNewStoragePath('');
                    setPathValidation(null);
                    setMoveProgress(null);
                  }}
                  disabled={isMovingStorage}
                >
                  重置
                </Button>
              </Space>

              <Alert
                message="重要提示"
                description="移动存储位置会自动创建备份，操作是安全的。移动完成后建议重启应用。"
                type="info"
                showIcon
              />
            </Space>
          </Card>
        )}

        {/* 当前存储模式 */}
        <Card title={<><DatabaseOutlined /> 当前存储模式</>}>
          <Descriptions column={1} size="small">
            <Descriptions.Item label="存储类型">
              <Tag color={storageMode === 'database' ? 'blue' : 'green'}>
                {storageMode === 'database' ? 'SQLite 数据库' : 'Markdown 文件'}
              </Tag>
            </Descriptions.Item>
            {storageMode === 'database' ? (
              <Descriptions.Item label="存储路径">
                {storagePath || '默认位置'}
              </Descriptions.Item>
            ) : (
              <Descriptions.Item label="存储路径">
                <Space>
                  <Text ellipsis={{ tooltip: storageStats?.filePath }} style={{ maxWidth: '300px' }}>
                    {storageStats?.filePath || '未配置'}
                  </Text>
                  {storageStats?.filePath && (
                    <Button
                      type="text"
                      size="small"
                      icon={<FolderOpenOutlined />}
                      onClick={() => handleOpenMarkdownFolder()}
                    >
                      打开
                    </Button>
                  )}
                </Space>
              </Descriptions.Item>
            )}
          </Descriptions>
        </Card>

        {/* 存储模式说明 */}
        {storageMode === 'database' && (
          <Alert
            message="当前使用数据库存储"
            description={
              <div>
                <p>您的待办数据当前存储在 SQLite 数据库中。</p>
                <p>您可以迁移到 Markdown 文件存储，享受以下优势：</p>
                <ul>
                  <li>✓ 人类可读的数据格式</li>
                  <li>✓ 支持任何文本编辑器</li>
                  <li>✓ 版本控制友好（Git）</li>
                  <li>✓ 完全去中心化，应用删除不影响数据</li>
                  <li>✓ 支持云同步（Dropbox、Google Drive 等）</li>
                </ul>
              </div>
            }
            type="info"
            showIcon
          />
        )}

        {/* Markdown 文件存储说明 */}
        {storageMode === 'file' && (
          <Alert
            message="当前使用 Markdown 文件存储"
            description={
              <div>
                <p>您的待办数据以 Markdown 文件格式存储。</p>
                <p>您可以：</p>
                <ul>
                  <li>在文件管理器中查看和编辑待办文件</li>
                  <li>使用任何文本编辑器修改待办内容</li>
                  <li>通过云服务同步数据到其他设备</li>
                  <li>使用 Git 进行版本控制</li>
                </ul>
              </div>
            }
            type="success"
            showIcon
          />
        )}

        {/* Markdown 存储路径管理 */}
        {storageMode === 'file' && !isEditingMarkdownPath && (
          <Card
            title={<><FolderOpenOutlined /> Markdown 存储位置</>}
            extra={
              <Button
                type="primary"
                size="small"
                icon={<SwapOutlined />}
                onClick={handleStartEditMarkdownPath}
              >
                更改位置
              </Button>
            }
          >
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <div>
                <Text type="secondary">当前存储位置：</Text>
                <div style={{ marginTop: 8 }}>
                  <Text ellipsis={{ tooltip: storageStats?.filePath }} style={{ maxWidth: '100%' }}>
                    {storageStats?.filePath || '未配置'}
                  </Text>
                </div>
              </div>

              <Alert
                message="存储说明"
                description={
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    <li>新创建的待办将保存到此位置</li>
                    <li>现有Markdown文件保持在原位置</li>
                    <li>您可以随时更改存储位置</li>
                  </ul>
                }
                type="info"
                showIcon
              />
            </Space>
          </Card>
        )}

        {/* Markdown 存储路径编辑 */}
        {storageMode === 'file' && isEditingMarkdownPath && (
          <Card
            title={<><SwapOutlined /> 更改存储位置</>}
            extra={
              <Button
                type="text"
                size="small"
                onClick={handleCancelEditMarkdownPath}
              >
                取消
              </Button>
            }
          >
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <Text strong>选择新的存储位置：</Text>
                <Space.Compact style={{ width: '100%', marginTop: 8 }}>
                  <Input
                    value={newMarkdownPath}
                    onChange={(e) => {
                      setNewMarkdownPath(e.target.value);
                      if (e.target.value) {
                        validateMarkdownPath(e.target.value);
                      } else {
                        setMarkdownPathValidation(null);
                      }
                    }}
                    placeholder="选择存储待办文件的文件夹"
                    readOnly
                  />
                  <Button
                    icon={<FolderOpenOutlined />}
                    onClick={handleSelectMarkdownPath}
                  >
                    浏览
                  </Button>
                </Space.Compact>
              </div>

              {/* 路径验证结果 */}
              {isValidatingMarkdownPath && (
                <div style={{ textAlign: 'center', padding: '10px 0' }}>
                  <Spin size="small" />
                  <Text type="secondary" style={{ marginLeft: 8 }}>正在验证路径...</Text>
                </div>
              )}

              {markdownPathValidation && !isValidatingMarkdownPath && (
                <Alert
                  message={markdownPathValidation.valid ? '路径验证成功' : '路径验证失败'}
                  description={
                    <div>
                      {markdownPathValidation.error && (
                        <div style={{ marginBottom: 8 }}>
                          <Text type="danger">{markdownPathValidation.error}</Text>
                        </div>
                      )}
                      {markdownPathValidation.warnings && markdownPathValidation.warnings.length > 0 && (
                        <div>
                          <Text type="warning">警告：</Text>
                          <ul style={{ margin: 0, paddingLeft: 20 }}>
                            {markdownPathValidation.warnings.map((warning: string, index: number) => (
                              <li key={index}>{warning}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {markdownPathValidation.valid && (
                        <div>
                          <Text type="success">
                            ✓ 路径可用，可用空间: {
                              markdownPathValidation.availableSpace
                                ? `${(markdownPathValidation.availableSpace / 1024 / 1024 / 1024).toFixed(2)} GB`
                                : '未知'
                            }
                          </Text>
                        </div>
                      )}
                    </div>
                  }
                  type={markdownPathValidation.valid ? 'success' : 'error'}
                  showIcon
                />
              )}

              {/* 操作按钮 */}
              <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                <Button onClick={handleCancelEditMarkdownPath}>
                  取消
                </Button>
                <Button
                  type="primary"
                  onClick={handleUpdateMarkdownPath}
                  disabled={!newMarkdownPath || !markdownPathValidation?.valid || isUpdatingMarkdownPath}
                  loading={isUpdatingMarkdownPath}
                >
                  确认更改
                </Button>
              </Space>

              <Alert
                message="重要说明"
                description={
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    <li>更改存储位置只影响新创建的待办文件</li>
                    <li>现有Markdown文件将保持在原位置</li>
                    <li>如需移动现有文件，请使用文件管理器手动操作</li>
                  </ul>
                }
                type="warning"
                showIcon
              />
            </Space>
          </Card>
        )}

        {/* 迁移选项 */}
        {storageMode === 'database' && (
          <Card title={<><CloudUploadOutlined /> 迁移到 Markdown 文件</>}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <Text strong>选择存储位置：</Text>
                <Space.Compact style={{ width: '100%', marginTop: 8 }}>
                  <Input
                    value={storagePath}
                    onChange={(e) => setStoragePath(e.target.value)}
                    placeholder="选择存储待办文件的文件夹"
                    readOnly
                  />
                  <Button icon={<FolderOpenOutlined />} onClick={handleSelectDirectory}>
                    浏览
                  </Button>
                </Space.Compact>
              </div>

              <Alert
                message="迁移说明"
                description={
                  <ul>
                    <li>迁移过程会自动创建数据库备份</li>
                    <li>每个待办将转换为独立的 Markdown 文件</li>
                    <li>附件将从数据库提取到独立文件夹</li>
                    <li>迁移完成后需要重新启动应用</li>
                  </ul>
                }
                type="warning"
                showIcon
              />

              {migrationProgress?.stage === 'error' && (
                <Alert
                  message="迁移失败"
                  description={migrationProgress.error}
                  type="error"
                  showIcon
                />
              )}

              <Button
                type="primary"
                size="large"
                block
                icon={<CloudUploadOutlined />}
                onClick={handleStartMigration}
                disabled={!storagePath || isMigrating}
                loading={isMigrating}
              >
                开始迁移
              </Button>
            </Space>
          </Card>
        )}

        {/* 文件存储管理 */}
        {storageMode === 'file' && (
          <>
            <Card title={<><SyncOutlined /> 文件存储管理</>}>
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <Alert
                  message="存储完整性诊断"
                  description="运行完整的存储系统检查，诊断文件-数据库映射不一致问题"
                  type="info"
                  showIcon
                  action={
                    <Button
                      type="primary"
                      icon={<ToolOutlined />}
                      onClick={() => setShowDiagnosticModal(true)}
                    >
                      运行诊断
                    </Button>
                  }
                />

                <Descriptions bordered column={2}>
                  <Descriptions.Item label="存储路径">
                    {storageStats?.filePath || '未知'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Markdown文件数">
                    <Tag color="green">{storageStats?.fileCount || 0}</Tag>
                  </Descriptions.Item>
                </Descriptions>
              </Space>
            </Card>

            <Card title={<><SyncOutlined /> 文件存储管理</>}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="存储位置">
                  {storagePath}
                </Descriptions.Item>
                <Descriptions.Item label="文件格式">
                  Markdown (.md)
                </Descriptions.Item>
                <Descriptions.Item label="关系管理">
                  Markdown 链接
                </Descriptions.Item>
                <Descriptions.Item label="发现的MD文件">
                  {storageStats && storageStats.fileCount}
                </Descriptions.Item>
              </Descriptions>

              <Button
                icon={<FolderOpenOutlined />}
                onClick={() => {
                  if (storagePath) {
                    window.electronAPI.openExternal(String(storagePath));
                  }
                }}
              >
                打开存储文件夹
              </Button>

              <Button
                icon={<FileTextOutlined />}
                onClick={() => setShowMarkdownBrowser(true)}
                style={{ marginTop: 8 }}
              >
                浏览和导入MD文件
              </Button>
            </Space>
          </Card>
          </>
        )}

        {/* ✅ 新增：Markdown文件浏览器 */}
        <MarkdownFileBrowser
          visible={showMarkdownBrowser}
          storagePath={storagePath || ''}
          onClose={() => setShowMarkdownBrowser(false)}
          onImportFile={handleImportMarkdownFile}
          onRefresh={handleRefreshMarkdownFiles}
        />
      </Space>

      {/* 存储诊断模态框 */}
      <StorageDiagnosticModal
        visible={showDiagnosticModal}
        onClose={() => setShowDiagnosticModal(false)}
      />
    </div>
  );
};

const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  settings,
  todos = [],
  onSave,
  onCancel,
  onReload,
  customTabs = [],
  onSaveCustomTabs,
  existingTags = [],
  colorTheme = 'purple',
  onColorThemeChange,
  promptTemplates = [],
  onTemplatesChange,
  onAIConfigUpdate
}) => {
  const [form] = Form.useForm();
  const [aiForm] = Form.useForm();
  const { message } = App.useApp();
  const [dbPath, setDbPath] = useState<string>('加载中...');
  const [activeTab, setActiveTab] = useState('general');
  const [aiProviders, setAiProviders] = useState<Array<{value: string; label: string; endpoint: string}>>([]);
  const [aiModels, setAiModels] = useState<Array<{id: string; name: string; description?: string}>>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [fetchModelsError, setFetchModelsError] = useState<string | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<{success: boolean; message: string} | null>(null);
  const [generatingKeywords, setGeneratingKeywords] = useState(false);
  const [localColorTheme, setLocalColorTheme] = useState<ColorTheme>(colorTheme);
  const [localPromptTemplates, setLocalPromptTemplates] = useState(promptTemplates);

  useEffect(() => {
    if (visible) {
      form.setFieldsValue({
        theme: settings.theme || 'light',
        calendarViewSize: settings.calendarViewSize || 'compact',
        colorTheme: settings.colorTheme || 'purple',
      });
      setLocalColorTheme((settings.colorTheme as ColorTheme) || 'purple');

      // 加载AI配置
      const aiConfigToLoad = {
        ai_provider: settings.ai_provider || 'disabled',
        ai_api_key: settings.ai_api_key || '',
        ai_api_endpoint: settings.ai_api_endpoint || '',
        ai_model: settings.ai_model || '', // ✅ 修复：添加ai_model字段加载
        ai_enabled: settings.ai_enabled === 'true',
      };

      console.log('[SettingsModal] 加载AI配置到表单:', {
        ...aiConfigToLoad,
        ai_api_key: aiConfigToLoad.ai_api_key ? '***' : '(empty)'
      });

      aiForm.setFieldsValue(aiConfigToLoad);

      // 获取数据库路径
      window.electronAPI.settings.get('dbPath').then((path) => {
        if (path) {
          setDbPath(path);
        } else {
          setDbPath('未知路径');
        }
      }).catch(() => {
        setDbPath('获取失败');
      });

      // 获取支持的AI提供商
      window.electronAPI.ai.getSupportedProviders().then((providers) => {
        setAiProviders(providers);
      }).catch(() => {
        console.error('Failed to load AI providers');
      });

      // 主动加载 Prompt 模板（作为后备）
      window.electronAPI.promptTemplates.getAll().then((templates) => {
        setLocalPromptTemplates(templates);
      }).catch(() => {
        console.error('Failed to load prompt templates in SettingsModal');
      });
    }
  }, [visible, settings, form, aiForm]);

  // 同步外部 promptTemplates 的变化到本地状态
  useEffect(() => {
    if (promptTemplates && promptTemplates.length > 0) {
      setLocalPromptTemplates(promptTemplates);
    }
  }, [promptTemplates]);

  const handleSubmit = () => {
    const values = form.getFieldsValue();
    onSave(values);
  };

  const handleOpenDataFolder = async () => {
    try {
      const result = await window.electronAPI.settings.openDataFolder();
      if (result.success) {
        message.success('已打开数据文件夹');
      } else {
        message.error('打开失败: ' + result.error);
      }
    } catch (error) {
      message.error('无法打开数据文件夹');
    }
  };

  const handleCopyPath = () => {
    if (dbPath && dbPath !== '加载中...' && dbPath !== '未知路径') {
      navigator.clipboard.writeText(dbPath).then(() => {
        message.success('路径已复制到剪贴板');
      }).catch(() => {
        message.error('复制失败');
      });
    }
  };

  const handleAIConfigSave = async () => {
    try {
      const values = await aiForm.validateFields();

      console.log('[SettingsModal] 保存AI配置，验证后的表单值:', {
        ...values,
        ai_api_key: values.ai_api_key ? '***' : '(empty)',
        ai_api_key_length: values.ai_api_key?.length || 0,
        ai_model_length: values.ai_model?.length || 0
      });

      const result = await window.electronAPI.ai.configure(
        values.ai_provider,
        values.ai_api_key || '',
        values.ai_api_endpoint || '',
        values.ai_model || ''
      );

      if (result.success) {
        // ✅ 验证保存后的AI服务状态
        const aiConfigAfterSave = await window.electronAPI.ai.getConfig();
        console.log('[SettingsModal] 保存后的AI服务状态:', {
          ...aiConfigAfterSave,
          apiKey: aiConfigAfterSave.enabled ? '***' : '(empty)'
        });

        if (!aiConfigAfterSave.enabled) {
          console.error('[SettingsModal] ⚠️  警告：配置保存后AI服务仍未启用！');
          message.warning('AI配置已保存，但服务可能未正确启用，请检查配置');
        }

        // 更新父组件的settings状态，保持UI同步
        if (onAIConfigUpdate) {
          const settingsToUpdate = {
            ai_provider: values.ai_provider,
            ai_api_key: values.ai_api_key || '',
            ai_api_endpoint: values.ai_api_endpoint || '',
            ai_model: values.ai_model || '',
            ai_enabled: values.ai_provider !== 'disabled' && values.ai_api_key ? 'true' : 'false'
          };
          console.log('[SettingsModal] 更新父组件settings状态:', {
            ...settingsToUpdate,
            ai_api_key: settingsToUpdate.ai_api_key ? '***' : '(empty)'
          });
          await onAIConfigUpdate(settingsToUpdate);
        }

        message.success('AI配置已保存');
        setConnectionTestResult(null); // 清除测试结果
      } else {
        message.error('保存失败: ' + result.error);
      }
    } catch (error) {
      console.error('[SettingsModal] 保存AI配置失败:', error);
      message.error('保存失败: ' + (error as Error).message);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionTestResult(null);

    try {
      const values = await aiForm.validateFields();

      // 先保存配置
      await window.electronAPI.ai.configure(
        values.ai_provider,
        values.ai_api_key || '',
        values.ai_api_endpoint || '',
        values.ai_model || ''
      );

      // 测试连接
      const result = await window.electronAPI.ai.testConnection();
      setConnectionTestResult(result);

      if (result.success) {
        message.success('连接成功！');
      } else {
        message.error('连接失败: ' + result.message);
      }
    } catch (error: any) {
      setConnectionTestResult({
        success: false,
        message: error.message || '测试失败'
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleProviderChange = async (provider: string) => {
    setConnectionTestResult(null);
    setFetchModelsError(null);

    if (provider === 'disabled') {
      setAiModels([]);
      aiForm.setFieldsValue({ ai_model: '', ai_api_key: '', ai_api_endpoint: '' });
      return;
    }

    try {
      // 尝试获取该provider的已保存配置
      const allProvidersResult = await window.electronAPI.ai.getAllProviders();
      if (allProvidersResult.success) {
        const savedConfig = allProvidersResult.providers.find(p => p.provider === provider);
        if (savedConfig && savedConfig.enabled) {
          // 自动填充已保存的配置
          aiForm.setFieldsValue({
            ai_api_key: '', // 出于安全考虑，不自动填充key
            ai_api_endpoint: savedConfig.endpoint,
            ai_model: savedConfig.model
          });
          message.info(`已加载 ${provider} 的配置（需要重新输入API Key）`);
        }
      }

      const models = await window.electronAPI.ai.getAvailableModels(provider);
      setAiModels(models);

      // 如果没有保存的模型或已保存的模型不在列表中，自动选择第一个
      const currentModel = aiForm.getFieldValue('ai_model');
      if (!currentModel || !models.find(m => m.id === currentModel)) {
        if (models.length > 0) {
          aiForm.setFieldsValue({ ai_model: models[0].id });
        } else {
          aiForm.setFieldsValue({ ai_model: '' });
        }
      }
    } catch (error) {
      console.error('Failed to load provider config:', error);
      setAiModels([]);
      aiForm.setFieldsValue({ ai_model: '' });
    }
  };

  const handleFetchModels = async () => {
    const provider = aiForm.getFieldValue('ai_provider');
    const apiKey = aiForm.getFieldValue('ai_api_key');
    const endpoint = aiForm.getFieldValue('ai_api_endpoint');

    if (!provider || provider === 'disabled') {
      message.warning('请先选择AI服务提供商');
      return;
    }

    if (!apiKey) {
      message.warning('请先输入API Key');
      return;
    }

    setFetchingModels(true);
    setFetchModelsError(null);

    try {
      const result = await window.electronAPI.ai.fetchModels(provider, apiKey, endpoint);

      if (result.success) {
        // 转换为UI需要的格式（添加description字段）
        const modelsWithDescription = result.models.map(m => ({
          id: m.id,
          name: m.name,
          description: undefined // API返回的可能没有description
        }));

        setAiModels(modelsWithDescription);

        // 自动选择第一个模型
        if (modelsWithDescription.length > 0) {
          aiForm.setFieldsValue({ ai_model: modelsWithDescription[0].id });
          message.success(`成功获取 ${modelsWithDescription.length} 个可用模型`);
        } else {
          message.warning('未获取到任何模型，请检查API Key是否正确');
        }

        // 如果有警告信息（使用了fallback），显示出来
        if (result.error) {
          setFetchModelsError(result.error);
        }
      } else {
        message.error('获取模型失败: ' + (result.error || '未知错误'));
        if (result.error) {
          setFetchModelsError(result.error);
        }
      }
    } catch (error: any) {
      console.error('Failed to fetch models:', error);
      message.error('获取模型失败: ' + error.message);
      setFetchModelsError(error.message);
    } finally {
      setFetchingModels(false);
    }
  };

  const handleBatchGenerateKeywords = async () => {
    console.log('[SettingsModal] 开始批量生成关键词...');
    setGeneratingKeywords(true);
    try {
      console.log('[SettingsModal] 调用 electronAPI.keywords.batchGenerate...');
      const result = await window.electronAPI.keywords.batchGenerate();
      console.log('[SettingsModal] 收到结果:', result);
      
      if (result.success) {
        message.success(`关键词生成完成！处理了 ${result.processed}/${result.total} 个待办`);
        if (onReload) {
          console.log('[SettingsModal] 重新加载数据...');
          await onReload();
        }
      } else {
        console.error('[SettingsModal] 生成失败:', result.error);
        message.error('生成失败: ' + result.error);
      }
    } catch (error: any) {
      console.error('[SettingsModal] 捕获到错误:', error);
      message.error('生成失败: ' + error.message);
    } finally {
      console.log('[SettingsModal] 完成，设置 loading 为 false');
      setGeneratingKeywords(false);
    }
  };

  const tabItems = [
    {
      key: 'general',
      label: (
        <span>
          <BulbOutlined />
          通用设置
        </span>
      ),
      children: (
        <Form form={form} layout="vertical">
        <Form.Item
          name="theme"
          label={
            <span>
              <BulbOutlined style={{ marginRight: 8 }} />
              主题外观
            </span>
          }
          tooltip="选择您喜欢的主题风格"
        >
          <Select
            options={[
              { label: '☀️ 浅色', value: 'light' },
              { label: '🌙 纯黑', value: 'dark' },
            ]}
            placeholder="选择主题"
          />
        </Form.Item>

        <Form.Item
          name="colorTheme"
          label={
            <span>
              <BgColorsOutlined style={{ marginRight: 8 }} />
              主题颜色
            </span>
          }
          tooltip="选择您喜欢的主题颜色"
        >
          <ColorThemeSelector value={localColorTheme} onChange={(theme) => {
            setLocalColorTheme(theme);
            onColorThemeChange?.(theme);
          }} />
        </Form.Item>

        <Form.Item
          name="calendarViewSize"
          label="📅 日历视图大小"
          tooltip="调整日历单元格的显示尺寸"
        >
          <Select
            options={[
              { label: '紧凑（推荐）', value: 'compact' },
              { label: '标准', value: 'standard' },
              { label: '舒适', value: 'comfortable' },
            ]}
            placeholder="选择日历视图大小"
          />
        </Form.Item>

        <Form.Item
          label={
            <span>
              <DatabaseOutlined style={{ marginRight: 8 }} />
              数据存储位置
            </span>
          }
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text
              copyable={{ text: dbPath, tooltips: ['复制路径', '已复制'] }}
              style={{
                fontSize: 12,
                wordBreak: 'break-all',
                display: 'block',
                padding: '8px 12px',
                backgroundColor: 'var(--ant-color-fill-tertiary)',
                borderRadius: 4
              }}
            >
              {dbPath}
            </Text>
            <Space>
              <Button
                size="small"
                icon={<FolderOpenOutlined />}
                onClick={handleOpenDataFolder}
              >
                打开数据文件夹
              </Button>
              <Button
                size="small"
                onClick={handleCopyPath}
              >
                复制路径
              </Button>
            </Space>
            <Text type="secondary" style={{ fontSize: 11 }}>
              💡 您的所有待办数据都存储在此位置，卸载应用时可选择是否保留
            </Text>
          </Space>
        </Form.Item>

        <Divider />

        <Collapse
          defaultActiveKey={[]}
          items={[
            {
              key: 'shortcuts',
              label: (
                <span>
                  <ThunderboltOutlined style={{ marginRight: 8 }} />
                  快捷键与托盘
                </span>
              ),
              children: (
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                  <Card title="🚀 全局快捷键" variant="borderless" size="small">
                    <Space direction="vertical" style={{ width: '100%' }} size="middle">
                      <div>
                        <div style={{ marginBottom: 8 }}>
                          <Text strong>快速创建待办：</Text>
                        </div>
                        <Tag color="blue" style={{ fontSize: '14px', padding: '6px 12px' }}>
                          {navigator.platform.includes('Mac') ? 'Cmd + Shift + T' : 'Ctrl + Shift + T'}
                        </Tag>
                        <div style={{ marginTop: 8 }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            在任何应用中选中文字或复制图片后，按此快捷键即可快速创建待办
                          </Text>
                        </div>
                      </div>

                      <Divider style={{ margin: '12px 0' }} />

                      <div>
                        <Text strong style={{ display: 'block', marginBottom: 8 }}>使用方法：</Text>
                        <ol style={{ margin: 0, paddingLeft: 20, color: 'rgba(0, 0, 0, 0.65)' }}>
                          <li style={{ marginBottom: 4 }}>在任何应用中选中文字或复制图片到剪贴板</li>
                          <li style={{ marginBottom: 4 }}>按下快捷键 {navigator.platform.includes('Mac') ? 'Cmd + Shift + T' : 'Ctrl + Shift + T'}</li>
                          <li style={{ marginBottom: 4 }}>MultiTodo 会自动显示并打开创建表单</li>
                          <li>剪贴板内容会自动填充到待办内容中</li>
                        </ol>
                      </div>
                    </Space>
                  </Card>

                  <Card title="💡 系统托盘" variant="borderless" size="small">
                    <Space direction="vertical" style={{ width: '100%' }} size="small">
                      <Text>
                        • <Text strong>关闭窗口</Text>：应用会最小化到系统托盘，不会退出
                      </Text>
                      <Text>
                        • <Text strong>单击托盘图标</Text>：快速显示/隐藏窗口
                      </Text>
                      <Text>
                        • <Text strong>右键托盘图标</Text>：查看菜单选项
                      </Text>
                      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
                        💡 提示：应用会在后台保持运行，随时响应全局快捷键
                      </Text>
                    </Space>
                  </Card>
                </Space>
              ),
            }
          ]}
        />

          <div style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 4,
            fontSize: 12,
            opacity: 0.8
          }}>
            💡 提示：纯黑主题更适合夜间使用，并且在AMOLED屏幕上更省电。紧凑模式可在一屏内显示完整月历。
          </div>
        </Form>
      ),
    },
    {
      key: 'tags',
      label: (
        <span>
          <TagOutlined />
          标签管理
        </span>
      ),
      children: (
        <TagManagement 
          todos={todos} 
          onReload={onReload || (async () => {})} 
        />
      ),
    },
    {
      key: 'ai',
      label: (
        <span>
          <RobotOutlined />
          AI 助手
        </span>
      ),
      children: (
        <div>
          <Alert
            message="智能推荐与AI增强"
            description="配置AI服务后，未来可享受智能待办分析、自动摘要等功能。当前已支持基于关键词的智能推荐。"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          
          <Form form={aiForm} layout="vertical">
            <Form.Item
              name="ai_provider"
              label="AI 服务提供商"
              tooltip="选择您使用的AI服务商"
            >
              <Select
                options={[
                  { label: '🚫 禁用', value: 'disabled' },
                  ...aiProviders.map(p => ({ label: p.label, value: p.value }))
                ]}
                onChange={(value) => {
                  setConnectionTestResult(null);
                  handleProviderChange(value);
                }}
              />
            </Form.Item>

            <Form.Item
              noStyle
              shouldUpdate={(prevValues, currentValues) => prevValues.ai_provider !== currentValues.ai_provider}
            >
              {({ getFieldValue }) => {
                const provider = getFieldValue('ai_provider');
                if (provider === 'disabled') {
                  return null;
                }
                
                return (
                  <>
                    <Form.Item
                      name="ai_api_key"
                      label={
                        <Space>
                          <span>API Key</span>
                          <Text type="secondary" style={{ fontSize: 12, fontWeight: 'normal' }}>
                            输入后点击"获取模型"按钮
                          </Text>
                        </Space>
                      }
                      rules={[{ required: provider !== 'disabled', message: '请输入API Key' }]}
                    >
                      <Space.Compact style={{ width: '100%' }}>
                        <Input.Password
                          placeholder="输入您的API Key"
                          onChange={() => {
                            setConnectionTestResult(null);
                            setFetchModelsError(null);
                          }}
                        />
                        <Button
                          onClick={handleFetchModels}
                          loading={fetchingModels}
                          disabled={!aiForm.getFieldValue('ai_api_key')}
                        >
                          获取模型
                        </Button>
                      </Space.Compact>
                    </Form.Item>

                    {fetchModelsError && (
                      <Alert
                        message={fetchModelsError.includes('使用默认列表') ? '提示' : '警告'}
                        description={fetchModelsError}
                        type={fetchModelsError.includes('使用默认列表') ? 'info' : 'warning'}
                        closable
                        onClose={() => setFetchModelsError(null)}
                        style={{ marginBottom: 16 }}
                      />
                    )}

                    <Form.Item
                      name="ai_api_endpoint"
                      label="API 端点（可选）"
                      tooltip="如需使用自定义端点，请填写完整URL"
                    >
                      <Input
                        placeholder={aiProviders.find(p => p.value === provider)?.endpoint || '默认端点'}
                        onChange={() => setConnectionTestResult(null)}
                      />
                    </Form.Item>

                    <Form.Item
                      name="ai_model"
                      label="AI 模型"
                      tooltip={
                        aiModels.length === 0
                          ? '请先输入API Key并点击"获取模型"按钮'
                          : '选择要使用的AI模型'
                      }
                      rules={[{ required: true, message: '请选择AI模型' }]}
                    >
                      <Select
                        placeholder={aiModels.length === 0 ? '请先获取模型列表' : '选择AI模型'}
                        options={aiModels.map(m => ({
                          label: m.name,
                          value: m.id,
                          title: m.description
                        }))}
                        onChange={() => setConnectionTestResult(null)}
                        notFoundContent={
                          <span>
                            {fetchingModels ? '正在获取模型...' : '请先输入API Key并点击"获取模型"按钮'}
                          </span>
                        }
                      />
                    </Form.Item>

                    <Form.Item>
                      <Space>
                        <Button
                          type="primary"
                          onClick={handleAIConfigSave}
                        >
                          保存配置
                        </Button>
                        <Button
                          onClick={handleTestConnection}
                          loading={testingConnection}
                        >
                          测试连接
                        </Button>
                      </Space>
                    </Form.Item>

                    {connectionTestResult && (
                      <Alert
                        message={connectionTestResult.success ? '连接成功' : '连接失败'}
                        description={connectionTestResult.message}
                        type={connectionTestResult.success ? 'success' : 'error'}
                        showIcon
                        icon={connectionTestResult.success ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                        closable
                        onClose={() => setConnectionTestResult(null)}
                      />
                    )}
                  </>
                );
              }}
            </Form.Item>
          </Form>

          <Divider />

          <Card title="🔑 关键词管理" variant="borderless" size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                系统会自动为新建和编辑的待办提取关键词，用于智能推荐相关待办。
              </Text>
              <Button
                type="default"
                loading={generatingKeywords}
                onClick={handleBatchGenerateKeywords}
                block
              >
                {generatingKeywords ? '生成中...' : '为所有待办生成关键词'}
              </Button>
              <Text type="secondary" style={{ fontSize: 11 }}>
                💡 首次使用或导入数据后，建议点击此按钮为现有待办生成关键词
              </Text>
            </Space>
          </Card>
        </div>
      ),
    },
    {
      key: 'promptTemplates',
      label: (
        <span>
          <BulbOutlined />
          Prompt 模板
        </span>
      ),
      children: (
        <PromptTemplateManager
          visible={visible && activeTab === 'promptTemplates'}
          onClose={() => {}}
          templates={localPromptTemplates}
          embedded={true}
          onReload={async () => {
            try {
              const templates = await window.electronAPI.promptTemplates.getAll();
              setLocalPromptTemplates(templates);
              // 通知 App 重新加载模板列表
              if (onTemplatesChange) {
                await onTemplatesChange();
              }
            } catch (error) {
              message.error('加载模板失败');
            }
          }}
        />
      ),
    },
    {
      key: 'customTabs',
      label: (
        <span>
          <TagOutlined />
          自定义Tab
        </span>
      ),
      children: (
        <CustomTabManager
          visible={visible && activeTab === 'customTabs'}
          onClose={() => {}}
          customTabs={customTabs}
          onSave={(tabs) => {
            onSaveCustomTabs?.(tabs);
          }}
          existingTags={existingTags}
          embedded={true}
        />
      ),
    },
    {
      key: 'backup',
      label: (
        <span>
          <DatabaseOutlined />
          数据备份
        </span>
      ),
      children: <BackupSettings />,
    },
    {
      key: 'urlAuthorization',
      label: (
        <span>
          <LinkOutlined />
          URL授权管理
        </span>
      ),
      children: <URLAuthorizationManager />,
    },
    {
      key: 'storage',
      label: (
        <span>
          <DatabaseOutlined />
          存储管理
        </span>
      ),
      children: <StorageManagement />,
    },
  ];

  return (
    <Modal
      title="应用设置"
      open={visible}
      onOk={activeTab === 'general' ? handleSubmit : onCancel}
      onCancel={onCancel}
      okText={activeTab === 'general' || activeTab === 'ai' ? '保存' : '关闭'}
      cancelText={(activeTab === 'general' || activeTab === 'ai' || activeTab === 'urlAuthorization') ? '取消' : undefined}
      width={800}
      styles={{ body: { padding: '16px 24px' } }}
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
      />
    </Modal>
  );
};

export default SettingsModal;
