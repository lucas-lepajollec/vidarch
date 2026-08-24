import React, { useState } from 'react';
import { Loader2, Lock, ShieldCheck } from 'lucide-react';
import { VidArchLogo } from '../components/common/VidArchLogo';
import { useI18n } from '../i18n/I18nProvider';

interface LoginPageProps {
  setupAvailable: boolean;
  onAuthenticated: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ setupAvailable, onAuthenticated }) => {
  const { t } = useI18n();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isSetup = setupAvailable;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (isSetup && password.length < 6) {
      setError(t('login.minLength'));
      return;
    }
    if (isSetup && password !== confirm) {
      setError(t('login.mismatch'));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(isSetup ? '/api/auth/setup' : '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || t('login.failed'));
        return;
      }
      onAuthenticated();
    } catch (err: any) {
      setError(err.message || t('login.network'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090d12] text-[#f4f7fb] flex items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-[#0f151d] border border-[#18212c] rounded-2xl p-8 space-y-6"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <VidArchLogo size="lg" />
          <h1 className="text-xl font-bold">
            {isSetup ? t('login.setupTitle') : t('login.title')}
          </h1>
          <p className="text-xs text-[#aaa] leading-relaxed">
            {isSetup
              ? t('login.setupBody')
              : t('login.body')}
          </p>
        </div>

        <label className="block space-y-1.5">
          <span className="text-[11px] font-semibold text-[#aaa] flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" />
            {t('login.password')}
          </span>
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-[#0c1118] border border-[#23303e] focus:border-white text-sm rounded-xl px-3.5 py-2.5 outline-none"
          />
        </label>

        {isSetup && (
          <label className="block space-y-1.5">
            <span className="text-[11px] font-semibold text-[#aaa]">{t('login.confirm')}</span>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full bg-[#0c1118] border border-[#23303e] focus:border-white text-sm rounded-xl px-3.5 py-2.5 outline-none"
            />
          </label>
        )}

        {error && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !password}
          className="w-full bg-white hover:bg-white/90 text-black text-sm font-bold py-2.5 rounded-full transition disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
          <span>{isSetup ? t('login.setupSubmit') : t('login.submit')}</span>
        </button>
      </form>
    </div>
  );
};
