import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  DownloadCloud,
  Check,
  Loader2,
  Film,
} from 'lucide-react';
import { useMyTube } from '../../context/MyTubeContext';
import { MediaThumb } from '../common/MediaThumb';
import { useI18n } from '../../i18n/I18nProvider';

export const DownloadModal: React.FC = () => {
  const { downloadModal, closeDownloadModal, enqueueDownload } = useMyTube();
  const { t } = useI18n();

  const [resolution, setResolution] = useState('1080p');
  const [defaultResolution, setDefaultResolution] = useState('1080p');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (!downloadModal.isOpen) return;
    setStatusMessage(null);
    setIsSubmitting(false);

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/system/settings');
        if (!res.ok) return;
        const data = await res.json();
        const next = typeof data.default_max_resolution === 'string' ? data.default_max_resolution : '1080p';
        if (!cancelled) {
          setDefaultResolution(next);
          setResolution(next);
        }
      } catch {
        if (!cancelled) {
          setDefaultResolution('1080p');
          setResolution('1080p');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [downloadModal.isOpen]);

  useEffect(() => {
    if (!downloadModal.isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) closeDownloadModal();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [downloadModal.isOpen, isSubmitting, closeDownloadModal]);

  if (!downloadModal.isOpen) return null;

  const qualityOptions = [
    { id: '2160p', label: t('dl.q2160'), desc: t('dl.q2160d') },
    { id: '1440p', label: t('dl.q1440'), desc: t('dl.q1440d') },
    { id: '1080p', label: t('dl.q1080'), desc: t('dl.q1080d') },
    { id: '720p', label: t('dl.q720'), desc: t('dl.q720d') },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!downloadModal.videoId && !downloadModal.url) return;

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      await enqueueDownload({
        videoId: downloadModal.videoId || downloadModal.url || '',
        url: downloadModal.url,
        title: downloadModal.title,
        channelTitle: downloadModal.channelTitle,
        channelId: downloadModal.channelId,
        thumbnailUrl: downloadModal.thumbnailUrl,
        resolution,
      });

      setStatusMessage({ text: t('dl.queued'), type: 'success' });
      setTimeout(() => closeDownloadModal(), 650);
    } catch (err: any) {
      setStatusMessage({ text: err.message || t('common.genericError'), type: 'error' });
      setIsSubmitting(false);
    }
  };

  const close = () => {
    if (!isSubmitting) closeDownloadModal();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-300"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className="w-full max-w-md bg-[#212121] border border-[#383838] rounded-3xl shadow-2xl overflow-hidden text-[#f1f1f1]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#303030]">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">{t('dl.title')}</h3>
            <p className="text-xs text-[#aaa] mt-0.5">{t('dl.subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={close}
            disabled={isSubmitting}
            className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 text-[#aaa] hover:text-white flex items-center justify-center transition cursor-pointer disabled:opacity-40"
            title={t('common.close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pt-4">
          <div className="flex gap-3.5 items-center">
            <div className="relative w-[7.5rem] aspect-video rounded-xl overflow-hidden bg-[#121212] flex-shrink-0">
              {downloadModal.videoId ? (
                <MediaThumb
                  video={{ id: downloadModal.videoId, thumbnailUrl: downloadModal.thumbnailUrl }}
                  alt={downloadModal.title || t('dl.thumb')}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#717171]">
                  <Film className="w-6 h-6" />
                </div>
              )}
              {downloadModal.durationString && (
                <span className="absolute bottom-1 right-1 bg-black/85 text-white text-[9px] font-bold px-1 rounded">
                  {downloadModal.durationString}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-semibold text-sm text-white line-clamp-2 leading-snug">
                {downloadModal.title || t('dl.fallbackTitle')}
              </h4>
              <p className="text-xs text-[#aaa] mt-1 truncate">
                {downloadModal.channelTitle || t('watch.youtubeChannel')}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-5 pt-5">
            <p className="text-xs font-semibold text-[#aaa] mb-2">{t('dl.quality')}</p>
            <p className="text-[11px] text-[#717171] mb-2.5 leading-relaxed">{t('dl.qualityHint')}</p>
            <div className="rounded-2xl border border-[#303030] overflow-hidden divide-y divide-[#303030]">
              {qualityOptions.map((opt) => {
                const isSelected = resolution === opt.id;
                const isDefault = opt.id === defaultResolution;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setResolution(opt.id)}
                    className={`w-full flex items-center gap-3 px-3.5 py-3 text-left transition cursor-pointer ${
                      isSelected ? 'bg-[#3d3d3d]' : 'bg-[#181818] hover:bg-[#272727]'
                    }`}
                  >
                    <span
                      className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        isSelected ? 'border-white' : 'border-[#717171]'
                      }`}
                    >
                      {isSelected ? <span className="w-2 h-2 rounded-full bg-white" /> : null}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-[#f1f1f1]'}`}>
                          {opt.label}
                        </span>
                        {isDefault && (
                          <span className="text-[10px] font-semibold text-[#aaa] bg-white/10 px-1.5 py-0.5 rounded">
                            {t('common.recommended')}
                          </span>
                        )}
                      </span>
                      <span className="block text-[11px] text-[#888] mt-0.5">{opt.desc}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {statusMessage && (
            <div className="px-5 pt-4">
              <div
                className={`px-3 py-2.5 rounded-xl text-xs flex items-center gap-2 ${
                  statusMessage.type === 'success'
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25'
                    : 'bg-rose-500/15 text-rose-300 border border-rose-500/25'
                }`}
              >
                {statusMessage.type === 'success' ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <X className="w-4 h-4" />
                )}
                <span>{statusMessage.text}</span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 px-5 py-4 mt-4 border-t border-[#303030]">
            <button
              type="button"
              onClick={close}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-[#aaa] hover:text-white rounded-full hover:bg-white/5 transition cursor-pointer disabled:opacity-40"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-white hover:bg-white/90 text-black text-xs font-bold px-5 py-2.5 rounded-full flex items-center gap-1.5 shadow transition disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{t('dl.adding')}</span>
                </>
              ) : (
                <>
                  <DownloadCloud className="w-3.5 h-3.5" />
                  <span>{t('dl.start')}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
