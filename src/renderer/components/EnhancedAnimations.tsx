import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircleOutlined,
  LoadingOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  CloseOutlined,
  CopyOutlined,
  EditOutlined,
  DeleteOutlined,
  HeartOutlined,
  StarOutlined
} from '@ant-design/icons';
import { commonVariants } from '../utils/motionVariants';

// 通知类型
export type NotificationType = 'success' | 'error' | 'warning' | 'info';

// 通知配置
export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number;
  showIcon?: boolean;
  showClose?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// 动画通知组件
export const AnimatedNotification: React.FC<{
  notification: Notification;
  onClose: (id: string) => void;
}> = ({ notification, onClose }) => {
  const [isVisible, setIsVisible] = useState(true);

  const getIcon = () => {
    switch (notification.type) {
      case 'success':
        return <CheckCircleOutlined style={{ color: '#10b981' }} />;
      case 'error':
        return <ExclamationCircleOutlined style={{ color: '#ef4444' }} />;
      case 'warning':
        return <ExclamationCircleOutlined style={{ color: '#f59e0b' }} />;
      case 'info':
      default:
        return <InfoCircleOutlined style={{ color: '#3b82f6' }} />;
    }
  };

  const getBackgroundColor = () => {
    switch (notification.type) {
      case 'success':
        return 'rgba(16, 185, 129, 0.1)';
      case 'error':
        return 'rgba(239, 68, 68, 0.1)';
      case 'warning':
        return 'rgba(245, 158, 11, 0.1)';
      case 'info':
      default:
        return 'rgba(59, 130, 246, 0.1)';
    }
  };

  const getBorderColor = () => {
    switch (notification.type) {
      case 'success':
        return 'rgba(16, 185, 129, 0.3)';
      case 'error':
        return 'rgba(239, 68, 68, 0.3)';
      case 'warning':
        return 'rgba(245, 158, 11, 0.3)';
      case 'info':
      default:
        return 'rgba(59, 130, 246, 0.3)';
    }
  };

  useEffect(() => {
    if (notification.duration !== 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => onClose(notification.id), 300);
      }, notification.duration || 5000);

      return () => clearTimeout(timer);
    }
  }, [notification.duration, notification.id, onClose]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key={notification.id}
          variants={commonVariants.notification}
          initial="initial"
          animate="animate"
          exit="exit"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '16px 20px',
            backgroundColor: getBackgroundColor(),
            border: `1px solid ${getBorderColor()}`,
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            maxWidth: '400px',
            minWidth: '300px',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {notification.showIcon && (
            <motion.div
              animate={{
                rotate: [0, 360],
                scale: [1, 1.2, 1]
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                repeatDelay: 2
              }}
            >
              {getIcon()}
            </motion.div>
          )}

          <div style={{ flex: 1 }}>
            <div style={{
              fontWeight: 600,
              fontSize: '14px',
              marginBottom: notification.message ? '4px' : 0
            }}>
              {notification.title}
            </div>
            {notification.message && (
              <div style={{
                fontSize: '12px',
                opacity: 0.8,
                lineHeight: '1.4'
              }}>
                {notification.message}
              </div>
            )}
          </div>

          {notification.action && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={notification.action.onClick}
              style={{
                padding: '6px 12px',
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '6px',
                fontSize: '12px',
                cursor: 'pointer',
                backdropFilter: 'blur(4px)',
                WebkitBackdropFilter: 'blur(4px)'
              }}
            >
              {notification.action.label}
            </motion.button>
          )}

          {notification.showClose && (
            <motion.button
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                setIsVisible(false);
                setTimeout(() => onClose(notification.id), 300);
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <CloseOutlined style={{ fontSize: '12px' }} />
            </motion.button>
          )}

          {/* 进度条 */}
          {notification.duration && notification.duration > 0 && (
            <motion.div
              initial={{ width: '100%' }}
              animate={{ width: '0%' }}
              transition={{
                duration: notification.duration / 1000,
                ease: 'linear'
              }}
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                height: '2px',
                backgroundColor: getBorderColor().replace('0.3', '0.6')
              }}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// 通知容器组件
