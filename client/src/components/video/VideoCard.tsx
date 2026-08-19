import React, { useState, useRef, useEffect } from 'react';
import { 
  Play, 
  Download, 
  MoreVertical, 
  Trash2, 
  ExternalLink,
  HardDrive
} from 'lucide-react';
import type { Video } from '../../types';
import { useVidArch } from '../../context/VidArchContext';
import { formatViews } from '../../utils/format';

interface VideoCardProps {
  video: Video;
  layout?: 'grid' | 'horizontal';
  onDelete?: () => void;
}

export const VideoCard: React.FC<VideoCardProps> = ({ video, layout = 'grid', onDelete }) => {
  const { goTo, openDownloadModal, subscriptions } = useVidArch();
  const [showMenu, setShowMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const isDownloaded = video.is_downloaded === 1;
  const channel = subscriptions.find(s => s.id === video.channel_id);

  // Compute thumbnail src (local media path if downloaded and exists, else web thumbnail_url)
  const initialThumb = (isDownloaded && video.local_thumbnail_path)
    ? `/media/downloads/${encodeURIComponent(video.local_thumbnail_path).replace(/%2F/g, '/')}`
    : video.thumbnail_url || `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`;

  const [currentThumb, setCurrentThumb] = useState(initialThumb);
  const [fallbackStep, setFallbackStep] = useState(0);

  useEffect(() => {
    setCurrentThumb(initialThumb);
    setFallbackStep(0);
  }, [initialThumb, video.id]);

  const handleImageError = () => {
    if (fallbackStep === 0) {
      // 1st fallback: hqdefault.jpg (always exists on YouTube CDN for all videos)
      setFallbackStep(1);
      setCurrentThumb(`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`);
    } else if (fallbackStep === 1) {
      // 2nd fallback: mqdefault.jpg
      setFallbackStep(2);
      setCurrentThumb(`https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`);
    } else if (fallbackStep === 2) {
      // 3rd fallback: 0.jpg
      setFallbackStep(3);
      setCurrentThumb(`https://i.ytimg.com/vi/${video.id}/0.jpg`);
    }
  };

  const handleCardClick = () => {
    goTo('watch', { videoId: video.id });
  };

  const handleDownloadClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    openDownloadModal({
      videoId: video.id,
      title: video.title,
      channelTitle: video.channel_title,
      channelId: video.channel_id,
      thumbnailUrl: currentThumb || video.thumbnail_url,
      durationString: video.duration_string,
    });
  };

  const handleDeleteClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Supprimer le fichier local de "${video.title}" ?`)) return;
    setIsDeleting(true);
    try {
      await fetch(`/api/videos/${video.id}`, { method: 'DELETE' });
      if (onDelete) onDelete();
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setIsDeleting(false);
      setShowMenu(false);
    }
  };

  // Watch progress percentage
  const progressPercent = video.duration && video.watch_progress
    ? Math.min(100, Math.round((video.watch_progress / video.duration) * 100))
    : 0;

  if (layout === 'horizontal') {
    // Horizontal row card (for related sidebar in Watch page or compact list)
    return (
      <div 
        onClick={handleCardClick}
        className="flex gap-3 group cursor-pointer hover:bg-white/5 p-1.5 rounded-xl transition"
      >
        <div className="relative w-40 aspect-video rounded-lg overflow-hidden bg-[#222] flex-shrink-0">
          <img
            src={currentThumb}
            alt={video.title}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={handleImageError}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          {video.duration_string && (
            <span className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
              {video.duration_string}
            </span>
          )}
          {isDownloaded && (
            <span className="absolute top-1.5 left-1.5 bg-emerald-600/90 text-white text-[9px] font-semibold px-1 py-0.5 rounded flex items-center gap-1 shadow">
              <HardDrive className="w-2.5 h-2.5" />
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-start">
          <h4 className="text-xs font-semibold text-[#f1f1f1] group-hover:text-white line-clamp-2 leading-snug">
            {video.title}
          </h4>
          <p className="text-[11px] text-[#aaa] mt-1 hover:text-[#f1f1f1] truncate">
            {video.channel_title}
          </p>
          <div className="text-[10px] text-[#717171] mt-0.5 flex items-center gap-1.5">
            {video.view_count !== undefined && video.view_count !== null && (
              <>
                <span>{formatViews(video.view_count)}</span>
                {video.upload_date && <span>•</span>}
              </>
            )}
            {video.upload_date && <span>{video.upload_date}</span>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col group cursor-pointer">
      {/* 16:9 Thumbnail Box */}
      <div 
        onClick={handleCardClick}
        className="relative w-full aspect-video rounded-xl overflow-hidden bg-[#222] shadow-md border border-white/5 group-hover:border-white/20 transition duration-200"
      >
        <img
          src={currentThumb}
          alt={video.title}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={handleImageError}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />

        {/* Duration pill */}
        {video.duration_string && (
          <span className="absolute bottom-2 right-2 bg-black/85 text-white text-xs font-bold px-1.5 py-0.5 rounded tracking-wide backdrop-blur-xs">
            {video.duration_string}
          </span>
        )}

        {/* Storage status pill */}
        <div className="absolute top-2 left-2 flex items-center gap-1">
          {isDownloaded ? (
            <span className="bg-emerald-500/90 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-lg">
              <HardDrive className="w-3 h-3" />
              <span>Stocké</span>
            </span>
          ) : (
            <span className="bg-black/70 backdrop-blur-md text-[#aaa] text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
              <span>En ligne</span>
            </span>
          )}
        </div>

        {/* Hover Quick Action overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 pointer-events-none">
          <div className="bg-white/90 text-black p-3 rounded-full transform group-hover:scale-110 transition shadow-xl">
            <Play className="w-5 h-5 fill-current ml-0.5" />
          </div>
        </div>

        {/* Watch Progress red bar */}
        {progressPercent > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
            <div 
              className="h-full bg-[#ff0033]" 
              style={{ width: `${progressPercent}%` }} 
            />
          </div>
        )}
      </div>

      {/* Info Row */}
      <div className="flex gap-3 mt-3 px-0.5">
        {/* Channel Avatar */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (video.channel_id) goTo('channel', { channelId: video.channel_id });
          }}
          className="w-9 h-9 rounded-full overflow-hidden bg-[#333] flex-shrink-0 flex items-center justify-center hover:ring-2 hover:ring-white/20 transition cursor-pointer"
        >
          {(channel?.avatar_url || (video as any).channel_avatar) ? (
            <img 
              src={channel?.avatar_url || (video as any).channel_avatar} 
              alt={video.channel_title} 
              loading="lazy"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover" 
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-tr from-[#333] to-[#555] flex items-center justify-center text-white font-bold text-xs">
              {video.channel_title ? video.channel_title.charAt(0).toUpperCase() : 'Y'}
            </div>
          )}
        </button>

        {/* Title & Metadata */}
        <div className="flex-1 min-w-0" onClick={handleCardClick}>
          <h3 className="text-sm font-semibold text-[#f1f1f1] group-hover:text-white line-clamp-2 leading-snug">
            {video.title}
          </h3>
          <p 
            onClick={(e) => {
              e.stopPropagation();
              if (video.channel_id) goTo('channel', { channelId: video.channel_id });
            }}
            className="text-xs text-[#aaa] hover:text-[#f1f1f1] mt-1 truncate transition"
          >
            {video.channel_title}
          </p>
          <div className="text-xs text-[#717171] mt-0.5 flex flex-wrap items-center gap-1.5">
            {video.view_count !== undefined && video.view_count !== null && (
              <>
                <span>{formatViews(video.view_count)}</span>
                {video.upload_date && <span>•</span>}
              </>
            )}
            {video.upload_date && <span>{video.upload_date}</span>}
          </div>
        </div>

        {/* Context Menu (3 dots) */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-1.5 text-[#aaa] hover:text-white rounded-full hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            title="Options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showMenu && (
            <div 
              className="absolute right-0 bottom-full sm:bottom-auto sm:top-full mb-2 sm:mb-0 sm:mt-1 w-52 bg-[#212121] border border-[#303030] rounded-xl shadow-2xl py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100"
              onClick={(e) => e.stopPropagation()}
            >
              {!isDownloaded ? (
                <button
                  onClick={handleDownloadClick}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-[#f1f1f1] hover:bg-[#333] transition cursor-pointer text-left"
                >
                  <Download className="w-4 h-4 text-[#ff0033]" />
                  <span>Télécharger la vidéo</span>
                </button>
              ) : (
                <button
                  onClick={handleDeleteClick}
                  disabled={isDeleting}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-rose-400 hover:bg-rose-500/10 transition cursor-pointer text-left disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{isDeleting ? 'Suppression...' : 'Supprimer le fichier'}</span>
                </button>
              )}

              <a
                href={(video as any).url || `https://www.youtube.com/watch?v=${video.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-[#aaa] hover:text-white hover:bg-[#333] transition cursor-pointer"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Ouvrir sur YouTube</span>
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
