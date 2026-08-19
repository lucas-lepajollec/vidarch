import React, { useState, useEffect } from 'react';
import { 
  ThumbsUp, 
  DownloadCloud, 
  Trash2, 
  ExternalLink, 
  CheckCircle2,
  Share2,
  Check,
  Loader2,
  UserMinus
} from 'lucide-react';
import type { Video } from '../types';
import { CustomVideoPlayer } from '../components/video/CustomVideoPlayer';
import { useMyTube } from '../context/MyTubeContext';
import { formatViews, formatUploadDate, formatFileSize } from '../utils/format';
import { MediaThumb } from '../components/common/MediaThumb';
import { ChannelAvatar } from '../components/common/ChannelAvatar';
import { useI18n } from '../i18n/I18nProvider';
import { ExpandableText } from '../components/common/ExpandableText';

export const Watch: React.FC = () => {
  const { nav, goTo, subscriptions, subscribeChannel, unsubscribeChannel, openDownloadModal, dataVersion, localOnly } = useMyTube();
  const { t, locale } = useI18n();
  const [video, setVideo] = useState<Video | null>(null);
  const [related, setRelated] = useState<Video[]>([]);
  const [isTheatre, setIsTheatre] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isHoveredSub, setIsHoveredSub] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const videoId = nav.videoId;

  const loadVideo = async () => {
    if (!videoId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/videos/${videoId}`);
      if (res.ok) {
        const data = await res.json();
        setVideo(data.video);
        setRelated(data.related || []);

        // Record immediate watch event in history
        try {
          await fetch(`/api/videos/${videoId}/progress`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              progress: Math.max(1, data.video?.watch_progress || 1),
            }),
          });
        } catch (_) {}
      }
    } catch (err) {
      console.error('Error fetching video details:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadVideo();
    window.scrollTo(0, 0);
  }, [videoId, dataVersion]);

  if (isLoading || !video) {
    return (
      <div className="flex-1 p-6 w-full max-w-[1800px] mx-auto flex items-center justify-center min-h-[70vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-[#ff0033] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-[#aaa]">{t('watch.loading')}</span>
        </div>
      </div>
    );
  }

  const isSubscribed = subscriptions.some(s => s.id === video.channel_id);
  const isDownloaded = video.is_downloaded === 1;

  const toggleLike = async () => {
    try {
      const nextLiked = video.liked === 1 ? 0 : 1;
      setVideo(prev => prev ? { ...prev, liked: nextLiked } : null);
      await fetch(`/api/videos/${video.id}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ liked: nextLiked === 1 }),
      });
    } catch (_) {}
  };

  const handleSubscribeToggle = async () => {
    if (!video.channel_id) return;
    if (isSubscribed) {
      await unsubscribeChannel(video.channel_id);
    } else {
      await subscribeChannel(`https://www.youtube.com/channel/${video.channel_id}`);
    }
  };

  const handleDelete = async () => {
    if (!confirm(t('card.deleteConfirm', { title: video.title }))) return;
    try {
      await fetch(`/api/videos/${video.id}`, { method: 'DELETE' });
      await loadVideo();
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const handleShare = () => {
    const shareUrl = `https://www.youtube.com/watch?v=${video!.id}`;
    navigator.clipboard?.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="flex-1 w-full px-0 sm:px-6 pt-0 sm:pt-6 pb-8 space-y-4">
      {isTheatre && (
        <div className="w-full aspect-video bg-black overflow-hidden">
          <CustomVideoPlayer
            video={video}
            isTheatre={isTheatre}
            onToggleTheatre={() => setIsTheatre((open) => !open)}
          />
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <div className="flex-1 min-w-0 w-full space-y-4">
          {!isTheatre && (
            <div className="w-full aspect-video bg-black overflow-hidden rounded-none sm:rounded-2xl shadow-2xl">
              <CustomVideoPlayer
                video={video}
                isTheatre={isTheatre}
                onToggleTheatre={() => setIsTheatre((open) => !open)}
              />
            </div>
          )}

          <div className="px-3 sm:px-0 space-y-3">
            {/* Video Title */}
            <h1 className="text-base sm:text-xl font-bold text-white tracking-tight leading-snug">
              {video.title}
            </h1>

            {/* Channel Row & Action Buttons */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
              {/* Channel Info */}
              <div className="flex items-center justify-between sm:justify-start gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => video.channel_id && goTo('channel', { channelId: video.channel_id })}
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden bg-[#2a2a2a] flex items-center justify-center hover:opacity-85 transition cursor-pointer flex-shrink-0"
                  >
                    <ChannelAvatar
                      channelId={video.channel_id}
                      url={video.channel_avatar}
                      title={video.channel_title}
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-full"
                      textClassName="text-sm"
                    />
                  </button>

                  <div className="min-w-0">
                    <button
                      onClick={() => video.channel_id && goTo('channel', { channelId: video.channel_id })}
                      className="font-bold text-white hover:text-[#3ea6ff] transition flex items-center gap-1.5 text-xs sm:text-sm cursor-pointer truncate"
                    >
                      <span className="truncate">{video.channel_title}</span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#aaa] fill-current flex-shrink-0" />
                    </button>
                    <span className="text-[11px] text-[#aaa] block truncate">
                      {isDownloaded ? t('watch.stored') : t('watch.youtubeChannel')}
                    </span>
                  </div>
                </div>

                {/* Subscribe pill button */}
                {video.channel_id && !localOnly && (
                  <button
                    onClick={handleSubscribeToggle}
                    onMouseEnter={() => setIsHoveredSub(true)}
                    onMouseLeave={() => setIsHoveredSub(false)}
                    disabled={isSubscribing}
                    className={`ml-2 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 shadow-sm flex-shrink-0 ${
                      isSubscribing
                        ? 'opacity-80 cursor-wait bg-[#272727] text-white'
                        : isSubscribed
                          ? isHoveredSub
                            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                            : 'bg-[#272727] hover:bg-[#383838] text-white'
                          : 'bg-white hover:bg-white/90 text-black shadow-lg font-bold shadow-white/10'
                    }`}
                  >
                    {isSubscribing ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span className="hidden sm:inline">{t('watch.fetching')}</span>
                      </>
                    ) : isSubscribed ? (
                      isHoveredSub ? (
                        <>
                          <UserMinus className="w-3.5 h-3.5 text-red-400" />
                          <span>{t('channel.unsubscribe')}</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#3ea6ff]" />
                          <span>{t('channel.subscribed')}</span>
                        </>
                      )
                    ) : (
                      <span>{t('channel.subscribe')}</span>
                    )}
                  </button>
                )}
              </div>

              {/* Action Pills Bar (Horizontally scrollable on mobile) */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                {/* Like Button */}
                <button
                  onClick={toggleLike}
                  className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs font-semibold transition cursor-pointer flex-shrink-0 ${
                    video.liked === 1
                      ? 'bg-[#3ea6ff]/20 text-[#3ea6ff] border border-[#3ea6ff]/30'
                      : 'bg-[#272727] hover:bg-[#383838] text-[#f1f1f1]'
                  }`}
                >
                  <ThumbsUp className={`w-3.5 sm:w-4 h-3.5 sm:h-4 ${video.liked === 1 ? 'fill-current' : ''}`} />
                  <span>{t('watch.like')}</span>
                </button>

                {/* Download / Local Status */}
                {isDownloaded ? (
                  <button
                    onClick={handleDelete}
                    className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs font-semibold bg-[#272727] hover:bg-rose-900/40 text-rose-400 transition cursor-pointer flex-shrink-0"
                    title={t('watch.deleteLocal')}
                  >
                    <Trash2 className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                    <span>{t('watch.delete')}</span>
                  </button>
                ) : !localOnly ? (
                  <button
                    onClick={() => openDownloadModal({
                      videoId: video.id,
                      url: `https://www.youtube.com/watch?v=${video.id}`,
                      title: video.title,
                      channelTitle: video.channel_title,
                      channelId: video.channel_id,
                      thumbnailUrl: video.thumbnail_url,
                      durationString: video.duration_string,
                    })}
                    className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs font-semibold bg-[#272727] hover:bg-[#383838] text-[#f1f1f1] transition-colors duration-200 cursor-pointer flex-shrink-0"
                  >
                    <DownloadCloud className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                    <span>{t('watch.download')}</span>
                  </button>
                ) : null}

                {/* Share */}
                <button
                  onClick={handleShare}
                  className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs font-semibold bg-[#272727] hover:bg-[#383838] text-[#f1f1f1] transition cursor-pointer flex-shrink-0"
                >
                  <Share2 className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                  <span>{copiedLink ? t('common.copied') : t('common.share')}</span>
                </button>

                {/* Open on YouTube */}
                <a
                  href={`https://www.youtube.com/watch?v=${video.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 sm:p-2 bg-[#272727] hover:bg-[#383838] text-[#aaa] hover:text-white rounded-full transition flex-shrink-0"
                  title={t('card.openYoutube')}
                >
                  <ExternalLink className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                </a>
              </div>
            </div>

            {/* Description & Stats Box */}
            <div className="bg-[#272727]/60 hover:bg-[#272727] rounded-2xl p-3.5 sm:p-4 text-xs transition space-y-2">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#aaa]">
              {video.view_count !== undefined && video.view_count !== null && (
                <span className="font-semibold text-white">{formatViews(video.view_count, locale)}</span>
              )}
              {video.upload_date && (
                <>
                  <span className="text-[#717171]">•</span>
                  <span>{formatUploadDate(video.upload_date, locale)}</span>
                </>
              )}
              {isDownloaded && video.file_size ? (
                <>
                  <span className="text-[#717171]">•</span>
                  <span>{formatFileSize(video.file_size, locale)}</span>
                </>
              ) : null}
            </div>

            {video.description ? (
              <ExpandableText text={video.description} className="text-sm text-[#ddd]" />
            ) : (
              <p className="text-[#888] italic text-sm">{t('watch.noDescription')}</p>
            )}
          </div>
        </div>
        </div>

        <div className="w-full lg:w-[400px] flex-shrink-0 space-y-3 px-3 sm:px-0">
          <h2 className="text-sm font-bold text-white px-1">
            {t('watch.related')}
          </h2>

          <div className="space-y-3">
            {related.map((item) => {
              return (
                <div
                  key={item.id}
                  onClick={() => goTo('watch', { videoId: item.id })}
                  className="flex gap-3 group cursor-pointer p-1.5 rounded-xl hover:bg-[#181818] transition"
                >
                  {/* Compact 16:9 Thumbnail */}
                  <div className="relative w-40 sm:w-44 aspect-video rounded-xl overflow-hidden bg-[#222] flex-shrink-0 shadow-sm">
                    <MediaThumb
                      video={item}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                    {item.duration_string && (
                      <span className="absolute bottom-1 right-1 bg-black/85 text-white text-[10px] font-bold px-1 py-0.2 rounded">
                        {item.duration_string}
                      </span>
                    )}
                    {item.is_downloaded !== 1 && !localOnly && (
                      <span className="absolute top-1 left-1 bg-black/70 text-[#aaa] text-[8px] font-medium px-1.5 py-0.5 rounded">
                        {t('card.online')}
                      </span>
                    )}
                  </div>

                  {/* Compact Info */}
                  <div className="flex-1 min-w-0 flex flex-col justify-start py-0.5">
                    <h3 className="font-semibold text-xs text-white group-hover:text-[#3ea6ff] line-clamp-2 leading-snug">
                      {item.title}
                    </h3>
                    <p className="text-[11px] text-[#aaa] mt-1 truncate">
                      {item.channel_title}
                    </p>
                    <div className="text-[10px] text-[#717171] mt-0.5 flex items-center gap-1">
                      {item.view_count !== undefined && item.view_count !== null ? (
                        <span>{formatViews(item.view_count)}</span>
                      ) : (
                        <span>{formatViews(item.view_count, locale)}</span>
                      )}
                      {item.upload_date && (
                        <>
                          <span>•</span>
                          <span>{item.upload_date}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
