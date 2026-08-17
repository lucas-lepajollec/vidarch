import React, { useState, useEffect } from 'react';
import { 
  Tv2, 
  HardDrive, 
  Film, 
  ArrowLeft, 
  Check, 
  Loader2, 
  ChevronDown, 
  UserMinus, 
  Sparkles,
  Sliders,
  UploadCloud,
  User,
  Plus,
  UserCheck
} from 'lucide-react';
import type { Channel, Video } from '../types';
import { VideoCard } from '../components/video/VideoCard';
import { useMyTube } from '../context/MyTubeContext';
import { formatSubscriberCount } from '../utils/format';

export const ChannelDetail: React.FC = () => {
  const { 
    nav, 
    goTo, 
    subscriptions, 
    subscribeChannel, 
    unsubscribeChannel, 
    dataVersion,
    openEditChannelModal,
    openImportModal,
    setActiveOwnerChannel,
    unclaimChannel
  } = useMyTube();
  const [channel, setChannel] = useState<Channel | null>(null);
  const [downloadedVideos, setDownloadedVideos] = useState<Video[]>([]);
  const [detectedVideos, setDetectedVideos] = useState<Video[]>([]);
  const [activeTab, setActiveTab] = useState<'downloaded' | 'online' | 'about'>('downloaded');
  const [autoDownload, setAutoDownload] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isHoveredSubscribed, setIsHoveredSubscribed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const channelId = nav.channelId;

  const loadChannelData = async (silent = false) => {
    if (!channelId) return;
    if (!silent) setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/channels/${encodeURIComponent(channelId)}`);
      if (res.ok) {
        const data = await res.json();
        setChannel(data.channel);
        const downloaded = data.downloadedVideos || [];
        const detected = data.detectedVideos || [];
        setDownloadedVideos(downloaded);
        setDetectedVideos(detected);
        setAutoDownload(data.channel?.auto_download === 1);
        setHasMore(detected.length >= 30);

        // Auto-switch to online tab if no downloaded videos exist
        if (downloaded.length === 0 && detected.length > 0) {
          setActiveTab('online');
        }
      } else {
        const errData = await res.json();
        setError(errData.error || 'Chaîne introuvable');
      }
    } catch (err: any) {
      console.error('Error fetching channel data:', err);
      setError('Erreur lors du chargement de la chaîne');
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadChannelData();
  }, [channelId, dataVersion]);

  // Load more videos pagination
  const handleLoadMore = async () => {
    if (!channel || isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const targetQuery = channel.handle || channel.id;
      const res = await fetch(`/api/channels/${encodeURIComponent(targetQuery)}/more-videos?offset=${detectedVideos.length}&limit=50`);
      if (res.ok) {
        const data = await res.json();
        const newVids: Video[] = data.videos || [];
        if (newVids.length > 0) {
          setDetectedVideos(prev => {
            const existingIds = new Set(prev.map(v => v.id));
            const filteredNew = newVids.filter(v => !existingIds.has(v.id));
            return [...prev, ...filteredNew];
          });
        }
        if (newVids.length < 50 || data.hasMore === false) {
          setHasMore(false);
        }
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Error loading more videos:', err);
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 w-full px-6 py-12 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-[#ff0033] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-[#aaa]">Chargement des informations de la chaîne...</span>
        </div>
      </div>
    );
  }

  if (error || !channel) {
    return (
      <div className="flex-1 w-full px-6 py-16 flex flex-col items-center justify-center text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-[#272727] flex items-center justify-center text-[#aaa]">
          <Tv2 className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-white">{error || 'Chaîne introuvable'}</h2>
        <p className="text-xs text-[#aaa] max-w-md">
          Impossible de récupérer les données de cette chaîne YouTube. Vérifiez le lien ou réessayez.
        </p>
        <button
          onClick={() => goTo('home')}
          className="bg-white text-black text-xs font-bold px-5 py-2.5 rounded-full hover:bg-white/90 transition flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour à l'accueil</span>
        </button>
      </div>
    );
  }

  const isSubscribed = subscriptions.some(s => s.id === channel.id || (channel.handle && s.handle === channel.handle));

  const handleSubscribeToggle = async () => {
    if (isSubscribing) return;
    setIsSubscribing(true);
    try {
      if (isSubscribed) {
        await unsubscribeChannel(channel.id);
      } else {
        await subscribeChannel(`https://www.youtube.com/channel/${channel.id}`);
      }
      // Silent refresh without unmounting UI
      await loadChannelData(true);
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleToggleAutoDownload = async (checked: boolean) => {
    setAutoDownload(checked);
    try {
      await fetch(`/api/channels/${channel.id}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auto_download: checked }),
      });
    } catch (err) {
      console.error('Settings update error:', err);
    }
  };

  return (
    <div className="flex-1 w-full px-3 sm:px-6 pt-2 sm:pt-3 pb-8 space-y-4 sm:space-y-6">
      {/* Banner */}
      {channel.banner_url ? (
        <div className="w-full h-28 sm:h-44 md:h-60 rounded-xl sm:rounded-2xl overflow-hidden bg-[#181818] shadow-md">
          <img src={channel.banner_url} alt="Bannière" className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="w-full h-20 sm:h-28 rounded-xl sm:rounded-2xl bg-gradient-to-r from-[#181818] via-[#202020] to-[#141414] border border-white/5 flex items-center justify-center">
          <div className="flex items-center gap-2 text-white/20 text-xs font-semibold uppercase tracking-widest">
            <Sparkles className="w-4 h-4" />
            <span>{channel.title}</span>
          </div>
        </div>
      )}

      {/* Channel Info Row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6 px-1">
        <div className="flex items-center gap-3.5 sm:gap-5">
          {/* Avatar */}
          <div className="w-16 h-16 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-full overflow-hidden bg-[#272727] shadow-xl flex-shrink-0">
            {channel.avatar_url ? (
              <img src={channel.avatar_url} alt={channel.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-tr from-[#ff0033] to-[#ff5e00] flex items-center justify-center text-white font-bold text-2xl sm:text-3xl">
                {channel.title.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Details */}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-2xl font-bold text-white tracking-tight">
                {channel.title}
              </h1>
              {channel.is_owner === 1 && (
                <span className="px-2 py-0.5 rounded-full bg-[#ff0033]/15 text-[#ff0033] font-bold text-[9px] sm:text-[10px] uppercase tracking-wider border border-[#ff0033]/30 flex items-center gap-1">
                  <User className="w-3 h-3" />
                  <span>Votre chaîne</span>
                </span>
              )}
            </div>
            <div className="text-[11px] sm:text-xs text-[#aaa] mt-1 flex flex-wrap items-center gap-1.5 sm:gap-2">
              {channel.handle && <span className="font-semibold text-[#ddd]">{channel.handle.startsWith('@') ? channel.handle : `@${channel.handle}`}</span>}
              {channel.subscriber_count && (
                <>
                  <span>•</span>
                  <span>{formatSubscriberCount(channel.subscriber_count)}</span>
                </>
              )}
              <span>•</span>
              <span>{downloadedVideos.length} vidéo{downloadedVideos.length > 1 ? 's' : ''}</span>
            </div>
            {channel.description && (
              <p className="text-xs text-[#aaa] line-clamp-2 max-w-2xl mt-1 leading-relaxed">
                {channel.description}
              </p>
            )}
          </div>
        </div>

        {/* Actions & Auto-download */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {channel.is_owner === 1 ? (
            <>
              <button
                onClick={() => openEditChannelModal(channel)}
                className="bg-[#272727] hover:bg-[#383838] text-white text-xs font-semibold px-4 py-2.5 rounded-full transition cursor-pointer flex items-center gap-2 shadow-sm border border-white/5"
              >
                <Sliders className="w-3.5 h-3.5 text-[#aaa]" />
                <span>Personnaliser</span>
              </button>

              <button
                onClick={openImportModal}
                className="bg-white hover:bg-white/90 text-black text-xs font-bold px-4 sm:px-5 py-2.5 rounded-full transition cursor-pointer flex items-center gap-2 shadow"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Mettre en ligne</span>
              </button>

              <button
                onClick={async () => {
                  if (confirm(`Dissocier "${channel.title}" de votre compte créateur ? (Elle redeviendra une chaîne standard)`)) {
                    await unclaimChannel(channel.id);
                    await loadChannelData();
                  }
                }}
                className="bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold px-3.5 py-2.5 rounded-full transition cursor-pointer flex items-center gap-1.5 border border-red-500/20"
                title="Dissocier cette chaîne de votre profil propriétaire"
              >
                <UserMinus className="w-3.5 h-3.5" />
                <span>Dissocier</span>
              </button>
            </>
          ) : (
            <>
              {/* Option to claim/set this channel as your own */}
              <button
                onClick={async () => {
                  if (confirm(`Définir "${channel.title}" comme votre chaîne principale ?`)) {
                    await setActiveOwnerChannel(channel.id);
                    await loadChannelData();
                  }
                }}
                className="bg-[#272727] hover:bg-[#383838] text-[#f1f1f1] hover:text-white text-xs font-medium px-3.5 py-2.5 rounded-full transition cursor-pointer flex items-center gap-1.5 border border-white/5"
                title="Définir comme votre chaîne principale"
              >
                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Définir comme ma chaîne</span>
              </button>

              {isSubscribed && (
                <label className="flex items-center gap-2 bg-[#272727] hover:bg-[#383838] px-4 py-2 rounded-full text-xs text-white cursor-pointer select-none transition">
                  <input
                    type="checkbox"
                    checked={autoDownload}
                    onChange={(e) => handleToggleAutoDownload(e.target.checked)}
                    className="w-4 h-4 accent-[#ff0033] rounded cursor-pointer"
                  />
                  <span>Auto-téléchargement</span>
                </label>
              )}

              {/* Smooth Subscribe / Unsubscribe Button */}
              <button
                onClick={handleSubscribeToggle}
                onMouseEnter={() => setIsHoveredSubscribed(true)}
                onMouseLeave={() => setIsHoveredSubscribed(false)}
                disabled={isSubscribing}
                className={`min-w-[120px] px-5 py-2.5 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-sm ${
                  isSubscribing
                    ? 'opacity-70 cursor-wait bg-[#272727] text-white'
                    : isSubscribed
                      ? isHoveredSubscribed
                        ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                        : 'bg-[#272727] hover:bg-[#383838] text-white'
                      : 'bg-white hover:bg-white/90 text-black shadow-md font-bold'
                }`}
              >
                {isSubscribing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : isSubscribed ? (
                  isHoveredSubscribed ? (
                    <>
                      <UserMinus className="w-3.5 h-3.5 text-red-400" />
                      <span>Se désabonner</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#3ea6ff]" />
                      <span>Abonné</span>
                    </>
                  )
                ) : (
                  <>
                    <span>S'abonner</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Channel Navigation Tabs (Scrollable on mobile) */}
      <div className="flex items-center gap-4 sm:gap-6 text-xs sm:text-sm font-semibold select-none pt-2 overflow-x-auto no-scrollbar border-b border-[#272727]">
        <button
          onClick={() => setActiveTab('downloaded')}
          className={`pb-2.5 relative transition cursor-pointer flex-shrink-0 ${
            activeTab === 'downloaded' ? 'text-white font-bold' : 'text-[#aaa] hover:text-white'
          }`}
        >
          <span>Vidéos téléchargées ({downloadedVideos.length})</span>
          {activeTab === 'downloaded' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('online')}
          className={`pb-2.5 relative transition cursor-pointer flex-shrink-0 ${
            activeTab === 'online' ? 'text-white font-bold' : 'text-[#aaa] hover:text-white'
          }`}
        >
          <span>Flux en ligne ({detectedVideos.length})</span>
          {activeTab === 'online' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('about')}
          className={`pb-2.5 relative transition cursor-pointer flex-shrink-0 ${
            activeTab === 'about' ? 'text-white font-bold' : 'text-[#aaa] hover:text-white'
          }`}
        >
          <span>À propos</span>
          {activeTab === 'about' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full" />
          )}
        </button>
      </div>

      {/* Content for tabs */}
      {activeTab === 'downloaded' && (
        <>
          {downloadedVideos.length === 0 ? (
            <div className="py-16 text-center max-w-md mx-auto space-y-3 px-4">
              <div className="w-14 h-14 rounded-full bg-[#272727] flex items-center justify-center text-[#aaa] mx-auto">
                <HardDrive className="w-7 h-7 text-[#717171]" />
              </div>
              <h3 className="font-semibold text-sm text-white">Aucune vidéo téléchargée pour cette chaîne</h3>
              <p className="text-xs text-[#aaa] pb-2">
                Consultez l'onglet "Flux en ligne" pour regarder ou télécharger les vidéos de cette chaîne.
              </p>
              <button
                onClick={() => setActiveTab('online')}
                className="bg-white text-black font-semibold text-xs px-5 py-2.5 rounded-full hover:bg-white/90 transition cursor-pointer"
              >
                Voir les vidéos en ligne
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-6 sm:gap-y-8">
              {downloadedVideos.map((v) => (
                <VideoCard key={v.id} video={v} onDelete={() => loadChannelData(true)} />
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'online' && (
        <div className="space-y-8">
          {detectedVideos.length === 0 ? (
            <div className="py-16 text-center max-w-md mx-auto space-y-2 px-4">
              <Film className="w-10 h-10 text-[#717171] mx-auto mb-2" />
              <h3 className="font-semibold text-sm text-white">Aucune vidéo en ligne disponible pour cette chaîne</h3>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-6 sm:gap-y-8">
                {detectedVideos.map((v) => (
                  <VideoCard key={v.id} video={v} onDelete={() => loadChannelData(true)} />
                ))}
              </div>

              {/* Load More Button */}
              {hasMore && (
                <div className="flex flex-col items-center justify-center pt-4 pb-8 gap-2">
                  <button
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                    className="flex items-center gap-2.5 px-6 py-3 rounded-full bg-[#272727] hover:bg-[#383838] text-white text-xs font-semibold transition cursor-pointer shadow-sm border border-white/5 active:scale-98"
                  >
                    {isLoadingMore ? (
                      <>
                        <Loader2 className="w-4 h-4 text-[#ff0033] animate-spin" />
                        <span>Récupération des vidéos suivantes...</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4" />
                        <span>Voir plus de vidéos</span>
                      </>
                    )}
                  </button>
                  <span className="text-[11px] text-[#717171]">
                    {detectedVideos.length} vidéos affichées
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'about' && (
        <div className="space-y-6 max-w-3xl text-xs text-[#ddd] pt-2">
          <div>
            <h3 className="font-bold text-white text-sm mb-2">Description</h3>
            <p className="whitespace-pre-line leading-relaxed text-[#aaa]">
              {channel.description || 'Aucune description disponible.'}
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-[#aaa] pt-2">
            <div>
              <span className="font-bold text-white block mb-1">Identifiant chaîne</span>
              <span className="font-mono">{channel.id}</span>
            </div>
            {channel.last_scanned_at && (
              <div>
                <span className="font-bold text-white block mb-1">Dernier scan</span>
                <span>{channel.last_scanned_at}</span>
              </div>
            )}
            <div>
              <span className="font-bold text-white block mb-1">Vidéos archivées</span>
              <span>{downloadedVideos.length} vidéo{downloadedVideos.length > 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
