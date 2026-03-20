/**
 * macroRecorder.ts — CodeMirror 6 宏录制/重放扩展
 *
 * 录制期间记录用户的文本变更（changes）和选区变化（selections），
 * 重放时依次 dispatch 记录的 transactions。
 *
 * 使用全局单例模式，支持跨编辑器实例的状态共享。
 */
import { EditorView } from '@codemirror/view';
import { type ChangeSpec } from '@codemirror/state';

interface MacroStep {
  changes: ChangeSpec;
}

class MacroRecorderState {
  private _recording = false;
  private _steps: MacroStep[] = [];
  private _lastMacro: MacroStep[] = [];
  private _listeners: Set<() => void> = new Set();

  get recording() { return this._recording; }
  get hasMacro() { return this._lastMacro.length > 0; }
  get stepCount() { return this._steps.length; }

  startRecording() {
    this._recording = true;
    this._steps = [];
    this._notify();
  }

  stopRecording() {
    this._recording = false;
    if (this._steps.length > 0) {
      this._lastMacro = [...this._steps];
    }
    this._steps = [];
    this._notify();
  }

  toggleRecording() {
    if (this._recording) {
      this.stopRecording();
    } else {
      this.startRecording();
    }
  }

  recordStep(changes: ChangeSpec) {
    if (this._recording) {
      this._steps.push({ changes });
    }
  }

  replay(view: EditorView) {
    if (this._lastMacro.length === 0) return;
    for (const step of this._lastMacro) {
      try {
        view.dispatch({ changes: step.changes });
      } catch {
        // 如果 changes 不适用于当前文档状态，跳过
        break;
      }
    }
    view.focus();
  }

  subscribe(listener: () => void) {
    this._listeners.add(listener);
    return () => { this._listeners.delete(listener); };
  }

  private _notify() {
    for (const fn of this._listeners) fn();
  }
}

/** 全局宏录制器单例 */
export const macroRecorder = new MacroRecorderState();

/**
 * 宏录制 EditorView 扩展
 * 在 updateListener 中监听 docChanged，自动记录变更
 */
export const macroRecorderExtension = EditorView.updateListener.of((update) => {
  if (update.docChanged && macroRecorder.recording) {
    update.transactions.forEach(tr => {
      if (tr.docChanged) {
        tr.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
          macroRecorder.recordStep({
            from: fromA,
            to: toA,
            insert: inserted.toString(),
          });
        });
      }
    });
  }
});
