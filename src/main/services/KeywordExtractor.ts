// 关键词提取服务 - 使用 nodejieba 进行中文分词和关键词提取
import * as nodejieba from 'nodejieba';

// 常见中文停用词表
const STOP_WORDS = new Set([
  '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一',
  '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有',
  '看', '好', '自己', '这', '那', '里', '为', '以', '个', '用', '于', '对',
  '他', '她', '它', '们', '地', '得', '着', '之', '而', '且', '或', '所',
  '及', '其', '则', '与', '并', '及', '等', '这个', '那个', '什么', '怎么',
  '如果', '因为', '所以', '但是', '然而', '可是', '虽然', '已经', '还是',
  '进行', '实现', '完成', '需要', '可以', '能够', '应该', '必须', '开始',
  '继续', '结束', '问题', '情况', '时候', '方面', '方式', '工作', '学习',
  '通过', '根据', '关于', '由于', '按照', '因此', '然后', '接着', '最后'
]);

// 单字母和单数字也过滤掉
const MIN_WORD_LENGTH = 2;
const MAX_WORD_LENGTH = 15;

export class KeywordExtractor {
  private initialized: boolean = false;

  constructor() {
    this.initialize();
  }

  /**
   * 初始化 nodejieba（加载词典）
   */
  private initialize(): void {
    try {
      if (!this.initialized) {
        // nodejieba 会自动加载默认词典
        console.log('KeywordExtractor initialized successfully');
        this.initialized = true;
      }
    } catch (error) {
      console.error('Failed to initialize KeywordExtractor:', error);
    }
  }

  /**
   * 从标题和内容中提取关键词
   * @param title 待办标题
   * @param content 待办内容（可能包含HTML）
   * @returns 关键词数组（5-10个）
   */
  public extractKeywords(title: string, content: string): string[] {
    try {
      // 清洗内容：移除HTML标签
      const cleanContent = this.cleanHTML(content);
      
      // 合并标题和内容，标题权重更高（重复2次）
      const text = `${title} ${title} ${cleanContent}`;
      
      // 如果文本太短，直接返回空数组
      if (text.trim().length < 5) {
        return [];
      }

      // 使用 TF-IDF 提取关键词
      const keywords = nodejieba.extract(text, 15); // 提取最多15个候选关键词
      
      // 过滤和处理关键词
      const filtered = keywords
        .map((item: any) => item.word) // 获取词语
        .filter((word: string) => this.isValidKeyword(word)) // 过滤无效词
        .slice(0, 10); // 取前10个

      return filtered;
    } catch (error) {
      console.error('Error extracting keywords:', error);
      return [];
    }
  }

  /**
   * 清除HTML标签，保留纯文本
   */
  private cleanHTML(html: string): string {
    if (!html) return '';
    
    // 简单的HTML标签清理
    return html
      .replace(/<[^>]*>/g, ' ') // 移除HTML标签
      .replace(/&nbsp;/g, ' ')   // 替换空格实体
      .replace(/&lt;/g, '<')     // 替换小于号实体
      .replace(/&gt;/g, '>')     // 替换大于号实体
      .replace(/&amp;/g, '&')    // 替换&符号
      .replace(/\s+/g, ' ')      // 多个空格合并为一个
      .trim();
  }

  /**
   * 判断是否为有效关键词
   */
  private isValidKeyword(word: string): boolean {
    // 长度检查
    if (word.length < MIN_WORD_LENGTH || word.length > MAX_WORD_LENGTH) {
      return false;
    }

    // 停用词检查
    if (STOP_WORDS.has(word)) {
      return false;
    }

    // 纯数字检查
    if (/^\d+$/.test(word)) {
      return false;
    }

    // 纯英文单字母检查
    if (/^[a-zA-Z]$/.test(word)) {
      return false;
    }

    // 纯标点符号检查
    if (/^[\W_]+$/.test(word)) {
      return false;
    }

    return true;
  }

  /**
   * 计算两个关键词数组的 Jaccard 相似度
   * @param keywords1 第一个关键词数组
   * @param keywords2 第二个关键词数组
   * @returns 相似度 0-1
   */
  public static calculateSimilarity(keywords1: string[], keywords2: string[]): number {
    if (!keywords1 || !keywords2 || keywords1.length === 0 || keywords2.length === 0) {
      return 0;
    }

    const set1 = new Set(keywords1);
    const set2 = new Set(keywords2);

    // 交集
    const intersection = new Set([...set1].filter(x => set2.has(x)));

    // 并集
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  /**
   * 获取两个关键词数组的匹配词
   */
  public static getMatchedKeywords(keywords1: string[], keywords2: string[]): string[] {
    const set1 = new Set(keywords1);
    const set2 = new Set(keywords2);
    return [...set1].filter(x => set2.has(x));
  }
}

// 导出单例
export const keywordExtractor = new KeywordExtractor();

