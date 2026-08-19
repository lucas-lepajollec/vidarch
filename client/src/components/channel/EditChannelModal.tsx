import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, Check, AlertCircle, Sparkles } from 'lucide-react';
import { useMyTube } from '../../context/MyTubeContext';
import { ImageUploadField } from './ImageUploadField';
import { useI18n } from '../../i18n/I18nProvider';

export const EditChannelModal: React.FC = () => {
  const { 
    isEditChannelModalOpen, 
    closeEditChannelModal, 
    editingChannel, 
    refreshMyChannel, 
    refreshSubscriptions, 
    notifyDataChanged 
  } = useMyTube();
  const { t } = useI18n();

  const [title, setTitle] = useState('');
  const [handle, setHandle] = useState('');
  const [description, setDescription] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingChannel) {
      setTitle(editingChannel.title || '');
      setHandle(editingChannel.handle || '');
      setDescription(editingChannel.description || '');
      setAvatarUrl(editingChannel.avatar_url || '');
      setBannerUrl(editingChannel.banner_url || '');
      setError(null);
    }
  }, [editingChannel]);

  if (!isEditChannelModalOpen || !editingChannel) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/channels/${editingChannel.id}/customize`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          handle: handle.trim(),
          description: description.trim(),
          avatarUrl: avatarUrl.trim(),
          bannerUrl: bannerUrl.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        await refreshMyChannel();
        await refreshSubscriptions();
        notifyDataChanged();
        closeEditChannelModal();
      } else {
        setError(data.error || t('edit.updateError'));
      }
    } catch (err: any) {
      setError(err.message || t('common.networkError'));
    } finally {
      setIsSaving(false);
    }
  };

  return createPortal(
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-300"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSaving) closeEditChannelModal();
      }}
    >
      <div className="w-full max-w-lg bg-[#212121] border border-[#383838] rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-[#f1f1f1]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#303030]">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              {t('edit.title')}
            </h2>
            <p className="text-xs text-[#aaa] mt-0.5">
              {t('edit.subtitle')}
            </p>
          </div>
          <button
            onClick={closeEditChannelModal}
            className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 text-[#aaa] hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-white mb-1.5">
              {t('edit.name')}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full bg-[#121212] border border-[#383838] focus:border-white text-white text-xs rounded-xl px-4 py-3 outline-none transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-white mb-1.5">
              {t('edit.handle')}
            </label>
            <input
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              className="w-full bg-[#121212] border border-[#383838] focus:border-white text-white text-xs rounded-xl px-4 py-3 outline-none transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-white mb-1.5">
              {t('edit.bio')}
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-[#121212] border border-[#383838] focus:border-white text-white text-xs rounded-xl p-3.5 outline-none transition"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <ImageUploadField
              label={t('edit.avatar')}
              value={avatarUrl}
              onChange={setAvatarUrl}
              type="avatar"
              placeholderUrl="https://.../avatar.png"
            />

            <ImageUploadField
              label={t('edit.banner')}
              value={bannerUrl}
              onChange={setBannerUrl}
              type="banner"
              placeholderUrl="https://.../banner.jpg"
            />
          </div>

          {error && (
            <div className="p-3.5 bg-red-500/10 text-red-400 text-xs rounded-2xl flex items-center gap-2 border border-red-500/20">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-[#303030]">
            <button
              type="button"
              onClick={closeEditChannelModal}
              className="px-5 py-2.5 rounded-full text-xs font-semibold text-[#aaa] hover:text-white hover:bg-white/5 transition"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSaving || !title.trim()}
              className="bg-white hover:bg-white/90 text-black text-xs font-bold px-6 py-2.5 rounded-full transition cursor-pointer disabled:opacity-40 flex items-center gap-2 shadow"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>{t('common.save')}</span>
            </button>
          </div>
        </form>

      </div>
    </div>,
    document.body
  );
};
