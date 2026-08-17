import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Sparkles, 
  Link, 
  Loader2, 
  Check, 
  AlertCircle, 
  User,
  Tv2
} from 'lucide-react';
import { useMyTube } from '../../context/MyTubeContext';
import { ImageUploadField } from './ImageUploadField';

export const MyChannelModal: React.FC = () => {
  const { 
    isCreateChannelModalOpen, 
    closeCreateChannelModal, 
    refreshMyChannel, 
    refreshSubscriptions, 
    notifyDataChanged,
    goTo 
  } = useMyTube();

  const [activeTab, setActiveTab] = useState<'create' | 'import'>('create');

  // Create state
  const [title, setTitle] = useState('');
  const [handle, setHandle] = useState('');
  const [description, setDescription] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Import / Claim state
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isSubmittingImport, setIsSubmittingImport] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    if (isCreateChannelModalOpen) {
      setTitle('');
      setHandle('');
      setDescription('');
      setAvatarUrl('');
      setBannerUrl('');
      setYoutubeUrl('');
      setCreateError(null);
      setImportError(null);
    }
  }, [isCreateChannelModalOpen]);

  if (!isCreateChannelModalOpen) return null;

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmittingCreate(true);
    setCreateError(null);

    try {
      const res = await fetch('/api/channels/create-my-channel', {
        method: 'POST',
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
      if (res.ok && data.success && data.channel) {
        await refreshMyChannel();
        await refreshSubscriptions();
        notifyDataChanged();
        closeCreateChannelModal();
        goTo('channel', { channelId: data.channel.id });
      } else {
        setCreateError(data.error || 'Erreur lors de la création');
      }
    } catch (err: any) {
      setCreateError(err.message || 'Erreur réseau');
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeUrl.trim()) return;

    setIsSubmittingImport(true);
    setImportError(null);

    try {
      const res = await fetch('/api/channels/claim-my-channel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: youtubeUrl.trim() }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.channel) {
        await refreshMyChannel();
        await refreshSubscriptions();
        notifyDataChanged();
        closeCreateChannelModal();
        goTo('channel', { channelId: data.channel.id });
      } else {
        setImportError(data.error || 'Chaîne YouTube introuvable');
      }
    } catch (err: any) {
      setImportError(err.message || 'Erreur réseau');
    } finally {
      setIsSubmittingImport(false);
    }
  };

  return createPortal(
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmittingCreate && !isSubmittingImport) closeCreateChannelModal();
      }}
    >
      <div className="w-full max-w-lg bg-[#212121] border border-[#383838] rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-[#f1f1f1]">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#303030]">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Votre Espace Chaîne
            </h2>
            <p className="text-xs text-[#aaa] mt-0.5">
              Créez votre chaîne personnalisée ou synchronisez votre chaîne YouTube officielle
            </p>
          </div>
          <button
            onClick={closeCreateChannelModal}
            className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 text-[#aaa] hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher (Pill Style) */}
        <div className="px-6 pt-4 pb-2">
          <div className="flex items-center p-1 bg-[#141414] border border-[#303030] rounded-2xl gap-1">
            <button
              onClick={() => setActiveTab('create')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'create'
                  ? 'bg-[#2a2a2a] text-white shadow font-bold'
                  : 'text-[#aaa] hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Créer une chaîne</span>
            </button>

            <button
              onClick={() => setActiveTab('import')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'import'
                  ? 'bg-[#2a2a2a] text-white shadow font-bold'
                  : 'text-[#aaa] hover:text-white'
              }`}
            >
              <Link className="w-3.5 h-3.5" />
              <span>Importer depuis YouTube</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          
          {/* TAB 1: CREATE FROM SCRATCH */}
          {activeTab === 'create' && (
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-white mb-1.5">
                  Nom de la chaîne *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (!handle) {
                      setHandle(`@${e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '')}`);
                    }
                  }}
                  placeholder="Ex: Mon Studio Vidéo"
                  required
                  className="w-full bg-[#121212] border border-[#383838] focus:border-white text-white text-xs rounded-xl px-4 py-3 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white mb-1.5">
                  Identifiant unique (@handle)
                </label>
                <input
                  type="text"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  placeholder="@monpseudo"
                  className="w-full bg-[#121212] border border-[#383838] focus:border-white text-white text-xs rounded-xl px-4 py-3 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white mb-1.5">
                  Description / Bio (Optionnel)
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Présentation de votre chaîne..."
                  className="w-full bg-[#121212] border border-[#383838] focus:border-white text-white text-xs rounded-xl p-3.5 outline-none transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <ImageUploadField
                  label="Logo / Avatar de la chaîne"
                  value={avatarUrl}
                  onChange={setAvatarUrl}
                  type="avatar"
                  placeholderUrl="https://.../avatar.png"
                />

                <ImageUploadField
                  label="Bannière de la chaîne"
                  value={bannerUrl}
                  onChange={setBannerUrl}
                  type="banner"
                  placeholderUrl="https://.../banner.jpg"
                />
              </div>

              {createError && (
                <div className="p-3.5 bg-red-500/10 text-red-400 text-xs rounded-2xl flex items-center gap-2 border border-red-500/20">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              <div className="flex justify-end pt-3">
                <button
                  type="submit"
                  disabled={isSubmittingCreate || !title.trim()}
                  className="bg-white hover:bg-white/90 text-black text-xs font-bold px-6 py-3 rounded-full transition cursor-pointer disabled:opacity-40 flex items-center gap-2 shadow"
                >
                  {isSubmittingCreate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>Créer ma chaîne</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: IMPORT FROM YOUTUBE */}
          {activeTab === 'import' && (
            <form onSubmit={handleImportSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-white">
                  URL ou Identifiant de votre chaîne YouTube
                </label>
                <input
                  type="text"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="https://www.youtube.com/@votrechaine ou @votrechaine"
                  required
                  className="w-full bg-[#121212] border border-[#383838] focus:border-white text-white text-xs rounded-xl px-4 py-3 outline-none transition"
                />
                <p className="text-[11px] text-[#aaa] leading-relaxed">
                  VidArch va récupérer votre avatar officiel, votre bannière, votre description et importer l'intégralité de vos vidéos publiées sous votre espace créateur.
                </p>
              </div>

              {importError && (
                <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-2xl text-xs text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              <div className="flex justify-end pt-3">
                <button
                  type="submit"
                  disabled={isSubmittingImport || !youtubeUrl.trim()}
                  className="bg-white hover:bg-white/90 text-black text-xs font-bold px-6 py-3 rounded-full transition cursor-pointer disabled:opacity-40 flex items-center gap-2 shadow"
                >
                  {isSubmittingImport ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#ff0033]" />
                      <span>Importation de la chaîne...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Définir comme ma chaîne</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>,
    document.body
  );
};
