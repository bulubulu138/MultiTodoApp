import React, { useState, useCallback } from 'react';
import { NodeProps } from 'reactflow';
import { RuntimeNodeData } from '../../../shared/types';
import { InlineTextEditor } from './InlineTextEditor';

interface EditableNodeProps extends NodeProps<RuntimeNodeData> {
  children: (props: {
    label: string;
    isEditing: boolean;
    onDoubleClick: () => void;
  }) => React.ReactNode;
  onLabelChange?: (newLabel: string) => void;
}

/**
 * EditableNode - 可编辑节点包装器
 * 
 * 为节点添加双击内联编辑功能
 */
export const EditableNode: React.FC<EditableNodeProps> = ({
  data,
  children,
  onLabelChange
}) => {
  const [isEditing, setIsEditing] = useState(false);

  const handleDoubleClick = useCallback(() => {
    if (!data.isLocked) {
      setIsEditing(true);
    }
  }, [data.isLocked]);

  const handleSave = useCallback((newLabel: string) => {
    if (onLabelChange) {
      onLabelChange(newLabel);
    }
    setIsEditing(false);
  }, [onLabelChange]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  if (isEditing) {
    return (
      <div style={{ minWidth: '120px', maxWidth: '200px' }}>
        <InlineTextEditor
          value={data.label}
          onSave={handleSave}
          onCancel={handleCancel}
          multiline={true}
        />
      </div>
    );
  }

  return (
    <>
      {children({
        label: data.label,
        isEditing,
        onDoubleClick: handleDoubleClick
      })}
    </>
  );
};
