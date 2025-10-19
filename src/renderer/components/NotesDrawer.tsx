import { Note } from '../../shared/types';
import React, { useState, useEffect, useCallback } from 'react';
import { Drawer, Button, Space, Card, Input, Typography, Popconfirm, App, Empty } from 'antd';
import { PlusOutlined, DeleteOutlined, BulbOutlined } from '@ant-design/icons';
import RichTextEditor from './RichTextEditor';

const { Title, Text } = Typography;

interface NotesDrawerProps {
  visible: boolean;
  onClose: () => void;
}

const NotesDrawer: React.FC<NotesDrawerProps> = ({ visible, onClose }) => {
  const { message } = App.useApp();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingContent, setEditingContent] = useState('');
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (visible) {
      loadNotes();
    }
  }, [visible]);

  const loadNotes = async () => {
    try {
      setLoading(true);
      const allNotes = await window.electronAPI.notes.getAll();
      setNotes(allNotes);
    } catch (error) {
      message.error('加载心得失败');
      console.error('Error loading notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async () => {
    try {
      const newNote = await window.electronAPI.notes.create({
        title: '新心得',
        content: '在此记录你的工作心得...'
      });
      setNotes([newNote, ...notes]);
      setEditingId(newNote.id!);
      setEditingTitle(newNote.title);
      setEditingContent(newNote.content);
      message.success('心得创建成功');
    } catch (error) {
      message.error('创建心得失败');
      console.error('Error creating note:', error);
    }
  };

  const autoSave = useCallback((id: number, title: string, content: string) => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }

    const timeout = setTimeout(async () => {
      try {
        await window.electronAPI.notes.update(id, { title, content });
        setNotes(prev => prev.map(n => 
          n.id === id ? { ...n, title, content, updatedAt: new Date().toISOString() } : n
        ));
        message.success('自动保存成功', 1);
      } catch (error) {
        message.error('保存失败');
        console.error('Error saving note:', error);
      }
    }, 1000);

    setSaveTimeout(timeout);
  }, [saveTimeout]);

  const handleTitleChange = (id: number, title: string) => {
    setEditingTitle(title);
    autoSave(id, title, editingContent);
  };

  const handleContentChange = (id: number, content: string) => {
    setEditingContent(content);
    autoSave(id, editingTitle, content);
  };

  const handleDelete = async (id: number) => {
    try {
      await window.electronAPI.notes.delete(id);
      setNotes(prev => prev.filter(n => n.id !== id));
      if (editingId === id) {
        setEditingId(null);
      }
      message.success('心得删除成功');
    } catch (error) {
      message.error('删除心得失败');
      console.error('Error deleting note:', error);
    }
  };

  const startEditing = (note: Note) => {
    setEditingId(note.id!);
    setEditingTitle(note.title);
    setEditingContent(note.content);
  };

  return (
    <Drawer
      title={
        <Space>
          <BulbOutlined />
          <span>工作心得</span>
        </Space>
      }
      placement="right"
      width={800}
      onClose={onClose}
      open={visible}
    >
      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={handleAddNote}
        style={{ marginBottom: 16, width: '100%' }}
        size="large"
      >
        添加心得
      </Button>

      {notes.length === 0 ? (
        <Empty
          description="暂无工作心得，点击上方按钮添加"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {notes.map(note => (
            <Card
              key={note.id}
              size="small"
              hoverable
              onClick={() => editingId !== note.id && startEditing(note)}
              style={{ 
                cursor: editingId === note.id ? 'default' : 'pointer',
                border: editingId === note.id ? '2px solid #1890ff' : undefined
              }}
              extra={
                <div onClick={(e) => e.stopPropagation()}>
                  <Popconfirm
                    title="确定要删除这条心得吗？"
                    onConfirm={(e) => {
                      e?.stopPropagation();
                      handleDelete(note.id!);
                    }}
                    okText="确定"
                    cancelText="取消"
                  >
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Popconfirm>
                </div>
              }
            >
              {editingId === note.id ? (
                <div onClick={(e) => e.stopPropagation()}>
                  <Input
                    value={editingTitle}
                    onChange={(e) => handleTitleChange(note.id!, e.target.value)}
                    placeholder="标题"
                    style={{ marginBottom: 8, fontWeight: 'bold' }}
                    size="large"
                  />
                  <RichTextEditor
                    value={editingContent}
                    onChange={(content) => handleContentChange(note.id!, content)}
                    placeholder="记录你的工作心得..."
                  />
                  <Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
                    最后更新: {new Date(note.updatedAt).toLocaleString()}
                  </Text>
                </div>
              ) : (
                <>
                  <Title level={5} style={{ marginTop: 0, marginBottom: 8 }}>
                    {note.title}
                  </Title>
                  <div
                    style={{ 
                      maxHeight: 200, 
                      overflow: 'auto',
                      fontSize: 14,
                      lineHeight: 1.6
                    }}
                    dangerouslySetInnerHTML={{ __html: note.content }}
                  />
                  <Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
                    最后更新: {new Date(note.updatedAt).toLocaleString()}
                  </Text>
                </>
              )}
            </Card>
          ))}
        </Space>
      )}
    </Drawer>
  );
};

export default NotesDrawer;

