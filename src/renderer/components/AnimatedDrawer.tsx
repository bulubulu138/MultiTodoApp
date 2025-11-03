import React from 'react';
import { Drawer, DrawerProps } from 'antd';

/**
 * 优化后的 Drawer 组件
 * 通过自定义配置提升性能
 */
const AnimatedDrawer: React.FC<DrawerProps> = (props) => {
  return (
    <Drawer
      {...props}
      // 优化性能设置
      destroyOnClose={props.destroyOnClose ?? true}
      // 使用 GPU 加速的抽屉动画
      rootClassName={`animated-drawer ${props.rootClassName || ''}`}
    />
  );
};

export default AnimatedDrawer;

