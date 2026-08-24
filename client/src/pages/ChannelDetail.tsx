import React, { useState, useEffect, useCallback } from 'react';
import { 
  Tv2, 
  HardDrive, 
  Film, 
  ArrowLeft, 
  Check, 
  Loader2, 
  ChevronDown, 
  UserMinus, 
  Sparkles,
} from 'lucide-react';
import type { Channel, Video } from '../types';
import { VideoCard } from '../components/video/VideoCard';
import { useMyTube } from '../context/MyTubeContext';
import { ChannelAvatar } from '../components/common/ChannelAvatar';
import { formatSubscriberCount } from '../utils/format';
import { useI18n } from '../i18n/I18nProvider';
import { ExpandableText } from '../components/common/ExpandableText';
import { bannerSrc } from '../utils/media';
import { AutoDownloadControl } from '../components/channel/AutoDownloadControl';

export const ChannelDetail: React.FC = () => {
  const { 
    nav, 
    goTo, 
    subscriptions, 
    subscribeChannel, 
    unsubscribeChannel, 
    dataVersion,
    localOnly,
    myChannel,
  } = useMyTube();
  const { t } = useI18n();
  const [channel, setChannel] = useState<Channel | null>(null);
  const [downloadedVideos, setDownloadedVideos] = useState<Video[]>([]);
  const [detectedVideos, setDetectedVideos] = useState<Video[]>([]);
  const [activeTab, setActiveTab] = useState<'downloaded' | 'online' | 'about'>('downloaded');
  const [autoDownload, setAutoDownload] = useState(false);
  const [autoDownloadMode, setAutoDownloadMode] = useState<'future' | 'all'>('future');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isHoveredSubscribed, setIsHoveredSubscribed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const channelId = nav.channelId;

  const loadChannelData = useCallback(async (silent = false) => {
    if (!channelId) return;
    if (!silent) setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/channels/${encodeURIComponent(channelId)}`);
      if (res.ok) {
        const data = await res.json();
        setChannel(data.channel);
        const downloaded = data.downloadedVideos || [];
        const detected = data.detectedVideos || [];
        setDownloadedVideos(downloaded);
        setDetectedVideos(detected);
        setAutoDownload(data.channel?.auto_download === 1);
        setAutoDownloadMode(data.channel?.auto_download_mode === 'all' ? 'all' : 'future');
        setHasMore(detected.length >= 30);

        // Auto-switch to online tab if no downloaded videos exist
        if (!localOnly && downloaded.length === 0 && detected.length > 0) {
          setActiveTab('online');
        } else if (localOnly) {
          setActiveTab((tab) => (tab === 'online' ? 'downloaded' : tab));
        }
      } else {
        const errData = await res.json();
        setError(errData.error || t('channel.notFound'));
      }
    } catch (err: any) {
      console.error('Error fetching channel data:', err);
      setError(t('channel.fetchError'));
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [channelId, localOnly, t]);

  useEffect(() => {
    void loadChannelData();
  }, [dataVersion, loadChannelData]);

  useEffect(() => {
    if (channel?.id && myChannel?.id && channel.id === myChannel.id) {
      goTo('mychannel');
    }
  }, [channel?.id, goTo, myChannel?.id]);

  // Load more videos pagination
  const handleLoadMore = async () => {
    if (!channel || isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const targetQuery = channel.handle || channel.id;
      const res = await fetch(`/api/channels/${encodeURIComponent(targetQuery)}/more-videos?offset=${detectedVideos.length}&limit=50`);
      if (res.ok) {
        const data = await res.json();
        const newVids: Video[] = data.videos || [];
        if (newVids.length > 0) {
          setDetectedVideos(prev => {
            const existingIds = new Set(prev.map(v => v.id));
            const filteredNew = newVids.filter(v => !existingIds.has(v.id));
            return [...prev, ...filteredNew];
          });
        }
        if (newVids.length < 50 || data.hasMore === false) {
          setHasMore(false);
        }
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Error loading more videos:', err);
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 w-full px-6 py-12 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-[#ff5a67] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-[#aaa]">{t('channel.loadingInfo')}</span>
        </div>
      </div>
    );
  }

  if (channel?.id && myChannel?.id && channel.id === myChannel.id) {
    return (
      <div className="flex-1 w-full px-6 py-12 flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-3 border-[#ff5a67] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !channel) {
    return (
      <div className="flex-1 w-full px-6 py-16 flex flex-col items-center justify-center text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-[#18212c] flex items-center justify-center text-[#aaa]">
          <Tv2 className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-white">{error || t('channel.notFound')}</h2>
        <p className="text-xs text-[#aaa] max-w-md">
          {t('channel.fetchError')}
        </p>
        <button
          onClick={() => goTo('home')}
          className="bg-white text-black text-xs font-bold px-5 py-2.5 rounded-full hover:bg-white/90 transition flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t('channel.backHome')}</span>
        </button>
      </div>
    );
  }

  const isSubscribed = subscriptions.some(s => s.id === channel.id || (channel.handle && s.handle === channel.handle));

  const handleSubscribeToggle = async () => {
    if (isSubscribing) return;
    setIsSubscribing(true);
    try {
      if (isSubscribed) {
        await unsubscribeChannel(channel.id);
      } else {
        await subscribeChannel(`https://www.youtube.com/channel/${channel.id}`);
      }
      // Silent refresh without unmounting UI
      await loadChannelData(true);
    } finally {
      setIsSubscribing(false);
    }
  };

  const resolvedBanner = bannerSrc(channel.id, channel.banner_url);

  return (
    <div className="flex-1 w-full px-4 sm:px-6 pt-6 pb-8 space-y-4 sm:space-y-6">
      {/* Banner */}
      {resolvedBanner ? (
        <div className="w-full h-28 sm:h-44 md:h-60 rounded-xl sm:rounded-2xl overflow-hidden bg-[#0f151d] shadow-md">
          <img src={resolvedBanner} alt={t('edit.banner')} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="w-full h-20 sm:h-28 rounded-xl sm:rounded-2xl bg-gradient-to-r from-[#0f151d] via-[#202020] to-[#0d131b] border border-white/5 flex items-center justify-center">
          <div className="flex items-center gap-2 text-white/20 text-xs font-semibold uppercase tracking-widest">
            <Sparkles className="w-4 h-4" />
            <span>{channel.title}</span>
          </div>
        </div>
      )}

      {/* Channel Info Row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6 px-1">
        <div className="flex items-center gap-3.5 sm:gap-5">
          {/* Avatar */}
          <ChannelAvatar
            channelId={channel.id}
            url={channel.avatar_url}
            title={channel.title}
            className="w-16 h-16 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-full shadow-xl"
            textClassName="text-2xl sm:text-3xl"
          />

          {/* Details */}
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-white tracking-tight">
              {channel.title}
            </h1>
            <div className="text-[11px] sm:text-xs text-[#aaa] mt-1 flex flex-wrap items-center gap-1.5 sm:gap-2">
              {channel.handle && <span className="font-semibold text-[#ddd]">{channel.handle.startsWith('@') ? channel.handle : `@${channel.handle}`}</span>}
              {channel.is_owner === 1 && (
                <>
                  {channel.handle && <span>•</span>}
                  <span className="text-[#888]">{t('channel.ours')}</span>
                </>
              )}
              {channel.subscriber_count && (
                <>
                  <span>•</span>
                  <span>{formatSubscriberCount(channel.subscriber_count)}</span>
                </>
              )}
              <span>•</span>
              <span>{t('channel.videoCount', {
                count: localOnly
                  ? downloadedVideos.length
                  : (channel.video_count || downloadedVideos.length),
              })}</span>
            </div>
            {channel.description && (
              <ExpandableText text={channel.description} />
            )}
          </div>
        </div>

        {/* Actions & Auto-download */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {!localOnly && (isSubscribed || channel.is_owner === 1) && !String(channel.id).startsWith('custom_') && (
            <AutoDownloadControl
              channelId={channel.auto_download_channel_id || channel.id}
              autoDownload={autoDownload ? 1 : 0}
              autoDownloadMode={autoDownloadMode}
              onUpdated={(next) => {
                setAutoDownload(next.auto_download === 1);
                setAutoDownloadMode(next.auto_download_mode === 'all' ? 'all' : 'future');
              }}
            />
          )}

          {/* Smooth Subscribe / Unsubscribe Button */}
          <button
            onClick={handleSubscribeToggle}
            onMouseEnter={() => setIsHoveredSubscribed(true)}
            onMouseLeave={() => setIsHoveredSubscribed(false)}
            disabled={isSubscribing}
            className={`min-w-[120px] px-5 py-2.5 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-sm ${
              isSubscribing
                ? 'opacity-70 cursor-wait bg-[#18212c] text-white'
                : isSubscribed
                  ? isHoveredSubscribed
                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                    : 'bg-[#18212c] hover:bg-[#23303e] text-white'
                  : 'bg-white hover:bg-white/90 text-black shadow-md font-bold'
            }`}
          >
            {isSubscribing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : isSubscribed ? (
              isHoveredSubscribed ? (
                <>
                  <UserMinus className="w-3.5 h-3.5 text-red-400" />
                  <span>{t('channel.unsubscribe')}</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 text-[#73c7e8]" />
                  <span>{t('channel.subscribed')}</span>
                </>
              )
            ) : (
              <>
                <span>{t('channel.subscribe')}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Channel Navigation Tabs (Scrollable on mobile) */}
      <div className="flex items-center gap-4 sm:gap-6 text-xs sm:text-sm font-semibold select-none pt-2 overflow-x-auto no-scrollbar border-b border-[#18212c]">
        <button
          onClick={() => setActiveTab('downloaded')}
          className={`pb-2.5 relative transition cursor-pointer flex-shrink-0 ${
            activeTab === 'downloaded' ? 'text-white font-bold' : 'text-[#aaa] hover:text-white'
          }`}
        >
          <span>{t('channel.downloaded', { count: downloadedVideos.length })}</span>
          {activeTab === 'downloaded' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full" />
          )}
        </button>

        {!localOnly && (
        <button
          onClick={() => setActiveTab('online')}
          className={`pb-2.5 relative transition cursor-pointer flex-shrink-0 ${
            activeTab === 'online' ? 'text-white font-bold' : 'text-[#aaa] hover:text-white'
          }`}
        >
          <span>{t('channel.online', { count: detectedVideos.length })}</span>
          {activeTab === 'online' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full" />
          )}
        </button>
        )}

        <button
          onClick={() => setActiveTab('about')}
          className={`pb-2.5 relative transition cursor-pointer flex-shrink-0 ${
            activeTab === 'about' ? 'text-white font-bold' : 'text-[#aaa] hover:text-white'
          }`}
        >
          <span>{t('channel.about')}</span>
          {activeTab === 'about' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full" />
          )}
        </button>
      </div>

      {/* Content for tabs */}
      {activeTab === 'downloaded' && (
        <>
          {downloadedVideos.length === 0 ? (
            <div className="py-16 text-center max-w-md mx-auto space-y-3 px-4">
              <div className="w-14 h-14 rounded-full bg-[#18212c] flex items-center justify-center text-[#aaa] mx-auto">
                <HardDrive className="w-7 h-7 text-[#657383]" />
              </div>
              <h3 className="font-semibold text-sm text-white">{t('channel.emptyTitle')}</h3>
              <p className="text-xs text-[#aaa] pb-2">
                {localOnly ? t('channel.emptyBodyLocal') : t('channel.emptyBody')}
              </p>
              {!localOnly && (
              <button
                onClick={() => setActiveTab('online')}
                className="bg-white text-black font-semibold text-xs px-5 py-2.5 rounded-full hover:bg-white/90 transition cursor-pointer"
              >
                {t('channel.seeOnline')}
              </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-6 sm:gap-y-8">
              {downloadedVideos.map((v) => (
                <VideoCard key={v.id} video={v} onDelete={() => loadChannelData(true)} />
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'online' && !localOnly && (
        <div className="space-y-8">
          {detectedVideos.length === 0 ? (
            <div className="py-16 text-center max-w-md mx-auto space-y-2 px-4">
              <Film className="w-10 h-10 text-[#657383] mx-auto mb-2" />
              <h3 className="font-semibold text-sm text-white">{t('channel.noOnlineVideos')}</h3>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-6 sm:gap-y-8">
                {detectedVideos.map((v) => (
                  <VideoCard key={v.id} video={v} onDelete={() => loadChannelData(true)} />
                ))}
              </div>

              {/* Load More Button */}
              {hasMore && (
                <div className="flex flex-col items-center justify-center pt-4 pb-8 gap-2">
                  <button
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                    className="flex items-center gap-2.5 px-6 py-3 rounded-full bg-[#18212c] hover:bg-[#23303e] text-white text-xs font-semibold transition cursor-pointer shadow-sm border border-white/5 active:scale-98"
                  >
                    {isLoadingMore ? (
                      <>
                        <Loader2 className="w-4 h-4 text-[#ff5a67] animate-spin" />
                        <span>{t('channel.loadingMore')}</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4" />
                        <span>{t('channel.loadMoreVideos')}</span>
                      </>
                    )}
                  </button>
                  <span className="text-[11px] text-[#657383]">
                    {t('channel.shownOnline', { count: detectedVideos.length })}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'about' && (
        <div className="space-y-6 max-w-3xl text-xs text-[#ddd] pt-2">
          <div>
            <h3 className="font-bold text-white text-sm mb-2">{t('channel.description')}</h3>
            <p className="whitespace-pre-line leading-relaxed text-[#aaa]">
              {channel.description || t('channel.noDescription')}
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-[#aaa] pt-2">
            <div>
              <span className="font-bold text-white block mb-1">{t('channel.channelIdLabel')}</span>
              <span className="font-mono">{channel.id}</span>
            </div>
            {channel.last_scanned_at && (
              <div>
                <span className="font-bold text-white block mb-1">{t('channel.lastScan')}</span>
                <span>{channel.last_scanned_at}</span>
              </div>
            )}
            <div>
              <span className="font-bold text-white block mb-1">{t('channel.archivedLabel')}</span>
              <span>{t('channel.videoCount', { count: downloadedVideos.length })}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
