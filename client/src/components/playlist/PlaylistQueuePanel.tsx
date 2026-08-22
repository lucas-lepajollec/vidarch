import React, { useEffect, useRef } from 'react';
import { ListVideo, Repeat, Shuffle, ThumbsUp, X } from 'lucide-react';
import type { PlaylistSummary, Video } from '../../types';
import { MediaThumb } from '../common/MediaThumb';
import { useI18n } from '../../i18n/I18nProvider';

interface PlaylistQueuePanelProps {
  playlist: PlaylistSummary;
  videos: Video[];
  currentId: string;
  shuffle: boolean;
  loop: boolean;
  maxHeight?: number;
  fill?: boolean;
  onPlay: (videoId: string) => void;
  onToggleShuffle: () => void;
  onToggleLoop: () => void;
  onClose: () => void;
}

export const PlaylistQueuePanel: React.FC<PlaylistQueuePanelProps> = ({
  playlist,
  videos,
  currentId,
  shuffle,
  loop,
  maxHeight,
  fill = false,
  onPlay,
  onToggleShuffle,
  onToggleLoop,
  onClose,
}) => {
  const { t } = useI18n();
  const activeRef = useRef<HTMLButtonElement>(null);
  const index = Math.max(1, videos.findIndex((item) => item.id === currentId) + 1);
  const title = playlist.id === 'liked' ? t('liked.title') : playlist.title;

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [currentId]);

  return (
    <div
      className={`w-full flex flex-col rounded-2xl border border-[#272727] bg-[#181818] overflow-hidden ${
        fill ? 'h-full rounded-none border-0 border-l' : ''
      }`}
      style={!fill && maxHeight ? { maxHeight } : undefined}
    >
      <div className="flex-shrink-0 px-3 pt-2.5 pb-2 border-b border-[#303030]">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{title}</p>
            <p className="text-[11px] text-[#aaa] mt-0.5 tabular-nums">
              {t('pl.queueCount', { current: index, total: videos.length })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-[#aaa] hover:text-white hover:bg-white/10 transition cursor-pointer"
            title={t('pl.closeQueue')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-1 mt-1.5">
          <button
            type="button"
            onClick={onToggleShuffle}
            className={`p-1.5 rounded-full transition cursor-pointer ${
              shuffle ? 'text-white bg-white/15' : 'text-[#aaa] hover:text-white hover:bg-white/10'
            }`}
            title={t('liked.shuffle')}
          >
            <Shuffle className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onToggleLoop}
            className={`p-1.5 rounded-full transition cursor-pointer ${
              loop ? 'text-white bg-white/15' : 'text-[#aaa] hover:text-white hover:bg-white/10'
            }`}
            title={t('pl.loop')}
          >
            <Repeat className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className={`${fill ? 'flex-1 min-h-0' : ''} overflow-y-auto`}>
        {videos.map((item, idx) => {
          const active = item.id === currentId;
          return (
            <button
              key={item.id}
              ref={active ? activeRef : undefined}
              type="button"
              onClick={() => onPlay(item.id)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 text-left transition cursor-pointer ${
                active ? 'bg-white/10' : 'hover:bg-white/5'
              }`}
            >
              <span className={`w-4 text-center text-[10px] tabular-nums flex-shrink-0 ${
                active ? 'text-white font-semibold' : 'text-[#717171]'
              }`}>
                {idx + 1}
              </span>
              <div className="relative w-28 aspect-video rounded-lg overflow-hidden bg-[#222] flex-shrink-0">
                {item.thumbnail_url || item.local_thumbnail_path ? (
                  <MediaThumb
                    video={item}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#666]">
                    {playlist.id === 'liked' ? <ThumbsUp className="w-4 h-4" /> : <ListVideo className="w-4 h-4" />}
                  </div>
                )}
                {item.duration_string && (
                  <span className="absolute bottom-0.5 right-0.5 bg-black/85 text-white text-[9px] font-bold px-1 rounded">
                    {item.duration_string}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-semibold line-clamp-2 leading-snug ${
                  active ? 'text-white' : 'text-[#f1f1f1]'
                }`}>
                  {item.title}
                </p>
                <p className="text-[11px] text-[#aaa] mt-0.5 truncate">{item.channel_title}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
