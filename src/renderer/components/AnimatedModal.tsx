import React from 'react';
import { Modal, ModalProps } from 'antd';

/**
 * 优化后的 Modal 组件
 * 通过自定义动画配置提升性能
 */
const AnimatedModal: React.FC<ModalProps> = (props) => {
  return (
    <Modal
      {...props}
      // 优化动画性能
      transitionName="ant-fade" // 使用更快的淡入淡出
      maskTransitionName="ant-fade"
      // 确保动画流畅
      destroyOnClose={props.destroyOnClose ?? true}
      // 移除不必要的动画延迟
      afterClose={props.afterClose}
    />
  );
};

export default AnimatedModal;

