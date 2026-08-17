import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Link, 
  UploadCloud, 
  Film, 
  Loader2, 
  Check, 
  AlertCircle, 
  DownloadCloud, 
  CheckCircle2,
  Plus,
  Tv2,
  Sliders,
  Sparkles
} from 'lucide-react';
import { useMyTube } from '../../context/MyTubeContext';
import { ImageUploadField } from '../channel/ImageUploadField';

export const ImportModal: React.FC = () => {
  const { 
    isImportModalOpen, 
    closeImportModal, 
    enqueueDownload, 
    subscribeChannel, 
    subscriptions, 
    refreshSubscriptions, 
    goTo, 
    notifyDataChanged 
  } = useMyTube();
  
  const [activeTab, setActiveTab] = useState<'url' | 'file'>('url');
  
  // URL Tab State
  const [urlInput, setUrlInput] = useState('');
  const [isInspectingUrl, setIsInspectingUrl] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [inspectedData, setInspectedData] = useState<{ type: 'video' | 'channel'; video?: any; channel?: any } | null>(null);
  const [selectedResolution, setSelectedResolution] = useState('1080p');
  const [autoDownloadChannel, setAutoDownloadChannel] = useState(false);
  const [isSubmittingUrl, setIsSubmittingUrl] = useState(false);

  // File Tab State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [originalYtUrl, setOriginalYtUrl] = useState('');
  const [isFetchingYtMeta, setIsFetchingYtMeta] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  
  // Custom Channel Creation State
  const [isCreatingNewChannel, setIsCreatingNewChannel] = useState(false);
  const [newChannelTitle, setNewChannelTitle] = useState('');
  const [newChannelHandle, setNewChannelHandle] = useState('');
  const [newChannelDesc, setNewChannelDesc] = useState('');
  const [newChannelAvatarUrl, setNewChannelAvatarUrl] = useState('');
  const [newChannelBannerUrl, setNewChannelBannerUrl] = useState('');

  // Upload Progress State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isImportModalOpen) {
      setUrlInput('');
      setInspectedData(null);
      setUrlError(null);
      setSelectedFile(null);
      setCustomTitle('');
      setCustomDescription('');
      setOriginalYtUrl('');
      setIsCreatingNewChannel(false);
      setUploadError(null);
      setUploadSuccess(false);
      setUploadProgress(0);
    }
  }, [isImportModalOpen]);

  if (!isImportModalOpen) return null;

  // Inspect URL
  const handleInspectUrl = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!urlInput.trim()) return;

    setIsInspectingUrl(true);
    setUrlError(null);
    setInspectedData(null);

    try {
      const res = await fetch('/api/import/inspect-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        setInspectedData(data);
      } else {
        const err = await res.json();
        setUrlError(err.error || 'Impossible d\'analyser ce lien');
      }
    } catch (err: any) {
      setUrlError('Erreur de connexion au serveur');
    } finally {
      setIsInspectingUrl(false);
    }
  };

  // Submit URL Action
  const handleActionUrl = async () => {
    if (!inspectedData) return;
    setIsSubmittingUrl(true);
    try {
      if (inspectedData.type === 'video' && inspectedData.video) {
        const v = inspectedData.video;
        await enqueueDownload({
          videoId: v.id,
          url: v.url,
          title: v.title,
          channelTitle: v.channelTitle,
          channelId: v.channelId,
          thumbnailUrl: v.thumbnailUrl,
          resolution: selectedResolution,
        });
        closeImportModal();
        goTo('downloads');
      } else if (inspectedData.type === 'channel' && inspectedData.channel) {
        const ch = inspectedData.channel;
        await subscribeChannel(ch.url || `https://www.youtube.com/channel/${ch.id}`, autoDownloadChannel);
        closeImportModal();
        goTo('channel', { channelId: ch.id });
      }
    } finally {
      setIsSubmittingUrl(false);
    }
  };

  // Auto fetch metadata from YouTube URL in File Tab
  const handleFetchYtMetaForFile = async () => {
    if (!originalYtUrl.trim()) return;
    setIsFetchingYtMeta(true);
    try {
      const res = await fetch('/api/import/inspect-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: originalYtUrl.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.type === 'video' && data.video) {
          const v = data.video;
          if (v.title) setCustomTitle(v.title);
          if (v.description) setCustomDescription(v.description);
          if (v.channelId) {
            setSelectedChannelId(v.channelId);
          }
        }
      }
    } catch (_) {}
    finally {
      setIsFetchingYtMeta(false);
    }
  };

  // Handle Local File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!customTitle) {
        setCustomTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  // Submit Local File Upload
  const handleUploadFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    const formData = new FormData();
    formData.append('video', selectedFile);
    formData.append('title', customTitle || selectedFile.name);
    formData.append('description', customDescription);
    formData.append('originalUrl', originalYtUrl);

    if (isCreatingNewChannel && newChannelTitle.trim()) {
      formData.append('createChannel', JSON.stringify({
        title: newChannelTitle.trim(),
        handle: newChannelHandle.trim(),
        description: newChannelDesc.trim(),
        avatarUrl: newChannelAvatarUrl.trim(),
        bannerUrl: newChannelBannerUrl.trim(),
      }));
    } else if (selectedChannelId) {
      formData.append('channelId', selectedChannelId);
    }

    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/import/file', true);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percent);
        }
      };

      xhr.onload = async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const data = JSON.parse(xhr.responseText);
          setUploadSuccess(true);
          await refreshSubscriptions();
          notifyDataChanged();
          setTimeout(() => {
            closeImportModal();
            if (data.channelId) {
              goTo('channel', { channelId: data.channelId });
            } else {
              goTo('library');
            }
          }, 800);
        } else {
          try {
            const err = JSON.parse(xhr.responseText);
            setUploadError(err.error || 'Erreur lors de l\'importation');
          } catch (_) {
            setUploadError('Erreur serveur');
          }
        }
        setIsUploading(false);
      };

      xhr.onerror = () => {
        setUploadError('Erreur réseau lors de l\'envoi du fichier');
        setIsUploading(false);
      };

      xhr.send(formData);
    } catch (err: any) {
      setUploadError(err.message || 'Erreur d\'envoi');
      setIsUploading(false);
    }
  };

  return createPortal(
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isUploading) closeImportModal();
      }}
    >
      <div className="w-full max-w-xl bg-[#212121] border border-[#383838] rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-[#f1f1f1]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#303030]">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Importer du contenu
            </h2>
            <p className="text-xs text-[#aaa] mt-0.5">
              Ajoutez une vidéo YouTube, une chaîne entière ou un fichier vidéo local
            </p>
          </div>
          <button
            onClick={closeImportModal}
            className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 text-[#aaa] hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selector (YouTube Studio Pill Bar) */}
        <div className="px-6 pt-4 pb-2">
          <div className="flex items-center p-1 bg-[#141414] border border-[#303030] rounded-2xl gap-1">
            <button
              onClick={() => setActiveTab('url')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'url'
                  ? 'bg-[#2a2a2a] text-white shadow font-bold'
                  : 'text-[#aaa] hover:text-white'
              }`}
            >
              <Link className="w-3.5 h-3.5" />
              <span>Lien URL YouTube</span>
            </button>

            <button
              onClick={() => setActiveTab('file')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'file'
                  ? 'bg-[#2a2a2a] text-white shadow font-bold'
                  : 'text-[#aaa] hover:text-white'
              }`}
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Fichier vidéo local</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          
          {/* ========================================================================= */}
          {/* TAB 1: LIEN URL YOUTUBE                                                   */}
          {/* ========================================================================= */}
          {activeTab === 'url' && (
            <div className="space-y-4">
              <form onSubmit={handleInspectUrl} className="space-y-2">
                <label className="block text-xs font-semibold text-[#aaa]">
                  Lien de la vidéo ou de la chaîne
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=... ou @chaine"
                    className="flex-1 bg-[#121212] border border-[#383838] focus:border-white text-white text-xs rounded-xl px-4 py-3 outline-none transition"
                  />
                  <button
                    type="submit"
                    disabled={isInspectingUrl || !urlInput.trim()}
                    className="bg-white hover:bg-white/90 text-black text-xs font-bold px-5 py-3 rounded-xl transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50 shadow"
                  >
                    {isInspectingUrl ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>Analyser</span>}
                  </button>
                </div>
              </form>

              {urlError && (
                <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-2xl text-xs text-red-400 flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{urlError}</span>
                </div>
              )}

              {/* Inspected Preview: VIDEO */}
              {inspectedData?.type === 'video' && inspectedData.video && (
                <div className="p-4 bg-[#141414] border border-[#333] rounded-2xl space-y-4 animate-in fade-in duration-150">
                  <div className="flex gap-3.5">
                    <div className="relative w-36 aspect-video rounded-xl overflow-hidden bg-[#272727] flex-shrink-0 shadow-md">
                      <img src={inspectedData.video.thumbnailUrl} alt={inspectedData.video.title} className="w-full h-full object-cover" />
                      {inspectedData.video.durationString && (
                        <span className="absolute bottom-1.5 right-1.5 bg-black/85 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                          {inspectedData.video.durationString}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <span className="text-[10px] font-semibold text-[#3ea6ff] uppercase tracking-wider block">Vidéo YouTube</span>
                      <h4 className="font-bold text-xs text-white line-clamp-2 mt-0.5 leading-snug">{inspectedData.video.title}</h4>
                      <p className="text-xs text-[#aaa] mt-1 truncate">{inspectedData.video.channelTitle}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[#272727]">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#aaa]">Qualité :</span>
                      <select
                        value={selectedResolution}
                        onChange={(e) => setSelectedResolution(e.target.value)}
                        className="bg-[#272727] text-white text-xs font-medium px-3 py-1.5 rounded-lg border border-[#383838] outline-none cursor-pointer"
                      >
                        <option value="2160p">4K (2160p)</option>
                        <option value="1440p">2K (1440p)</option>
                        <option value="1080p">1080p (Full HD)</option>
                        <option value="720p">720p (HD)</option>
                      </select>
                    </div>

                    <button
                      onClick={handleActionUrl}
                      disabled={isSubmittingUrl}
                      className="bg-white hover:bg-white/90 text-black text-xs font-bold px-5 py-2.5 rounded-full transition cursor-pointer flex items-center gap-1.5 shadow"
                    >
                      {isSubmittingUrl ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <DownloadCloud className="w-3.5 h-3.5" />}
                      <span>Télécharger & Archiver</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Inspected Preview: CHANNEL */}
              {inspectedData?.type === 'channel' && inspectedData.channel && (
                <div className="p-4 bg-[#141414] border border-[#333] rounded-2xl space-y-4 animate-in fade-in duration-150">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full overflow-hidden bg-[#272727] flex-shrink-0 shadow-md">
                      {inspectedData.channel.avatarUrl ? (
                        <img src={inspectedData.channel.avatarUrl} alt={inspectedData.channel.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-tr from-[#ff0033] to-[#ff5e00] flex items-center justify-center text-white font-bold text-lg">
                          {inspectedData.channel.title?.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider block">Chaîne YouTube</span>
                      <h4 className="font-bold text-sm text-white truncate">{inspectedData.channel.title}</h4>
                      <p className="text-xs text-[#aaa]">{inspectedData.channel.handle} • {inspectedData.channel.subscriberCount}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[#272727]">
                    <label className="flex items-center gap-2 text-xs text-[#aaa] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoDownloadChannel}
                        onChange={(e) => setAutoDownloadChannel(e.target.checked)}
                        className="w-4 h-4 accent-[#ff0033] rounded"
                      />
                      <span>Auto-téléchargement</span>
                    </label>

                    <button
                      onClick={handleActionUrl}
                      disabled={isSubmittingUrl}
                      className="bg-white hover:bg-white/90 text-black text-xs font-bold px-5 py-2.5 rounded-full transition cursor-pointer flex items-center gap-1.5 shadow"
                    >
                      {isSubmittingUrl ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      <span>S'abonner & Importer</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: FICHIER LOCAL (.MP4, .MKV...)                                      */}
          {/* ========================================================================= */}
          {activeTab === 'file' && (
            <form onSubmit={handleUploadFile} className="space-y-4">
              {/* File Dropzone */}
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="video/mp4,video/mkv,video/webm,video/avi,video/quicktime,.mp4,.mkv,.webm,.avi,.mov"
                  className="hidden"
                />

                {!selectedFile ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-[#383838] hover:border-white/40 bg-[#141414] rounded-3xl p-8 flex flex-col items-center justify-center text-center gap-3 cursor-pointer transition group"
                  >
                    <div className="w-14 h-14 rounded-full bg-[#272727] text-white flex items-center justify-center group-hover:scale-105 transition shadow-md">
                      <UploadCloud className="w-6 h-6 text-[#ff0033]" />
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-white block">Sélectionnez un fichier vidéo sur votre ordinateur</span>
                      <span className="text-[11px] text-[#aaa] block">MP4, MKV, WEBM jusqu'à 10 Go</span>
                    </div>
                    <span className="bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-4 py-1.5 rounded-full transition mt-1">
                      Parcourir les fichiers
                    </span>
                  </div>
                ) : (
                  <div className="p-4 bg-[#141414] border border-[#383838] rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-[#272727] flex items-center justify-center flex-shrink-0">
                        <Film className="w-5 h-5 text-[#ff0033]" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-white block truncate">{selectedFile.name}</span>
                        <span className="text-[11px] text-[#aaa]">{(selectedFile.size / (1024 * 1024)).toFixed(1)} Mo</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedFile(null)}
                      className="text-xs text-[#aaa] hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 transition"
                    >
                      Changer
                    </button>
                  </div>
                )}
              </div>

              {/* Optional YouTube pairing */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-[#aaa]">
                  Lien YouTube d'origine (Optionnel pour auto-remplir les métadonnées)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={originalYtUrl}
                    onChange={(e) => setOriginalYtUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="flex-1 bg-[#121212] border border-[#383838] text-white text-xs rounded-xl px-4 py-2.5 outline-none focus:border-white"
                  />
                  <button
                    type="button"
                    onClick={handleFetchYtMetaForFile}
                    disabled={isFetchingYtMeta || !originalYtUrl.trim()}
                    className="bg-[#2a2a2a] hover:bg-[#383838] text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition cursor-pointer disabled:opacity-40"
                  >
                    {isFetchingYtMeta ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>Remplir</span>}
                  </button>
                </div>
              </div>

              {/* Title & Description */}
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-white mb-1.5">Titre de la vidéo *</label>
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="Titre de votre vidéo"
                    required
                    className="w-full bg-[#121212] border border-[#383838] text-white text-xs rounded-xl px-4 py-2.5 outline-none focus:border-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#aaa] mb-1.5">Description (Optionnel)</label>
                  <textarea
                    rows={2}
                    value={customDescription}
                    onChange={(e) => setCustomDescription(e.target.value)}
                    placeholder="Description de la vidéo..."
                    className="w-full bg-[#121212] border border-[#383838] text-white text-xs rounded-xl p-3 outline-none focus:border-white"
                  />
                </div>
              </div>

              {/* Channel Association / Dedicated Space */}
              <div className="p-4 bg-[#141414] border border-[#303030] rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Chaîne / Espace de destination</span>
                  <button
                    type="button"
                    onClick={() => setIsCreatingNewChannel(!isCreatingNewChannel)}
                    className="text-xs font-semibold text-[#3ea6ff] hover:underline cursor-pointer"
                  >
                    {isCreatingNewChannel ? 'Choisir une chaîne existante' : '+ Créer un espace dédié'}
                  </button>
                </div>

                {!isCreatingNewChannel ? (
                  <select
                    value={selectedChannelId}
                    onChange={(e) => setSelectedChannelId(e.target.value)}
                    className="w-full bg-[#1e1e1e] border border-[#383838] text-white text-xs rounded-xl px-3.5 py-2.5 outline-none cursor-pointer"
                  >
                    <option value="">Vidéos Importées (Espace par défaut)</option>
                    {subscriptions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title} ({s.handle || s.id})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="space-y-2.5 pt-2 border-t border-[#222]">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={newChannelTitle}
                        onChange={(e) => setNewChannelTitle(e.target.value)}
                        placeholder="Nom de l'espace *"
                        required={isCreatingNewChannel}
                        className="bg-[#1e1e1e] border border-[#383838] text-white text-xs rounded-xl px-3 py-2 outline-none focus:border-white"
                      />
                      <input
                        type="text"
                        value={newChannelHandle}
                        onChange={(e) => setNewChannelHandle(e.target.value)}
                        placeholder="@identifiant"
                        className="bg-[#1e1e1e] border border-[#383838] text-white text-xs rounded-xl px-3 py-2 outline-none focus:border-white"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <ImageUploadField
                        label="Logo / Avatar de l'espace"
                        value={newChannelAvatarUrl}
                        onChange={setNewChannelAvatarUrl}
                        type="avatar"
                        placeholderUrl="https://.../avatar.png"
                      />

                      <ImageUploadField
                        label="Bannière de l'espace"
                        value={newChannelBannerUrl}
                        onChange={setNewChannelBannerUrl}
                        type="banner"
                        placeholderUrl="https://.../banner.jpg"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Upload Progress Bar */}
              {isUploading && (
                <div className="space-y-1.5 p-3 bg-[#141414] border border-[#303030] rounded-2xl">
                  <div className="flex justify-between text-xs text-[#aaa]">
                    <span>Importation en cours...</span>
                    <span className="font-bold text-white">{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-[#272727] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#ff0033] transition-all duration-150 rounded-full"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {uploadError && (
                <div className="p-3.5 bg-red-500/10 text-red-400 text-xs rounded-2xl flex items-center gap-2 border border-red-500/20">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              {uploadSuccess && (
                <div className="p-3.5 bg-emerald-500/10 text-emerald-400 text-xs rounded-2xl flex items-center gap-2 border border-emerald-500/20">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>Vidéo importée et prête dans votre bibliothèque !</span>
                </div>
              )}

              {/* Submit Button */}
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isUploading || !selectedFile}
                  className="bg-white hover:bg-white/90 text-black text-xs font-bold px-6 py-3 rounded-full transition cursor-pointer disabled:opacity-40 flex items-center gap-2 shadow"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Envoi en cours...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>Importer dans la bibliothèque</span>
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
