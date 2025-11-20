import { Variants } from 'framer-motion';

// 通用动画变体配置
export const commonVariants = {
  // 页面切换动画
  pageTransition: {
    hidden: {
      opacity: 0,
      y: 20,
      filter: 'blur(10px)'
    },
    visible: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: {
        duration: 0.4,
        ease: [0.25, 0.1, 0.25, 1], // 模拟原生动画曲线
        staggerChildren: 0.1
      }
    },
    exit: {
      opacity: 0,
      y: -20,
      filter: 'blur(10px)',
      transition: {
        duration: 0.3,
        ease: [0.25, 0.1, 0.25, 1]
      }
    }
  },

  // 列表项动画
  listItem: {
    hidden: {
      opacity: 0,
      y: 30,
      scale: 0.95
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.3,
        ease: [0.25, 0.1, 0.25, 1],
        type: 'spring',
        stiffness: 300,
        damping: 24
      }
    },
    hover: {
      scale: 1.02,
      y: -2,
      transition: {
        duration: 0.2,
        ease: [0.25, 0.1, 0.25, 1]
      }
    },
    tap: {
      scale: 0.98,
      transition: {
        duration: 0.1,
        ease: [0.25, 0.1, 0.25, 1]
      }
    }
  },

  // 卡片动画
  card: {
    hidden: {
      opacity: 0,
      y: 40,
      scale: 0.9
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.4,
        ease: [0.25, 0.1, 0.25, 1],
        type: 'spring',
        stiffness: 260,
        damping: 20
      }
    },
    hover: {
      scale: 1.01,
      y: -4,
      transition: {
        duration: 0.2,
        ease: [0.25, 0.1, 0.25, 1]
      }
    }
  },

  // 模态框动画
  modal: {
    hidden: {
      opacity: 0,
      scale: 0.9,
      y: 20
    },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        duration: 0.3,
        ease: [0.25, 0.1, 0.25, 1],
        type: 'spring',
        stiffness: 300,
        damping: 25
      }
    },
    exit: {
      opacity: 0,
      scale: 0.9,
      y: 20,
      transition: {
        duration: 0.2,
        ease: [0.25, 0.1, 0.25, 1]
      }
    }
  },

  // 抽屉动画
  drawer: {
    hidden: {
      opacity: 0,
      x: '100%'
    },
    visible: {
      opacity: 1,
      x: 0,
      transition: {
        duration: 0.4,
        ease: [0.25, 0.1, 0.25, 1],
        type: 'spring',
        stiffness: 250,
        damping: 25
      }
    },
    exit: {
      opacity: 0,
      x: '100%',
      transition: {
        duration: 0.3,
        ease: [0.25, 0.1, 0.25, 1]
      }
    }
  },

  // 按钮动画
  button: {
    hover: {
      scale: 1.05,
      transition: {
        duration: 0.15,
        ease: [0.25, 0.1, 0.25, 1]
      }
    },
    tap: {
      scale: 0.95,
      transition: {
        duration: 0.1,
        ease: [0.25, 0.1, 0.25, 1]
      }
    }
  },

  // 搜索框动画
  search: {
    focused: {
      scale: 1.02,
      transition: {
        duration: 0.2,
        ease: [0.25, 0.1, 0.25, 1]
      }
    },
    blur: {
      scale: 1,
      transition: {
        duration: 0.2,
        ease: [0.25, 0.1, 0.25, 1]
      }
    }
  },

  // 加载动画
  loading: {
    initial: {
      opacity: 0
    },
    animate: {
      opacity: 1,
      transition: {
        duration: 0.3
      }
    },
    exit: {
      opacity: 0,
      transition: {
        duration: 0.2
      }
    }
  },

  // 通知动画
  notification: {
    initial: {
      opacity: 0,
      y: -100,
      scale: 0.3
    },
    animate: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.4,
        ease: [0.25, 0.1, 0.25, 1],
        type: 'spring',
        stiffness: 400,
        damping: 20
      }
    },
    exit: {
      opacity: 0,
      y: -100,
      scale: 0.3,
      transition: {
        duration: 0.3,
        ease: [0.25, 0.1, 0.25, 1]
      }
    }
  },

  // 标签页切换动画
  tabIndicator: {
    initial: false,
    animate: {
      backgroundColor: '#1890ff',
      transition: {
        type: 'spring',
        stiffness: 500,
        damping: 30
      }
    }
  },

  // 徽章动画
  badge: {
    initial: {
      scale: 0,
      opacity: 0
    },
    animate: {
      scale: 1,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 600,
        damping: 15
      }
    }
  }
} as const;

// 容器动画配置
export const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08, // 子元素交错动画
      delayChildren: 0.1
    }
  }
};

// 子项动画配置
export const itemVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 20
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.1, 0.25, 1]
    }
  }
};

// 动画属性配置
export const motionProps = {
  // 默认过渡配置
  defaultTransition: {
    duration: 0.3,
    ease: [0.25, 0.1, 0.25, 1]
  },

  // 弹簧过渡配置
  springTransition: {
    type: 'spring' as const,
    stiffness: 300,
    damping: 25
  },

  // 长动画配置
  longTransition: {
    duration: 0.5,
    ease: [0.25, 0.1, 0.25, 1]
  },

  // 快速动画配置
  quickTransition: {
    duration: 0.15,
    ease: [0.25, 0.1, 0.25, 1]
  }
};

// 手势动画配置
export const gestureProps = {
  whileHover: {
    scale: 1.02,
    transition: {
      duration: 0.2,
      ease: [0.25, 0.1, 0.25, 1]
    }
  },
  whileTap: {
    scale: 0.98,
    transition: {
      duration: 0.1,
      ease: [0.25, 0.1, 0.25, 1]
    }
  }
};

// 主题相关动画变体
export const themeVariants = {
  light: {
    backgroundColor: '#ffffff',
    color: '#000000',
    transition: {
      duration: 0.3,
      ease: [0.25, 0.1, 0.25, 1]
    }
  },
  dark: {
    backgroundColor: '#000000',
    color: '#ffffff',
    transition: {
      duration: 0.3,
      ease: [0.25, 0.1, 0.25, 1]
    }
  }
} as const;