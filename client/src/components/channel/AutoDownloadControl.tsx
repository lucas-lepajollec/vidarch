import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Loader2 } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import { AnchoredPopover } from '../common/AnchoredPopover';

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
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setChoice(choiceFromProps(autoDownload, autoDownloadMode));
  }, [autoDownload, autoDownloadMode, channelId]);

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
    <div className="relative">
      <button
        ref={btnRef}
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
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
        {!compact || active ? <span>{label}</span> : <span>{t('channel.autoDownload')}</span>}
        <ChevronDown className={`w-3.5 h-3.5 ${active ? 'text-white/80' : 'text-[#aaa]'}`} />
      </button>

      <AnchoredPopover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={btnRef}
        align="end"
        preferredSide="bottom"
        className="w-72 max-w-[calc(100vw-16px)]"
      >
          <p className="va-menu-label">{t('channel.autoDownload')}</p>
          {options.map((option) => {
            const selected = choice === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => apply(option.id)}
                className={`va-menu-item items-start ${selected ? 'is-active' : ''}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block">{option.label}</span>
                  <span className="va-menu-hint">{option.hint}</span>
                </span>
                {selected ? <Check className="w-3.5 h-3.5 text-white/50 flex-shrink-0 mt-0.5" /> : null}
              </button>
            );
          })}
      </AnchoredPopover>
    </div>
  );
};
