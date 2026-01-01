import { FlowchartPatch, PatchHistory } from '../../shared/types';

/**
 * UndoRedoManager
 * 
 * 管理操作历史，支持撤销和重做功能
 * 使用 Patch 模型记录所有操作
 */
export class UndoRedoManager {
  private history: FlowchartPatch[] = [];
  private currentIndex: number = -1;
  private maxHistorySize: number = 100;

  /**
   * 执行操作并记录到历史
   * @param patch 要执行的 Patch
   * @param originalData 原始数据（用于生成反向 Patch）
   */
  execute(patch: FlowchartPatch, originalData?: any): void {
    // 清除当前位置之后的历史（如果用户在撤销后执行了新操作）
    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1);
    }

    // 添加新 patch
    this.history.push(patch);
    this.currentIndex++;

    // 限制历史记录大小
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
      this.currentIndex--;
    }
  }

  /**
   * 撤销操作
   * @returns 当前位置的 Patch（需要应用反向操作）
   */
  undo(): FlowchartPatch | null {
    if (!this.canUndo()) {
      return null;
    }

    const patch = this.history[this.currentIndex];
    this.currentIndex--;
    return patch;
  }

  /**
   * 重做操作
   * @returns 下一个位置的 Patch
   */
  redo(): FlowchartPatch | null {
    if (!this.canRedo()) {
      return null;
    }

    this.currentIndex++;
    const patch = this.history[this.currentIndex];
    return patch;
  }

  /**
   * 检查是否可以撤销
   */
  canUndo(): boolean {
    return this.currentIndex >= 0;
  }

  /**
   * 检查是否可以重做
   */
  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  /**
   * 获取当前历史状态
   */
  getHistory(): PatchHistory {
    return {
      patches: [...this.history],
      currentIndex: this.currentIndex
    };
  }

  /**
   * 清空历史记录
   */
  clear(): void {
    this.history = [];
    this.currentIndex = -1;
  }

  /**
   * 获取历史记录大小
   */
  getHistorySize(): number {
    return this.history.length;
  }

  /**
   * 获取当前位置
   */
  getCurrentIndex(): number {
    return this.currentIndex;
  }

  /**
   * 设置最大历史记录大小
   */
  setMaxHistorySize(size: number): void {
    this.maxHistorySize = size;
    
    // 如果当前历史超过新的限制，裁剪旧记录
    if (this.history.length > size) {
      const excess = this.history.length - size;
      this.history = this.history.slice(excess);
      this.currentIndex = Math.max(-1, this.currentIndex - excess);
    }
  }
}
