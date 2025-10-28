// Type definitions for segment
declare module 'segment' {
  export interface SegmentOptions {
    simple?: boolean;
    stripPunctuation?: boolean;
  }

  export interface SegmentWord {
    w: string;
    p?: number;
  }

  export class Segment {
    constructor();
    
    /**
     * 使用默认的识别模块和字典
     */
    useDefault(): this;
    
    /**
     * 开始分词
     * @param text 要分词的文本
     * @param options 分词选项
     */
    doSegment(text: string, options?: SegmentOptions): SegmentWord[];
  }

  export default Segment;
}

