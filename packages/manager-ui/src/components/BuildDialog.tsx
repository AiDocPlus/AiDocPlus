import { useState } from 'react';
import { X, Hammer, Loader2 } from 'lucide-react';
import { runBuildScript } from '../hooks/useResources';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';

interface BuildDialogProps {
  repoDir: string;
  onClose: () => void;
}

export function BuildDialog({ repoDir, onClose }: BuildDialogProps) {
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');

  const handleBuild = async () => {
    setRunning(true);
    setOutput('');
    setError('');
    try {
      const result = await runBuildScript(repoDir);
      setOutput(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] top-[5vh] translate-y-0 overflow-hidden flex flex-col p-0">
        <DialogHeader className="flex-row items-center justify-between px-6 pt-6 pb-4 border-b space-y-0">
          <DialogTitle className="flex items-center gap-2">
            <Hammer className="h-5 w-5" />
            构建资源
          </DialogTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="p-6 space-y-4 flex-1 min-h-0 overflow-y-auto">
          <div className="text-sm text-muted-foreground">
            仓库目录：<code className="bg-muted px-1.5 py-0.5 rounded text-foreground">{repoDir}</code>
          </div>

          <Button
            onClick={handleBuild}
            disabled={running}
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Hammer className="h-4 w-4" />}
            {running ? '构建中...' : '执行 build.sh'}
          </Button>

          {output && (
            <div className="space-y-2">
              <label className="text-sm font-medium">构建输出</label>
              <pre className="w-full max-h-[300px] overflow-y-auto rounded-md border border-input bg-muted/30 px-3 py-2 text-xs font-mono whitespace-pre-wrap text-green-700">
                {output}
              </pre>
            </div>
          )}

          {error && (
            <div className="space-y-2">
              <label className="text-sm font-medium">错误</label>
              <pre className="w-full max-h-[200px] overflow-y-auto rounded-md border border-input bg-destructive/10 px-3 py-2 text-xs font-mono whitespace-pre-wrap text-destructive">
                {error}
              </pre>
            </div>
          )}
        </div>

        <div className="flex justify-end px-6 py-4 border-t shrink-0">
          <Button variant="outline" onClick={onClose}>
            关闭
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
