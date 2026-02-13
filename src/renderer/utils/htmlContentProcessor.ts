/**
 * HTML内容处理器
 * 针对不同导出格式提供不同的HTML清理策略
 */

export interface HtmlContentProcessorOptions {
  format: 'csv' | 'markdown' | 'json';
  preserveHtml?: boolean;
}

interface FlowchartSummary {
  nodeCount: number;
  edgeCount: number;
}

function parseFlowchartSummary(flowchartElement: Element): FlowchartSummary {
  const flowchartRaw = flowchartElement.getAttribute('data-flowchart');

  if (flowchartRaw) {
    try {
      const parsed = JSON.parse(flowchartRaw) as { nodes?: unknown[]; edges?: unknown[] };
      return {
        nodeCount: Array.isArray(parsed.nodes) ? parsed.nodes.length : 0,
        edgeCount: Array.isArray(parsed.edges) ? parsed.edges.length : 0,
      };
    } catch {
      // use fallback below
    }
  }

  const nodesRaw = flowchartElement.getAttribute('data-nodes');
  const edgesRaw = flowchartElement.getAttribute('data-edges');

  let nodeCount = 0;
  let edgeCount = 0;

  if (nodesRaw) {
    try {
      const nodes = JSON.parse(nodesRaw) as unknown[];
      nodeCount = Array.isArray(nodes) ? nodes.length : 0;
    } catch {
      nodeCount = 0;
    }
  }

  if (edgesRaw) {
    try {
      const edges = JSON.parse(edgesRaw) as unknown[];
      edgeCount = Array.isArray(edges) ? edges.length : 0;
    } catch {
      edgeCount = 0;
    }
  }

  return { nodeCount, edgeCount };
}

/**
 * 处理HTML内容，根据目标格式转换为合适的文本
 */
export function processHtmlContent(
  content: string,
  options: HtmlContentProcessorOptions
): string {
  if (!content || typeof content !== 'string') {
    return content;
  }

  const { format, preserveHtml = false } = options;

  // JSON格式且preserveHtml为true时，直接返回原始内容
  if (format === 'json' && preserveHtml) {
    return content;
  }

  // 使用DOMParser解析HTML
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'text/html');

  // 先处理流程图，避免缩略图中的 img 被统计为普通图片。
  const flowchartElements = Array.from(doc.querySelectorAll('flowchart-preview'));
  const flowchartNotes = flowchartElements.map((element, index) => {
    const summary = parseFlowchartSummary(element);
    return `[流程图${index + 1}: ${summary.nodeCount}个节点, ${summary.edgeCount}条连线]`;
  });
  flowchartElements.forEach((element) => element.remove());

  // 统计普通图片数量
  const images = doc.querySelectorAll('img');
  const imgCount = images.length;

  // 移除所有img标签（稍后添加图片计数）
  images.forEach(img => img.remove());

  // 根据格式处理内容
  let result: string;
  switch (format) {
    case 'csv':
      result = processForCsv(doc);
      break;
    case 'markdown':
      result = processForMarkdown(doc);
      break;
    case 'json':
    default:
      result = processForJson(doc);
      break;
  }

  // 添加流程图和图片标记
  const appendNotes: string[] = [];

  if (flowchartNotes.length > 0) {
    appendNotes.push(flowchartNotes.join('\n'));
  }

  if (imgCount > 0) {
    appendNotes.push(imgCount === 1 ? '【图片1张】' : `【图片${imgCount}张】`);
  }

  if (appendNotes.length > 0) {
    result = result.trim() ? `${result.trim()}\n\n${appendNotes.join('\n')}` : appendNotes.join('\n');
  }

  return result;
}

/**
 * 处理为CSV格式（纯文本，移除所有HTML标签）
 */
