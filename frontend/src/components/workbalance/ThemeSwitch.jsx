import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function ThemeSwitch({ className }) {
  const { isDark, setTheme } = useTheme();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn('inline-flex items-center', className)}>
          <Switch
            checked={isDark}
            onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
            aria-label={isDark ? 'Beralih ke mode terang' : 'Beralih ke mode gelap'}
            thumbContent={
              isDark ? (
                <Moon aria-hidden="true" className="size-3.5 text-primary" />
              ) : (
                <Sun aria-hidden="true" className="size-3.5 text-warning" />
              )
            }
          />
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {isDark ? 'Mode terang' : 'Mode gelap'}
      </TooltipContent>
    </Tooltip>
  );
}
