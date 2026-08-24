import React, { useEffect, useState } from 'react';
import { ListVideo, Plus, ThumbsUp, Trash2 } from 'lucide-react';
import type { PlaylistSummary } from '../types';
import { useMyTube } from '../context/MyTubeContext';
import { MediaThumb } from '../components/common/MediaThumb';
import { useI18n } from '../i18n/I18nProvider';

function displayTitle(item: PlaylistSummary, t: (key: string) => string) {
  return item.id === 'liked' ? t('liked.title') : item.title;
}

export const Playlists: React.FC = () => {
  const { goTo, dataVersion, notifyDataChanged } = useMyTube();
  const { t } = useI18n();
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/playlists');
      if (res.ok) setPlaylists(await res.json());
    } catch (err) {
      console.error('Error fetching playlists:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [dataVersion]);

  const createPlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title || isSaving) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error('create failed');
      const created = (await res.json()) as PlaylistSummary;
      notifyDataChanged();
      goTo('playlists', { playlistId: created.id });
    } catch (err) {
      console.error('Create playlist error:', err);
      setIsSaving(false);
    }
  };

  const deletePlaylist = async (playlist: PlaylistSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    if (playlist.system) return;
    if (!confirm(t('pl.deleteConfirm', { title: playlist.title }))) return;
    try {
      await fetch(`/api/playlists/${encodeURIComponent(playlist.id)}`, { method: 'DELETE' });
      setPlaylists((prev) => prev.filter((item) => item.id !== playlist.id));
      notifyDataChanged();
    } catch (err) {
      console.error('Delete playlist error:', err);
    }
  };

  return (
    <div className="flex-1 w-full px-4 sm:px-6 pt-6 pb-8 space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{t('pl.title')}</h1>
          <p className="text-xs text-[#aaa] mt-1">{t('pl.subtitle')}</p>
        </div>
      </div>

      {isLoading && playlists.length === 0 ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="w-10 h-10 border-2 border-[#ff5a67] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
          {playlists.map((playlist) => (
            <div
              key={playlist.id}
              onClick={() => goTo('playlists', { playlistId: playlist.id })}
              className="text-left group cursor-pointer"
            >
              <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-[#222] shadow-md">
                {playlist.cover_video_id || playlist.cover_thumb ? (
                  <MediaThumb
                    video={{
                      id: playlist.cover_video_id || playlist.id,
                      thumbnail_url: playlist.cover_thumb,
                      local_thumbnail_path: playlist.local_thumbnail_path,
                      is_downloaded: playlist.is_downloaded,
                    }}
                    alt={displayTitle(playlist, t)}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                ) : (
                  <div className={`w-full h-full flex items-center justify-center ${
                    playlist.id === 'liked'
                      ? 'bg-gradient-to-br from-[#3d1a1a] via-[#1c1818] to-[#0c1118] text-[#ff5a67]'
                      : 'bg-gradient-to-br from-[#2a2a2a] to-[#0c1118] text-[#aaa]'
                  }`}>
                    {playlist.id === 'liked' ? <ThumbsUp className="w-10 h-10" /> : <ListVideo className="w-10 h-10" />}
                  </div>
                )}
                <div className="absolute inset-y-0 right-0 w-[28%] bg-black/65 backdrop-blur-[2px] flex flex-col items-center justify-center text-white">
                  <ListVideo className="w-5 h-5 mb-1" />
                  <span className="text-sm font-bold tabular-nums">{playlist.video_count}</span>
                </div>
                {playlist.id === 'liked' && (
                  <span className="absolute top-2 left-2 w-8 h-8 rounded-full bg-black/70 border border-white/10 flex items-center justify-center text-[#73c7e8]">
                    <ThumbsUp className="w-3.5 h-3.5 fill-current" />
                  </span>
                )}
                {!playlist.system && (
                  <button
                    type="button"
                    onClick={(e) => deletePlaylist(playlist, e)}
                    className="absolute top-2 left-2 p-1.5 rounded-full bg-black/70 text-[#aaa] hover:text-rose-400 opacity-0 group-hover:opacity-100 transition cursor-pointer"
                    title={t('common.delete')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <h3 className="mt-3 text-sm font-semibold text-[#f4f7fb] group-hover:text-white line-clamp-2 leading-snug">
                {displayTitle(playlist, t)}
              </h3>
              <p className="text-xs text-[#aaa] mt-1">{t('pl.videoCount', { count: playlist.video_count })}</p>
            </div>
          ))}

          <div className="text-left">
            {creating ? (
              <form
                onSubmit={createPlaylist}
                className="w-full aspect-video rounded-xl border border-white/15 bg-[#0f151d] p-4 flex flex-col justify-center gap-3"
              >
                <input
                  autoFocus
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  maxLength={80}
                  placeholder={t('pl.namePlaceholder')}
                  className="w-full bg-[#0c1118] border border-[#23303e] rounded-full px-3.5 py-2 text-sm text-white placeholder:text-[#657383] outline-none focus:border-white/40"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={!newTitle.trim() || isSaving}
                    className="flex-1 bg-white text-black text-xs font-bold py-2 rounded-full disabled:opacity-40 cursor-pointer"
                  >
                    {isSaving ? t('common.saving') : t('pl.createAction')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCreating(false);
                      setNewTitle('');
                    }}
                    className="px-3 py-2 rounded-full bg-[#18212c] text-xs font-semibold text-[#aaa] hover:text-white cursor-pointer"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="w-full aspect-video rounded-xl border border-dashed border-white/20 hover:border-white/40 bg-[#0f151d]/60 hover:bg-[#16202a] flex flex-col items-center justify-center gap-2 text-[#aaa] hover:text-white transition cursor-pointer"
              >
                <span className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center">
                  <Plus className="w-5 h-5" />
                </span>
                <span className="text-sm font-semibold">{t('pl.newPlaylist')}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
