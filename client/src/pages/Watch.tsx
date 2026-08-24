import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  ThumbsUp, 
  DownloadCloud, 
  Trash2, 
  ExternalLink, 
  CheckCircle2,
  Share2,
  Check,
  Loader2,
  UserMinus,
  ListPlus
} from 'lucide-react';
import type { PlaylistSummary, Video } from '../types';
import { CustomVideoPlayer } from '../components/video/CustomVideoPlayer';
import { useMyTube } from '../context/MyTubeContext';
import { formatViews, formatUploadDate, formatFileSize } from '../utils/format';
import { ChannelAvatar } from '../components/common/ChannelAvatar';
import { ExpandableText } from '../components/common/ExpandableText';
import { useI18n } from '../i18n/I18nProvider';
import { VideoCard } from '../components/video/VideoCard';
import { readPlayerPrefs, writePlayerPrefs } from '../utils/playerPrefs';
import { AddToPlaylistModal } from '../components/playlist/AddToPlaylistModal';
import { PlaylistQueuePanel } from '../components/playlist/PlaylistQueuePanel';

const LOOP_KEY = 'va.pl.loop';

function readLoopPref(): boolean {
  try {
    return localStorage.getItem(LOOP_KEY) !== '0';
  } catch {
    return true;
  }
}

function queueOrder(ids: string[], playlistId: string, shuffle: boolean): string[] {
  if (!shuffle) return ids;
  const key = `va.pl.order.${playlistId}`;
  try {
    const raw = sessionStorage.getItem(key);
    if (raw) {
      const saved = JSON.parse(raw) as string[];
      if (Array.isArray(saved)) {
        const known = new Set(ids);
        const kept = saved.filter((id) => known.has(id));
        const extra = ids.filter((id) => !kept.includes(id));
        if (kept.length + extra.length === ids.length) return [...kept, ...extra];
      }
    }
  } catch {}
  const next = [...ids];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  try {
    sessionStorage.setItem(key, JSON.stringify(next));
  } catch {}
  return next;
}

