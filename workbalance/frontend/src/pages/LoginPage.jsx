import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, Lock, Mail, ShieldCheck } from 'lucide-react';
import { getDefaultRouteForRole, useAuth } from '../context/AuthContext';
import { extractApiError } from '../services/api';

const DEMO_ACCOUNTS = [
  { label: 'Admin', email: 'admin@workbalance.id', password: 'password123', badge: 'Full CRUD Master' },
  { label: 'Manajer', email: 'manager@workbalance.id', password: 'password123', badge: 'Read-Only Tim' },
  { label: 'Pegawai', email: 'pegawai1@workbalance.id', password: 'password123', badge: 'Portal Pribadi' },
];

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      navigate(getDefaultRouteForRole(loggedInUser.role), { replace: true });
    } catch (err) {
      setErrorMessage(extractApiError(err, 'Gagal masuk. Periksa email dan kata sandi Anda.').message);
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
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-white">
      {/* Left Brand Panel */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-[#1E293B] to-[#0369A1] text-white relative overflow-hidden">
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 32 32" fill="none" className="w-9 h-9" aria-hidden="true">
            <rect x="4" y="9" width="6" height="16" rx="3" fill="#38BDF8" />
            <rect x="13" y="4" width="6" height="22" rx="3" fill="#10B981" />
            <rect x="22" y="10" width="6" height="15" rx="3" fill="#F59E0B" />
            <path d="M4.5 18.5C9.5 14.2 22.5 14.2 27.5 18.5" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
          <div>
            <span className="text-xl font-bold tracking-tight">
              Work<span className="text-[#38BDF8]">Balance</span>
            </span>
            <p className="text-[10px] tracking-[0.14em] uppercase text-sky-200/90 font-semibold">
              Decent Work, Better Life
            </p>
          </div>
        </div>

        <div className="max-w-lg space-y-6 my-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs font-medium text-sky-100">
            <ShieldCheck className="w-4 h-4 text-[#10B981]" />
            <span>SDG 8 Decision Support System (Target 8.5 & 8.8)</span>
          </div>

          <h2 className="text-3xl font-bold leading-snug">
            Pantau Beban Kerja dan Kondisi Kerja Secara Terukur & Adil.
          </h2>
          <p className="text-sm text-sky-100/85 leading-relaxed">
            WorkBalance mengintegrasikan data kepegawaian, aktivitas kerja, kesejahteraan, dan
            kepatuhan waktu kerja sesuai acuan <span className="font-semibold text-white">PP No. 35/2021</span>{' '}
            untuk membantu organisasi menjaga keseimbangan beban kerja tim.
          </p>

          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="rounded-xl bg-white/10 border border-white/10 p-4">
              <div className="w-2 h-8 rounded-full bg-[#38BDF8] mb-2.5" />
              <p className="text-xs font-semibold">Struktur Kerja</p>
              <p className="text-[11px] text-sky-100/75 mt-0.5">Kapasitas & jam kerja normal</p>
            </div>
            <div className="rounded-xl bg-white/10 border border-white/10 p-4">
              <div className="w-2 h-10 rounded-full bg-[#10B981] mb-2.5" />
              <p className="text-xs font-semibold">Kesejahteraan</p>
              <p className="text-[11px] text-sky-100/75 mt-0.5">Decent Work Score 6 dimensi</p>
            </div>
            <div className="rounded-xl bg-white/10 border border-white/10 p-4">
              <div className="w-2 h-7 rounded-full bg-[#F59E0B] mb-2.5" />
              <p className="text-xs font-semibold">Deteksi Dini</p>
              <p className="text-[11px] text-sky-100/75 mt-0.5">Peringatan risiko beban kerja</p>
            </div>
          </div>
        </div>

        <p className="text-xs text-sky-200/70">
          Purwarupa Akademik PPL SI4804 — Kelompok A-A
        </p>
      </div>

      {/* Right Form Panel */}
      <div className="flex flex-col justify-center items-center p-6 sm:p-12 bg-[#F8FAFC]">
        <div className="w-full max-w-md bg-white rounded-xl border border-slate-200/80 p-7 sm:p-8 shadow-xs">
          <div className="mb-6">
            <img
              src="/assets/workbalance_horizontal_logo_2.svg"
              alt="WorkBalance"
              className="h-9 w-auto mb-5"
            />
            <h1 className="text-2xl font-bold text-[#1E293B]">Masuk ke WorkBalance</h1>
            <p className="text-sm text-slate-500 mt-1">
              Gunakan akun organisasi Anda untuk mengakses ruang kerja sesuai peran.
            </p>
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2.5 rounded-lg bg-[#FEE2E2] border border-red-200 px-3.5 py-3 text-xs text-[#B91C1C]"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@workbalance.id"
                  className="w-full pl-9 pr-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#0284C7] focus:ring-2 focus:ring-[#0284C7]/20 transition"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Kata Sandi
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan kata sandi"
                  className="w-full pl-9 pr-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#0284C7] focus:ring-2 focus:ring-[#0284C7]/20 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-60 text-white font-semibold text-sm py-2.5 px-4 rounded-lg transition cursor-pointer"
            >
              <span>{submitting ? 'Memproses...' : 'Masuk'}</span>
              {!submitting && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
              Isi Cepat Akun Demo (Data Uji)
            </p>
            <div className="grid grid-cols-3 gap-2">
              {DEMO_ACCOUNTS.map((demo) => (
                <button
                  key={demo.email}
                  type="button"
                  onClick={() => applyDemoAccount(demo)}
                  className="text-left p-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:border-[#0284C7] hover:bg-[#E0F2FE]/40 transition cursor-pointer"
                >
                  <p className="text-xs font-semibold text-[#1E293B]">{demo.label}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 truncate">{demo.badge}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
