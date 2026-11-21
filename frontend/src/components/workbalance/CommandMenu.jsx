import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CornerDownLeft } from 'lucide-react';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { getNavGroupsForRole } from '@/lib/navigation';

export function CommandMenu({ open, onOpenChange, role }) {
  const navigate = useNavigate();
  const location = useLocation();
  const groups = getNavGroupsForRole(role);

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onOpenChange?.(!open);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onOpenChange]);

  const handleSelect = (path) => {
    onOpenChange?.(false);
    if (location.pathname !== path) {
      navigate(path);
    }
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Navigasi Cepat"
      description="Cari dan buka modul WorkBalance."
    >
      <Command>
        <CommandInput
          id="wb-command-search"
          name="command_search"
          placeholder="Cari modul..."
        />
        <CommandList>
          <CommandEmpty>Modul tidak ditemukan.</CommandEmpty>
          {groups.map((group) => (
            <CommandGroup key={group.label} heading={group.label}>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.to;
                return (
                  <CommandItem
                    key={item.to}
                    value={`${item.label} ${item.keywords || ''}`}
                    onSelect={() => handleSelect(item.to)}
                    className="flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="size-4 text-muted-foreground" />
                      <span>{item.label}</span>
                    </div>
                    {isActive ? (
                      <span className="text-xs font-medium text-primary">
                        Aktif
                      </span>
                    ) : (
                      <CornerDownLeft className="size-3.5 text-muted-foreground" />
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ))}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
