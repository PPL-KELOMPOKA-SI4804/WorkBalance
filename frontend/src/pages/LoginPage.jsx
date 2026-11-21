import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Scale,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getDefaultRouteForRole, useAuth } from '@/context/AuthContext';
import { extractApiError } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { StatusBadge } from '@/components/workbalance';

const DEMO_ACCOUNTS = [
  {
    label: 'Admin',
    tone: 'info',
    email: 'admin@workbalance.id',
    password: 'password123',
    scope: 'Master & Analitik',
  },
  {
    label: 'Manajer',
    tone: 'success',
    email: 'manager@workbalance.id',
    password: 'password123',
    scope: 'Pemantauan Tim',
  },
  {
    label: 'Pegawai',
    tone: 'warning',
    email: 'pegawai1@workbalance.id',
    password: 'password123',
    scope: 'Portal Pribadi',
  },
];

const SYSTEM_PILLARS = [
  {
    icon: Scale,
    label: 'Kepatuhan PP No. 35/2021',
    metric: '40j normal · maks 18j lembur',
  },
  {
    icon: TrendingUp,
    label: 'Decent Work Score',
    metric: '6 dimensi · skala 0–100',
  },
  {
    icon: ShieldCheck,
    label: 'Privasi Survei NFR-02',
    metric: 'Agregasi per departemen',
  },
];

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (user) {
    return <Navigate to={getDefaultRouteForRole(user.role)} replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage('');
    setSubmitting(true);

    try {
      const loggedInUser = await login(email.trim(), password);
      toast.success(
        `Selamat datang kembali, ${loggedInUser.employee?.full_name || loggedInUser.email}`
      );
      navigate(getDefaultRouteForRole(loggedInUser.role), { replace: true });
    } catch (err) {
      setErrorMessage(
        extractApiError(
          err,
          'Gagal masuk. Periksa kembali email dan kata sandi Anda.'
        ).message
      );
    } finally {
      setSubmitting(false);
    }
  };

  const applyDemoAccount = (demo) => {
    setEmail(demo.email);
    setPassword(demo.password);
    setErrorMessage('');
  };

  return (
    <div className="grid min-h-screen grid-cols-1 bg-background text-foreground lg:grid-cols-12">
      {/* Left Architectural Context Panel */}
      <aside className="hidden flex-col justify-between border-r border-border bg-sidebar p-10 lg:col-span-6 lg:flex xl:col-span-7 xl:p-14">
        <div>
          <img
            src="/assets/workbalance_horizontal_logo.svg"
            alt="WorkBalance"
            className="-ml-1 h-9 w-auto object-contain"
          />
        </div>

        <div className="my-auto flex max-w-xl flex-col gap-8 py-8">
          <div className="flex flex-col gap-3">
            <h2 className="text-3xl leading-[1.18] font-semibold tracking-[-0.03em] text-foreground text-balance xl:text-[34px]">
              Keseimbangan beban kerja, terukur setiap minggu.
            </h2>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              Pemantauan kapasitas tugas, jam kerja, dan indikator SDG 8 secara objektif dan non-punitif.
            </p>
          </div>

          {/* Concise Specification Surface */}
          <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {SYSTEM_PILLARS.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <div
                  key={pillar.label}
                  className="flex items-center justify-between gap-4 px-5 py-4"
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      aria-hidden="true"
                      className="size-4 shrink-0 text-primary"
                    />
                    <span className="text-sm font-medium text-foreground">
                      {pillar.label}
                    </span>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground tabular-nums">
                    {pillar.metric}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex w-full max-w-xl items-center justify-between text-xs text-muted-foreground">
          <span>WorkBalance · SDG 8 Decision Support</span>
          <span>PPL SI4804 · Kelompok A</span>
        </div>
      </aside>

      {/* Right Authentication Column */}
      <main className="flex flex-col items-center justify-center px-6 py-12 sm:px-10 lg:col-span-6 xl:col-span-5">
        <div className="flex w-full max-w-[380px] flex-col gap-7">
          <div className="flex flex-col gap-1.5">
            <img
              src="/assets/workbalance_horizontal_logo.svg"
              alt="WorkBalance"
              className="-ml-1 mb-3 h-8 w-auto self-start object-contain lg:hidden"
            />
            <h1 className="text-2xl font-semibold tracking-[-0.025em] text-foreground text-balance">
              Masuk ke ruang kerja
            </h1>
            <p className="text-sm text-muted-foreground">
              Gunakan akun organisasi untuk mengakses dasbor Anda.
            </p>
          </div>

          <AnimatePresence initial={false}>
            {errorMessage && (
              <motion.div
                role="alert"
                initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-3 text-xs text-destructive"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span className="leading-relaxed">{errorMessage}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email" className="text-xs font-medium text-foreground">
                Email
              </Label>
              <div className="relative">
                <Mail
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@workbalance.id"
                  className="h-10 rounded-lg bg-card pl-9 text-sm"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password" className="text-xs font-medium text-foreground">
                Kata Sandi
              </Label>
              <div className="relative">
                <Lock
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan kata sandi"
                  className="h-10 rounded-lg bg-card pr-10 pl-9 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={submitting}
              className="mt-1 h-10 w-full rounded-lg font-medium transition-transform active:scale-[0.99]"
            >
              {submitting ? (
                <>
                  <Spinner data-icon="inline-start" />
                  Memproses...
                </>
              ) : (
                <>
                  Masuk
                  <ArrowRight data-icon="inline-end" />
                </>
              )}
            </Button>
          </form>

          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">Akun Uji Cepat</span>
              <Separator className="flex-1" />
            </div>

            <div className="grid grid-cols-3 gap-2">
              {DEMO_ACCOUNTS.map((demo) => {
                const selected = email === demo.email;
                return (
                  <button
                    key={demo.email}
                    type="button"
                    onClick={() => applyDemoAccount(demo)}
                    className={cn(
                      'flex flex-col items-start gap-1.5 rounded-xl border px-3 py-2.5 text-left transition-colors',
                      selected
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-card hover:border-foreground/25 hover:bg-muted/40'
                    )}
                  >
                    <StatusBadge tone={demo.tone} label={demo.label} />
                    <span className="w-full truncate text-xs text-muted-foreground">
                      {demo.scope}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
