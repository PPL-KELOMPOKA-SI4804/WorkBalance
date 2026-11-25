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
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getDefaultRouteForRole, useAuth } from '@/context/AuthContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { extractApiError } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { BrandLogo, StatusBadge, ThemeSwitch } from '@/components/workbalance';

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

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();

  useDocumentTitle('Masuk');

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
    <div className="relative grid min-h-screen grid-cols-1 bg-background text-foreground lg:grid-cols-12">
      <div className="absolute top-4 right-4 z-20 sm:top-6 sm:right-6">
        <ThemeSwitch />
      </div>

      {/* Left Editorial Photography Panel (HRDashboard 2. Sign In - Filled) */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-[oklch(0.15_0.020_262)] lg:col-span-6 lg:flex">
        <img
          src="/assets/login-hero.jpg"
          alt="Kolaborasi tim WorkBalance dalam ruang kerja modern"
          className="absolute inset-0 h-full w-full object-cover object-[center_35%]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-[oklch(0.135_0.022_262/96%)] via-[oklch(0.145_0.022_262/56%)] to-[oklch(0.145_0.022_262/22%)]"
        />

        <div className="relative z-10 p-10 xl:p-14">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/25 px-3.5 py-1.5 text-xs font-medium text-white/90 backdrop-blur-sm">
            <span className="size-1.5 rounded-full bg-[var(--chart-2)]" />
            SDG 8 · Decent Work Decision Support
          </span>
        </div>

        <div className="relative z-10 mt-auto flex max-w-xl flex-col gap-5 p-10 xl:p-14">
          <BrandLogo variant="lockup" inverted />

          <div className="flex flex-col gap-2.5">
            <h2 className="text-3xl leading-[1.18] font-bold tracking-[-0.03em] text-white text-balance xl:text-[36px]">
              Keseimbangan beban kerja, terukur setiap minggu.
            </h2>
            <p className="max-w-md text-sm leading-relaxed text-white/80">
              Pemantauan kapasitas tugas, batas jam kerja PP No. 35/2021, dan indikator SDG 8 secara objektif dan non-punitif.
            </p>
          </div>

          <div className="flex items-center justify-between gap-4 pt-3">
            <div className="flex items-center gap-1.5" aria-hidden="true">
              <span className="h-1.5 w-8 rounded-full bg-white" />
              <span className="h-1.5 w-2 rounded-full bg-white/35" />
              <span className="h-1.5 w-2 rounded-full bg-white/35" />
            </div>
            <span className="text-xs font-medium text-white/75 tabular-nums">
              PP No. 35/2021 · Privasi NFR-02
            </span>
          </div>
        </div>
      </aside>

      {/* Right Authentication Column */}
      <main className="flex flex-col items-center justify-center px-6 py-12 sm:px-10 lg:col-span-6">
        <div className="flex w-full max-w-[400px] flex-col gap-7">
          <div className="flex flex-col gap-1.5">
            <div className="mb-3 self-start lg:hidden">
              <BrandLogo variant="horizontal" />
            </div>
            <h1 className="text-2xl font-bold tracking-[-0.025em] text-foreground text-balance sm:text-[28px]">
              Masuk ke akun Anda
            </h1>
            <p className="text-sm text-muted-foreground">
              Gunakan akun organisasi untuk mengakses ruang kerja WorkBalance.
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
                className="flex items-start gap-2.5 rounded-xl border border-danger-border bg-danger-subtle px-3.5 py-3 text-xs text-danger"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span className="leading-relaxed">{errorMessage}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-foreground">
                Email <span className="text-danger">*</span>
              </Label>
              <div className="relative">
                <Mail
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
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
                  className="h-11 rounded-xl bg-card pl-10 text-sm"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password" className="text-xs font-semibold text-foreground">
                Kata Sandi <span className="text-danger">*</span>
              </Label>
              <div className="relative">
                <Lock
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
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
                  className="h-11 rounded-xl bg-card pr-10 pl-10 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="cta"
              size="lg"
              disabled={submitting}
              className="mt-1 h-11 w-full rounded-xl font-semibold transition-transform active:scale-[0.99]"
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
                      'flex flex-col items-start gap-1.5 rounded-xl border px-3 py-2.5 text-left transition-all duration-150',
                      selected
                        ? 'border-primary bg-primary/10 shadow-[inset_0_0_0_1px_var(--primary)]'
                        : 'border-border bg-card hover:-translate-y-0.5 hover:border-hover-border hover:bg-hover-surface hover:shadow-xs dark:hover:shadow-none'
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

          <p className="text-center text-xs text-muted-foreground">
            WorkBalance · PPL SI4804 · Kelompok A
          </p>
        </div>
      </main>
    </div>
  );
}
