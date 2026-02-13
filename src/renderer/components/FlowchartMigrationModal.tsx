import React, { useState, useEffect } from 'react';
import { Modal, Button, Typography, Space, Alert, Spin, Radio, List, Tag, Progress, Divider, Collapse, Result } from 'antd';
import { DeleteOutlined, ExportOutlined, CheckCircleOutlined, WarningOutlined } from '@ant-design/icons';

const { Text, Title, Paragraph } = Typography;
const { Panel } = Collapse;

interface MigrationStatus {
  hasLegacyFlowcharts: boolean;
  flowchartCount: number;
  totalNodes: number;
  totalEdges: number;
  canMigrate: boolean;
}

interface MigrationFlowchart {
  id: string;
  name: string;
  description: string | null;
  nodes: any[];
  edges: any[];
  created_at: number;
  updated_at: number;
}

interface MigrationResult {
  success: boolean;
  migratedCount: number;
  skippedCount: number;
  errors: string[];
  details: Array<{
    flowchartId: string;
    flowchartName: string;
    success: boolean;
    todoId?: number;
    error?: string;
  }>;
}

interface FlowchartMigrationPanelProps {
  visible: boolean;
  onClose: () => void;
}

const FlowchartMigrationPanel: React.FC<FlowchartMigrationPanelProps> = ({ visible, onClose }) => {
  const [status, setStatus] = useState<MigrationStatus | null>(null);
  const [flowcharts, setFlowcharts] = useState<MigrationFlowchart[]>([]);
  const [loading, setLoading] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
  const [cleanupDone, setCleanupDone] = useState(false);
  const [migrationOption, setMigrationOption] = useState<'new' | 'existing'>('new');

  useEffect(() => {
    if (visible) {
      loadStatus();
      loadFlowcharts();
    }
  }, [visible]);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const result = await window.electronAPI.flowchartMigration.getStatus();
      setStatus(result);
    } catch (error) {
      console.error('Error loading migration status:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFlowcharts = async () => {
    try {
      setLoading(true);
      const result = await window.electronAPI.flowchartMigration.getFlowcharts();
      setFlowcharts(result);
    } catch (error) {
      console.error('Error loading flowcharts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMigrate = async () => {
    if (!status?.flowchartCount) {
      return;
    }

    try {
      setMigrating(true);
      const options = {
        createNewTodos: migrationOption === 'new'
      };
      const result = await window.electronAPI.flowchartMigration.migrate(options);
      setMigrationResult(result);

      // Reload status after migration
      await loadStatus();
      await loadFlowcharts();
    } catch (error) {
      console.error('Error migrating flowcharts:', error);
    } finally {
      setMigrating(false);
    }
  };

  const handleCleanup = async () => {
    Modal.confirm({
      title: '确认清理旧流程图数据？',
      content: '此操作将永久删除所有独立的流程图数据表（包括流程图、节点、边和关联关系）。此操作不可撤销！',
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          setLoading(true);
          const result = await window.electronAPI.flowchartMigration.cleanup();
          if (result.success) {
            setCleanupDone(true);
            await loadStatus();
            setFlowcharts([]);
            setMigrationResult(null);
          } else {
            Modal.error({
              title: '清理失败',
              content: result.error || '未知错误'
            });
          }
        } catch (error) {
          console.error('Error cleaning up:', error);
        } finally {
          setLoading(false);
        }
      }
    });
  };

  if (loading && !status) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <Spin size="large" />
        <div style={{ marginTop: '16px' }}>加载中...</div>
      </div>
    );
  }

  if (cleanupDone) {
    return (
      <div style={{ padding: '24px' }}>
        <Result
          status="success"
          title="流程图迁移完成"
          subTitle="旧的流程图数据已成功清理"
          extra={[
            <Button type="primary" key="close" onClick={onClose}>
              关闭
            </Button>
          ]}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <Title level={4}>流程图迁移</Title>
      <Paragraph type="secondary">
        将旧的独立流程图系统数据迁移到新的嵌入式流程图格式。
      </Paragraph>

      {!status?.hasLegacyFlowcharts ? (
        <Alert
          message="没有需要迁移的流程图"
          description="当前系统中没有检测到旧的独立流程图数据。"
          type="info"
          showIcon
          style={{ marginBottom: '16px' }}
        />
      ) : (
        <>
          <Alert
            message="检测到旧的流程图数据"
            description={
              <Space direction="vertical" size="small">
                <Text>找到 {status?.flowchartCount} 个流程图</Text>
                <Text>共 {status?.totalNodes} 个节点</Text>
                <Text>共 {status?.totalEdges} 条边</Text>
              </Space>
            }
            type="warning"
            showIcon
            style={{ marginBottom: '16px' }}
          />

          <Collapse defaultActiveKey={['flowcharts']} style={{ marginBottom: '16px' }}>
            <Panel header={`流程图列表 (${flowcharts.length})`} key="flowcharts">
              <List
                dataSource={flowcharts}
                renderItem={(flowchart) => (
                  <List.Item>
                    <List.Item.Meta
                      title={
                        <Space>
                          <Text strong>{flowchart.name}</Text>
                          <Tag color="blue">{flowchart.nodes.length} 节点</Tag>
                          <Tag color="green">{flowchart.edges.length} 边</Tag>
                        </Space>
                      }
                      description={
                        <Space direction="vertical" size="small">
                          {flowchart.description && <Text type="secondary">{flowchart.description}</Text>}
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            创建于: {new Date(flowchart.created_at).toLocaleString()}
                          </Text>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            </Panel>
          </Collapse>

          <div style={{ marginBottom: '16px' }}>
            <Title level={5}>迁移方式</Title>
            <Radio.Group value={migrationOption} onChange={(e) => setMigrationOption(e.target.value)}>
              <Space direction="vertical">
                <Radio value="new">
                  <Space>
                    <Text>创建新待办</Text>
                    <Text type="secondary">为每个流程图创建一个新的待办事项</Text>
                  </Space>
                </Radio>
                <Radio value="existing" disabled>
                  <Space>
                    <Text>追加到现有待办</Text>
                    <Text type="secondary">（暂不可用）</Text>
                  </Space>
                </Radio>
              </Space>
            </Radio.Group>
          </div>

          <Space style={{ marginBottom: '24px' }}>
            <Button
              type="primary"
              icon={<ExportOutlined />}
              onClick={handleMigrate}
              loading={migrating}
            >
              开始迁移
            </Button>
          </Space>

          {migrationResult && (
            <>
              <Divider />
              <Title level={5}>迁移结果</Title>
              {migrationResult.success ? (
                <Alert
                  message="迁移成功"
                  description={
                    <Space direction="vertical" size="small">
                      <Text>成功迁移 {migrationResult.migratedCount} 个流程图</Text>
                      {migrationResult.skippedCount > 0 && (
                        <Text>跳过 {migrationResult.skippedCount} 个流程图</Text>
                      )}
                    </Space>
                  }
                  type="success"
                  showIcon
                  style={{ marginBottom: '16px' }}
                />
              ) : (
                <Alert
                  message="迁移完成（部分失败）"
                  description={
                    <Space direction="vertical" size="small">
                      <Text>成功: {migrationResult.migratedCount}</Text>
                      <Text>跳过: {migrationResult.skippedCount}</Text>
                      {migrationResult.errors.length > 0 && (
                        <>
                          <Text strong>错误:</Text>
                          {migrationResult.errors.map((error, idx) => (
                            <Text key={idx} type="danger">• {error}</Text>
                          ))}
                        </>
                      )}
                    </Space>
                  }
                  type="warning"
                  showIcon
                  style={{ marginBottom: '16px' }}
                />
              )}

              <Collapse>
                <Panel header={`详细结果 (${migrationResult.details.length})`} key="details">
                  <List
                    dataSource={migrationResult.details}
                    renderItem={(detail) => (
                      <List.Item>
                        <List.Item.Meta
                          avatar={
                            detail.success ? (
                              <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '20px' }} />
                            ) : (
                              <WarningOutlined style={{ color: '#faad14', fontSize: '20px' }} />
                            )
                          }
                          title={detail.flowchartName}
                          description={
                            <Space direction="vertical" size="small">
                              {detail.success ? (
                                <Text type="success">
                                  {detail.todoId ? `已创建待办 #${detail.todoId}` : '迁移成功'}
                                </Text>
                              ) : (
                                <Text type="danger">{detail.error}</Text>
                              )}
                            </Space>
                          }
                        />
                      </List.Item>
                    )}
                  />
                </Panel>
              </Collapse>
            </>
          )}

          {status?.flowchartCount === 0 && migrationResult?.success && (
            <>
              <Divider />
              <Alert
                message="所有流程图已迁移"
                description="迁移完成后，您可以清理旧的流程图数据表以释放数据库空间。"
                type="info"
                showIcon
                style={{ marginBottom: '16px' }}
              />
              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={handleCleanup}
                loading={loading}
              >
                清理旧流程图数据
              </Button>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default FlowchartMigrationPanel;
