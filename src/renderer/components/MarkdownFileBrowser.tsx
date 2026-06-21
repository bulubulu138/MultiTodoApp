import React, { useState, useEffect } from 'react';
import {
  Modal,
  List,
  Button,
  Space,
  Typography,
  Tag,
  Card,
  Tooltip,
  message,
  Progress,
  Checkbox,
  Alert,
  Descriptions
} from 'antd';
import {
  FolderOpenOutlined,
  FileTextOutlined,
  ImportOutlined,
  ExportOutlined,
  ReloadOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';

const { Text, Paragraph } = Typography;

interface MarkdownFile {
  path: string;
  name: string;
  size: number;
  modifiedTime: Date;
  content?: string;
  exists: boolean;
}

interface MarkdownFileBrowserProps {
  visible: boolean;
  storagePath: string;
  onClose: () => void;
  onImportFile: (filePath: string) => Promise<void>;
  onRefresh?: () => Promise<void>;
}

const MarkdownFileBrowser: React.FC<MarkdownFileBrowserProps> = ({
  visible,
  storagePath,
  onClose,
  onImportFile,
  onRefresh
}) => {
  const [files, setFiles] = useState<MarkdownFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [previewFile, setPreviewFile] = useState<MarkdownFile | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (visible) {
      loadFiles();
    }
  }, [visible]);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const filePaths = await window.electronAPI.hybridStorage.scanMarkdownFiles();

      const fileData: MarkdownFile[] = filePaths.map((filePath: string) => {
        const name = filePath.split(/[/\\]/).pop() || 'unknown';
        const stats = require('fs').statSync(filePath);
        return {
          path: filePath,
          name,
          size: stats.size,
          modifiedTime: stats.mtime,
          exists: true
        };
      });

      setFiles(fileData);
    } catch (error) {
      console.error('Error loading markdown files:', error);
      message.error('加载MD文件失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      if (onRefresh) {
        await onRefresh();
      }
      await loadFiles();
      message.success('文件列表已刷新');
    } catch (error) {
      console.error('Error refreshing files:', error);
      message.error('刷新失败');
    } finally {
      setRefreshing(false);
    }
  };

  const handleSelectFile = (filePath: string) => {
    const isSelected = selectedFiles.includes(filePath);
    if (isSelected) {
      setSelectedFiles(selectedFiles.filter(f => f !== filePath));
    } else {
      setSelectedFiles([...selectedFiles, filePath]);
    }
  };

  const handleSelectAll = () => {
    if (selectedFiles.length === files.length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(files.map(f => f.path));
    }
  };

  const handleImportSelected = async () => {
    if (selectedFiles.length === 0) {
      message.warning('请先选择要导入的文件');
      return;
    }

    setImporting(true);
    const importPromises = selectedFiles.map(filePath =>
      onImportFile(filePath).catch(error => {
        console.error(`Failed to import ${filePath}:`, error);
        return { success: false, file: filePath } as any;
      })
    );

    try {
      const results = await Promise.all(importPromises);
      const successCount = results.filter(r => r.success).length;
      const failCount = results.length - successCount;

      if (failCount === 0) {
        message.success(`成功导入 ${successCount} 个文件`);
        setSelectedFiles([]);
        await loadFiles();
      } else {
        message.warning(`导入完成：成功 ${successCount} 个，失败 ${failCount} 个`);
      }
    } catch (error) {
      console.error('Error importing files:', error);
      message.error('导入文件时发生错误');
    } finally {
      setImporting(false);
    }
  };

  const handlePreview = async (file: MarkdownFile) => {
    try {
      // 读取文件内容预览
      const content = require('fs').readFileSync(file.path, 'utf-8');
      setPreviewFile({
        ...file,
        content: content.substring(0, 500) + (content.length > 500 ? '\n...' : '')
      });
    } catch (error) {
      console.error('Error reading file for preview:', error);
      message.error('读取文件预览失败');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleString('zh-CN');
  };

  return (
    <Modal
      rootClassName="ios-modal"
      title={<><FileTextOutlined /> Markdown文件浏览器</>}
      open={visible}
      onCancel={onClose}
      width={900}
      footer={null}
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 操作栏 */}
        <Card size="small">
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={handleRefresh}
              loading={refreshing}
            >
              刷新
            </Button>
            <Button
              icon={<CheckCircleOutlined />}
              onClick={handleSelectAll}
              disabled={files.length === 0}
            >
              {selectedFiles.length === files.length ? '取消全选' : '全选'}
            </Button>
            <Button
              type="primary"
              icon={<ImportOutlined />}
              onClick={handleImportSelected}
              disabled={selectedFiles.length === 0 || importing}
              loading={importing}
            >
              导入选中 ({selectedFiles.length})
            </Button>
          </Space>
          <div style={{ marginLeft: 'auto' }}>
            <Text type="secondary">
              存储位置: {storagePath}
            </Text>
          </div>
        </Card>

        {/* 文件列表 */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Progress percent={100} status="active" />
            <Text type="secondary">正在扫描MD文件...</Text>
          </div>
        ) : files.length === 0 ? (
          <Alert
            message="没有找到Markdown文件"
            description={`在目录 ${storagePath} 中没有找到 .md 文件`}
            type="info"
            showIcon
          />
        ) : (
          <Card size="small">
            <List
              dataSource={files}
              renderItem={(file) => (
                <List.Item
                  style={{
                    padding: '12px 0',
                    borderBottom: '1px solid #f0f0f0'
                  }}
                >
                  <Space direction="horizontal" style={{ width: '100%' }}>
                    <Checkbox
                      checked={selectedFiles.includes(file.path)}
                      onChange={() => handleSelectFile(file.path)}
                    />
                    <FileTextOutlined style={{ fontSize: '20px', color: '#52c41a' }} />
                    <div style={{ flex: 1 }}>
                      <Space direction="vertical" size={0} style={{ width: '100%' }}>
                        <Space>
                          <Text strong>{file.name}</Text>
                          <Tag color="blue">{formatFileSize(file.size)}</Tag>
                        </Space>
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          {file.path}
                        </Text>
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          修改时间: {formatDate(file.modifiedTime)}
                        </Text>
                      </Space>
                    </div>
                    <Space>
                      <Tooltip title="预览">
                        <Button
                          type="text"
                          icon={<EyeOutlined />}
                          onClick={() => handlePreview(file)}
                        >
                          预览
                        </Button>
                      </Tooltip>
                      <Tooltip title="导入此文件">
                        <Button
                          type="primary"
                          size="small"
                          icon={<ImportOutlined />}
                          onClick={() => onImportFile(file.path)}
                        >
                          导入
                        </Button>
                      </Tooltip>
                    </Space>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        )}

        {/* 文件预览 */}
        {previewFile && (
          <Card
            title="文件预览"
            size="small"
            extra={
              <Button
                type="text"
                onClick={() => setPreviewFile(null)}
              >
                关闭
              </Button>
            }
          >
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="文件名">{previewFile.name}</Descriptions.Item>
              <Descriptions.Item label="文件大小">
                {formatFileSize(previewFile.size)}
              </Descriptions.Item>
              <Descriptions.Item label="修改时间">
                {formatDate(previewFile.modifiedTime)}
              </Descriptions.Item>
            </Descriptions>
            <div
              style={{
                background: '#f5f5f5',
                padding: '12px',
                borderRadius: '4px',
                maxHeight: '200px',
                overflow: 'auto',
                fontFamily: 'monospace',
                fontSize: '12px',
                whiteSpace: 'pre-wrap'
              }}
            >
              {previewFile.content}
            </div>
          </Card>
        )}

        {/* 统计信息 */}
        {files.length > 0 && (
          <Alert
            message={`找到 ${files.length} 个Markdown文件，已选择 ${selectedFiles.length} 个`}
            type="info"
            showIcon
          />
        )}
      </Space>
    </Modal>
  );
};

export default MarkdownFileBrowser;