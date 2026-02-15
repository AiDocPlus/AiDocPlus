/**
 * Plugin SDK UI 原语 re-export 层
 * 插件应从此处 import UI 组件，而非直接 import @/components/ui/*
 * 这样底层 UI 库更换时只需修改此文件
 */

export { Button } from '@/components/ui/button';
export { Input } from '@/components/ui/input';
export { Label } from '@/components/ui/label';
export { Switch } from '@/components/ui/switch';
export { Textarea } from '@/components/ui/textarea';
export {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
export {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
export { Separator } from '@/components/ui/separator';
export { ScrollArea } from '@/components/ui/scroll-area';
export {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
export { MarkdownEditor } from '@/components/editor/MarkdownEditor';
export { DropdownMenuLabel } from '@/components/ui/dropdown-menu';
