/**
 * 存储完整性诊断模态框
 * 用于显示详细的存储系统检查结果
 */

import React, { useState, useEffect } from 'react';
import { Modal, Descriptions, Tag, Alert, Button, Collapse, Space, Typography, Card, Statistic, Row, Col, Spin, message } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  ToolOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';

const { Text, Title, Paragraph } = Typography;
const { Panel } = Collapse;

interface StorageDiagnosticResult {
  success: boolean;
  healthy: boolean;
  checks: {
    database: {
      healthy: boolean;
      todoCount: number;
      sampleTitles: string[];
      error?: string;
    };
    fileSystem: {
      healthy: boolean;
      mdFileCount: number;
      sampleFiles: string[];
      error?: string;
    };
    index: {
      healthy: boolean;
      indexEntryCount: number;
      indexLoaded: boolean;
      sampleEntries: Array<{ uuid: string; title: string }>;
      error?: string;
    };
    mapping: {
      healthy: boolean;
      orphanFiles: string[];
      orphanRecords: string[];
      databaseMismatch: number;
      error?: string;
    };
  };
  summary: string;
  recommendations: string[];
  error?: string;
}

interface StorageDiagnosticModalProps {
  visible: boolean;
  onClose: () => void;
}

const StorageDiagnosticModal: React.FC<StorageDiagnosticModalProps> = ({ visible, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<StorageDiagnosticResult | null>(null);
  const [error, setError] = useState<string>('');

  const runDiagnostic = async () => {
    setLoading(true);
    setError('');
    setResult(null);

    try {
      console.log('[StorageDiagnosticModal] Running storage integrity check...');
      const diagnosticResult = await window.electronAPI.debug.checkStorageIntegrity();
      console.log('[StorageDiagnosticModal] Diagnostic result:', diagnosticResult);

      if (diagnosticResult.success) {
        // 验证返回值结构的完整性
        if (!diagnosticResult.checks) {
          console.error('[StorageDiagnosticModal] Invalid result structure: missing checks field');
          setError('诊断返回数据结构异常，请联系开发者');
          message.error('存储完整性检查失败');
        } else {
          setResult(diagnosticResult);
          if (!diagnosticResult.healthy) {
            const recommendationCount = diagnosticResult.recommendations?.length || 0;
            message.warning(`发现 ${recommendationCount} 个问题，建议查看详情`);
          } else {
            message.success('存储系统健康');
          }
        }
      } else {
        setError(diagnosticResult.error || '诊断失败');
        message.error('存储完整性检查失败');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg);
      console.error('[StorageDiagnosticModal] Error running diagnostic:', err);
      message.error('存储完整性检查失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      runDiagnostic();
    }
  }, [visible]);

  const renderHealthIcon = (healthy: boolean) => {
    return healthy ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
  };

  const renderHealthTag = (healthy: boolean) => {
    return healthy ? (
      <Tag color="success" icon={<CheckCircleOutlined />}>健康</Tag>
    ) : (
      <Tag color="error" icon={<CloseCircleOutlined />}>异常</Tag>
    );
  };

  const renderRecommendations = () => {
    if (!result || !result.recommendations || result.recommendations.length === 0) {
      return null;
    }

    return (
      <Card
        title={
          <Space>
            <ToolOutlined />
            <Text strong>修复建议</Text>
          </Space>
        }
        style={{ marginTop: 16 }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {result.recommendations.map((rec, index) => (
            <Alert
              key={index}
              message={`${index + 1}. ${rec}`}
              type="info"
              showIcon
              icon={<InfoCircleOutlined />}
            />
          ))}
        </Space>
      </Card>
    );
  };

  return (
    <Modal
      title={
        <Space>
          <ToolOutlined />
          <Text strong>存储完整性诊断</Text>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          关闭
        </Button>,
        <Button key="refresh" type="primary" icon={<ReloadOutlined />} onClick={runDiagnostic} loading={loading}>
          重新检查
        </Button>
      ]}
      width={1000}
      styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
    >
      {loading && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" tip="正在诊断存储系统..." />
        </div>
      )}

      {!loading && error && (
        <Alert
          message="诊断失败"
          description={error}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {!loading && result && (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {/* 总体健康状态 */}
          <Card>
            <Row gutter={16} align="middle">
              <Col span={12}>
                <Statistic
                  title="总体健康状态"
                  value={result.healthy ? '健康' : '异常'}
                  valueStyle={{ color: result.healthy ? '#52c41a' : '#ff4d4f', fontSize: 24 }}
                  prefix={result.healthy ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="发现问题数量"
                  value={result.recommendations?.length || 0}
                  valueStyle={{ color: (result.recommendations?.length || 0) > 0 ? '#ff4d4f' : '#52c41a', fontSize: 24 }}
                  prefix={<ExclamationCircleOutlined />}
                />
              </Col>
            </Row>
            <Paragraph style={{ marginTop: 16 }}>
              <Text strong>摘要：</Text>
              <Text>{result.summary || '无摘要信息'}</Text>
            </Paragraph>
          </Card>

          {/* 详细检查结果 */}
          {result.checks ? (
            <Collapse defaultActiveKey={['1', '2', '3', '4']} ghost>
            {/* 数据库检查 */}
            <Panel
              header={
                <Space>
                  {renderHealthIcon(result.checks.database?.healthy ?? false)}
                  <Text strong>数据库状态</Text>
                  {renderHealthTag(result.checks.database?.healthy ?? false)}
                </Space>
              }
              key="1"
            >
              <Descriptions bordered column={1}>
                <Descriptions.Item label="健康状态">
                  {result.checks.database?.healthy ? '✅ 正常' : '❌ 异常'}
                </Descriptions.Item>
                <Descriptions.Item label="待办数量">
                  {result.checks.database?.todoCount ?? 0}
                </Descriptions.Item>
                <Descriptions.Item label="示例标题">
                  {(result.checks.database?.sampleTitles?.length ?? 0) > 0
                    ? result.checks.database.sampleTitles.join(', ')
                    : '无'}
                </Descriptions.Item>
                {result.checks.database?.error && (
                  <Descriptions.Item label="错误信息">
                    <Text type="danger">{result.checks.database.error}</Text>
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Panel>

            {/* 文件系统检查 */}
            <Panel
              header={
                <Space>
                  {renderHealthIcon(result.checks.fileSystem?.healthy ?? false)}
                  <Text strong>文件系统状态</Text>
                  {renderHealthTag(result.checks.fileSystem?.healthy ?? false)}
                </Space>
              }
              key="2"
            >
              <Descriptions bordered column={1}>
                <Descriptions.Item label="健康状态">
                  {result.checks.fileSystem?.healthy ? '✅ 正常' : '❌ 异常'}
                </Descriptions.Item>
                <Descriptions.Item label="Markdown文件数量">
                  <Text
                    strong
                    style={{
                      color: (result.checks.fileSystem?.mdFileCount ?? 0) > 0 ? '#52c41a' : '#ff4d4f',
                      fontSize: 18
                    }}
                  >
                    {result.checks.fileSystem?.mdFileCount ?? 0}
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label="示例文件">
                  {(result.checks.fileSystem?.sampleFiles?.length ?? 0) > 0
                    ? result.checks.fileSystem.sampleFiles.join(', ')
                    : '无'}
                </Descriptions.Item>
                {result.checks.fileSystem?.error && (
                  <Descriptions.Item label="错误信息">
                    <Text type="danger">{result.checks.fileSystem.error}</Text>
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Panel>

            {/* 索引检查 */}
            <Panel
              header={
                <Space>
                  {renderHealthIcon(result.checks.index?.healthy ?? false)}
                  <Text strong>索引状态</Text>
                  {renderHealthTag(result.checks.index?.healthy ?? false)}
                </Space>
              }
              key="3"
            >
              <Descriptions bordered column={1}>
                <Descriptions.Item label="健康状态">
                  {result.checks.index?.healthy ? '✅ 正常' : '❌ 异常'}
                </Descriptions.Item>
                <Descriptions.Item label="索引条目数量">
                  {result.checks.index?.indexEntryCount ?? 0}
                </Descriptions.Item>
                <Descriptions.Item label="索引已加载">
                  {result.checks.index?.indexLoaded ? '✅ 是' : '❌ 否'}
                </Descriptions.Item>
                <Descriptions.Item label="示例条目">
                  {(result.checks.index?.sampleEntries?.length ?? 0) > 0
                    ? result.checks.index.sampleEntries
                        .map(e => `${e.uuid}: ${e.title || 'Untitled'}`)
                        .join(', ')
                    : '无'}
                </Descriptions.Item>
                {result.checks.index?.error && (
                  <Descriptions.Item label="错误信息">
                    <Text type="danger">{result.checks.index.error}</Text>
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Panel>

            {/* 映射检查 */}
            <Panel
              header={
                <Space>
                  {renderHealthIcon(result.checks.mapping?.healthy ?? false)}
                  <Text strong>映射关系</Text>
                  {renderHealthTag(result.checks.mapping?.healthy ?? false)}
                </Space>
              }
              key="4"
            >
              <Descriptions bordered column={1}>
                <Descriptions.Item label="健康状态">
                  {result.checks.mapping?.healthy ? '✅ 正常' : '❌ 异常'}
                </Descriptions.Item>
                <Descriptions.Item label="孤立文件数量">
                  <Text
                    strong
                    style={{ color: (result.checks.mapping?.orphanFiles?.length ?? 0) > 0 ? '#ff4d4f' : '#52c41a' }}
                  >
                    {result.checks.mapping?.orphanFiles?.length ?? 0}
                  </Text>
                  {(result.checks.mapping?.orphanFiles?.length ?? 0) > 0 && (
                    <Alert
                      message="发现孤立文件"
                      description={`${result.checks.mapping.orphanFiles.length} 个文件存在但索引中不存在`}
                      type="warning"
                      showIcon
                      style={{ marginTop: 8 }}
                    />
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="孤立记录数量">
                  <Text
                    strong
                    style={{ color: (result.checks.mapping?.orphanRecords?.length ?? 0) > 0 ? '#ff4d4f' : '#52c41a' }}
                  >
                    {result.checks.mapping?.orphanRecords?.length ?? 0}
                  </Text>
                  {(result.checks.mapping?.orphanRecords?.length ?? 0) > 0 && (
                    <Alert
                      message="发现孤立索引记录"
                      description={`${result.checks.mapping.orphanRecords.length} 个索引条目指向不存在的文件`}
                      type="warning"
                      showIcon
                      style={{ marginTop: 8 }}
                    />
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="数据库不匹配数量">
                  <Text
                    strong
                    style={{ color: (result.checks.mapping?.databaseMismatch ?? 0) > 0 ? '#ff4d4f' : '#52c41a' }}
                  >
                    {result.checks.mapping?.databaseMismatch ?? 0}
                  </Text>
                  {(result.checks.mapping?.databaseMismatch ?? 0) > 0 && (
                    <Alert
                      message="发现数据库不匹配"
                      description={`${result.checks.mapping.databaseMismatch} 个数据库记录与文件不匹配`}
                      type="warning"
                      showIcon
                      style={{ marginTop: 8 }}
                    />
                  )}
                </Descriptions.Item>
                {result.checks.mapping?.error && (
                  <Descriptions.Item label="错误信息">
                    <Text type="danger">{result.checks.mapping.error}</Text>
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Panel>
          </Collapse>
          ) : (
            <Alert
              message="数据结构异常"
              description="诊断结果缺少详细的检查数据，请联系开发者"
              type="error"
              showIcon
            />
          )}

          {/* 修复建议 */}
          {renderRecommendations()}
        </Space>
      )}
    </Modal>
  );
};

export default StorageDiagnosticModal;
