import { Todo } from '../../shared/types';

const MAX_CLIPBOARD_SIZE = 20 * 1024 * 1024; // 20MB

export interface CopyResult {
  success: boolean;
  message: string;
  size?: number;
}

// 图片URL转Base64
async function imageUrlToBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Failed to convert image to base64:', error);
    return null;
  }
}

// 从HTML中提取图片并转换为base64
async function processImagesInHtml(html: string): Promise<{ html: string; totalSize: number }> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const images = doc.querySelectorAll('img');
  
  let totalSize = 0;
  let processedCount = 0;

  for (const img of Array.from(images)) {
    const src = img.getAttribute('src');
    if (!src) continue;

    // 如果已经是base64，计算大小
    if (src.startsWith('data:')) {
      totalSize += src.length;
      continue;
    }

    // 转换为base64
    const base64 = await imageUrlToBase64(src);
    if (base64) {
      totalSize += base64.length;
      
      // 检查是否超过限制
      if (totalSize > MAX_CLIPBOARD_SIZE) {
        // 超过限制，用占位符替换
        img.replaceWith(document.createTextNode('[图片过大，已省略]'));
      } else {
        img.setAttribute('src', base64);
        img.setAttribute('style', 'max-width: 100%; height: auto; margin: 8px 0; border-radius: 4px;');
        processedCount++;
      }
    } else {
      // 转换失败，用占位符替换
      img.replaceWith(document.createTextNode('[图片]'));
    }
  }

  return {
    html: doc.body.innerHTML,
    totalSize
  };
}

// HTML转纯文本（保留结构）
function htmlToPlainText(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // 处理图片
  doc.querySelectorAll('img').forEach(img => {
    img.replaceWith(document.createTextNode('[图片]'));
  });
  
  // 处理换行
  doc.querySelectorAll('br').forEach(br => {
    br.replaceWith(document.createTextNode('\n'));
  });
  
  // 处理段落
  doc.querySelectorAll('p').forEach(p => {
    const text = p.textContent || '';
    p.replaceWith(document.createTextNode(text + '\n'));
  });
  
  // 处理列表
  doc.querySelectorAll('li').forEach((li, index) => {
    const text = li.textContent || '';
    li.replaceWith(document.createTextNode(`${index + 1}. ${text}\n`));
  });
  
  return doc.body.textContent || '';
}

// 获取状态文本
function getStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    pending: '待办',
    in_progress: '进行中',
    completed: '已完成',
    paused: '暂停'
  };
  return statusMap[status] || status;
}

// 获取优先级文本
function getPriorityText(priority: string): string {
  const priorityMap: Record<string, string> = {
    high: '高',
    medium: '中',
    low: '低'
  };
  return priorityMap[priority] || priority;
}

// 生成HTML格式
async function generateHtml(todo: Todo): Promise<{ html: string; size: number }> {
  const statusText = getStatusText(todo.status);
  const priorityText = getPriorityText(todo.priority);
  const tags = todo.tags ? todo.tags.split(',').map(t => `#${t.trim()}`).join(' ') : '无';
  
  // 处理内容中的图片
  let content = todo.content || '无';
  const { html: processedContent, totalSize } = await processImagesInHtml(content);
  
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333;">
      <div style="font-size: 16px; font-weight: bold; margin-bottom: 8px;">【待办】${todo.title}</div>
      <div style="border-top: 2px solid #d9d9d9; margin: 8px 0;"></div>
      <div style="margin-bottom: 4px;"><strong>状态：</strong>${statusText} | <strong>优先级：</strong>${priorityText}</div>
      <div style="margin-bottom: 8px;"><strong>标签：</strong>${tags}</div>
      <div style="border-top: 2px solid #d9d9d9; margin: 8px 0;"></div>
      <div style="font-weight: bold; margin-bottom: 8px;">内容：</div>
      ${processedContent}
    </div>
  `;
  
  return { html, size: html.length + totalSize };
}

// 生成纯文本格式
function generatePlainText(todo: Todo): string {
  const statusText = getStatusText(todo.status);
  const priorityText = getPriorityText(todo.priority);
  const tags = todo.tags ? todo.tags.split(',').map(t => `#${t.trim()}`).join(' ') : '无';
  
  const content = todo.content ? htmlToPlainText(todo.content) : '无';
  
  return `【待办】${todo.title}
━━━━━━━━━━━━━━━
状态：${statusText} | 优先级：${priorityText}
标签：${tags}
━━━━━━━━━━━━━━━
内容：
${content}`;
}

// 主复制函数
export async function copyTodoToClipboard(todo: Todo): Promise<CopyResult> {
  try {
    // 生成HTML格式
    const { html, size } = await generateHtml(todo);
    
    // 检查大小
    if (size > MAX_CLIPBOARD_SIZE) {
      return {
        success: false,
        message: `内容过大（${(size / 1024 / 1024).toFixed(1)}MB），超过20MB限制`,
        size
      };
    }
    
    // 生成纯文本格式
    const plainText = generatePlainText(todo);
    
    // 写入剪切板（HTML + 纯文本）
    const clipboardItem = new ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([plainText], { type: 'text/plain' })
    });
    
    await navigator.clipboard.write([clipboardItem]);
    
    const sizeText = size > 1024 * 1024 
      ? `${(size / 1024 / 1024).toFixed(1)}MB`
      : `${(size / 1024).toFixed(0)}KB`;
    
    return {
      success: true,
      message: `已复制到剪切板（${sizeText}）`,
      size
    };
  } catch (error) {
    console.error('Copy failed:', error);
    
    // 降级：只复制纯文本
    try {
      const plainText = generatePlainText(todo);
      await navigator.clipboard.writeText(plainText);
      return {
        success: true,
        message: '已复制纯文本到剪切板（不含图片）'
      };
    } catch (fallbackError) {
      return {
        success: false,
        message: '复制失败，请重试'
      };
    }
  }
}