function processForCsv(doc: Document): string {
  // 获取纯文本内容
  let text = doc.body.textContent || '';

  // 清理多余空白
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

/**
 * 处理为Markdown格式（转换HTML标签为Markdown语法）
 */
function processForMarkdown(doc: Document): string {
  const clone = doc.cloneNode(true) as Document;
  const body = clone.body;

  // 处理链接：将 <a href="url">text</a> 转换为 [text](url)
  body.querySelectorAll('a').forEach(a => {
    const href = a.getAttribute('href');
    const text = a.textContent;
    if (href && text) {
      const markdownLink = `[${text}](${href})`;
      a.replaceWith(document.createTextNode(markdownLink));
    } else {
      // 如果没有href或text，只保留文本内容
      a.replaceWith(document.createTextNode(text || ''));
    }
  });

  // 处理粗体：<strong>text</strong> → **text**
  body.querySelectorAll('strong, b').forEach(strong => {
    const text = strong.textContent;
    if (text) {
      strong.replaceWith(document.createTextNode(`**${text}**`));
    }
  });

  // 处理斜体：<em>text</em> → *text*
  body.querySelectorAll('em, i').forEach(em => {
    const text = em.textContent;
    if (text) {
      em.replaceWith(document.createTextNode(`*${text}*`));
    }
  });

  // 处理标题：<h1>-<h6> → #-######
  body.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(h => {
    const level = parseInt(h.tagName[1]);
    const prefix = '#'.repeat(level);
    const text = h.textContent;
    if (text) {
      h.replaceWith(document.createTextNode(`${prefix} ${text}\n\n`));
    }
  });

  // 处理段落：<p> → 移除标签，保留文本 + 换行
  body.querySelectorAll('p').forEach(p => {
    const text = p.textContent;
    if (text) {
      p.replaceWith(document.createTextNode(`${text}\n\n`));
    }
  });

  // 处理无序列表：<ul><li> → - item
  body.querySelectorAll('ul').forEach(ul => {
    const items = Array.from(ul.querySelectorAll('li'));
    const markdown = items.map(li => `- ${li.textContent || ''}`).join('\n');
    ul.replaceWith(document.createTextNode(`${markdown}\n\n`));
  });

  // 处理有序列表：<ol><li> → 1. item
  body.querySelectorAll('ol').forEach((ol, index) => {
    const items = Array.from(ol.querySelectorAll('li'));
    let start = 1;
    const startAttr = ol.getAttribute('start');
    if (startAttr) {
      start = parseInt(startAttr);
    }
    const markdown = items.map((li, i) => `${start + i}. ${li.textContent || ''}`).join('\n');
    ol.replaceWith(document.createTextNode(`${markdown}\n\n`));
  });

  // 处理代码：<code>text</code> → `text`
  body.querySelectorAll('code').forEach(code => {
    const text = code.textContent;
    if (text) {
      code.replaceWith(document.createTextNode(`\`${text}\``));
    }
  });

  // 处理预格式化文本：<pre>text</pre> → ```text```
  body.querySelectorAll('pre').forEach(pre => {
    const text = pre.textContent;
    if (text) {
      pre.replaceWith(document.createTextNode(`\`\`\`\n${text}\n\`\`\`\n\n`));
    }
  });

  // 处理换行：<br> → \n
  body.querySelectorAll('br').forEach(br => {
    br.replaceWith(document.createTextNode('\n'));
  });

  // 处理引用：<blockquote>text</blockquote> → > text
  body.querySelectorAll('blockquote').forEach(blockquote => {
    const text = blockquote.textContent;
    if (text) {
      const lines = text.split('\n');
      const quoted = lines.map(line => `> ${line}`).join('\n');
      blockquote.replaceWith(document.createTextNode(`${quoted}\n\n`));
    }
  });

  // 处理水平线：<hr> → ---
  body.querySelectorAll('hr').forEach(hr => {
    hr.replaceWith(document.createTextNode('---\n\n'));
  });

  // 处理删除线：<del>text</del> → ~~text~~
  body.querySelectorAll('del, s').forEach(del => {
    const text = del.textContent;
    if (text) {
      del.replaceWith(document.createTextNode(`~~${text}~~`));
    }
  });

  // 处理表格：<table>
  body.querySelectorAll('table').forEach(table => {
    const rows = Array.from(table.querySelectorAll('tr'));
    if (rows.length === 0) {
      table.remove();
      return;
    }

    let markdown = '\n';
    rows.forEach((row, rowIndex) => {
      const cells = Array.from(row.querySelectorAll('td, th'));
      const rowData = cells.map(cell => {
        // 处理单元格内的内容
        const cellText = cell.textContent?.trim() || '';
        return ` ${cellText} `;
      });
      markdown += `|${rowData.join('|')}|\n`;

      // 添加表头分隔符
      if (rowIndex === 0) {
        const separator = cells.map(() => '---').join('|');
        markdown += `|${separator}|\n`;
      }
    });
    markdown += '\n';
    table.replaceWith(document.createTextNode(markdown));
  });

  // 获取最终文本
  let text = body.textContent || '';

  // 清理多余的空行（超过2个连续换行）
  text = text.replace(/\n{3,}/g, '\n\n');

  // 清理首尾空白
  text = text.trim();

  return text;
}

/**
 * 处理为JSON格式（保留部分结构，移除危险标签）
 */
function processForJson(doc: Document): string {
  // 对于JSON，我们保留基本的文本结构但清理HTML标签
  return processForCsv(doc);
}

/**
 * 快速处理函数：仅移除HTML标签，保留图片标记
 * 用于向后兼容processImagesInHtml
 */
export function processHtmlTagsOnly(content: string): string {
  return processHtmlContent(content, { format: 'csv' });
}
