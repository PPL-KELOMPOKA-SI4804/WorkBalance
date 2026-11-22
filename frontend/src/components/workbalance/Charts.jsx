import { useReducedMotion } from 'motion/react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts';
import { cn } from '@/lib/utils';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { AnimatedNumber } from './AnimatedNumber';

const DECENT_WORK_META = {
  good: {
    label: 'Baik',
    color: 'var(--chart-2)',
    textClass: 'text-success',
  },
  needs_attention: {
    label: 'Perlu Perhatian',
    color: 'var(--chart-3)',
    textClass: 'text-warning',
  },
  action_priority: {
    label: 'Prioritas Tindakan',
    color: 'var(--chart-5)',
    textClass: 'text-danger',
  },
};

export function DecentWorkDonutChart({
  score = 0,
  category = 'needs_attention',
  className,
}) {
  const prefersReducedMotion = useReducedMotion();
  const clamped = Math.min(100, Math.max(0, Number(score || 0)));
  const meta = DECENT_WORK_META[category] || DECENT_WORK_META.needs_attention;

  const chartData = [
    { name: 'Skor Tercapai', value: Number(clamped.toFixed(1)), fill: meta.color },
    { name: 'Sisa Target', value: Number((100 - clamped).toFixed(1)), fill: 'var(--muted)' },
  ];

  const chartConfig = {
    score: { label: 'Decent Work Score', color: meta.color },
  };

  return (
    <div
      data-slot="decent-work-donut"
      className={cn('relative mx-auto flex size-48 items-center justify-center', className)}
    >
      <ChartContainer config={chartConfig} className="size-48 aspect-square">
        <PieChart>
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent hideLabel />}
          />
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius="72%"
            outerRadius="92%"
            startAngle={90}
            endAngle={-270}
            cornerRadius={8}
            stroke="none"
            isAnimationActive={!prefersReducedMotion}
            animationDuration={240}
            animationEasing="ease-out"
          >
            {chartData.map((entry) => (
              <Cell key={entry.name} fill={entry.fill} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <AnimatedNumber
          value={clamped}
          decimals={1}
          className="text-3xl leading-none font-semibold tracking-[-0.03em] text-foreground"
        />
        <span className={cn('mt-1.5 text-xs font-medium', meta.textClass)}>
          {meta.label}
        </span>
      </div>
    </div>
  );
}

export function WorkHoursBarChart({
  data = [],
  xKey = 'label',
  normalKey = 'normal_hours',
  overtimeKey = 'overtime_hours',
  dailyLimit = 8,
  heightClass = 'h-64',
  className,
}) {
  const prefersReducedMotion = useReducedMotion();
  const chartConfig = {
    [normalKey]: { label: 'Jam Normal', color: 'var(--chart-1)' },
    [overtimeKey]: { label: 'Jam Lembur', color: 'var(--chart-3)' },
  };

  return (
    <ChartContainer
      config={chartConfig}
      className={cn('w-full aspect-auto', heightClass, className)}
    >
      <BarChart data={data} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey={xKey}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          unit="j"
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        {typeof dailyLimit === 'number' && dailyLimit > 0 && (
          <ReferenceLine
            y={dailyLimit}
            stroke="var(--chart-5)"
            strokeDasharray="4 4"
            strokeWidth={1.5}
          />
        )}
        <Bar
          dataKey={normalKey}
          stackId="hours"
          fill={`var(--color-${normalKey})`}
          radius={[0, 0, 0, 0]}
          maxBarSize={36}
          isAnimationActive={!prefersReducedMotion}
          animationDuration={220}
          animationEasing="ease-out"
        />
        <Bar
          dataKey={overtimeKey}
          stackId="hours"
          fill={`var(--color-${overtimeKey})`}
          radius={[6, 6, 0, 0]}
          maxBarSize={36}
          isAnimationActive={!prefersReducedMotion}
          animationDuration={220}
          animationEasing="ease-out"
        />
      </BarChart>
    </ChartContainer>
  );
}

export function WorkloadTrendAreaChart({
  data = [],
  xKey = 'period',
  series = [
    { key: 'risk_score', label: 'Workload Risk', color: 'var(--chart-1)' },
  ],
  referenceY,
  heightClass = 'h-64',
  className,
}) {
  const prefersReducedMotion = useReducedMotion();
  const chartConfig = series.reduce((acc, item) => {
    acc[item.key] = { label: item.label, color: item.color };
    return acc;
  }, {});

  return (
    <ChartContainer
      config={chartConfig}
      className={cn('w-full aspect-auto', heightClass, className)}
    >
      <AreaChart data={data} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}>
        <defs>
          {series.map((item) => (
            <linearGradient
              key={item.key}
              id={`wb-grad-${item.key}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="5%" stopColor={item.color} stopOpacity={0.18} />
              <stop offset="95%" stopColor={item.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey={xKey}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <YAxis
          domain={[0, 100]}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        {typeof referenceY === 'number' && (
          <ReferenceLine
            y={referenceY}
            stroke="var(--chart-5)"
            strokeDasharray="4 4"
            strokeWidth={1.5}
          />
        )}
        {series.map((item) => (
          <Area
            key={item.key}
            type="monotone"
            dataKey={item.key}
            stroke={item.color}
            strokeWidth={2}
            fill={`url(#wb-grad-${item.key})`}
            dot={{ r: 3, strokeWidth: 1.5, fill: 'var(--card)' }}
            activeDot={{ r: 5 }}
            isAnimationActive={!prefersReducedMotion}
            animationDuration={220}
            animationEasing="ease-out"
          />
        ))}
      </AreaChart>
    </ChartContainer>
  );
}
