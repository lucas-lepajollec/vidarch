import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Loader2, Zap } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';

export type AutoDownloadChoice = 'off' | 'future' | 'all';

function choiceFromProps(autoDownload?: number, mode?: string | null): AutoDownloadChoice {
  if (autoDownload !== 1) return 'off';
  return mode === 'all' ? 'all' : 'future';
}

export const AutoDownloadControl: React.FC<{
  channelId: string;
  autoDownload?: number;
  autoDownloadMode?: string | null;
  compact?: boolean;
  onUpdated?: (next: { auto_download: number; auto_download_mode: AutoDownloadChoice }) => void;
}> = ({ channelId, autoDownload, autoDownloadMode, compact, onUpdated }) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [choice, setChoice] = useState<AutoDownloadChoice>(() => choiceFromProps(autoDownload, autoDownloadMode));
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setChoice(choiceFromProps(autoDownload, autoDownloadMode));
  }, [autoDownload, autoDownloadMode, channelId]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const apply = async (next: AutoDownloadChoice) => {
    if (busy || next === choice) {
      setOpen(false);
      return;
    }
    if (next === 'all' && !confirm(t('channel.autoAllConfirm'))) return;

    const previous = choice;
    setChoice(next);
    setOpen(false);
    setBusy(true);
    try {
      const res = await fetch(`/api/channels/${encodeURIComponent(channelId)}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auto_download: next !== 'off',
          auto_download_mode: next === 'all' ? 'all' : 'future',
        }),
      });
      if (!res.ok) {
        setChoice(previous);
        return;
      }
      onUpdated?.({
        auto_download: next === 'off' ? 0 : 1,
        auto_download_mode: next,
      });
    } catch {
      setChoice(previous);
    } finally {
      setBusy(false);
    }
  };

  const label =
    choice === 'all' ? t('channel.autoAll') : choice === 'future' ? t('channel.autoFuture') : t('channel.autoDownload');
  const active = choice !== 'off';

  const options: Array<{ id: AutoDownloadChoice; label: string; hint: string }> = [
    { id: 'off', label: t('channel.autoOff'), hint: t('channel.autoOffHint') },
    { id: 'future', label: t('channel.autoFuture'), hint: t('channel.autoFutureHint') },
    { id: 'all', label: t('channel.autoAll'), hint: t('channel.autoAllHint') },
  ];

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={busy}
        title={t('channel.autoDownload')}
        className={`flex items-center gap-1.5 rounded-full text-xs font-semibold transition cursor-pointer disabled:opacity-60 ${
          compact ? 'px-3 py-2' : 'px-4 py-2.5'
        } ${
          active
            ? 'bg-[#ff0033] hover:bg-[#e6002e] text-white shadow-sm'
            : 'bg-[#272727] hover:bg-[#383838] text-white border border-white/5'
        }`}
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className={`w-3.5 h-3.5 ${active ? 'fill-white' : 'text-[#ffb020]'}`} />}
        {!compact || active ? <span>{label}</span> : <span>{t('channel.autoDownload')}</span>}
        <ChevronDown className={`w-3.5 h-3.5 ${active ? 'text-white/80' : 'text-[#aaa]'}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-30 w-72 bg-[#212121] border border-[#383838] rounded-2xl shadow-2xl py-1.5 overflow-hidden">
          <p className="px-3.5 pt-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#888]">
            {t('channel.autoDownload')}
          </p>
          {options.map((option) => {
            const selected = choice === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => apply(option.id)}
                className={`w-full px-3.5 py-2.5 text-left transition cursor-pointer ${
                  selected ? 'bg-[#2a2a2a]' : 'hover:bg-[#282828]'
                }`}
              >
                <span className="flex items-start gap-2.5">
                  <span className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full border flex items-center justify-center ${
                    selected ? 'border-[#ff0033] bg-[#ff0033]' : 'border-[#555]'
                  }`}>
                    {selected ? <Check className="w-2.5 h-2.5 text-white" /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold text-white">{option.label}</span>
                    <span className="block text-[11px] text-[#888] leading-snug mt-0.5">{option.hint}</span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
