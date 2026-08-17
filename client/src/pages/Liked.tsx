import React, { useState, useEffect } from 'react';
import { 
  ThumbsUp, 
  Play, 
  Shuffle, 
  Trash2, 
  HardDrive
} from 'lucide-react';
import type { Video } from '../types';
import { useMyTube } from '../context/MyTubeContext';

export const LikedPage: React.FC = () => {
  const { goTo, dataVersion } = useMyTube();
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadLikedVideos = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/videos?tab=liked');
      if (res.ok) {
        const data = await res.json();
        setVideos(data);
      }
    } catch (err) {
      console.error('Error fetching liked videos:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLikedVideos();
  }, [dataVersion]);

  const handleUnlike = async (videoId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/videos/${videoId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ liked: false }),
      });
      setVideos(prev => prev.filter(v => v.id !== videoId));
    } catch (err) {
      console.error('Unlike error:', err);
    }
  };

  const firstVideo = videos[0];

  return (
    <div className="flex-1 w-full px-3 sm:px-6 pt-3 pb-8 flex flex-col lg:flex-row gap-8 text-[#f1f1f1]">
      {/* Left Column: YouTube Playlist Header Card */}
      <div className="w-full lg:w-88 flex-shrink-0">
        <div className="bg-gradient-to-b from-[#2a1a1a] via-[#1c1818] to-[#121212] border border-[#272727] p-6 rounded-3xl shadow-xl lg:sticky lg:top-18 space-y-4">
          {/* Cover Thumbnail */}
          <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-[#222] shadow-lg border border-white/10">
            {firstVideo ? (
              <img
                src={firstVideo.thumbnail_url || `https://i.ytimg.com/vi/${firstVideo.id}/hqdefault.jpg`}
                alt="Couverture"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[#ff0033]">
                <ThumbsUp className="w-12 h-12" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition cursor-pointer" onClick={() => firstVideo && goTo('watch', { videoId: firstVideo.id })}>
              <div className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center shadow-xl">
                <Play className="w-6 h-6 fill-current ml-0.5" />
              </div>
            </div>
          </div>

          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Vidéos « J'aime »
            </h1>
            <p className="text-xs text-[#aaa] mt-1 font-medium">
              Bibliothèque locale • {videos.length} vidéo{videos.length > 1 ? 's' : ''}
            </p>
          </div>

          {/* Action Buttons */}
          {videos.length > 0 && (
            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => firstVideo && goTo('watch', { videoId: firstVideo.id })}
                className="flex-1 bg-white hover:bg-white/90 text-black text-xs font-bold py-2.5 px-4 rounded-full flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Tout regarder</span>
              </button>

              <button
                onClick={() => {
                  const random = videos[Math.floor(Math.random() * videos.length)];
                  if (random) goTo('watch', { videoId: random.id });
                }}
                className="bg-[#272727] hover:bg-[#383838] text-white p-2.5 rounded-full transition cursor-pointer"
                title="Lecture aléatoire"
              >
                <Shuffle className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Numbered Video List */}
      <div className="flex-1 min-w-0 space-y-2">
        {videos.length > 0 ? (
          <div className="space-y-1">
            {videos.map((video, idx) => {
              const isDownloaded = video.is_downloaded === 1;
              const thumbSrc = (isDownloaded && video.local_thumbnail_path)
                ? `/media/downloads/${encodeURIComponent(video.local_thumbnail_path).replace(/%2F/g, '/')}`
                : video.thumbnail_url || `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`;

              return (
                <div
                  key={video.id}
                  onClick={() => goTo('watch', { videoId: video.id })}
                  className="flex items-center gap-4 p-2 rounded-2xl hover:bg-[#181818] transition group cursor-pointer"
                >
                  {/* Number */}
                  <span className="w-5 text-center text-xs font-semibold text-[#888] flex-shrink-0">
                    {idx + 1}
                  </span>

                  {/* Thumbnail */}
                  <div className="relative w-36 aspect-video rounded-xl overflow-hidden bg-[#222] flex-shrink-0">
                    <img
                      src={thumbSrc}
                      alt={video.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {video.duration_string && (
                      <span className="absolute bottom-1 right-1 bg-black/85 text-white text-[10px] font-bold px-1 rounded">
                        {video.duration_string}
                      </span>
                    )}
                    {isDownloaded && (
                      <span className="absolute top-1 left-1 bg-emerald-600/90 text-white text-[9px] font-semibold px-1 rounded flex items-center gap-1">
                        <HardDrive className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs sm:text-sm font-semibold text-white group-hover:text-[#3ea6ff] line-clamp-2 leading-snug">
                      {video.title}
                    </h3>
                    <p className="text-xs text-[#aaa] mt-1 truncate">
                      {video.channel_title}
                    </p>
                  </div>

                  {/* Unlike button */}
                  <button
                    onClick={(e) => handleUnlike(video.id, e)}
                    className="p-2 text-[#888] hover:text-rose-400 rounded-full hover:bg-white/10 opacity-0 group-hover:opacity-100 transition cursor-pointer flex-shrink-0"
                    title="Retirer des vidéos J'aime"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : !isLoading && (
          <div className="py-20 text-center max-w-md mx-auto space-y-3">
            <div className="w-16 h-16 rounded-full bg-[#272727] flex items-center justify-center text-[#aaa] mx-auto">
              <ThumbsUp className="w-8 h-8" />
            </div>
            <h3 className="font-bold text-base text-white">Aucune vidéo aimée pour le moment</h3>
            <p className="text-xs text-[#aaa]">
              Cliquez sur le bouton "J'aime" sous une vidéo pour la retrouver rapidement dans cette liste.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
