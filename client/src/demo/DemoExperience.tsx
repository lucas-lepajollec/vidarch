import React, { useEffect, useRef, useState } from 'react';
import { CircleHelp, RotateCcw, ShieldCheck } from 'lucide-react';
import { isDemoMode, resetDemoSession } from './config';
import { useI18n } from '../i18n/I18nProvider';

const LINKS = {
  site: 'https://vidarch.lucas-homelab.fr',
  docs: 'https://docs.vidarch.lucas-homelab.fr',
  source: 'https://github.com/lucas-lepajollec/vidarch',
};

function readIntroSeen() {
  try {
    return sessionStorage.getItem('lh-demo-intro-seen') === '1';
  } catch {
    return false;
  }
}

export const DemoExperience: React.FC = () => {
  const { t } = useI18n();
  const [isGuideOpen, setGuideOpen] = useState(() => isDemoMode && !readIntroSeen());
  const [noticeKey, setNoticeKey] = useState('demo.defaultNotice');
  const [announcement, setAnnouncement] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!isDemoMode) return;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const onNotice = (event: Event) => {
      const key = (event as CustomEvent<string>).detail || 'demo.defaultNotice';
      setNoticeKey(key);
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => setNoticeKey('demo.defaultNotice'), 3500);
    };
    window.addEventListener('vidarch-demo-notice', onNotice);
    return () => {
      window.removeEventListener('vidarch-demo-notice', onNotice);
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isGuideOpen && !dialog.open) {
      dialog.showModal();
      titleRef.current?.focus({ preventScroll: true });
      dialog.scrollTop = 0;
    }
    if (!isGuideOpen && dialog.open) dialog.close();
  }, [isGuideOpen]);

  if (!isDemoMode) return null;

  const closeGuide = () => {
    try {
      sessionStorage.setItem('lh-demo-intro-seen', '1');
    } catch {
      /* ignore */
    }
    setGuideOpen(false);
  };

  const resetDemo = () => {
    setAnnouncement(t('demo.resetting'));
    resetDemoSession();
  };

  const cards = [
    { title: t('demo.try'), text: t('demo.tryBody') },
    { title: t('demo.sim'), text: t('demo.simBody') },
    { title: t('demo.never'), text: t('demo.neverBody') },
  ];

  return (
    <>
      <div className={`lh-demo-chip pointer-events-none fixed bottom-4 right-4 z-[80] ${isGuideOpen ? 'invisible' : ''}`}>
        {noticeKey !== 'demo.defaultNotice' && (
          <div className="pointer-events-none mb-2 max-w-[240px] rounded-2xl border border-white/10 bg-[#0b0e13]/92 px-3 py-2 text-[11px] leading-4 text-white/60 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl">
            {t(noticeKey)}
          </div>
        )}
        <div className="pointer-events-auto flex items-center rounded-full border border-white/12 bg-[#0b0e13]/92 p-1 text-white shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <button
            type="button"
            onClick={() => setGuideOpen(true)}
            className="flex min-h-9 items-center gap-2 rounded-full px-3 text-[11px] font-semibold tracking-[0.14em] uppercase text-white/90 transition-colors hover:bg-white/8"
            aria-label={t('demo.info')}
          >
            <span>{t('demo.chip')}</span>
            <CircleHelp size={14} className="text-white/45" aria-hidden="true" />
          </button>
          <span className="h-4 w-px bg-white/12" aria-hidden="true" />
          <button
            type="button"
            onClick={resetDemo}
            className="grid size-9 place-items-center rounded-full text-white/55 transition-colors hover:bg-white/10 hover:text-white"
            aria-label={t('demo.resetTitle')}
            title={t('demo.reset')}
          >
            <RotateCcw size={14} aria-hidden="true" />
          </button>
        </div>
      </div>

      <p className="sr-only" aria-live="polite">{announcement || (noticeKey !== 'demo.defaultNotice' ? t(noticeKey) : '')}</p>

      <dialog
        ref={dialogRef}
        onClick={(event) => {
          if (event.target === dialogRef.current) closeGuide();
        }}
        onCancel={(event) => {
          event.preventDefault();
          closeGuide();
        }}
        onClose={closeGuide}
        aria-labelledby="lh-demo-title"
        aria-describedby="lh-demo-body"
        className="lh-demo-dialog m-auto max-h-[calc(100dvh-1.5rem)] w-[min(92vw,640px)] max-w-none overflow-x-hidden overflow-y-auto rounded-[28px] border border-white/10 bg-[#0b0e13] p-0 text-white shadow-[0_30px_120px_rgba(0,0,0,0.72)] backdrop:bg-black/72"
      >
        <div className="relative overflow-hidden px-5 py-6 sm:px-8 sm:py-8">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-semibold tracking-[0.16em] uppercase text-white/70">
              <ShieldCheck size={13} aria-hidden="true" />
              {t('demo.public')}
            </div>
          </div>

          <h2 ref={titleRef} id="lh-demo-title" tabIndex={-1} className="max-w-xl text-[1.7rem] font-semibold tracking-tight outline-none sm:text-4xl">
            {t('demo.introTitle')}
          </h2>
          <p id="lh-demo-body" className="mt-3 max-w-xl text-sm leading-6 text-white/55 sm:text-[15px]">
            {t('demo.introBody')}
          </p>

          <div className="mt-6 grid gap-2 sm:grid-cols-3 sm:gap-3">
            {cards.map((card) => (
              <div key={card.title} className="rounded-2xl border border-white/8 bg-white/[0.035] p-3.5">
                <h3 className="text-[11px] font-semibold tracking-[0.08em] uppercase text-white/80">{card.title}</h3>
                <p className="mt-2 text-xs leading-5 text-white/42">{card.text}</p>
              </div>
            ))}
          </div>

          <p className="mt-5 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-xs leading-5 text-white/42">
            {t('demo.attribution')}
          </p>

          <nav className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-xs text-white/50" aria-label={t('demo.public')}>
            <a className="underline decoration-white/20 underline-offset-4 hover:text-white" href={LINKS.site} target="_blank" rel="noreferrer">{t('demo.site')}</a>
            <a className="underline decoration-white/20 underline-offset-4 hover:text-white" href={LINKS.docs} target="_blank" rel="noreferrer">{t('demo.docs')}</a>
            <a className="underline decoration-white/20 underline-offset-4 hover:text-white" href={LINKS.source} target="_blank" rel="noreferrer">{t('demo.source')}</a>
          </nav>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={resetDemo}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 px-4 text-sm text-white/60 transition-colors hover:bg-white/5 hover:text-white sm:order-1"
            >
              <RotateCcw size={15} aria-hidden="true" />
              {t('demo.reset')}
            </button>
            <button
              type="button"
              onClick={closeGuide}
              className="min-h-11 rounded-xl bg-white px-6 text-sm font-semibold text-[#0b0e13] transition-colors hover:bg-white/90 sm:order-2"
            >
              {t('demo.enter')}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
};
