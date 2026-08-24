import React, { useEffect, useState } from 'react';
import { Archive, DownloadCloud, RotateCcw, ShieldCheck, Sparkles, X } from 'lucide-react';
import { DEMO_SESSION_KEY, isDemoMode, resetDemoSession } from './config';

const DEFAULT_NOTICE = 'Données de démo · aucune action réelle';

export const DemoExperience: React.FC = () => {
  const [showIntro, setShowIntro] = useState(() => {
    if (!isDemoMode) return false;
    try {
      return sessionStorage.getItem(DEMO_SESSION_KEY) !== '1';
    } catch {
      return true;
    }
  });
  const [notice, setNotice] = useState(DEFAULT_NOTICE);

  useEffect(() => {
    if (!isDemoMode) return;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const onNotice = (event: Event) => {
      const message = (event as CustomEvent<string>).detail || DEFAULT_NOTICE;
      setNotice(message);
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => setNotice(DEFAULT_NOTICE), 3500);
    };
    window.addEventListener('vidarch-demo-notice', onNotice);
    return () => {
      window.removeEventListener('vidarch-demo-notice', onNotice);
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  if (!isDemoMode) return null;

  const closeIntro = () => {
    try {
      sessionStorage.setItem(DEMO_SESSION_KEY, '1');
    } catch {}
    setShowIntro(false);
  };

  return (
    <>
      <div className="va-demo-badge fixed z-[90] bottom-3 left-3 right-3 sm:left-auto sm:right-4 sm:w-auto pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2.5 rounded-2xl border border-white/10 bg-[#0f151d]/95 px-3 py-2.5 shadow-2xl backdrop-blur-xl">
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-[#ff5a67]/12 text-[#ff7180]">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <strong className="block text-[11px] font-bold uppercase tracking-[0.12em] text-white">Mode démo</strong>
            <span className="va-demo-detail block max-w-[260px] truncate text-[10px] text-[#93a0af]">{notice}</span>
          </span>
          <button
            type="button"
            onClick={resetDemoSession}
            className="ml-auto flex h-8 items-center gap-1.5 rounded-xl bg-white/[0.06] px-2.5 text-[10px] font-semibold text-[#dce3eb] transition hover:bg-white/[0.1] hover:text-white"
            title="Réinitialiser toutes les données de démonstration"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden min-[390px]:inline">Réinitialiser</span>
          </button>
        </div>
      </div>

      {showIntro && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[#05070a]/82 p-4 backdrop-blur-md">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="demo-intro-title"
            className="relative my-auto w-full max-w-2xl overflow-hidden rounded-[28px] border border-white/10 bg-[#0d131a] shadow-[0_30px_120px_rgba(0,0,0,.65)]"
          >
            <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_70%_0%,rgba(255,90,103,.22),transparent_60%)]" aria-hidden />
            <button
              type="button"
              onClick={closeIntro}
              className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.05] text-[#93a0af] transition hover:bg-white/[0.1] hover:text-white"
              aria-label="Fermer la présentation"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="relative px-5 pb-6 pt-8 sm:px-8 sm:pb-8 sm:pt-10">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#ff5a67]/20 bg-[#ff5a67]/8 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#ff7c89]">
                <Sparkles className="h-3.5 w-3.5" />
                Démonstration publique
              </div>
              <h1 id="demo-intro-title" className="mt-5 max-w-lg text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl">
                Explorez VidArch sans connecter quoi que ce soit.
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-[#9aa7b5]">
                Cette version reprend la véritable interface du produit avec une sélection de Blender Open Movies. Les actions et compteurs restent simulés dans votre navigateur et disparaissent au rechargement.
              </p>
              <p className="mt-2 max-w-xl text-[11px] leading-5 text-[#6f7d8c]">
                Visuels issus de projets Blender Studio publiés sous licences Creative Commons. Les attributions sont indiquées dans chaque fiche vidéo.
              </p>

              <div className="mt-7 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-white/[0.035] p-4">
                  <Archive className="h-5 w-5 text-[#73c7e8]" />
                  <strong className="mt-3 block text-xs text-white">Parcourir</strong>
                  <span className="mt-1 block text-[11px] leading-5 text-[#7f8d9c]">Chaînes, bibliothèque, recherche et playlists.</span>
                </div>
                <div className="rounded-2xl bg-white/[0.035] p-4">
                  <DownloadCloud className="h-5 w-5 text-[#ff7180]" />
                  <strong className="mt-3 block text-xs text-white">Simuler</strong>
                  <span className="mt-1 block text-[11px] leading-5 text-[#7f8d9c]">Téléchargements et actions sans aucun serveur.</span>
                </div>
                <div className="rounded-2xl bg-white/[0.035] p-4">
                  <ShieldCheck className="h-5 w-5 text-[#70d6a5]" />
                  <strong className="mt-3 block text-xs text-white">Rester isolé</strong>
                  <span className="mt-1 block text-[11px] leading-5 text-[#7f8d9c]">Aucun compte, cookie, fichier ou appel externe.</span>
                </div>
              </div>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={closeIntro}
                  className="rounded-xl bg-[#ff5a67] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-[#ff5a67]/15 transition hover:bg-[#ef4c5a]"
                >
                  Entrer dans la démo
                </button>
                <span className="text-center text-[10px] text-[#657383] sm:text-left">Les liens et services externes sont volontairement neutralisés.</span>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
};
