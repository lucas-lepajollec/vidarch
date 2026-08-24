import React, { useState, useRef } from 'react';
import { 
  Play, 
  Download, 
  MoreVertical, 
  Trash2, 
  ExternalLink,
  ListPlus
} from 'lucide-react';
import type { Video } from '../../types';
import { useVidArch } from '../../context/VidArchContext';
import { formatViews, formatUploadDate, formatFileSize } from '../../utils/format';
import { MediaThumb } from '../common/MediaThumb';
import { ChannelAvatar } from '../common/ChannelAvatar';
import { useI18n } from '../../i18n/I18nProvider';
import { AnchoredPopover } from '../common/AnchoredPopover';
import { AddToPlaylistModal } from '../playlist/AddToPlaylistModal';

interface VideoCardProps {
  video: Video;
  layout?: 'grid' | 'horizontal';
  onDelete?: () => void;
  showFileSize?: boolean;
  hideProgress?: boolean;
  hideMeta?: boolean;
}

export const VideoCard: React.FC<VideoCardProps> = ({
  video,
  layout = 'grid',
  onDelete,
  showFileSize = false,
  hideProgress = false,
  hideMeta = false,
}) => {
  const { goTo, openDownloadModal, localOnly } = useVidArch();
  const { t, locale } = useI18n();
  const [showMenu, setShowMenu] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  const isDownloaded = video.is_downloaded === 1;
  const sizeLabel = showFileSize && isDownloaded ? formatFileSize(video.file_size, locale) : '';

  const handleCardClick = () => {
    goTo('watch', { videoId: video.id });
  };

  const handleDownloadClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    openDownloadModal({
      videoId: video.id,
      url: `https://www.youtube.com/watch?v=${video.id}`,
      title: video.title,
      channelTitle: video.channel_title,
      channelId: video.channel_id,
      thumbnailUrl: video.thumbnail_url,
      durationString: video.duration_string,
    });
  };

  const handleDeleteClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(t('card.deleteConfirm', { title: video.title }))) return;
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

  const handleAddToPlaylist = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    setShowPlaylistModal(true);
  };

  const playlistMenuItem = (
    <button
      onClick={handleAddToPlaylist}
      className="va-menu-item"
    >
      <ListPlus className="va-menu-icon" />
      <span>{t('card.addToPlaylist')}</span>
    </button>
  );

  const playlistModal = (
    <AddToPlaylistModal
      open={showPlaylistModal}
      videoId={video.id}
      onClose={() => setShowPlaylistModal(false)}
    />
  );
  const progressPercent = video.duration && video.watch_progress
    ? Math.min(100, Math.round((video.watch_progress / video.duration) * 100))
    : 0;

  if (layout === 'horizontal') {
    // Horizontal row card (for related sidebar in Watch page or compact list)
    return (
      <>
      <div 
        onClick={handleCardClick}
        className="va-video-card flex gap-3.5 group cursor-pointer hover:bg-white/5 p-1.5 rounded-xl transition"
      >
        <div className="va-thumb relative w-52 aspect-video rounded-xl overflow-hidden bg-[#222] flex-shrink-0">
          <MediaThumb
            video={video}
            alt={video.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200 ease-out"
          />
          {video.duration_string && (
            <span className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
              {video.duration_string}
            </span>
          )}
          {sizeLabel ? (
            <span className="va-state-badge is-local absolute top-1.5 left-1.5">
              {sizeLabel}
            </span>
          ) : !localOnly && !isDownloaded ? (
            <span className="va-state-badge is-online absolute top-1.5 left-1.5">
              {t('card.online')}
            </span>
          ) : null}
        </div>
        <div className="flex-1 min-w-0 flex items-start gap-1">
        <div className="flex-1 min-w-0 flex flex-col justify-start">
          <h4 className="text-[13px] font-semibold text-[#f4f7fb] group-hover:text-white line-clamp-2 leading-snug">
            {video.title}
          </h4>
          <p className="text-xs text-[#aaa] mt-1 hover:text-[#f4f7fb] truncate">
            {video.channel_title}
          </p>
          {!hideMeta && (
            <div className="text-[11px] text-[#657383] mt-0.5 flex items-center gap-1.5">
              {video.view_count !== undefined && video.view_count !== null && (
                <>
                  <span>{formatViews(video.view_count, locale)}</span>
                  {video.upload_date && <span>•</span>}
                </>
              )}
              {video.upload_date && <span>{formatUploadDate(video.upload_date, locale)}</span>}
            </div>
          )}
        </div>
        <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            ref={menuBtnRef}
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-1 text-[#ccc] hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer flex-shrink-0"
            title={t('card.options')}
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          <AnchoredPopover
            open={showMenu}
            onClose={() => setShowMenu(false)}
            anchorRef={menuBtnRef}
            align="end"
            preferredSide="top"
            className="w-52"
          >
              {playlistMenuItem}
              {!isDownloaded && !localOnly ? (
                <button
                  onClick={handleDownloadClick}
                  className="va-menu-item"
                >
                  <Download className="va-menu-icon" />
                  <span>{t('card.download')}</span>
                </button>
              ) : isDownloaded ? (
                <button
                  onClick={handleDeleteClick}
                  disabled={isDeleting}
                  className="va-menu-item is-danger"
                >
                  <Trash2 className="va-menu-icon" />
                  <span>{isDeleting ? t('card.deleting') : t('card.delete')}</span>
                </button>
              ) : null}
              {!localOnly && (
              <a
                href={(video as any).url || `https://www.youtube.com/watch?v=${video.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="va-menu-item"
              >
                <ExternalLink className="va-menu-icon" />
                <span>{t('card.openYoutube')}</span>
              </a>
              )}
          </AnchoredPopover>
        </div>
        </div>
      </div>
      {playlistModal}
      </>
    );
  }

  return (
    <div className="va-video-card flex flex-col group cursor-pointer">
      {/* 16:9 Thumbnail Box */}
      <div 
        onClick={handleCardClick}
        className="va-thumb relative w-full aspect-video rounded-xl overflow-hidden bg-[#222] shadow-md transition duration-200"
      >
        <MediaThumb
          video={video}
          alt={video.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200 ease-out"
        />

        {/* Duration pill */}
        {video.duration_string && (
          <span className="absolute bottom-2 right-2 bg-black/85 text-white text-xs font-bold px-1.5 py-0.5 rounded tracking-wide backdrop-blur-xs">
            {video.duration_string}
          </span>
        )}

        {sizeLabel ? (
          <span className="va-state-badge is-local absolute top-1.5 left-1.5">
            {sizeLabel}
          </span>
        ) : !localOnly && !isDownloaded ? (
          <span className="va-state-badge is-online absolute top-1.5 left-1.5">
            {t('card.online')}
          </span>
        ) : null}

        {/* Hover Quick Action overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 pointer-events-none">
          <div className="bg-[#ff5a67] text-white p-3 rounded-[12px_12px_7px_12px] transform group-hover:scale-110 transition shadow-xl shadow-[#bd3448]/25">
            <Play className="w-5 h-5 fill-current ml-0.5" />
          </div>
        </div>

        {/* Watch Progress red bar */}
        {!hideProgress && progressPercent > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
            <div 
              className="h-full bg-[#ff5a67]"
              style={{ width: `${progressPercent}%` }} 
            />
          </div>
        )}
      </div>

      {/* Info Row */}
      <div className="flex gap-3 mt-3 px-0.5 items-start">
        {/* Channel Avatar */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (video.channel_id) goTo('channel', { channelId: video.channel_id });
          }}
          className="flex-shrink-0 self-start hover:ring-2 hover:ring-white/20 rounded-full transition cursor-pointer"
        >
          <ChannelAvatar channelId={video.channel_id} url={video.channel_avatar} title={video.channel_title} />
        </button>

        {/* Title & Metadata */}
        <div className="flex-1 min-w-0" onClick={handleCardClick}>
          <h3 className="text-sm font-semibold text-[#f4f7fb] group-hover:text-white line-clamp-2 leading-snug">
            {video.title}
          </h3>
          <p 
            onClick={(e) => {
              e.stopPropagation();
              if (video.channel_id) goTo('channel', { channelId: video.channel_id });
            }}
            className="text-xs text-[#aaa] hover:text-[#f4f7fb] mt-1 truncate transition"
          >
            {video.channel_title}
          </p>
          {!hideMeta && (
          <div className="text-xs text-[#657383] mt-0.5 flex flex-wrap items-center gap-1.5">
            {video.view_count !== undefined && video.view_count !== null && (
              <>
                <span>{formatViews(video.view_count, locale)}</span>
                {video.upload_date && <span>•</span>}
              </>
            )}
            {video.upload_date && <span>{formatUploadDate(video.upload_date, locale)}</span>}
          </div>
          )}
        </div>

        {/* Context Menu (3 dots) */}
        <div className="relative flex-shrink-0">
          <button
            ref={menuBtnRef}
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-1.5 text-[#ccc] hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer flex-shrink-0"
            title={t('card.options')}
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          <AnchoredPopover
            open={showMenu}
            onClose={() => setShowMenu(false)}
            anchorRef={menuBtnRef}
            align="end"
            preferredSide="bottom"
            className="w-52"
          >
              {playlistMenuItem}
              {!isDownloaded && !localOnly ? (
                <button
                  onClick={handleDownloadClick}
                  className="va-menu-item"
                >
                  <Download className="va-menu-icon" />
                  <span>{t('card.download')}</span>
                </button>
              ) : isDownloaded ? (
                <button
                  onClick={handleDeleteClick}
                  disabled={isDeleting}
                  className="va-menu-item is-danger"
                >
                  <Trash2 className="va-menu-icon" />
                  <span>{isDeleting ? t('card.deleting') : t('card.delete')}</span>
                </button>
              ) : null}

              {!localOnly && (
              <a
                href={(video as any).url || `https://www.youtube.com/watch?v=${video.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="va-menu-item"
              >
                <ExternalLink className="va-menu-icon" />
                <span>{t('card.openYoutube')}</span>
              </a>
              )}
          </AnchoredPopover>
        </div>
      </div>
      {playlistModal}
    </div>
  );
};
