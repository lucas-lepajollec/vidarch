import React, { useState, useEffect } from 'react';
import { 
  Search as SearchIcon, 
  DownloadCloud, 
  ExternalLink, 
  Loader2, 
  CheckCircle2, 
  Check, 
  Play, 
  Trash2, 
  ChevronDown,
  UserMinus
} from 'lucide-react';
import type { Video, SearchResultItem } from '../types';
import { useMyTube } from '../context/MyTubeContext';
import { formatViews, formatSubscriberCount } from '../utils/format';
import { MediaThumb } from '../components/common/MediaThumb';
import { ChannelAvatar } from '../components/common/ChannelAvatar';
import { ExpandableText } from '../components/common/ExpandableText';
import { useI18n } from '../i18n/I18nProvider';

interface ChannelResult {
  id: string;
  title: string;
  handle?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  subscriberCount?: string;
  description?: string;
  downloadedCount?: number;
  isSubscribed?: boolean;
  url?: string;
  language?: string;
}

export const SearchPage: React.FC = () => {
  const { nav, goTo, openDownloadModal, subscribeChannel, unsubscribeChannel, subscriptions, localOnly } = useMyTube();
  const { t, locale } = useI18n();
  const [channels, setChannels] = useState<ChannelResult[]>([]);
  const [localVideos, setLocalVideos] = useState<Video[]>([]);
  const [youtubeVideos, setYoutubeVideos] = useState<SearchResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [subscribingId, setSubscribingId] = useState<string | null>(null);
  const [hoveredSubId, setHoveredSubId] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'channels' | 'videos' | 'local'>('all');

  const query = nav.query || '';

  const performSearch = async () => {
    if (!query.trim()) return;
    setIsLoading(true);
    try {
      const searchType = localOnly ? 'local' : 'all';
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&type=${searchType}&offset=0&limit=15`);
      if (res.ok) {
        const data = await res.json();
        setChannels(data.channels || []);
        setLocalVideos(data.localVideos || []);
        const ytVids = data.youtubeVideos || data.youtubeResults || [];
        setYoutubeVideos(localOnly ? [] : ytVids);
        setHasMore(!localOnly && ytVids.length >= 10);
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    performSearch();
  }, [query, localOnly]);

  const handleLoadMore = async () => {
    if (!query.trim() || isLoadingMore || !hasMore || localOnly) return;
    setIsLoadingMore(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&type=all&offset=${youtubeVideos.length}&limit=15`);
      if (res.ok) {
        const data = await res.json();
        const newVids: SearchResultItem[] = data.youtubeVideos || [];
        if (newVids.length > 0) {
          setYoutubeVideos(prev => {
            const existingIds = new Set(prev.map(v => v.id));
            const filtered = newVids.filter(v => !existingIds.has(v.id));
            return [...prev, ...filtered];
          });
        }
        if (newVids.length === 0 || data.hasMore === false) {
          setHasMore(false);
        }
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Error loading more search results:', err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleSubscribeToggle = async (ch: ChannelResult, e: React.MouseEvent) => {
    e.stopPropagation();
    if (subscribingId === ch.id) return;
    setSubscribingId(ch.id);
    try {
      const isSub = subscriptions.some(s => s.id === ch.id || (ch.handle && s.handle === ch.handle));
      if (isSub) {
        await unsubscribeChannel(ch.id);
      } else {
        await subscribeChannel(ch.url || `https://www.youtube.com/channel/${ch.id}`);
      }
    } finally {
      setSubscribingId(null);
    }
  };

  const handleDeleteLocalVideo = async (videoId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(t('search.deleteConfirm'))) return;
    try {
      await fetch(`/api/videos/${videoId}`, { method: 'DELETE' });
      setLocalVideos(prev => prev.filter(v => v.id !== videoId));
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  // Filter items
  const showChannels = (selectedFilter === 'all' || selectedFilter === 'channels') && channels.length > 0;
  const showLocalVideos = (selectedFilter === 'all' || selectedFilter === 'local') && localVideos.length > 0;
  const showYoutubeVideos = !localOnly && (selectedFilter === 'all' || selectedFilter === 'videos') && youtubeVideos.length > 0;

  const hasAnyResults = channels.length > 0 || localVideos.length > 0 || youtubeVideos.length > 0;

  return (
    <div className="flex-1 w-full px-4 sm:px-6 pt-6 pb-8 space-y-6">
      {/* Category Chips Bar for Search Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar select-none">
        {(localOnly
          ? [
              { id: 'all', label: t('search.filterAll') },
              { id: 'channels', label: `${t('search.filterChannels')} (${channels.length})` },
              { id: 'local', label: t('search.filterLocal', { count: localVideos.length }) },
            ]
          : [
              { id: 'all', label: t('search.filterAll') },
              { id: 'channels', label: `${t('search.filterChannels')} (${channels.length})` },
              { id: 'videos', label: `${t('search.filterVideos')} (${youtubeVideos.length})` },
              { id: 'local', label: t('search.filterLocal', { count: localVideos.length }) },
            ]
        ).map((filter) => (
          <button
            key={filter.id}
            onClick={() => setSelectedFilter(filter.id as any)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              selectedFilter === filter.id
                ? 'bg-white text-black font-bold shadow-sm'
                : 'bg-[#272727] hover:bg-[#383838] text-[#f1f1f1]'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="w-8 h-8 text-[#ff0033] animate-spin" />
        </div>
      )}

      {!isLoading && !hasAnyResults && (
        <div className="py-24 text-center max-w-md mx-auto space-y-2">
          <SearchIcon className="w-12 h-12 text-[#717171] mx-auto mb-2" />
          <h3 className="font-bold text-base text-white">{t('search.empty')} “{query}”</h3>
          <p className="text-xs text-[#aaa]">
            {localOnly ? t('search.emptyLocal') : t('search.empty')}
          </p>
        </div>
      )}

      {!isLoading && (
        <div className="max-w-6xl space-y-6">
          {/* ========================================================================= */}
          {/* 1. TOP SECTION: CHANNELS RESULTS (Dissociated round logo at the top)      */}
          {/* ========================================================================= */}
          {showChannels && (
            <div className="space-y-4">
              {channels.map((ch) => {
                const isSub = subscriptions.some(s => s.id === ch.id || (ch.handle && s.handle === ch.handle));
                const isThisSubscribing = subscribingId === ch.id;
                const isThisHovered = hoveredSubId === ch.id;

                return (
                  <div
                    key={ch.id}
                    onClick={() => goTo('channel', { channelId: ch.id })}
                    className="flex flex-col sm:flex-row items-center justify-between gap-6 p-4 sm:p-6 rounded-2xl hover:bg-[#181818] transition cursor-pointer group"
                  >
                    {/* Left: Big Circular Logo Avatar + Channel Info */}
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left min-w-0">
                      {/* Big Round Avatar */}
                      <ChannelAvatar
                        channelId={ch.id}
                        url={ch.avatarUrl}
                        title={ch.title}
                        className="w-28 h-28 sm:w-36 sm:h-36 rounded-full border-2 border-[#272727] shadow-lg group-hover:scale-105 transition-transform duration-200"
                        textClassName="text-4xl"
                      />

                      {/* Info */}
                      <div className="space-y-1.5 my-auto">
                        <div className="flex items-center justify-center sm:justify-start gap-1.5">
                          <h2 className="text-lg sm:text-xl font-bold text-white group-hover:text-[#3ea6ff] transition">
                            {ch.title}
                          </h2>
                          <CheckCircle2 className="w-4 h-4 text-[#aaa] fill-current" />
                        </div>

                        <div className="text-xs text-[#aaa] flex flex-wrap items-center justify-center sm:justify-start gap-2">
                          {ch.handle && (
                            <span className="font-semibold text-[#ddd]">
                              {ch.handle.startsWith('@') ? ch.handle : `@${ch.handle}`}
                            </span>
                          )}
                          {ch.subscriberCount && (
                            <>
                              <span>•</span>
                              <span>{formatSubscriberCount(ch.subscriberCount)}</span>
                            </>
                          )}
                          {ch.downloadedCount !== undefined && ch.downloadedCount > 0 && (
                            <>
                              <span>•</span>
                              <span className="text-emerald-400 font-medium">{t('search.archivedCount', { count: ch.downloadedCount })}</span>
                            </>
                          )}
                        </div>

                        {ch.description && (
                          <ExpandableText text={ch.description} className="text-xs text-[#888]" />
                        )}
                      </div>
                    </div>

                    {/* Right: Subscribe Button */}
                    {!localOnly && (
                    <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => handleSubscribeToggle(ch, e)}
                        onMouseEnter={() => setHoveredSubId(ch.id)}
                        onMouseLeave={() => setHoveredSubId(null)}
                        disabled={isThisSubscribing}
                        className={`min-w-[130px] px-5 py-2.5 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-sm ${
                          isThisSubscribing
                            ? 'opacity-80 cursor-wait bg-[#272727] text-white'
                            : isSub
                              ? isThisHovered
                                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                : 'bg-[#272727] hover:bg-[#383838] text-white'
                              : 'bg-white hover:bg-white/90 text-black font-bold'
                        }`}
                      >
                        {isThisSubscribing ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>{t('search.fetching')}</span>
                          </>
                        ) : isSub ? (
                          isThisHovered ? (
                            <>
                              <UserMinus className="w-3.5 h-3.5 text-red-400" />
                              <span>{t('search.unsubscribe')}</span>
                            </>
                          ) : (
                            <>
                              <Check className="w-3.5 h-3.5 text-[#3ea6ff]" />
                              <span>{t('search.subscribed')}</span>
                            </>
                          )
                        ) : (
                          <span>{t('search.subscribe')}</span>
                        )}
                      </button>
                    </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ========================================================================= */}
          {/* 2. LOCAL VIDEOS SECTION (Stored in Library) - Rich Horizontal Cards       */}
          {/* ========================================================================= */}
          {showLocalVideos && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-[#aaa] px-1">
                {t('search.libraryTitle', { count: localVideos.length })}
              </h3>

              <div className="space-y-3">
                {localVideos.map((video) => {
                  return (
                    <div
                      key={video.id}
                      onClick={() => goTo('watch', { videoId: video.id })}
                      className="flex flex-col sm:flex-row gap-4 p-3 rounded-2xl hover:bg-[#181818] transition cursor-pointer group bg-[#0f0f0f]/40"
                    >
                      {/* Thumbnail */}
                      <div className="relative w-full sm:w-64 aspect-video rounded-xl overflow-hidden bg-[#272727] flex-shrink-0">
                        <MediaThumb video={video} alt={video.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                        {video.duration_string && (
                          <span className="absolute bottom-2 right-2 bg-black/80 text-white text-[11px] font-semibold px-2 py-0.5 rounded-md">
                            {video.duration_string}
                          </span>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 flex flex-col justify-between py-1 min-w-0">
                        <div>
                          <h3 className="font-semibold text-sm sm:text-base text-white group-hover:text-[#3ea6ff] line-clamp-2 leading-snug">
                            {video.title}
                          </h3>

                          {/* Stats */}
                          <div className="text-xs text-[#aaa] mt-1 flex items-center gap-1.5">
                            {video.view_count !== undefined && video.view_count !== null && (
                              <span>{formatViews(video.view_count, locale)}</span>
                            )}
                            {video.view_count && video.upload_date && <span>•</span>}
                            {video.upload_date && <span>{video.upload_date}</span>}
                          </div>

                          {/* Channel */}
                          <div 
                            className="flex items-center gap-2 mt-2.5 group/ch cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (video.channel_id) {
                                goTo('channel', { channelId: video.channel_id });
                              }
                            }}
                          >
                            <ChannelAvatar
                              channelId={video.channel_id}
                              url={video.channel_avatar}
                              title={video.channel_title}
                              className="w-6 h-6 rounded-full"
                              textClassName="text-[10px]"
                            />
                            <span className="text-xs text-[#aaa] group-hover/ch:text-white font-medium">
                              {video.channel_title}
                            </span>
                            <CheckCircle2 className="w-3 h-3 text-[#888] fill-current" />
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 mt-3 pt-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => goTo('watch', { videoId: video.id })}
                            className="bg-white text-black font-semibold text-xs px-4 py-1.5 rounded-full hover:bg-white/90 transition flex items-center gap-1.5 cursor-pointer"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>{t('search.play')}</span>
                          </button>

                          <button
                            onClick={(e) => handleDeleteLocalVideo(video.id, e)}
                            className="p-1.5 text-[#aaa] hover:text-rose-400 rounded-full hover:bg-[#272727] transition cursor-pointer"
                            title={t('card.delete')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 3. ONLINE YOUTUBE VIDEOS SECTION - YouTube Search Layout                 */}
          {/* ========================================================================= */}
          {showYoutubeVideos && youtubeVideos.length > 0 && (
            <div className="space-y-4 pt-2">
              <h3 className="text-sm font-medium text-[#aaa] px-1">
                {t('search.youtubeVideos', { count: youtubeVideos.length })}
              </h3>

              <div className="space-y-4">
                {youtubeVideos.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => goTo('watch', { videoId: item.id })}
                    className="flex flex-col sm:flex-row gap-4 p-3 rounded-2xl hover:bg-[#181818] transition cursor-pointer group"
                  >
                    {/* Big YouTube Video Thumbnail */}
                      <div className="relative w-full sm:w-80 md:w-96 aspect-video rounded-xl overflow-hidden bg-[#272727] flex-shrink-0 shadow-sm">
                        <MediaThumb
                          video={{ id: item.id, thumbnail_url: item.thumbnailUrl }}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      <span className="absolute top-2 left-2 bg-black/70 text-[#aaa] text-[10px] font-medium px-2 py-0.5 rounded-full">
                        {t('card.online')}
                      </span>
                      {item.durationString && (
                        <span className="absolute bottom-2 right-2 bg-black/85 text-white text-[11px] font-semibold px-2 py-0.5 rounded-md">
                          {item.durationString}
                        </span>
                      )}
                    </div>

                    {/* Rich Video Info (YouTube layout) */}
                    <div className="flex-1 flex flex-col justify-between py-1 min-w-0">
                      <div>
                        {/* Title */}
                        <h3 className="font-semibold text-sm sm:text-base text-white group-hover:text-[#3ea6ff] line-clamp-2 leading-snug">
                          {item.title}
                        </h3>

                        {/* Views & Date */}
                        <div className="text-xs text-[#aaa] mt-1 flex items-center gap-1.5">
                          {item.viewCount !== undefined && item.viewCount !== null && (
                            <span>{formatViews(item.viewCount, locale)}</span>
                          )}
                          {item.viewCount && item.uploadDate && <span>•</span>}
                          {item.uploadDate && <span>{t('search.ago', { date: item.uploadDate })}</span>}
                        </div>

                        {/* Channel Row with Avatar */}
                        <div 
                          className="flex items-center gap-2 mt-2.5 group/ch cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (item.channelId) {
                              goTo('channel', { channelId: item.channelId });
                            }
                          }}
                        >
                          <ChannelAvatar
                            channelId={item.channelId}
                            url={item.channelAvatar}
                            title={item.channelTitle || ''}
                            className="w-6 h-6 rounded-full"
                            textClassName="text-[10px]"
                          />
                          <span className="text-xs text-[#aaa] group-hover/ch:text-white font-medium">
                            {item.channelTitle}
                          </span>
                          <CheckCircle2 className="w-3 h-3 text-[#888] fill-current" />
                        </div>

                        {/* Description Preview */}
                        {item.description && (
                          <ExpandableText text={item.description} className="text-xs text-[#717171]" />
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-wrap items-center gap-2.5 mt-3 pt-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => openDownloadModal({
                            videoId: item.id,
                            url: item.url,
                            title: item.title,
                            channelTitle: item.channelTitle,
                            channelId: item.channelId,
                            thumbnailUrl: item.thumbnailUrl,
                            durationString: item.durationString,
                          })}
                          className="bg-[#ff0033] hover:bg-[#cc0029] text-white text-xs font-semibold px-4 py-1.5 rounded-full flex items-center gap-1.5 shadow transition cursor-pointer"
                        >
                          <DownloadCloud className="w-3.5 h-3.5" />
                          <span>{t('search.download')}</span>
                        </button>

                        <button
                          onClick={() => goTo('watch', { videoId: item.id })}
                          className="bg-[#272727] hover:bg-[#383838] text-white text-xs font-medium px-3.5 py-1.5 rounded-full flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>{t('common.watch')}</span>
                        </button>

                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 text-[#aaa] hover:text-white rounded-full hover:bg-[#272727] transition"
                          title={t('card.openYoutube')}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Load More Button for Search Results */}
                {hasMore && (
                  <div className="flex flex-col items-center justify-center pt-6 pb-8 gap-2">
                    <button
                      onClick={handleLoadMore}
                      disabled={isLoadingMore}
                      className="flex items-center gap-2.5 px-6 py-3 rounded-full bg-[#272727] hover:bg-[#383838] text-white text-xs font-semibold transition cursor-pointer shadow-sm border border-white/5 active:scale-98"
                    >
                      {isLoadingMore ? (
                        <>
                          <Loader2 className="w-4 h-4 text-[#ff0033] animate-spin" />
                          <span>{t('search.loadingMore')}</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-4 h-4" />
                          <span>{t('search.showMore')}</span>
                        </>
                      )}
                    </button>
                    <span className="text-[11px] text-[#717171]">
                      {t('search.onlineShown', { count: youtubeVideos.length })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