export const Watch: React.FC = () => {
  const { nav, goTo, subscriptions, subscribeChannel, unsubscribeChannel, openDownloadModal, dataVersion, localOnly, notifyDataChanged } = useMyTube();
  const { t, locale } = useI18n();
  const [video, setVideo] = useState<Video | null>(null);
  const [related, setRelated] = useState<Video[]>([]);
  const [isTheatre, setIsTheatre] = useState(() => readPlayerPrefs().theatre);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isHoveredSub, setIsHoveredSub] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [queuePlaylist, setQueuePlaylist] = useState<PlaylistSummary | null>(null);
  const [queueVideos, setQueueVideos] = useState<Video[]>([]);
  const [loop, setLoop] = useState(readLoopPref);
  const skipVersionRefresh = useRef(true);
  const loadVideoRef = useRef<(silent?: boolean) => Promise<void>>(async () => {});
  const playerBoxRef = useRef<HTMLDivElement>(null);
  const [playerH, setPlayerH] = useState<number | undefined>(undefined);

  const videoId = nav.videoId;
  const playlistId = nav.playlistId;
  const shuffle = !!nav.playlistShuffle;

  const loadVideo = useCallback(async (silent = false) => {
    if (!videoId) return;
    if (!silent) {
      setIsLoading(true);
      window.scrollTo(0, 0);
    }
    try {
      const res = await fetch(`/api/videos/${videoId}`);
      if (res.ok) {
        const data = await res.json();
        setVideo((prev) => {
          const next = data.video as Video;
          if (silent && prev && prev.id === next.id) {
            const keepStream = prev.is_downloaded === 1 && !!prev.local_video_path;
            return keepStream
              ? { ...next, is_downloaded: prev.is_downloaded, local_video_path: prev.local_video_path }
              : { ...next };
          }
          return next;
        });
        setRelated(data.related || []);

        if (!silent) {
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
      }
    } catch (err) {
      console.error('Error fetching video details:', err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [videoId]);

  loadVideoRef.current = loadVideo;

  useEffect(() => {
    void loadVideo(false);
  }, [loadVideo]);

  useEffect(() => {
    if (skipVersionRefresh.current) {
      skipVersionRefresh.current = false;
      return;
    }
    void loadVideoRef.current(true);
  }, [dataVersion]);

  useEffect(() => {
    if (!playlistId) {
      setQueuePlaylist(null);
      setQueueVideos([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/playlists/${encodeURIComponent(playlistId)}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        setQueuePlaylist(data.playlist);
        setQueueVideos(data.videos || []);
      } catch (err) {
        console.error('Error loading playlist queue:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [playlistId, dataVersion]);

  useEffect(() => {
    const el = playerBoxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setPlayerH(el.clientHeight));
    ro.observe(el);
    setPlayerH(el.clientHeight);
    return () => ro.disconnect();
  }, [isTheatre, videoId, playlistId, isLoading]);

  const orderedIds = useMemo(
    () => (playlistId ? queueOrder(queueVideos.map((item) => item.id), playlistId, shuffle) : []),
    [playlistId, queueVideos, shuffle],
  );

  const playInQueue = useCallback((id: string) => {
    goTo('watch', { videoId: id, playlistId, playlistShuffle: shuffle || undefined });
  }, [goTo, playlistId, shuffle]);

  const playNext = useCallback(() => {
    if (!playlistId || !videoId || orderedIds.length < 2) return;
    const idx = orderedIds.indexOf(videoId);
    if (idx < 0) return;
    let next = idx + 1;
    if (next >= orderedIds.length) {
      if (!loop) return;
      next = 0;
    }
    if (orderedIds[next] === videoId) return;
    goTo('watch', { videoId: orderedIds[next], playlistId, playlistShuffle: shuffle || undefined });
  }, [goTo, playlistId, videoId, orderedIds, loop, shuffle]);

  const toggleLoop = () => {
    setLoop((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(LOOP_KEY, next ? '1' : '0');
      } catch {}
      return next;
    });
  };

  const toggleShuffle = () => {
    if (playlistId) {
      try {
        sessionStorage.removeItem(`va.pl.order.${playlistId}`);
      } catch {}
    }
    goTo('watch', {
      videoId: videoId,
      playlistId,
      playlistShuffle: shuffle ? undefined : true,
    });
  };

  const closeQueue = () => {
    if (videoId) goTo('watch', { videoId });
  };

  const toggleTheatre = () => {
    setIsTheatre((open) => {
      const next = !open;
      writePlayerPrefs({ theatre: next });
      return next;
    });
  };

  if (isLoading || !video) {
    return (
      <div className="flex-1 p-6 w-full max-w-[1800px] mx-auto flex items-center justify-center min-h-[70vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-[#ff5a67] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-[#aaa]">{t('watch.loading')}</span>
        </div>
      </div>
    );
  }

  const isSubscribed = subscriptions.some(s => s.id === video.channel_id);
  const isDownloaded = video.is_downloaded === 1;
  const showQueue = !!queuePlaylist && queueVideos.length > 0;

  const playerNode = (
    <CustomVideoPlayer
      video={video}
      isTheatre={isTheatre}
      onToggleTheatre={toggleTheatre}
      autoPlay={!!playlistId}
      onEnded={playNext}
    />
  );

  const toggleLike = async () => {
    try {
      const nextLiked = video.liked === 1 ? 0 : 1;
      setVideo(prev => prev ? { ...prev, liked: nextLiked } : null);
      await fetch(`/api/videos/${video.id}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ liked: nextLiked === 1 }),
      });
      notifyDataChanged();
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
    <>
    {isTheatre && (
      <div className="w-full h-[calc(100dvh-3.5rem)] bg-black flex overflow-hidden">
        <div className="flex-1 min-w-0 h-full overflow-hidden">
          {playerNode}
        </div>
        {showQueue && (
          <div className="hidden lg:block w-[480px] flex-shrink-0 h-full bg-[#090d12]">
            <PlaylistQueuePanel
              playlist={queuePlaylist!}
              videos={queueVideos}
              currentId={video.id}
              shuffle={shuffle}
              loop={loop}
              fill
              onPlay={playInQueue}
              onToggleShuffle={toggleShuffle}
              onToggleLoop={toggleLoop}
              onClose={closeQueue}
            />
          </div>
        )}
      </div>
    )}
    <div className={`flex-1 w-full px-0 lg:px-6 pb-8 space-y-4 ${isTheatre ? 'pt-4 lg:pt-5' : 'pt-0 lg:pt-6'}`}>
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <div className="flex-1 min-w-0 w-full space-y-4">
          {!isTheatre && (
            <div
              ref={playerBoxRef}
              className="w-full bg-black overflow-hidden rounded-none lg:rounded-2xl shadow-2xl"
            >
              {playerNode}
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
                      className="font-bold text-white hover:text-[#73c7e8] transition flex items-center gap-1.5 text-xs sm:text-sm cursor-pointer truncate"
                    >
                      <span className="truncate">{video.channel_title}</span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#aaa] fill-current flex-shrink-0" />
                    </button>
                    <span className="text-[11px] text-[#aaa] block truncate">
                      {t('channel.videoCount', {
                        count: localOnly
                          ? (video.channel_downloaded_count || 0)
                          : (video.channel_video_count || video.channel_downloaded_count || 0),
                      })}
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
                        ? 'opacity-80 cursor-wait bg-[#18212c] text-white'
                        : isSubscribed
                          ? isHoveredSub
                            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                            : 'bg-[#18212c] hover:bg-[#23303e] text-white'
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
                          <Check className="w-3.5 h-3.5 text-[#73c7e8]" />
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
                <button
                  onClick={() => setShowPlaylistModal(true)}
                  className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs font-semibold bg-[#18212c] hover:bg-[#23303e] text-[#f4f7fb] transition cursor-pointer flex-shrink-0"
                >
                  <ListPlus className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                  <span>{t('watch.addToPlaylist')}</span>
                </button>

                <button
                  onClick={toggleLike}
                  className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition cursor-pointer flex-shrink-0 ${
                    video.liked === 1
                      ? 'bg-[#73c7e8]/20 text-[#73c7e8] border border-[#73c7e8]/30'
                      : 'bg-[#18212c] hover:bg-[#23303e] text-[#f4f7fb]'
                  }`}
                  title={t('watch.like')}
                >
                  <ThumbsUp className={`w-3.5 sm:w-4 h-3.5 sm:h-4 ${video.liked === 1 ? 'fill-current' : ''}`} />
                </button>

                {/* Download / Local Status */}
                {isDownloaded ? (
                  <button
                    onClick={handleDelete}
                    className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs font-semibold bg-[#18212c] hover:bg-rose-900/40 text-rose-400 transition cursor-pointer flex-shrink-0"
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
                    className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs font-semibold bg-[#18212c] hover:bg-[#23303e] text-[#f4f7fb] transition-colors duration-200 cursor-pointer flex-shrink-0"
                  >
                    <DownloadCloud className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                    <span>{t('watch.download')}</span>
                  </button>
                ) : null}

                {/* Share */}
                <button
                  onClick={handleShare}
                  className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs font-semibold bg-[#18212c] hover:bg-[#23303e] text-[#f4f7fb] transition cursor-pointer flex-shrink-0"
                >
                  <Share2 className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                  <span>{copiedLink ? t('common.copied') : t('common.share')}</span>
                </button>

                {/* Open on YouTube */}
                <a
                  href={`https://www.youtube.com/watch?v=${video.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 sm:p-2 bg-[#18212c] hover:bg-[#23303e] text-[#aaa] hover:text-white rounded-full transition flex-shrink-0"
                  title={t('card.openYoutube')}
                >
                  <ExternalLink className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                </a>
              </div>
            </div>

            {/* Description & Stats Box */}
            <div className="va-description-panel bg-[#18212c]/60 hover:bg-[#18212c] rounded-2xl p-3.5 sm:p-4 text-xs transition space-y-2">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#aaa]">
              {video.view_count !== undefined && video.view_count !== null && (
                <span className="font-semibold text-white">{formatViews(video.view_count, locale)}</span>
              )}
              {video.upload_date && (
                <>
                  <span className="text-[#657383]">•</span>
                  <span>{formatUploadDate(video.upload_date, locale)}</span>
                </>
              )}
              {isDownloaded && video.file_size ? (
                <>
                  <span className="text-[#657383]">•</span>
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

        <div className="w-full lg:w-[480px] flex-shrink-0 space-y-3 px-3 sm:px-0">
          {showQueue && (
            <div className={isTheatre ? 'lg:hidden' : undefined}>
              <PlaylistQueuePanel
                playlist={queuePlaylist!}
                videos={queueVideos}
                currentId={video.id}
                shuffle={shuffle}
                loop={loop}
                maxHeight={playerH && playerH > 120 ? playerH : 360}
                onPlay={playInQueue}
                onToggleShuffle={toggleShuffle}
                onToggleLoop={toggleLoop}
                onClose={closeQueue}
              />
            </div>
          )}
          <h2 className="va-section-heading text-sm font-bold text-white px-1">
            {t('watch.related')}
          </h2>

          <div className="space-y-1">
            {related.map((item) => (
              <VideoCard key={item.id} video={item} layout="horizontal" />
            ))}
          </div>
        </div>
      </div>
    </div>
    <AddToPlaylistModal
      open={showPlaylistModal}
      videoId={video.id}
      onClose={() => setShowPlaylistModal(false)}
      onLikedChange={(liked) => setVideo((prev) => prev ? { ...prev, liked: liked ? 1 : 0 } : null)}
    />
    </>
  );
};
