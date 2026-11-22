import { cn } from '@/lib/utils';

const TONE_CLASSES = {
  success: {
    pill: 'border-success-border bg-success-subtle text-success',
    dot: 'bg-success-solid',
  },
  warning: {
    pill: 'border-warning-border bg-warning-subtle text-warning',
    dot: 'bg-warning-solid',
  },
  danger: {
    pill: 'border-danger-border bg-danger-subtle text-danger',
    dot: 'bg-danger-solid',
  },
  info: {
    pill: 'border-info-border bg-info-subtle text-info',
    dot: 'bg-info-solid',
  },
  neutral: {
    pill: 'border-border bg-muted text-foreground',
    dot: 'bg-muted-foreground',
  },
};

const STATUS_PRESETS = {
  // Workload Risk
  low: { label: 'Risiko Rendah', tone: 'success' },
  medium: { label: 'Risiko Sedang', tone: 'warning' },
  high: { label: 'Risiko Tinggi', tone: 'danger' },
  override: { label: 'Override PP 35', tone: 'danger' },

  // Decent Work Score
  good: { label: 'Baik', tone: 'success' },
  needs_attention: { label: 'Perlu Perhatian', tone: 'warning' },
  action_priority: { label: 'Prioritas Tindakan', tone: 'danger' },

  // Workflow & Approvals
  approved: { label: 'Disetujui', tone: 'success' },
  completed: { label: 'Selesai', tone: 'success' },
  resolved: { label: 'Selesai', tone: 'success' },
  active: { label: 'Aktif', tone: 'success' },

  pending: { label: 'Menunggu', tone: 'warning' },
  in_progress: { label: 'Ditangani', tone: 'warning' },

  open: { label: 'Terbuka', tone: 'info' },
  enrolled: { label: 'Terdaftar', tone: 'info' },
  planned: { label: 'Direncanakan', tone: 'info' },
  todo: { label: 'Belum Mulai', tone: 'info' },

  rejected: { label: 'Ditolak', tone: 'danger' },
  cancelled: { label: 'Dibatalkan', tone: 'neutral' },
  inactive: { label: 'Nonaktif', tone: 'neutral' },
  severe: { label: 'Kritis', tone: 'danger' },
};

export function StatusBadge({
  status,
  tone,
  label,
  showDot = true,
  className,
}) {
  const key = typeof status === 'string' ? status.toLowerCase() : '';
  const preset = STATUS_PRESETS[key];
  const resolvedTone = tone || preset?.tone || 'neutral';
  const resolvedLabel = label || preset?.label || status || '-';
  const styles = TONE_CLASSES[resolvedTone] || TONE_CLASSES.neutral;

  return (
    <span
      data-slot="status-badge"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs leading-4 font-medium whitespace-nowrap tabular-nums',
        styles.pill,
        className
      )}
    >
      {showDot && (
        <span
          aria-hidden="true"
          className={cn(
            'size-1.5 shrink-0 -translate-y-[0.5px] rounded-full',
            styles.dot
          )}
        />
      )}
      <span>{resolvedLabel}</span>
    </span>
  );
}
