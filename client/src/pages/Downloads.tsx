import React, { useState, useEffect } from 'react';
import { 
  Trash2, 
  RotateCcw, 
  X, 
  DownloadCloud,
  Loader2,
  Clock,
} from 'lucide-react';
import { useVidArch, useDownloadQueue } from '../context/VidArchContext';
import { MediaThumb } from '../components/common/MediaThumb';
import { useI18n } from '../i18n/I18nProvider';
import { parseQualityNote } from '../utils/qualityNote';

export const Downloads: React.FC = () => {
  const { goTo } = useVidArch();
  const { queue, refreshQueue } = useDownloadQueue();
  const { t, locale } = useI18n();
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'error'>('all');

  useEffect(() => {
    void refreshQueue();
  }, [refreshQueue]);

  const handleCancel = async (id: string) => {
    try {
      await fetch(`/api/downloads/${id}/cancel`, { method: 'POST' });
      await refreshQueue();
    } catch (_) {}
  };

  const handleRetry = async (id: string) => {
    try {
      await fetch(`/api/downloads/${id}/retry`, { method: 'POST' });
      await refreshQueue();
    } catch (_) {}
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/downloads/${id}`, { method: 'DELETE' });
      await refreshQueue();
    } catch (_) {}
  };

  const handleCancelAll = async () => {
    if (!confirm(t('downloads.cancelAllConfirm'))) return;
    try {
      await fetch('/api/downloads/cancel-all', { method: 'POST' });
      await refreshQueue();
    } catch (_) {}
  };

  const handleClearCompleted = async () => {
    try {
      await fetch('/api/downloads/clear', { method: 'POST' });
      await refreshQueue();
    } catch (_) {}
  };

  const activeTasks = queue.filter(task => task.status === 'downloading' || task.status === 'processing' || task.status === 'queued');
  const pastTasks = queue.filter(task => task.status === 'completed' || task.status === 'error' || task.status === 'canceled');

  const filteredPastTasks = pastTasks.filter(task => {
    if (filter === 'completed') return task.status === 'completed';
    if (filter === 'error') return task.status === 'error' || task.status === 'canceled';
    return true;
  });

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString(locale, { 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const historyTitle =
    filter === 'completed'
      ? t('downloads.doneTitle')
      : filter === 'error'
        ? t('downloads.errorTitle')
        : t('downloads.historyTitle');

  const showHistory =
    (filter === 'all' || filter === 'completed' || filter === 'error') &&
    (filteredPastTasks.length > 0 || filter !== 'all');

  return (
    <div className="flex-1 w-full px-4 sm:px-6 pt-6 pb-8 space-y-6 text-[#f4f7fb]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            {t('downloads.manager')}
          </h1>
          <p className="text-xs text-[#aaa] mt-1">
            {t('downloads.subtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {activeTasks.length > 0 && (
            <button
              onClick={handleCancelAll}
              className="flex items-center gap-1.5 text-xs text-red-300 hover:text-white bg-red-500/15 hover:bg-red-500/25 px-4 py-2 rounded-full transition cursor-pointer font-semibold"
            >
              <X className="w-3.5 h-3.5" />
              <span>{t('downloads.cancelAll')}</span>
            </button>
          )}
          {pastTasks.length > 0 && (
            <button
              onClick={handleClearCompleted}
              className="flex items-center gap-1.5 text-xs text-[#aaa] hover:text-white bg-[#18212c] hover:bg-[#23303e] px-4 py-2 rounded-full transition cursor-pointer font-medium"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t('downloads.clearDone')}</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar select-none">
        {[
          { id: 'all', label: `${t('search.filterAll')} (${queue.length})` },
          { id: 'active', label: t('downloads.active', { count: activeTasks.length }) },
          { id: 'completed', label: t('downloads.completed', { count: pastTasks.filter(task => task.status === 'completed').length }) },
          { id: 'error', label: t('downloads.failures', { count: pastTasks.filter(task => task.status === 'error').length }) },
        ].map((chip) => (
          <button
            key={chip.id}
            onClick={() => setFilter(chip.id as any)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              filter === chip.id
                ? 'bg-white text-black font-bold shadow-sm'
                : 'bg-[#18212c] hover:bg-[#23303e] text-[#f4f7fb]'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {(filter === 'all' || filter === 'active') && activeTasks.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-white tracking-tight">
            {t('downloads.activeTitle')}
            <span className="ml-2 text-sm font-normal text-[#657383]">{activeTasks.length}</span>
          </h2>

          <div className="space-y-1">
            {activeTasks.map((task) => {
              const percent = Math.round(task.progress || 0);
              const isQueued = task.status === 'queued';
              const isProcessing = task.status === 'processing';

              return (
                <div
                  key={task.id}
                  className="flex gap-3 p-2 rounded-2xl hover:bg-[#0f151d] transition group"
                >
                  <div className="relative w-36 sm:w-44 aspect-video rounded-xl overflow-hidden bg-[#222] flex-shrink-0">
                    {task.video_id ? (
                      <MediaThumb
                        video={{ id: task.video_id, thumbnail_url: task.thumbnail_url }}
                        alt={task.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-[#18212c] flex items-center justify-center text-white/40">
                        <DownloadCloud className="w-5 h-5" />
                      </div>
                    )}
                    {task.resolution && (
                      <span className="absolute bottom-1.5 right-1.5 bg-black/85 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                        {task.resolution}
                      </span>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/15">
                      <div
                        className={`h-full progress-fill ${isQueued || isProcessing ? 'bg-[#aaa] animate-pulse-subtle' : 'bg-[#ff5a67]'}`}
                        style={{ width: isQueued || isProcessing ? '100%' : `${Math.max(4, percent)}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 py-0.5">
                    <h3 className="text-sm font-semibold text-white line-clamp-2 leading-snug">
                      {task.title}
                    </h3>
                    <p className="text-xs text-[#aaa] mt-1 truncate">{task.channel_title}</p>
                    <p className="text-[11px] text-[#657383] mt-1.5 truncate">
                      {isQueued ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="w-3 h-3" />
                          {t('downloads.queued')}
                        </span>
                      ) : isProcessing ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          {t('downloads.processing')}
                        </span>
                      ) : (
                        <>
                          {percent}%
                          {task.speed ? ` · ${task.speed}` : ''}
                          {task.eta ? ` · ${task.eta}` : ''}
                          {task.total_bytes
                            ? ` · ${((task.downloaded_bytes || 0) / (1024 * 1024)).toFixed(1)} / ${t('common.mb', { n: ((task.total_bytes || 0) / (1024 * 1024)).toFixed(1) })}`
                            : ''}
                        </>
                      )}
                    </p>
                  </div>

                  <button
                    onClick={() => handleCancel(task.id)}
                    className="self-start p-1.5 text-[#aaa] hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer flex-shrink-0"
                    title={t('downloads.cancel')}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showHistory && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-white tracking-tight">
            {historyTitle}
            <span className="ml-2 text-sm font-normal text-[#657383]">{filteredPastTasks.length}</span>
          </h2>

          {filteredPastTasks.length > 0 ? (
            <div className="space-y-1">
              {filteredPastTasks.map((task) => {
                const isSuccess = task.status === 'completed';
                const isError = task.status === 'error';
                const canWatch = isSuccess && Boolean(task.video_id);
                const qualityNote = isSuccess ? parseQualityNote(task.quality_note) : null;

                return (
                  <div
                    key={task.id}
                    onClick={() => {
                      if (canWatch) goTo('watch', { videoId: task.video_id });
                    }}
                    className={`flex items-start gap-3 p-2 rounded-2xl transition group ${
                      canWatch ? 'hover:bg-[#0f151d] cursor-pointer' : 'hover:bg-[#0f151d]/60'
                    }`}
                  >
                    <div className="relative w-36 sm:w-44 aspect-video rounded-xl overflow-hidden bg-[#222] flex-shrink-0">
                      {task.video_id ? (
                        <MediaThumb
                          video={{ id: task.video_id, thumbnail_url: task.thumbnail_url }}
                          alt={task.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full bg-[#18212c] flex items-center justify-center text-white/40">
                          <DownloadCloud className="w-5 h-5" />
                        </div>
                      )}
                      {task.resolution && (
                        <span className="absolute bottom-1.5 right-1.5 bg-black/85 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                          {task.resolution}
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 py-0.5">
                      <h3 className={`text-sm font-semibold text-white line-clamp-2 leading-snug ${canWatch ? 'group-hover:text-[#73c7e8]' : ''}`}>
                        {task.title}
                      </h3>
                      <p className="text-xs text-[#aaa] mt-1 truncate">{task.channel_title}</p>
                      <p className={`text-[11px] mt-1.5 ${isError ? 'text-rose-400/90' : 'text-[#657383]'}`}>
                        {isError
                          ? (task.error_message || t('downloads.failed'))
                          : task.status === 'canceled'
                            ? t('downloads.canceled')
                            : (
                              <>
                                <span className="truncate">{formatDate(task.completed_at || task.created_at)}</span>
                                {qualityNote && (
                                  <span className={`block mt-0.5 ${qualityNote.direction === 'lower' ? 'text-amber-400/90' : 'text-sky-400/90'}`}>
                                    {t(
                                      qualityNote.direction === 'higher' ? 'downloads.qualityHigher' : 'downloads.qualityLower',
                                      { requested: qualityNote.requested, actual: qualityNote.actual }
                                    )}
                                  </span>
                                )}
                              </>
                            )}
                      </p>
                    </div>

                    <div className="flex items-center gap-0.5 flex-shrink-0 pt-0.5">
                      {isError && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRetry(task.id);
                          }}
                          className="p-1.5 text-[#aaa] hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer"
                          title={t('common.retry')}
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(task.id);
                        }}
                        className="p-1.5 text-[#aaa] hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer"
                        title={t('history.remove')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-[#888]">
              {t('downloads.emptyCat')}
            </div>
          )}
        </div>
      )}

      {queue.length === 0 && (
        <div className="py-20 flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4">
          <div className="w-20 h-20 rounded-full bg-[#18212c] flex items-center justify-center text-[#aaa]">
            <DownloadCloud className="w-10 h-10" />
          </div>
          <div>
            <h2 className="font-bold text-lg text-white">{t('downloads.empty')}</h2>
            <p className="text-xs text-[#aaa] mt-1">
              {t('downloads.emptyBody')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
