import React, { useState, useEffect } from 'react';
import { 
  History as HistoryIcon, 
  Trash2, 
  Search as SearchIcon, 
  X, 
  Play, 
  Clock,
  ExternalLink,
  ChevronRight,
  ListFilter
} from 'lucide-react';
import type { Video } from '../types';
import { useMyTube } from '../context/MyTubeContext';
import { MediaThumb } from '../components/common/MediaThumb';
import { ExpandableText } from '../components/common/ExpandableText';
import { useI18n } from '../i18n/I18nProvider';

interface SearchHistoryItem {
  id: string;
  query: string;
  result_count?: number;
  searched_at: string;
}

export const HistoryPage: React.FC = () => {
  const { goTo, dataVersion, localOnly } = useMyTube();
  const { t, locale } = useI18n();
  const [activeTab, setActiveTab] = useState<'videos' | 'searches'>('videos');
  const [videos, setVideos] = useState<Video[]>([]);
  const [searches, setSearches] = useState<SearchHistoryItem[]>([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [vRes, sRes] = await Promise.all([
        fetch('/api/history/videos'),
        fetch('/api/history/searches'),
      ]);

      if (vRes.ok) {
        const vData = await vRes.json();
        setVideos(vData);
      }
      if (sRes.ok) {
        const sData = await sRes.json();
        setSearches(sData);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    if (localOnly) setActiveTab('videos');
  }, [dataVersion, localOnly]);

  const handleClearVideosHistory = async () => {
    if (!confirm(t('history.clearVideosConfirm'))) return;
    try {
      await fetch('/api/history/videos', { method: 'DELETE' });
      setVideos([]);
    } catch (err) {
      console.error('Clear videos history error:', err);
    }
  };

  const handleClearSearchHistory = async () => {
    if (!confirm(t('history.clearSearchesConfirm'))) return;
    try {
      await fetch('/api/history/searches', { method: 'DELETE' });
      setSearches([]);
    } catch (err) {
      console.error('Clear searches history error:', err);
    }
  };

  const handleRemoveVideo = async (videoId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/history/videos/${videoId}`, { method: 'DELETE' });
      setVideos(prev => prev.filter(v => v.id !== videoId));
    } catch (err) {
      console.error('Remove video from history error:', err);
    }
  };

  const handleRemoveSearch = async (searchId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/history/searches/${encodeURIComponent(searchId)}`, { method: 'DELETE' });
      setSearches(prev => prev.filter(s => s.id !== searchId));
    } catch (err) {
      console.error('Remove search query error:', err);
    }
  };

  const filteredVideos = videos.filter(v => 
    !searchFilter.trim() || 
    v.title.toLowerCase().includes(searchFilter.toLowerCase()) || 
    v.channel_title?.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const filteredSearches = searches.filter(s =>
    !searchFilter.trim() ||
    s.query.toLowerCase().includes(searchFilter.toLowerCase())
  );

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

  return (
    <div className="flex-1 w-full px-4 sm:px-6 pt-6 pb-8 flex flex-col lg:flex-row gap-8 text-[#f4f7fb]">
      {/* ========================================================================= */}
      {/* Video List or Search List (Left on desktop, below controls on mobile)     */}
      {/* ========================================================================= */}
      <div className="order-2 lg:order-1 flex-1 space-y-4 min-w-0">
        <h1 className="text-xl font-bold text-white tracking-tight">
          {activeTab === 'videos' ? t('history.videosTitle') : t('history.searchesTitle')}
        </h1>

        {/* 1. VIDEOS LIST */}
        {activeTab === 'videos' && (
          <div>
            {filteredVideos.length > 0 ? (
              <div className="space-y-4">
                {filteredVideos.map((video) => {
                  const isDownloaded = video.is_downloaded === 1;
                  const progressPercent = video.duration && video.watch_progress
                    ? Math.min(100, Math.round((video.watch_progress / video.duration) * 100))
                    : 0;

                  return (
                    <div
                      key={video.id}
                      onClick={() => goTo('watch', { videoId: video.id })}
                      className="flex flex-col sm:flex-row gap-4 p-2 rounded-2xl hover:bg-[#0f151d] transition group cursor-pointer"
                    >
                      {/* 16:9 Thumbnail */}
                      <div className="relative w-full sm:w-60 md:w-64 aspect-video rounded-xl overflow-hidden bg-[#222] flex-shrink-0 shadow-sm">
                        <MediaThumb
                          video={video}
                          alt={video.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                        {!localOnly && !isDownloaded && (
                          <span className="absolute top-1.5 left-1.5 bg-black/70 text-[#aaa] text-[9px] font-medium px-1.5 py-0.5 rounded">
                            {t('card.online')}
                          </span>
                        )}
                        {video.duration_string && (
                          <span className="absolute bottom-1.5 right-1.5 bg-black/85 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                            {video.duration_string}
                          </span>
                        )}
                        {progressPercent > 0 && (
                          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                            <div className="h-full bg-[#ff5a67]" style={{ width: `${progressPercent}%` }} />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="text-sm font-semibold text-white group-hover:text-[#73c7e8] line-clamp-2 leading-snug">
                                {video.title}
                              </h3>
                            </div>
                            <button
                              onClick={(e) => handleRemoveVideo(video.id, e)}
                              className="p-1.5 text-[#aaa] hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer flex-shrink-0"
                              title={t('history.remove')}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          <div 
                            className="flex items-center gap-2 mt-1.5 group/ch cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (video.channel_id) goTo('channel', { channelId: video.channel_id });
                            }}
                          >
                            <span className="text-xs text-[#aaa] group-hover/ch:text-white font-medium">
                              {video.channel_title}
                            </span>
                          </div>

                          {video.description && (
                            <ExpandableText text={video.description} className="text-xs text-[#657383]" />
                          )}
                        </div>

                        {/* Timestamp */}
                        <div className="flex items-center gap-2 text-[11px] text-[#657383] mt-2">
                          {(video as any).last_watched_at ? (
                            <span>{t('history.watchedOn', { date: formatDate((video as any).last_watched_at) })}</span>
                          ) : (
                            <span>{t('history.watchedRecently')}</span>
                          )}
                          {progressPercent > 0 && (
                            <span>• {progressPercent}%</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : !isLoading && (
              <div className="py-20 text-center max-w-md mx-auto space-y-3">
                <div className="w-16 h-16 rounded-full bg-[#18212c] flex items-center justify-center text-[#aaa] mx-auto">
                  <HistoryIcon className="w-8 h-8" />
                </div>
                <h3 className="font-bold text-base text-white">{t('history.emptyVideos')}</h3>
                <p className="text-xs text-[#aaa]">
                  {t('history.emptyVideosBody')}
                </p>
              </div>
            )}
          </div>
        )}

        {/* 2. SEARCHES LIST */}
        {activeTab === 'searches' && !localOnly && (
          <div>
            {filteredSearches.length > 0 ? (
              <div className="space-y-1">
                {filteredSearches.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => goTo('search', { query: s.query })}
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-[#0f151d] transition cursor-pointer group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <SearchIcon className="w-4 h-4 text-[#aaa] group-hover:text-white flex-shrink-0" />
                      <div className="min-w-0">
                        <span className="text-sm font-semibold text-white group-hover:text-[#73c7e8] transition block truncate">
                          {s.query}
                        </span>
                        <span className="text-[11px] text-[#657383]">
                          {formatDate(s.searched_at)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => handleRemoveSearch(s.id, e)}
                        className="p-1.5 text-[#aaa] hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer"
                        title={t('history.removeSearch')}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : !isLoading && (
              <div className="py-20 text-center max-w-md mx-auto space-y-3">
                <div className="w-16 h-16 rounded-full bg-[#18212c] flex items-center justify-center text-[#aaa] mx-auto">
                  <SearchIcon className="w-8 h-8" />
                </div>
                <h3 className="font-bold text-base text-white">{t('history.emptySearches')}</h3>
                <p className="text-xs text-[#aaa]">
                  Vos prochaines recherches apparaîtront ici.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* Controls Sidebar (Top on mobile, Right pinned on desktop)                 */}
      {/* ========================================================================= */}
      <div className="order-1 lg:order-2 w-full lg:w-72 xl:w-80 flex-shrink-0 space-y-5 pt-1 lg:sticky lg:top-18 lg:self-start border-b lg:border-b-0 border-[#18212c] pb-6 lg:pb-0">
        {/* Search Input with underline */}
        <div className="flex items-center border-b border-[#3e3e3e] focus-within:border-white py-1.5 transition">
          <SearchIcon className="w-4 h-4 text-[#888] mr-3 flex-shrink-0" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder={t('history.searchPh')}
            className="w-full bg-transparent text-[16px] sm:text-xs text-white placeholder-[#657383] focus:outline-none"
          />
          {searchFilter && (
            <button onClick={() => setSearchFilter('')} className="text-[#888] hover:text-white p-0.5">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Clear Action Buttons */}
        <div className="space-y-1">
          <button
            onClick={handleClearVideosHistory}
            disabled={videos.length === 0}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-[#f4f7fb] hover:bg-[#18212c] transition cursor-pointer disabled:opacity-40"
          >
            <Trash2 className="w-4 h-4 text-[#aaa]" />
            <span>{t('history.clearVideos')}</span>
          </button>

          <button
            onClick={handleClearSearchHistory}
            disabled={searches.length === 0}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-[#f4f7fb] hover:bg-[#18212c] transition cursor-pointer disabled:opacity-40"
          >
            <Trash2 className="w-4 h-4 text-[#aaa]" />
            <span>{t('history.clearSearches')}</span>
          </button>
        </div>

        {/* Type d'historique Radio Buttons (Native YouTube style) */}
        <div className="space-y-3 pt-2">
          <span className="text-xs font-bold text-white block">{t('history.type')}</span>
          
          <div className="space-y-1">
            <label 
              onClick={() => setActiveTab('videos')}
              className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-[#18212c] cursor-pointer transition"
            >
              <span className={`text-xs font-medium ${activeTab === 'videos' ? 'text-white font-bold' : 'text-[#aaa]'}`}>
                {t('history.watchedCount', { count: videos.length })}
              </span>
              <input
                type="radio"
                name="history_type"
                checked={activeTab === 'videos'}
                onChange={() => setActiveTab('videos')}
                className="accent-[#ff5a67] w-4 h-4 cursor-pointer"
              />
            </label>

            {!localOnly && (
            <label 
              onClick={() => setActiveTab('searches')}
              className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-[#18212c] cursor-pointer transition"
            >
              <span className={`text-xs font-medium ${activeTab === 'searches' ? 'text-white font-bold' : 'text-[#aaa]'}`}>
                {t('history.searchesCount', { count: searches.length })}
              </span>
              <input
                type="radio"
                name="history_type"
                checked={activeTab === 'searches'}
                onChange={() => setActiveTab('searches')}
              />
            </label>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
