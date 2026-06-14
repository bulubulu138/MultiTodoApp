import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Drawer, Tabs, List, Button, Input, Space, Modal, message, Tooltip, Dropdown, Menu } from 'antd';
import {
  PlusOutlined,
  FileTextOutlined,
  DeleteOutlined,
  EditOutlined,
  FolderOpenOutlined,
  ExclamationCircleOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import type { Todo, ReviewFile } from '../../../shared/types';
import MarkdownEditorReview from './MarkdownEditorReview';
import dayjs from 'dayjs';
import './ReviewModeDrawer.css';

const { TabPane } = Tabs;
const { confirm } = Modal;

interface ReviewModeDrawerProps {
  visible: boolean;
  onClose: () => void;
  todos: Todo[];
  onDeleteTodo: (uuid: string) => Promise<void>;
}

const ReviewModeDrawer: React.FC<ReviewModeDrawerProps> = ({
  visible,
  onClose,
  todos,
  onDeleteTodo,
}) => {
  const [activeTab, setActiveTab] = useState<'files' | 'todos'>('files');
  const [reviewFiles, setReviewFiles] = useState<ReviewFile[]>([]);
  const [currentFile, setCurrentFile] = useState<ReviewFile | null>(null);
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [todoSearchText, setTodoSearchText] = useState('');
  const [renamingFileId, setRenamingFileId] = useState<string | null>(null);
  const [newFilename, setNewFilename] = useState('');

  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 加载复盘文件列表
  const loadReviewFiles = useCallback(async () => {
    try {
      setLoading(true);
      // @ts-ignore - review API 已在 preload.ts 中定义
      const files = await window.electronAPI.review.list();
      setReviewFiles(files);
    } catch (error) {
      console.error('Failed to load review files:', error);
      message.error('加载复盘文件失败');
    } finally {
      setLoading(false);
    }
  }, []);

  // 初始加载
  useEffect(() => {
    if (visible) {
      loadReviewFiles();
    }
  }, [visible, loadReviewFiles]);

  // 创建新文件
  const handleCreateFile = useCallback(async () => {
    try {
      // @ts-ignore - review API 已在 preload.ts 中定义
      const newFile = await window.electronAPI.review.create();
      await loadReviewFiles();
      setCurrentFile(newFile);
      setContent('');
      setLastSaved(null);
      message.success('创建复盘文件成功');
    } catch (error) {
      console.error('Failed to create review file:', error);
      message.error('创建复盘文件失败');
    }
  }, [loadReviewFiles]);

  // 选择文件
  const handleFileSelect = useCallback(async (file: ReviewFile) => {
    try {
      // 如果有未保存的内容，先保存
      if (currentFile && saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        // @ts-ignore
        await window.electronAPI.review.update(currentFile.filepath, content);
      }

      setLoading(true);
      // @ts-ignore
      const fileContent = await window.electronAPI.review.read(file.filepath);
      setCurrentFile(file);
      setContent(fileContent);
      setLastSaved(new Date(file.updatedAt));
    } catch (error) {
      console.error('Failed to read review file:', error);
      message.error('读取复盘文件失败');
    } finally {
      setLoading(false);
    }
  }, [currentFile, content]);

  // 删除文件
  const handleDeleteFile = useCallback((file: ReviewFile) => {
    confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: `确定要删除复盘文件"${file.filename}"吗？此操作无法撤销。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          // @ts-ignore
          await window.electronAPI.review.delete(file.filepath);
          await loadReviewFiles();
          if (currentFile?.filepath === file.filepath) {
            setCurrentFile(null);
            setContent('');
            setLastSaved(null);
          }
          message.success('删除成功');
        } catch (error) {
          console.error('Failed to delete review file:', error);
          message.error('删除失败');
        }
      },
    });
  }, [loadReviewFiles, currentFile]);

  // 重命名文件
  const handleRenameFile = useCallback(async (file: ReviewFile, newName: string) => {
    try {
      if (!newName.trim()) {
        message.error('文件名不能为空');
        return;
      }

      if (!newName.endsWith('.md')) {
        newName = newName + '.md';
      }

      const dir = file.filepath.substring(0, file.filepath.lastIndexOf('\\') + 1);
      const newPath = dir + newName;

      // @ts-ignore
      await window.electronAPI.review.rename(file.filepath, newPath);
      await loadReviewFiles();
      if (currentFile?.filepath === file.filepath) {
        setCurrentFile({ ...file, filename: newName, filepath: newPath });
      }
      message.success('重命名成功');
      setRenamingFileId(null);
    } catch (error) {
      console.error('Failed to rename review file:', error);
      message.error('重命名失败');
    }
  }, [loadReviewFiles, currentFile]);

  // 在文件管理器中打开
  const handleOpenInExplorer = useCallback(async (file: ReviewFile) => {
    try {
      // @ts-ignore
      await window.electronAPI.review.openInExplorer(file.filepath);
    } catch (error) {
      console.error('Failed to open in explorer:', error);
      message.error('打开文件管理器失败');
    }
  }, []);

  // 删除代办
  const handleDeleteTodoInReview = useCallback((todo: Todo) => {
    confirm({
      title: '确认删除代办',
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p>该操作将从整个系统中删除代办（包括所有复盘文档中的引用），无法撤销。</p>
          <p style={{ color: '#ff4d4f', fontWeight: 'bold' }}>
            代办标题：{todo.title}
          </p>
          <p style={{ marginTop: 8 }}>建议：如需管理代办，请前往主界面进行操作。</p>
        </div>
      ),
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await onDeleteTodo(todo.id);
          message.success('删除成功');
        } catch (error) {
          console.error('Failed to delete todo:', error);
          message.error('删除失败');
        }
      },
    });
  }, [onDeleteTodo]);

  // 内容变化处理（防抖保存）
  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);

    if (!currentFile) return;

    // 清除之前的定时器
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    // 设置新的定时器（1秒后自动保存）
    saveTimerRef.current = setTimeout(async () => {
      try {
        setSaving(true);
        // @ts-ignore
        await window.electronAPI.review.update(currentFile.filepath, newContent);
        setLastSaved(new Date());
        message.success('自动保存成功', 1);
      } catch (error) {
        console.error('Failed to auto-save:', error);
        message.error('自动保存失败');
      } finally {
        setSaving(false);
      }
    }, 1000);
  }, [currentFile]);

  // 手动保存
  const handleManualSave = useCallback(async () => {
    if (!currentFile) return;

    // 清除自动保存定时器
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    try {
      setSaving(true);
      // @ts-ignore
      await window.electronAPI.review.update(currentFile.filepath, content);
      setLastSaved(new Date());
      message.success('保存成功');
    } catch (error) {
      console.error('Failed to save:', error);
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  }, [currentFile, content]);

  // 过滤代办列表
  const filteredTodos = todoSearchText
    ? todos.filter(todo =>
        todo.title.toLowerCase().includes(todoSearchText.toLowerCase())
      )
    : todos;

  // 文件右键菜单
  const getFileContextMenu = (file: ReviewFile) => (
    <Menu>
      <Menu.Item
        key="rename"
        icon={<EditOutlined />}
        onClick={() => {
          setRenamingFileId(file.filepath);
          setNewFilename(file.filename.replace('.md', ''));
        }}
      >
        重命名
      </Menu.Item>
      <Menu.Item
        key="explorer"
        icon={<FolderOpenOutlined />}
        onClick={() => handleOpenInExplorer(file)}
      >
        在文件管理器中打开
      </Menu.Item>
      <Menu.Item
        key="delete"
        icon={<DeleteOutlined />}
        danger
        onClick={() => handleDeleteFile(file)}
      >
        删除
      </Menu.Item>
    </Menu>
  );

  return (
    <Drawer
      title="复盘模式"
      placement="right"
      width="90%"
      open={visible}
      onClose={onClose}
      className="review-mode-drawer"
    >
      <div className="review-mode-container">
        {/* 左侧面板 */}
        <div className="review-sidebar">
          <Tabs activeKey={activeTab} onChange={(key) => setActiveTab(key as 'files' | 'todos')}>
            <TabPane tab="复盘文档" key="files">
              <div className="files-tab-content">
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={handleCreateFile}
                  block
                  style={{ marginBottom: 16 }}
                >
                  新建复盘文档
                </Button>

                <List
                  loading={loading}
                  dataSource={reviewFiles}
                  renderItem={(file) => (
                    <List.Item
                      className={currentFile?.filepath === file.filepath ? 'file-item-active' : ''}
                      onClick={() => handleFileSelect(file)}
                      style={{ cursor: 'pointer' }}
                    >
                      <Dropdown overlay={getFileContextMenu(file)} trigger={['contextMenu']}>
                        <div style={{ width: '100%' }}>
                          {renamingFileId === file.filepath ? (
                            <Input
                              value={newFilename}
                              onChange={(e) => setNewFilename(e.target.value)}
                              onPressEnter={() => handleRenameFile(file, newFilename)}
                              onBlur={() => {
                                if (newFilename.trim()) {
                                  handleRenameFile(file, newFilename);
                                } else {
                                  setRenamingFileId(null);
                                }
                              }}
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <>
                              <div className="file-item-title">
                                <FileTextOutlined /> {file.filename}
                              </div>
                              <div className="file-item-meta">
                                {dayjs(file.updatedAt).format('YYYY-MM-DD HH:mm')}
                              </div>
                            </>
                          )}
                        </div>
                      </Dropdown>
                    </List.Item>
                  )}
                />
              </div>
            </TabPane>

            <TabPane tab="代办列表" key="todos">
              <div className="todos-tab-content">
                <Input
                  placeholder="搜索代办..."
                  prefix={<SearchOutlined />}
                  value={todoSearchText}
                  onChange={(e) => setTodoSearchText(e.target.value)}
                  allowClear
                  style={{ marginBottom: 16 }}
                />

                <List
                  dataSource={filteredTodos}
                  renderItem={(todo) => (
                    <List.Item
                      actions={[
                        <Tooltip title="删除代办（永久删除）">
                          <Button
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => handleDeleteTodoInReview(todo)}
                          />
                        </Tooltip>,
                      ]}
                    >
                      <List.Item.Meta
                        title={todo.title}
                        description={
                          <Space size="small">
                            <span className={`status-badge status-${todo.status}`}>
                              {todo.status === 'pending' ? '待处理' :
                               todo.status === 'in_progress' ? '进行中' :
                               todo.status === 'completed' ? '已完成' : '暂停'}
                            </span>
                            <span className={`priority-badge priority-${todo.priority}`}>
                              {todo.priority === 'mental' ? '脑力' :
                               todo.priority === 'communication' ? '沟通' : '琐碎'}
                            </span>
                          </Space>
                        }
                      />
                    </List.Item>
                  )}
                />
              </div>
            </TabPane>
          </Tabs>
        </div>

        {/* 右侧编辑器 */}
        <div className="review-editor">
          {currentFile ? (
            <MarkdownEditorReview
              value={content}
              onChange={handleContentChange}
              onSave={handleManualSave}
              todos={todos}
              saving={saving}
              lastSaved={lastSaved}
            />
          ) : (
            <div className="editor-empty-state">
              <FileTextOutlined style={{ fontSize: 64, color: '#ccc' }} />
              <p style={{ marginTop: 16, color: '#999' }}>
                请选择或创建一个复盘文档
              </p>
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
};

export default ReviewModeDrawer;
