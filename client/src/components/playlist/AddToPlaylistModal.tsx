import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ListPlus, Loader2, Plus, ThumbsUp, X } from 'lucide-react';
import type { PlaylistSummary } from '../../types';
import { MediaThumb } from '../common/MediaThumb';
import { useI18n } from '../../i18n/I18nProvider';
import { useMyTube } from '../../context/MyTubeContext';

interface AddToPlaylistModalProps {
  open: boolean;
  videoId: string;
  onClose: () => void;
  onLikedChange?: (liked: boolean) => void;
}

function playlistTitle(item: PlaylistSummary, t: (key: string) => string) {
  return item.id === 'liked' ? t('liked.title') : item.title;
}

export const AddToPlaylistModal: React.FC<AddToPlaylistModalProps> = ({
  open,
  videoId,
  onClose,
  onLikedChange,
}) => {
  const { t } = useI18n();
  const { notifyDataChanged } = useMyTube();
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/playlists?contains=${encodeURIComponent(videoId)}`);
      if (res.ok) setPlaylists(await res.json());
    } catch (err) {
      console.error('Error loading playlists:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !videoId) return;
    setCreating(false);
    setNewTitle('');
    void load();
  }, [open, videoId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isCreating) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, isCreating, onClose]);

  if (!open) return null;

  const toggle = async (playlist: PlaylistSummary) => {
    if (busyId) return;
    setBusyId(playlist.id);
    const nextContains = !playlist.contains;
    try {
      const res = await fetch(
        nextContains
          ? `/api/playlists/${encodeURIComponent(playlist.id)}/videos`
          : `/api/playlists/${encodeURIComponent(playlist.id)}/videos/${encodeURIComponent(videoId)}`,
        {
          method: nextContains ? 'POST' : 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: nextContains ? JSON.stringify({ videoId }) : undefined,
        },
      );
      if (!res.ok) throw new Error('toggle failed');
      setPlaylists((prev) =>
        prev.map((item) =>
          item.id === playlist.id
            ? {
                ...item,
                contains: nextContains,
                video_count: Math.max(0, item.video_count + (nextContains ? 1 : -1)),
              }
            : item,
        ),
      );
      if (playlist.id === 'liked') onLikedChange?.(nextContains);
      notifyDataChanged();
    } catch (err) {
      console.error('Playlist toggle error:', err);
    } finally {
      setBusyId(null);
    }
  };

  const createAndAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title || isCreating) return;
    setIsCreating(true);
    try {
      const created = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      if (!created.ok) throw new Error('create failed');
      const playlist = (await created.json()) as PlaylistSummary;
      await fetch(`/api/playlists/${encodeURIComponent(playlist.id)}/videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId }),
      });
      setCreating(false);
      setNewTitle('');
      notifyDataChanged();
      await load();
    } catch (err) {
      console.error('Create playlist error:', err);
    } finally {
      setIsCreating(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isCreating) onClose();
      }}
    >
      <div
        className="w-full max-w-md bg-[#111821] border border-[#23303e] rounded-3xl shadow-2xl overflow-hidden text-[#f4f7fb]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#24303d]">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">{t('pl.saveTo')}</h3>
            <p className="text-xs text-[#aaa] mt-0.5">{t('pl.saveToHint')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 text-[#aaa] hover:text-white flex items-center justify-center transition cursor-pointer"
            title={t('common.close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[min(60vh,420px)] overflow-y-auto px-2 py-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-[#aaa]">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : (
            playlists.map((playlist) => {
              const inList = !!playlist.contains;
              return (
                <button
                  key={playlist.id}
                  type="button"
                  onClick={() => toggle(playlist)}
                  disabled={busyId === playlist.id}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-white/5 transition cursor-pointer text-left disabled:opacity-60"
                >
                  <div className="relative w-16 aspect-video rounded-lg overflow-hidden bg-[#0c1118] flex-shrink-0">
                    {playlist.cover_video_id || playlist.cover_thumb ? (
                      <MediaThumb
                        video={{
                          id: playlist.cover_video_id || playlist.id,
                          thumbnail_url: playlist.cover_thumb,
                          local_thumbnail_path: playlist.local_thumbnail_path,
                          is_downloaded: playlist.is_downloaded,
                        }}
                        alt={playlistTitle(playlist, t)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#888]">
                        {playlist.id === 'liked' ? <ThumbsUp className="w-4 h-4" /> : <ListPlus className="w-4 h-4" />}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{playlistTitle(playlist, t)}</p>
                    <p className="text-[11px] text-[#aaa] mt-0.5">
                      {t('pl.videoCount', { count: playlist.video_count })}
                    </p>
                  </div>
                  <span
                    className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 ${
                      inList ? 'bg-white border-white text-black' : 'border-[#657383] text-transparent'
                    }`}
                  >
                    {busyId === playlist.id ? (
                      <Loader2 className="w-3 h-3 animate-spin text-current" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="border-t border-[#24303d] px-4 py-3">
          {creating ? (
            <form onSubmit={createAndAdd} className="flex items-center gap-2">
              <input
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                maxLength={80}
                placeholder={t('pl.namePlaceholder')}
                className="flex-1 min-w-0 bg-[#0f151d] border border-[#23303e] rounded-full px-3.5 py-2 text-sm text-white placeholder:text-[#657383] outline-none focus:border-white/40"
              />
              <button
                type="submit"
                disabled={!newTitle.trim() || isCreating}
                className="px-3.5 py-2 rounded-full bg-white text-black text-xs font-bold disabled:opacity-40 cursor-pointer"
              >
                {isCreating ? t('common.saving') : t('pl.createAction')}
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl text-sm font-semibold text-white hover:bg-white/5 transition cursor-pointer"
            >
              <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                <Plus className="w-4 h-4" />
              </span>
              {t('pl.newPlaylist')}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};