export const NotificationContainer: React.FC<{
  notifications: Notification[];
  onClose: (id: string) => void;
}> = ({ notifications, onClose }) => {
  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}
    >
      <AnimatePresence>
        {notifications.map((notification) => (
          <AnimatedNotification
            key={notification.id}
            notification={notification}
            onClose={onClose}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

// 增强按钮组件
export const EnhancedButton: React.FC<{
  children: React.ReactNode;
  icon?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  style?: React.CSSProperties;
  className?: string;
}> = ({
  children,
  icon,
  variant = 'primary',
  size = 'medium',
  loading = false,
  disabled = false,
  onClick,
  type = 'button',
  style = {},
  className = ''
}) => {
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number }>>([]);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || loading) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newRipple = {
      id: Date.now(),
      x,
      y
    };

    setRipples(prev => [...prev, newRipple]);

    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== newRipple.id));
    }, 600);

    onClick?.();
  };

  const getSizeStyle = () => {
    switch (size) {
      case 'small':
        return { padding: '6px 12px', fontSize: '12px' };
      case 'large':
        return { padding: '12px 24px', fontSize: '16px' };
      default:
        return { padding: '8px 16px', fontSize: '14px' };
    }
  };

  const getVariantStyle = () => {
    switch (variant) {
      case 'secondary':
        return {
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          borderColor: 'rgba(255, 255, 255, 0.2)',
          color: '#ffffff'
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          borderColor: 'transparent',
          color: '#ffffff'
        };
      default:
        return {
          backgroundColor: 'rgba(59, 130, 246, 0.8)',
          borderColor: 'rgba(59, 130, 246, 0.6)',
          color: '#ffffff'
        };
    }
  };

  return (
    <motion.button
      type={type}
      disabled={disabled || loading}
      className={`enhanced-button ${className}`}
      onClick={handleClick}
      variants={commonVariants.button}
      whileHover="hover"
      whileTap="tap"
      style={{
        position: 'relative',
        overflow: 'hidden',
        border: '1px solid',
        borderRadius: '8px',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        transition: 'all 0.3s ease',
        outline: 'none',
        opacity: disabled ? 0.5 : 1,
        ...getSizeStyle(),
        ...getVariantStyle(),
        ...style
      }}
    >
      {/* 涟漪效果 */}
      {ripples.map(ripple => (
        <motion.span
          key={ripple.id}
          initial={{
            position: 'absolute',
            width: '0px',
            height: '0px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 255, 255, 0.3)',
            left: ripple.x,
            top: ripple.y,
            transform: 'translate(-50%, -50%)'
          }}
          animate={{
            width: '200px',
            height: '200px'
          }}
          exit={{
            opacity: 0
          }}
          transition={{
            duration: 0.6,
            ease: 'easeOut'
          }}
        />
      ))}

      {loading ? (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: 'linear'
          }}
        >
          <LoadingOutlined />
        </motion.div>
      ) : (
        icon
      )}

      <span>{children}</span>
    </motion.button>
  );
};

// 浮动操作按钮组件
export const FloatingActionButton: React.FC<{
  icon: React.ReactNode;
  onClick: () => void;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  color?: string;
  size?: number;
  tooltip?: string;
}> = ({
  icon,
  onClick,
  position = 'bottom-right',
  color = '#3b82f6',
  size = 56,
  tooltip
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const getPositionStyle = () => {
    switch (position) {
      case 'bottom-left':
        return { bottom: '20px', left: '20px' };
      case 'top-right':
        return { top: '20px', right: '20px' };
      case 'top-left':
        return { top: '20px', left: '20px' };
      default:
        return { bottom: '20px', right: '20px' };
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        ...getPositionStyle(),
        zIndex: 1000
      }}
    >
      {tooltip && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{
            opacity: isHovered ? 1 : 0,
            y: isHovered ? 0 : 10
          }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'absolute',
            bottom: `${size + 10}px`,
            right: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '6px 12px',
            borderRadius: '4px',
            fontSize: '12px',
            whiteSpace: 'nowrap',
            pointerEvents: 'none'
          }}
        >
          {tooltip}
        </motion.div>
      )}

      <motion.button
        whileHover={{ scale: 1.1, rotate: 5 }}
        whileTap={{ scale: 0.9, rotate: -5 }}
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: '50%',
          backgroundColor: color,
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: `${size * 0.4}px`,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)'
        }}
      >
        {icon}
      </motion.button>
    </div>
  );
};

// 加载骨架屏组件
export const SkeletonCard: React.FC<{
  width?: number | string;
  height?: number;
  lines?: number;
  showAvatar?: boolean;
}> = ({
  width = '100%',
  height = 120,
  lines = 3,
  showAvatar = false
}) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        width,
        height: 'auto',
        padding: '16px',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)'
      }}
    >
      {showAvatar && (
        <motion.div
          animate={{
            opacity: [0.3, 0.7, 0.3]
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity
          }}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            marginBottom: '12px'
          }}
        />
      )}

      {Array.from({ length: lines }).map((_, index) => (
        <motion.div
          key={index}
          animate={{
            opacity: [0.3, 0.7, 0.3]
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            delay: index * 0.1
          }}
          style={{
            height: '16px',
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '4px',
            marginBottom: index < lines - 1 ? '8px' : 0,
            width: index === lines - 1 ? '60%' : '100%'
          }}
        />
      ))}
    </motion.div>
  );
};