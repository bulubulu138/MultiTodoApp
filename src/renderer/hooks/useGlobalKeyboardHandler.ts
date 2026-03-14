import { useEffect } from 'react';

/**
 * 全局键盘事件处理 Hook
 * 防止输入法使用时的空格/退格键滚动
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
        target.closest('[contenteditable="true"]');

      // 检查是否在 IME composition 过程中
      const isComposing = target.getAttribute('data-composing') === 'true' ||
                         target.closest('[data-composing="true"]') !== null;

      // 处理空格键
      if (event.key === ' ' || event.code === 'Space') {
        // 如果在输入框或 IME composition 中，允许默认行为
        if (isEditable || isComposing) {
          return;
        }
        // 否则阻止默认滚动行为
        event.preventDefault();
        return;
      }

      // 处理退格键
      if (event.key === 'Backspace') {
        // 如果在输入框中，允许默认行为（删除文本）
        if (isEditable) {
          return;
        }
        // 否则阻止默认导航/滚动行为
        event.preventDefault();
        return;
      }
    };

    // 在捕获阶段监听，以便在组件处理前拦截
    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, []);
};
