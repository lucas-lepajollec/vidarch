import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useVidArch } from '../../context/VidArchContext';
import { useI18n } from '../../i18n/I18nProvider';

export const DownloadNotice: React.FC = () => {
  const { downloadNotice, dismissDownloadNotice, goTo } = useVidArch();
  const { t } = useI18n();

  useEffect(() => {
    if (!downloadNotice) return;
    const timer = window.setTimeout(() => dismissDownloadNotice(), 8000);
    return () => window.clearTimeout(timer);
  }, [downloadNotice, dismissDownloadNotice]);

  if (!downloadNotice) return null;

  const key = downloadNotice.direction === 'higher' ? 'downloads.toastHigher' : 'downloads.toastLower';
  const text = t(key, {
    title: downloadNotice.title,
    requested: downloadNotice.requested,
    actual: downloadNotice.actual,
  });

  return createPortal(
    <button
      type="button"
      onClick={() => {
        if (downloadNotice.videoId) goTo('watch', { videoId: downloadNotice.videoId });
        else goTo('downloads');
        dismissDownloadNotice();
      }}
      className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-[80] max-w-sm text-left bg-[#111821] border border-[#23303e] text-white text-xs font-medium px-4 py-3 rounded-xl shadow-2xl flex items-start gap-2.5 page-enter cursor-pointer hover:bg-[#2a2a2a] transition-colors duration-200"
    >
      <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${downloadNotice.direction === 'lower' ? 'bg-amber-400' : 'bg-sky-400'}`} />
      <span className="leading-snug">{text}</span>
    </button>,
    document.body
  );
};
