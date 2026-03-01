import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Tag, Typography, Statistic, Row, Col, message, Popconfirm, Tooltip, Alert } from 'antd';
import { ReloadOutlined, DeleteOutlined, ClearOutlined, LinkOutlined, CloudDownloadOutlined, CopyOutlined } from '@ant-design/icons';
import { App } from 'antd';

const { Text } = Typography;

/**
 * URL授权记录接口
 */
interface URLAuthorizationRecord {
  id: number;
  url: string;
  domain: string;
  title: string | null;
  first_authorized_at: string;
  last_refreshed_at: string;
  refresh_count: number;
  status: 'active' | 'expired' | 'failed';
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * URL显示记录接口（包括未授权的URL）
 */
interface URLDisplayRecord {
  url: string;
  todoId: number;
  hasAuthorization: boolean;
  authorization: URLAuthorizationRecord | null;
  // 计算属性
  status: 'active' | 'expired' | 'failed' | 'unauthorized';
  title: string | null;
  domain: string;
  last_refreshed_at: string | null;
  refresh_count: number;
  id?: number; // 可选，用于已授权的记录
}

/**
 * URL授权管理组件
 */
const URLAuthorizationManager: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const [records, setRecords] = useState<URLDisplayRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [showInitPrompt, setShowInitPrompt] = useState(false);

