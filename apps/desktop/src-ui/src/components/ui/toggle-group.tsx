import * as React from 'react';
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group';
import { cn } from '@/lib/utils';

const ToggleGroup = ToggleGroupPrimitive.Root;

const ToggleGroupItem = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item> & {
    size?: 'sm' | 'default';
  }
>(({ className, size = 'default', ...props }, ref) => (
  <ToggleGroupPrimitive.Item
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center rounded-md border border-transparent bg-transparent text-muted-foreground transition-colors',
      'hover:bg-accent hover:text-foreground',
      'data-[state=on]:bg-muted data-[state=on]:text-foreground data-[state=on]:border-border',
      size === 'sm' ? 'h-7 px-2 text-xs' : 'h-9 px-3 text-sm',
      className
    )}
    {...props}
  />
));
ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName;

export { ToggleGroup, ToggleGroupItem };

