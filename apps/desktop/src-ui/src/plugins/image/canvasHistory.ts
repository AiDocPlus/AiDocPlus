/**
 * 画布撤销/重做引擎
 *
 * 基于 Fabric.js JSON 快照实现，每次画布变更保存完整 JSON。
 * 限制历史深度为 50 步，超出后丢弃最早的快照。
 */

const MAX_HISTORY = 50;

export class CanvasHistory {
  private undoStack: string[] = [];
  private redoStack: string[] = [];
  private locked = false;

  /** 保存当前快照（在每次画布变更后调用） */
  push(json: string) {
    if (this.locked) return;
    this.undoStack.push(json);
    if (this.undoStack.length > MAX_HISTORY) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  /** 撤销，返回上一个快照 JSON，无则返回 null */
  undo(_currentJson: string): string | null {
    if (this.undoStack.length <= 1) return null;
    const current = this.undoStack.pop()!;
    this.redoStack.push(current);
    return this.undoStack[this.undoStack.length - 1] || null;
  }

  /** 重做，返回下一个快照 JSON，无则返回 null */
  redo(): string | null {
    if (this.redoStack.length === 0) return null;
    const next = this.redoStack.pop()!;
    this.undoStack.push(next);
    return next;
  }

  /** 是否可撤销 */
  get canUndo(): boolean {
    return this.undoStack.length > 1;
  }

  /** 是否可重做 */
  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** 锁定（加载快照时防止触发 push） */
  lock() {
    this.locked = true;
  }

  /** 解锁 */
  unlock() {
    this.locked = false;
  }

  /** 清空所有历史 */
  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }
}
