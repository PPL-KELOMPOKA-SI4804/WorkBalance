import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import {
  ChevronDown,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Scale,
  Search,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import {
  getInitials,
  getNavGroupsForRole,
  ROLE_LABELS,
} from '@/lib/navigation';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Spinner } from '@/components/ui/spinner';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { CommandMenu } from '@/components/workbalance';

const SIDEBAR_STORAGE_KEY = 'wb_sidebar_collapsed';

function readInitialCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function SidebarNav({ groups, pathname, collapsed, onNavigate, layoutScope = 'desktop' }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          {!collapsed && (
            <p className="px-2.5 pb-0.5 text-xs font-medium text-muted-foreground">
              {group.label}
            </p>
          )}
          <nav aria-label={group.label} className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.to;
              const linkNode = (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={onNavigate}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'group relative flex items-center gap-2.5 rounded-lg text-sm transition-colors',
                    collapsed ? 'justify-center p-2' : 'px-2.5 py-2',
                    isActive
                      ? 'font-medium text-foreground'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  )}
                >
                  {isActive && (
                    <motion.span
                      layoutId={prefersReducedMotion ? undefined : `wb-nav-active-${layoutScope}`}
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      aria-hidden="true"
                      className="absolute inset-0 rounded-lg bg-card ring-1 ring-border"
                    />
                  )}
                  <Icon
                    aria-hidden="true"
                    className={cn(
                      'relative z-10 size-4 shrink-0 transition-colors',
                      isActive
                        ? 'text-primary'
                        : 'text-muted-foreground group-hover:text-foreground'
                    )}
                  />
                  {!collapsed && (
                    <span className="relative z-10 truncate leading-none">
                      {item.label}
                    </span>
                  )}
                </Link>
              );

              if (!collapsed) {
                return linkNode;
              }

              return (
                <Tooltip key={item.to}>
                  <TooltipTrigger asChild>{linkNode}</TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </nav>
        </div>
      ))}
    </div>
  );
}

