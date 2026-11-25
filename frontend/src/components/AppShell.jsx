import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
  Menu,
  Scale,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import {
  getDashboardItemForRole,
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
import { BrandLogo, CommandMenu, ThemeSwitch } from '@/components/workbalance';

const SIDEBAR_STORAGE_KEY = 'wb_sidebar_collapsed';

function readInitialCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function SidebarNav({
  dashboardItem,
  groups,
  pathname,
  collapsed,
  onNavigate,
  layoutScope = 'desktop',
}) {
  const prefersReducedMotion = useReducedMotion();

  // Keep active route's accordion group expanded by default
  const [openGroups, setOpenGroups] = useState(() => {
    const initial = {};
    for (const g of groups) {
      const hasActive = g.items.some((item) => item.to === pathname);
      initial[g.id] = hasActive || groups.length <= 2;
    }
    return initial;
  });

  useEffect(() => {
    setOpenGroups((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const g of groups) {
        if (g.items.some((item) => item.to === pathname) && !next[g.id]) {
          next[g.id] = true;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [groups, pathname]);

  const toggleGroup = (id) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const isDashboardActive = dashboardItem && pathname === dashboardItem.to;
  const DashboardIcon = dashboardItem?.icon;

  return (
    <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 py-4">
      {/* HRDashboard Home-V1 Hero Dashboard CTA Pill */}
      {dashboardItem && (
        <div>
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  to={dashboardItem.to}
                  onClick={onNavigate}
                  aria-current={isDashboardActive ? 'page' : undefined}
                  aria-label={dashboardItem.label}
                  className={cn(
                    'flex size-10 mx-auto items-center justify-center rounded-xl transition-all duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]',
                    'bg-[var(--hero-primary)] text-[var(--hero-primary-foreground)] hover:-translate-y-px hover:brightness-110 hover:shadow-[0_12px_24px_-8px_oklch(0.538_0.152_238_/_68%)] active:translate-y-0',
                    isDashboardActive
                      ? 'shadow-[0_8px_20px_-6px_oklch(0.538_0.152_238_/_55%)] ring-2 ring-primary/25'
                      : 'opacity-92 hover:opacity-100'
                  )}
                >
                  {DashboardIcon && <DashboardIcon aria-hidden="true" className="size-4" />}
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                {dashboardItem.commandLabel || dashboardItem.label}
              </TooltipContent>
            </Tooltip>
          ) : (
            <Link
              to={dashboardItem.to}
              onClick={onNavigate}
              aria-current={isDashboardActive ? 'page' : undefined}
              className={cn(
                'flex h-11 w-full items-center justify-between rounded-xl px-4 text-sm font-semibold transition-all duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]',
                'bg-[var(--hero-primary)] text-[var(--hero-primary-foreground)] hover:-translate-y-px hover:brightness-110 hover:shadow-[0_12px_26px_-8px_oklch(0.538_0.152_238_/_68%)] active:translate-y-0',
                isDashboardActive
                  ? 'shadow-[0_10px_24px_-8px_oklch(0.538_0.152_238_/_60%)]'
                  : 'opacity-92 hover:opacity-100'
              )}
            >
              <span className="truncate leading-5">{dashboardItem.label}</span>
              {DashboardIcon && <DashboardIcon aria-hidden="true" className="size-4 shrink-0" />}
            </Link>
          )}
        </div>
      )}

      {/* Collapsible Accordion Navigation Groups */}
      <div className="flex flex-col gap-1.5">
        {groups.map((group) => {
          const GroupIcon = group.icon;
          const groupHasActive = group.items.some((item) => item.to === pathname);
          const isOpen = Boolean(openGroups[group.id]);

          // Collapsed Icon Rail: render flat icons with tooltips
          if (collapsed) {
            return (
              <div key={group.id} className="flex flex-col items-center gap-1 py-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.to;
                  return (
                    <Tooltip key={item.to}>
                      <TooltipTrigger asChild>
                        <Link
                          to={item.to}
                          onClick={onNavigate}
                          aria-current={isActive ? 'page' : undefined}
                          aria-label={item.label}
                          className={cn(
                            'relative flex size-10 items-center justify-center rounded-xl transition-all duration-150',
                            isActive
                              ? 'bg-hover-surface text-primary'
                              : 'text-sidebar-foreground hover:scale-105 hover:bg-hover-surface hover:text-primary'
                          )}
                        >
                          <Icon aria-hidden="true" className="size-4" />
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right" sideOffset={8}>
                        {item.label}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            );
          }

          return (
            <div key={group.id} className="flex flex-col">
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                aria-expanded={isOpen}
                className={cn(
                  'group flex h-10 w-full items-center justify-between gap-2.5 rounded-xl px-3 text-sm font-medium transition-all duration-150 hover:bg-hover-surface hover:text-foreground',
                  groupHasActive
                    ? 'text-foreground'
                    : 'text-sidebar-foreground'
                )}
              >
                <span className="flex min-w-0 items-center gap-3">
                  {GroupIcon && (
                    <GroupIcon
                      aria-hidden="true"
                      className={cn(
                        'size-4 shrink-0 transition-all duration-150 group-hover:scale-105 group-hover:text-primary',
                        groupHasActive
                          ? 'text-primary'
                          : 'text-muted-foreground'
                      )}
                    />
                  )}
                  <span className="truncate leading-5">{group.label}</span>
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className={cn(
                    'size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:text-foreground',
                    isOpen && 'rotate-180'
                  )}
                />
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.nav
                    aria-label={group.label}
                    initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                    animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
                    exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="mt-0.5 flex flex-col gap-0.5 pb-1.5 pl-4">
                      {group.items.map((item) => {
                        const isActive = pathname === item.to;
                        return (
                          <Link
                            key={item.to}
                            to={item.to}
                            onClick={onNavigate}
                            aria-current={isActive ? 'page' : undefined}
                            className={cn(
                              'group relative flex items-center rounded-xl px-4 py-2 text-sm transition-all duration-150',
                              isActive
                                ? 'font-semibold text-foreground'
                                : 'text-sidebar-foreground hover:bg-hover-surface hover:text-foreground hover:shadow-[inset_3px_0_0_var(--primary)]'
                            )}
                          >
                            {isActive && (
                              <motion.span
                                layoutId={
                                  prefersReducedMotion
                                    ? undefined
                                    : `wb-nav-active-${layoutScope}`
                                }
                                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                                aria-hidden="true"
                                className="absolute inset-0 rounded-xl bg-hover-surface shadow-[inset_3px_0_0_var(--primary)]"
                              />
                            )}
                            <span className="relative z-10 truncate leading-5 transition-transform duration-150 group-hover:translate-x-0.5">
                              {item.label}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </motion.nav>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RegulatoryFooter({ collapsed }) {
  if (collapsed) {
    return (
      <div className="flex justify-center border-t border-sidebar-border p-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex size-9 items-center justify-center rounded-xl text-muted-foreground">
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
    <div className="border-t border-sidebar-border px-4 py-3.5">
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
  actions,
  children,
}) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useDocumentTitle(title);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readInitialCollapsed);
  const [loggingOut, setLoggingOut] = useState(false);

  const dashboardItem = getDashboardItemForRole(user?.role);
  const navGroups = getNavGroupsForRole(user?.role);
  const fullName = user?.employee?.full_name || user?.email || 'Pengguna';
  const roleLabel = ROLE_LABELS[user?.role] || user?.role || 'Pengguna';
  const initials = getInitials(user?.employee?.full_name, user?.email);
  const employeeCode = user?.employee?.employee_code;
  const departmentName = user?.employee?.department?.name;

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
      {/* Desktop Collapsible Sidebar (HRDashboard Home-V1) */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ease-out lg:flex',
          collapsed ? 'w-[72px]' : 'w-64'
        )}
      >
        <div
          className={cn(
            'flex h-[68px] shrink-0 items-center border-b border-sidebar-border',
            collapsed ? 'justify-center px-2' : 'justify-between px-4'
          )}
        >
          <Link
            to="/"
            className="flex min-w-0 items-center focus-visible:outline-none"
            aria-label="Beranda WorkBalance"
          >
            <BrandLogo variant={collapsed ? 'mark' : 'horizontal'} />
          </Link>

          {!collapsed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={toggleCollapsed}
                  aria-label="Ciutkan sidebar"
                  className="shrink-0 rounded-lg text-muted-foreground hover:text-foreground"
                >
                  <ChevronsLeft className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Ciutkan sidebar</TooltipContent>
            </Tooltip>
          )}
        </div>

        {collapsed && (
          <div className="flex justify-center pt-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={toggleCollapsed}
                  aria-label="Perluas sidebar"
                  className="rounded-lg text-muted-foreground hover:text-foreground"
                >
                  <ChevronsRight className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Perluas sidebar</TooltipContent>
            </Tooltip>
          </div>
        )}

        <SidebarNav
          dashboardItem={dashboardItem}
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
          <SheetHeader className="flex h-[68px] flex-row items-center border-b border-sidebar-border px-4 py-0">
            <BrandLogo variant="horizontal" />
            <SheetTitle className="sr-only">Navigasi WorkBalance</SheetTitle>
            <SheetDescription className="sr-only">
              Menu navigasi utama berdasarkan peran pengguna.
            </SheetDescription>
          </SheetHeader>

          <SidebarNav
            dashboardItem={dashboardItem}
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
          collapsed ? 'lg:pl-[72px]' : 'lg:pl-64'
        )}
      >
        {/* Sticky Top Header Bar (HRDashboard h-[68px] with wide search trigger & ThemeSwitch) */}
        <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between gap-4 border-b border-border bg-sidebar/95 px-4 backdrop-blur-sm sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="ghost"
              size="icon-sm"
              className="-ml-1.5 lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Buka navigasi"
            >
              <Menu className="size-4" />
            </Button>

            {/* Wide Command Search Trigger (Figma HRDashboard Topbar Signature) */}
            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              aria-label="Cari modul atau halaman"
              className="hidden h-10 w-60 items-center justify-between gap-2 rounded-xl border border-border bg-muted/65 px-3.5 text-sm text-muted-foreground transition-all duration-150 hover:border-hover-border hover:bg-hover-surface hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:inline-flex xl:w-72"
            >
              <span className="inline-flex min-w-0 items-center gap-2.5 truncate">
                <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-xs">Cari modul...</span>
              </span>
              <kbd className="shrink-0 rounded-md border border-border bg-card px-1.5 py-0.5 font-mono text-xs leading-none font-normal text-foreground">
                Ctrl K
              </kbd>
            </button>

            <div className="flex min-w-0 items-baseline gap-2 md:pl-1">
              {showBreadcrumb && (
                <>
                  <span className="hidden shrink-0 text-xs text-muted-foreground xl:inline">
                    {normalizedParent}
                  </span>
                  <span
                    aria-hidden="true"
                    className="hidden text-xs text-border xl:inline"
                  >
                    /
                  </span>
                </>
              )}
              <h1 className="truncate text-sm leading-tight font-semibold tracking-[-0.015em] text-foreground sm:text-[15px]">
                {title}
              </h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setCommandOpen(true)}
              aria-label="Cari modul"
              className="rounded-lg text-muted-foreground hover:text-foreground md:hidden"
            >
              <Search className="size-4" />
            </Button>

            {actions}

            <ThemeSwitch />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="-mr-1.5 flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-all duration-150 hover:bg-hover-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Avatar className="size-8 border border-border">
                    <AvatarFallback className="bg-primary/12 text-xs font-semibold text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden max-w-[140px] flex-col sm:flex">
                    <span className="truncate text-xs leading-tight font-semibold text-foreground">
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