  // 域名提取工具函数
  const extractDomain = (url: string): string => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return 'unknown';
    }
  };

  // 加载所有URL（包括未授权的）
  const loadRecords = async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI.urlAuth.getAllUrls();
      if (result.success && result.data) {
        // 转换数据格式
        const displayRecords: URLDisplayRecord[] = result.data.map(item => {
          if (item.hasAuthorization && item.authorization) {
            return {
              id: item.authorization.id,
              url: item.authorization.url,
              domain: item.authorization.domain,
              title: item.authorization.title,
              first_authorized_at: item.authorization.first_authorized_at,
              last_refreshed_at: item.authorization.last_refreshed_at,
              refresh_count: item.authorization.refresh_count,
              status: item.authorization.status,
              error_message: item.authorization.error_message,
              created_at: item.authorization.created_at,
              updated_at: item.authorization.updated_at,
              todoId: item.todoId,
              hasAuthorization: true,
              authorization: item.authorization,
            };
          } else {
            return {
              url: item.url,
              todoId: item.todoId,
              hasAuthorization: false,
              authorization: null,
              status: 'unauthorized' as const,
              title: null,
              domain: extractDomain(item.url),
              last_refreshed_at: null,
              refresh_count: 0,
            };
          }
        });
        setRecords(displayRecords);
      }
    } catch (error) {
      console.error('Failed to load URLs:', error);
      messageApi.error('加载URL失败');
    } finally {
      setLoading(false);
    }
  };

  // 组件挂载时加载数据
  useEffect(() => {
    loadRecords();
  }, []);

  // 检查是否需要显示初始化提示
  useEffect(() => {
    if (!loading && records.length === 0) {
      setShowInitPrompt(true);
    } else {
      setShowInitPrompt(false);
    }
  }, [records, loading]);

  // 批量刷新所有授权
  const handleRefreshAll = async () => {
    setRefreshing(true);
    try {
      const result = await window.electronAPI.urlAuth.refreshAll();
      if (result.success) {
        messageApi.success(
          `刷新完成！成功: ${result.successCount}, 失败: ${result.failedCount}`
        );
        await loadRecords(); // 重新加载数据
      } else {
        messageApi.error('刷新失败: ' + result.error);
      }
    } catch (error) {
      console.error('Failed to refresh authorizations:', error);
      messageApi.error('刷新失败');
    } finally {
      setRefreshing(false);
    }
  };

  // 清理过期记录
  const handleCleanup = async () => {
    try {
      const result = await window.electronAPI.urlAuth.cleanup();
      if (result.success) {
        messageApi.success(`已清理 ${result.count} 条过期记录`);
        await loadRecords(); // 重新加载数据
      } else {
        messageApi.error('清理失败: ' + result.error);
      }
    } catch (error) {
      console.error('Failed to cleanup:', error);
      messageApi.error('清理失败');
    }
  };

  // 初始化授权数据库（从现有待办事项迁移）
  const handleInitialize = async () => {
    setInitializing(true);
    try {
      const result = await window.electronAPI.urlAuth.initialize();
      if (result.success) {
        messageApi.success(`成功迁移 ${result.count} 条授权记录`);
        setShowInitPrompt(false);
        await loadRecords(); // 重新加载数据
      } else {
        messageApi.error('初始化失败: ' + result.error);
      }
    } catch (error) {
      console.error('Failed to initialize:', error);
      messageApi.error('初始化失败');
    } finally {
      setInitializing(false);
    }
  };

  // 删除单个记录
  const handleDelete = async (url: string) => {
    try {
      const result = await window.electronAPI.urlAuth.delete(url);
      if (result.success) {
        messageApi.success('删除成功');
        await loadRecords(); // 重新加载数据
      } else {
        messageApi.error('删除失败: ' + result.error);
      }
    } catch (error) {
      console.error('Failed to delete authorization:', error);
      messageApi.error('删除失败');
    }
  };

  // 立即授权
  const handleAuthorize = async (url: string) => {
    try {
      const result = await window.electronAPI.urlAuth.authorize(url);
      if (result.success && result.title) {
        messageApi.success('授权成功！');
        await loadRecords(); // 重新加载列表
      } else {
        messageApi.warning('授权窗口已打开，请在窗口中完成授权');
      }
    } catch (error) {
      console.error('Failed to authorize URL:', error);
      messageApi.error('授权失败');
    }
  };

  // 复制URL
  const handleCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      messageApi.success('URL已复制到剪贴板');
    } catch (error) {
      console.error('Failed to copy URL:', error);
      messageApi.error('复制失败');
    }
  };

  // 格式化相对时间
  const formatRelativeTime = (timestamp: string | null): string => {
    if (!timestamp) return '-';
    const now = Date.now();
    const time = new Date(timestamp).getTime();
    const diff = now - time;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 30) return `${days}天前`;
    return new Date(timestamp).toLocaleDateString('zh-CN');
  };

  // 渲染状态标签
  const renderStatus = (status: string) => {
    switch (status) {
      case 'active':
        return <Tag color="success">已授权</Tag>;
      case 'failed':
        return <Tag color="error">授权失败</Tag>;
      case 'expired':
        return <Tag color="default">已过期</Tag>;
      case 'unauthorized':
        return <Tag color="warning">未授权</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };

  // 渲染URL（带截断）
  const renderUrl = (url: string) => {
    const maxLength = 50;
    if (url.length <= maxLength) return url;
    return (
      <Tooltip title={url}>
        <Text>{url.substring(0, maxLength)}...</Text>
      </Tooltip>
    );
  };

  // 渲染标题（带截断）
  const renderTitle = (title: string | null) => {
    if (!title) return <Text type="secondary">未获取</Text>;
    const maxLength = 40;
    if (title.length <= maxLength) return title;
    return (
      <Tooltip title={title}>
        <Text>{title.substring(0, maxLength)}...</Text>
      </Tooltip>
    );
  };

  // 统计数据
  const stats = {
    total: records.length,
    active: records.filter(r => r.status === 'active').length,
    failed: records.filter(r => r.status === 'failed').length,
    expired: records.filter(r => r.status === 'expired').length,
    unauthorized: records.filter(r => r.status === 'unauthorized').length,
  };

  const columns = [
    {
      title: 'URL',
      dataIndex: 'url',
      key: 'url',
      width: '30%',
      ellipsis: true,
      render: renderUrl,
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: '25%',
      ellipsis: true,
      render: renderTitle,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: renderStatus,
    },
    {
      title: '最后刷新',
      dataIndex: 'last_refreshed_at',
      key: 'last_refreshed_at',
      width: 120,
      render: formatRelativeTime,
    },
    {
      title: '刷新次数',
      dataIndex: 'refresh_count',
      key: 'refresh_count',
      width: 100,
      align: 'center' as const,
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: unknown, record: URLDisplayRecord) => (
        <Space size="small">
          {/* 未授权URL：显示立即授权按钮 */}
          {record.status === 'unauthorized' && (
            <Button
              type="primary"
              size="small"
              onClick={() => handleAuthorize(record.url)}
            >
              立即授权
            </Button>
          )}

          {/* 复制URL按钮 */}
          <Button
            type="text"
            size="small"
            icon={<CopyOutlined />}
            onClick={() => handleCopyUrl(record.url)}
          />

          {/* 删除按钮 - 仅对已授权的URL */}
          {record.hasAuthorization && (
            <Popconfirm
              title="删除授权"
              description="确定要删除此授权记录吗？"
              onConfirm={() => handleDelete(record.url)}
              okText="确定"
              cancelText="取消"
            >
              <Button
                type="text"
                danger
                size="small"
                icon={<DeleteOutlined />}
              />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* 统计信息 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}>
          <Statistic
            title="总计"
            value={stats.total}
            prefix={<LinkOutlined />}
            valueStyle={{ fontSize: 18 }}
          />
        </Col>
        <Col span={5}>
          <Statistic
            title="已授权"
            value={stats.active}
            valueStyle={{ color: '#52c41a', fontSize: 18 }}
          />
        </Col>
        <Col span={5}>
          <Statistic
            title="授权失败"
            value={stats.failed}
            valueStyle={{ color: '#ff4d4f', fontSize: 18 }}
          />
        </Col>
        <Col span={5}>
          <Statistic
            title="未授权"
            value={stats.unauthorized}
            valueStyle={{ color: '#faad14', fontSize: 18 }}
          />
        </Col>
        <Col span={5}>
          <Statistic
            title="已过期"
            value={stats.expired}
            valueStyle={{ color: '#8c8c8c', fontSize: 18 }}
          />
        </Col>
      </Row>

      {/* 初始化提示 */}
      {showInitPrompt && (
        <Alert
          message="检测到没有授权记录"
          description="授权数据库为空。您可以从现有的待办事项中迁移已授权的URL，或者通过正常的授权流程逐步添加记录。"
          type="info"
          showIcon
          action={
            <Button
              type="primary"
              size="small"
              icon={<CloudDownloadOutlined />}
              loading={initializing}
              onClick={handleInitialize}
            >
              从待办事项迁移
            </Button>
          }
          style={{ marginBottom: 16 }}
          closable
          onClose={() => setShowInitPrompt(false)}
        />
      )}

      {/* 操作按钮 */}
      <Space style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<ReloadOutlined />}
          loading={refreshing}
          onClick={handleRefreshAll}
          disabled={records.length === 0}
        >
          全部刷新
        </Button>
        <Popconfirm
          title="清理过期记录"
          description="确定要清理超过30天未刷新的非活跃记录吗？"
          onConfirm={handleCleanup}
          okText="确定"
          cancelText="取消"
          disabled={stats.expired === 0}
        >
          <Button
            icon={<ClearOutlined />}
            disabled={stats.expired === 0}
          >
            清理过期记录
          </Button>
        </Popconfirm>
      </Space>

      {/* 数据表格 */}
      <Table
        columns={columns}
        dataSource={records}
        rowKey={(record) => record.url}
        loading={loading}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条记录`,
        }}
        size="small"
      />

      {/* 提示信息 */}
      <div style={{ marginTop: 16, padding: 12, backgroundColor: 'var(--ant-color-fill-tertiary)', borderRadius: 4, fontSize: 12 }}>
        <Text type="secondary">
          💡 提示：授权数据库会自动记录所有已授权的URL标题。卡片中的URL标题优先从此处获取，
          避免重复网络请求。系统会自动定期刷新活跃的授权记录。
        </Text>
      </div>
    </div>
  );
};

export default URLAuthorizationManager;