function RegulatoryFooter({ collapsed }) {
  if (collapsed) {
    return (
      <div className="flex justify-center border-t border-sidebar-border p-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex size-8 items-center justify-center rounded-lg text-muted-foreground">
              <Scale className="size-4" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            PP No. 35/2021 · 40j normal, maks 18j lembur/minggu
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="border-t border-sidebar-border px-4 py-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
        <Scale aria-hidden="true" className="size-3.5 shrink-0 text-primary" />
        <span className="truncate">PP 35/2021 · 40j + maks 18j</span>
      </div>
    </div>
  );
}

export default function AppShell({
  title,
  breadcrumb,
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Cari data...',
  actions,
  children,
}) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readInitialCollapsed);
  const [loggingOut, setLoggingOut] = useState(false);

  const navGroups = getNavGroupsForRole(user?.role);
  const fullName = user?.employee?.full_name || user?.email || 'Pengguna';
  const roleLabel = ROLE_LABELS[user?.role] || user?.role || 'Pengguna';
  const initials = getInitials(user?.employee?.full_name, user?.email);
  const employeeCode = user?.employee?.employee_code;
  const departmentName = user?.employee?.department?.name;

  // Keep breadcrumb concise: only show parent context when it does not repeat the page title
  const normalizedParent = breadcrumb
    ? String(breadcrumb).split('/')[0].trim()
    : '';
  const showBreadcrumb =
    Boolean(normalizedParent) &&
    normalizedParent.toLowerCase() !== String(title || '').trim().toLowerCase();

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? '1' : '0');
      } catch {
        // Ignore storage errors in restricted contexts
      }
      return next;
    });
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Desktop Collapsible Sidebar (Second Neutral Surface) */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ease-out lg:flex',
          collapsed ? 'w-[68px]' : 'w-60'
        )}
      >
        <div
          className={cn(
            'flex h-14 shrink-0 items-center border-b border-sidebar-border',
            collapsed ? 'justify-center px-2' : 'px-4'
          )}
        >
          <Link
            to="/"
            className="flex items-center focus-visible:outline-none"
            aria-label="Beranda WorkBalance"
          >
            {collapsed ? (
              <img
                src="/assets/workbalance_logo.svg"
                alt="WorkBalance"
                className="size-7 object-contain"
              />
            ) : (
              <img
                src="/assets/workbalance_horizontal_logo.svg"
                alt="WorkBalance"
                className="-ml-1 h-8 w-auto object-contain"
              />
            )}
          </Link>
        </div>

        <SidebarNav
          groups={navGroups}
          pathname={location.pathname}
          collapsed={collapsed}
          layoutScope="desktop"
        />

        <RegulatoryFooter collapsed={collapsed} />
      </aside>

      {/* Mobile / Tablet Accessible Sheet Navigation */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="flex w-72 flex-col gap-0 bg-sidebar p-0"
        >
          <SheetHeader className="flex h-14 flex-row items-center border-b border-sidebar-border px-4 py-0">
            <img
              src="/assets/workbalance_horizontal_logo.svg"
              alt="WorkBalance"
              className="-ml-1 h-8 w-auto object-contain"
            />
            <SheetTitle className="sr-only">Navigasi WorkBalance</SheetTitle>
            <SheetDescription className="sr-only">
              Menu navigasi utama berdasarkan peran pengguna.
            </SheetDescription>
          </SheetHeader>

          <SidebarNav
            groups={navGroups}
            pathname={location.pathname}
            collapsed={false}
            layoutScope="mobile"
            onNavigate={() => setMobileOpen(false)}
          />

          <RegulatoryFooter collapsed={false} />
        </SheetContent>
      </Sheet>

      {/* Main Content Shell */}
      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col transition-[padding-left] duration-200 ease-out',
          collapsed ? 'lg:pl-[68px]' : 'lg:pl-60'
        )}
      >
        {/* Sticky Top Header Bar */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-border bg-background/95 px-4 backdrop-blur-sm sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2.5">
            <Button
              variant="ghost"
              size="icon-sm"
              className="-ml-1.5 lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Buka navigasi"
            >
              <Menu className="size-4" />
            </Button>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="-ml-1.5 hidden text-muted-foreground hover:text-foreground lg:inline-flex"
                  onClick={toggleCollapsed}
                  aria-label={collapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
                >
                  {collapsed ? (
                    <PanelLeftOpen className="size-4" />
                  ) : (
                    <PanelLeftClose className="size-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {collapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
              </TooltipContent>
            </Tooltip>

            <div className="flex min-w-0 items-baseline gap-2">
              {showBreadcrumb && (
                <>
                  <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                    {normalizedParent}
                  </span>
                  <span
                    aria-hidden="true"
                    className="hidden text-xs text-border sm:inline"
                  >
                    /
                  </span>
                </>
              )}
              <h1 className="truncate text-[15px] leading-tight font-semibold tracking-[-0.015em] text-foreground">
                {title}
              </h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2.5">
            {onSearchChange && (
              <div className="relative hidden w-60 md:block lg:w-72">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="wb-header-search"
                  name="header_search"
                  type="text"
                  value={searchValue}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-8 bg-card pl-8 pr-7 text-xs"
                />
                {searchValue && (
                  <button
                    type="button"
                    onClick={() => onSearchChange('')}
                    aria-label="Hapus pencarian"
                    className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCommandOpen(true)}
              className="hidden h-8 gap-2 bg-card px-2.5 text-xs font-normal text-muted-foreground hover:text-foreground sm:inline-flex"
            >
              <Search className="size-3.5" />
              <span className="hidden xl:inline">Cari modul...</span>
              <kbd className="rounded-sm border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] leading-none font-medium text-foreground">
                Ctrl K
              </kbd>
            </Button>

            {actions}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="-mr-1.5 flex items-center gap-2 rounded-lg px-2 py-1 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Avatar className="size-7 border border-border">
                    <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden max-w-[140px] flex-col sm:flex">
                    <span className="truncate text-xs leading-tight font-medium text-foreground">
                      {fullName}
                    </span>
                    <span className="truncate text-xs leading-tight text-muted-foreground">
                      {roleLabel}
                    </span>
                  </div>
                  <ChevronDown className="hidden size-3.5 text-muted-foreground sm:block" />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="flex flex-col gap-1 font-normal">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-semibold text-foreground">
                      {fullName}
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">
                      {roleLabel}
                    </span>
                  </div>
                  <span className="truncate text-xs text-muted-foreground">
                    {user?.email}
                  </span>
                  {(employeeCode || departmentName) && (
                    <span className="truncate text-xs text-muted-foreground">
                      {employeeCode && <span className="font-mono">{employeeCode}</span>}
                      {employeeCode && departmentName ? ' · ' : ''}
                      {departmentName}
                    </span>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={loggingOut}
                    onSelect={(event) => {
                      event.preventDefault();
                      handleLogout();
                    }}
                  >
                    {loggingOut ? (
                      <Spinner className="size-4" />
                    ) : (
                      <LogOut className="size-4" />
                    )}
                    <span>{loggingOut ? 'Keluar...' : 'Keluar'}</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Main Workspace Canvas */}
        <main className="mx-auto w-full max-w-[1480px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>

      {/* Global Ctrl+K Command Palette */}
      <CommandMenu
        open={commandOpen}
        onOpenChange={setCommandOpen}
        role={user?.role}
      />
    </div>
  );
}
