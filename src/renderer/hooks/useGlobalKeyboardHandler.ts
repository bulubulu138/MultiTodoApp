import { useEffect } from 'react';

/**
 * 全局键盘事件处理 Hook
 * 防止输入法使用时的空格/退格键滚动
 * 防止富文本编辑器中的键盘事件触发页面滚动
 *
 * 增强：支持 ReactQuill 和其他富文本编辑器的所有键盘输入
 */
export const useGlobalKeyboardHandler = () => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const tagName = target.tagName.toLowerCase();
      const isEditable =
        tagName === 'input' ||
        tagName === 'textarea' ||
        target.isContentEditable ||
        target.closest('[contenteditable="true"]') ||
        // 增强：检测 ReactQuill 编辑器（.ql-editor 类）
        target.closest('.ql-editor') ||
        // 增强：检测任何带有 contenteditable 属性的元素
        target.closest('[contenteditable]');

      // 检查是否在 IME composition 过程中
      const isComposing = target.getAttribute('data-composing') === 'true' ||
                         target.closest('[data-composing="true"]') !== null;

      // 如果在可编辑元素中，阻止所有可能触发滚动的键盘事件
      if (isEditable) {
        // 定义所有可能触发滚动的按键
        const scrollTriggeringKeys = [
          // 可打印字符（字母、数字）
          /^[a-zA-Z0-9]$/,
          // 符号和标点
          /^[\!\@\#\$\%\^\&\*\(\)\_\+\-\=\[\]\{\}\|\;\:\'\"\,\.\<\>\/\?\`]$/,
          // 导航和编辑键
          'Enter', 'Tab', 'Delete', 'Insert', 'Home', 'End',
          'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
          'PageUp', 'PageDown',
          // 空格键
          ' ', 'Space', 'Backspace'
        ];

        // 检查当前按键是否应该阻止滚动
        const shouldPreventScroll = scrollTriggeringKeys.some(pattern => {
          if (typeof pattern === 'string') {
            return event.key === pattern || event.code === pattern;
          }
          return pattern.test(event.key) || pattern.test(event.code);
        });

        // 如果是可能触发滚动的按键，且没有修饰键（Ctrl/Cmd），阻止事件传播
        if (shouldPreventScroll && !event.ctrlKey && !event.metaKey) {
          event.stopPropagation();
          // 移除 preventDefault() 以允许正常的输入行为（空格、删除键等）
          return;
        }
      }

      // 原有逻辑：非可编辑区域处理空格和退格键
      if (!isEditable && !isComposing) {
        // 处理空格键
        if (event.key === ' ' || event.code === 'Space') {
          event.preventDefault();
          return;
        }

        // 处理退格键
        if (event.key === 'Backspace') {
          event.preventDefault();
          return;
        }
      }
    };

    // 在捕获阶段监听，以便在组件处理前拦截
    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, []);
};
