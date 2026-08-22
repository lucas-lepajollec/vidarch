import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ListVideo,
  Play,
  Shuffle,
  ThumbsUp,
  Trash2,
} from 'lucide-react';
import type { PlaylistSummary, Video } from '../types';
import { useMyTube } from '../context/MyTubeContext';
import { MediaThumb } from '../components/common/MediaThumb';
import { useI18n } from '../i18n/I18nProvider';

export const PlaylistDetail: React.FC = () => {
  const { nav, goTo, dataVersion, notifyDataChanged } = useMyTube();
  const { t } = useI18n();
  const playlistId = nav.playlistId || (nav.page === 'liked' ? 'liked' : '');
  const [playlist, setPlaylist] = useState<PlaylistSummary | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const skipVersionRefresh = useRef(true);

  const isLiked = playlistId === 'liked';

  const load = async (silent = false) => {
    if (!playlistId) return;
    if (!silent) setIsLoading(true);
    try {
      const res = await fetch(`/api/playlists/${encodeURIComponent(playlistId)}`);
      if (res.ok) {
        const data = await res.json();
        setPlaylist(data.playlist);
        setVideos(data.videos || []);
      } else {
        setPlaylist(null);
        setVideos([]);
      }
    } catch (err) {
      console.error('Error fetching playlist:', err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    void load(false);
  }, [playlistId]);

  useEffect(() => {
    if (skipVersionRefresh.current) {
      skipVersionRefresh.current = false;
      return;
    }
    void load(true);
  }, [dataVersion]);

  const handleRemove = async (videoId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!playlistId) return;
    try {
      await fetch(`/api/playlists/${encodeURIComponent(playlistId)}/videos/${encodeURIComponent(videoId)}`, {
        method: 'DELETE',
      });
      setVideos((prev) => prev.filter((v) => v.id !== videoId));
      setPlaylist((prev) =>
        prev ? { ...prev, video_count: Math.max(0, prev.video_count - 1) } : prev,
      );
      notifyDataChanged();
    } catch (err) {
      console.error('Remove from playlist error:', err);
    }
  };

  const title = isLiked ? t('liked.title') : (playlist?.title || t('pl.title'));
  const firstVideo = videos[0];

  const openWatch = (videoId: string, shuffle = false) => {
    goTo('watch', { videoId, playlistId, playlistShuffle: shuffle || undefined });
  };

  return (
    <div className="flex-1 w-full px-4 sm:px-6 pt-6 pb-8 flex flex-col lg:flex-row gap-8 text-[#f1f1f1]">
      <div className="w-full lg:w-88 flex-shrink-0">
        <div className={`border border-[#272727] p-6 rounded-3xl shadow-xl lg:sticky lg:top-18 space-y-4 ${
          isLiked
            ? 'bg-gradient-to-b from-[#2a1a1a] via-[#1c1818] to-[#121212]'
            : 'bg-gradient-to-b from-[#242424] via-[#1a1a1a] to-[#121212]'
        }`}>
          <button
            type="button"
            onClick={() => goTo('playlists')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#aaa] hover:text-white transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {t('pl.title')}
          </button>

          <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-[#222] shadow-lg border border-white/10">
            {firstVideo ? (
              <MediaThumb
                video={firstVideo}
                alt={title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className={`w-full h-full flex items-center justify-center ${isLiked ? 'text-[#ff0033]' : 'text-[#aaa]'}`}>
                {isLiked ? <ThumbsUp className="w-12 h-12" /> : <ListVideo className="w-12 h-12" />}
              </div>
            )}
            <div
              className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition cursor-pointer"
              onClick={() => firstVideo && openWatch(firstVideo.id)}
            >
              <div className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center shadow-xl">
                <Play className="w-6 h-6 fill-current ml-0.5" />
              </div>
            </div>
          </div>

          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {title}
            </h1>
            <p className="text-xs text-[#aaa] mt-1 font-medium">
              {isLiked
                ? t('liked.stats', { count: videos.length })
                : t('pl.stats', { count: videos.length })}
            </p>
          </div>

          {videos.length > 0 && (
            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => firstVideo && openWatch(firstVideo.id)}
                className="flex-1 bg-white hover:bg-white/90 text-black text-xs font-bold py-2.5 px-4 rounded-full flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>{t('liked.watchAll')}</span>
              </button>

              <button
                onClick={() => {
                  const random = videos[Math.floor(Math.random() * videos.length)];
                  if (random) openWatch(random.id, true);
                }}
                className="bg-[#272727] hover:bg-[#383838] text-white p-2.5 rounded-full transition cursor-pointer"
                title={t('liked.shuffle')}
              >
                <Shuffle className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 min-w-0 space-y-2">
        {videos.length > 0 ? (
          <div className="space-y-1">
            {videos.map((video, idx) => (
              <div
                key={video.id}
                onClick={() => openWatch(video.id)}
                className="flex items-center gap-4 p-2 rounded-2xl hover:bg-[#181818] transition group cursor-pointer"
              >
                <span className="w-5 text-center text-xs font-semibold text-[#888] flex-shrink-0">
                  {idx + 1}
                </span>

                <div className="relative w-36 aspect-video rounded-xl overflow-hidden bg-[#222] flex-shrink-0">
                  <MediaThumb
                    video={video}
                    alt={video.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {video.duration_string && (
                    <span className="absolute bottom-1 right-1 bg-black/85 text-white text-[10px] font-bold px-1 rounded">
                      {video.duration_string}
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-xs sm:text-sm font-semibold text-white group-hover:text-[#3ea6ff] line-clamp-2 leading-snug">
                    {video.title}
                  </h3>
                  <p className="text-xs text-[#aaa] mt-1 truncate">
                    {video.channel_title}
                  </p>
                </div>

                <button
                  onClick={(e) => handleRemove(video.id, e)}
                  className="p-2 text-[#888] hover:text-rose-400 rounded-full hover:bg-white/10 transition cursor-pointer flex-shrink-0"
                  title={isLiked ? t('liked.remove') : t('pl.removeVideo')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        ) : !isLoading && (
          <div className="py-20 text-center max-w-md mx-auto space-y-3">
            <div className="w-16 h-16 rounded-full bg-[#272727] flex items-center justify-center text-[#aaa] mx-auto">
              {isLiked ? <ThumbsUp className="w-8 h-8" /> : <ListVideo className="w-8 h-8" />}
            </div>
            <h3 className="font-bold text-base text-white">
              {isLiked ? t('liked.emptyTitle') : t('pl.emptyPlaylistTitle')}
            </h3>
            <p className="text-xs text-[#aaa]">
              {isLiked ? t('liked.emptyBody') : t('pl.emptyPlaylistBody')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
