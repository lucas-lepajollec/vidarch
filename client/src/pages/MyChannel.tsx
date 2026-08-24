import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  ChevronDown,
  Film,
  HardDrive,
  Image as ImageIcon,
  Loader2,
  Lock,
  Trash2,
  Unlock,
  UploadCloud,
  User,
} from 'lucide-react';
import type { Channel, Video } from '../types';
import { VideoCard } from '../components/video/VideoCard';
import { useMyTube } from '../context/MyTubeContext';
import { ChannelAvatar } from '../components/common/ChannelAvatar';
import { ExpandableText } from '../components/common/ExpandableText';
import { useI18n } from '../i18n/I18nProvider';
import { bannerSrc } from '../utils/media';
import { isUnsetOwnerTitle, ownerDisplayTitle } from '../utils/channelTitle';
import { AutoDownloadControl } from '../components/channel/AutoDownloadControl';
import { AnchoredPopover } from '../components/common/AnchoredPopover';

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Could not read file'));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function isYoutubeSourcedChannel(ch: Channel | null): boolean {
  if (!ch) return false;
  if (ch.linked_youtube_id) return true;
  return /^UC[a-zA-Z0-9_-]{10,}$/.test(ch.id);
}

export const MyChannel: React.FC = () => {
  const {
    goTo,
    dataVersion,
    openImportModal,
    refreshMyChannel,
    notifyDataChanged,
    localOnly,
    myChannels,
    setActiveOwnerChannel,
  } = useMyTube();
  const { t } = useI18n();

  const [channel, setChannel] = useState<Channel | null>(null);
  const [downloadedVideos, setDownloadedVideos] = useState<Video[]>([]);
  const [detectedVideos, setDetectedVideos] = useState<Video[]>([]);
  const [activeTab, setActiveTab] = useState<'downloaded' | 'online' | 'about'>('downloaded');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [handle, setHandle] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [brandingUnlocked, setBrandingUnlocked] = useState(false);
  const [autoDownload, setAutoDownload] = useState(false);
  const [autoDownloadMode, setAutoDownloadMode] = useState<'future' | 'all'>('future');

  const bannerInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const switchBtnRef = useRef<HTMLButtonElement>(null);

  const loadPage = async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError(null);
    try {
      const mineRes = await fetch('/api/channels/my-channel');
      if (!mineRes.ok) throw new Error(t('channel.fetchError'));
      const mine = await mineRes.json();
      if (!mine?.id) throw new Error(t('channel.notFound'));

      const res = await fetch(`/api/channels/${encodeURIComponent(mine.id)}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || t('channel.notFound'));
      }
      const data = await res.json();
      const ch: Channel = data.channel;
      setChannel(ch);
      setAutoDownload(ch.auto_download === 1);
      setAutoDownloadMode(ch.auto_download_mode === 'all' ? 'all' : 'future');
      setBrandingUnlocked(false);
      setTitle(isUnsetOwnerTitle(ch.title) ? '' : ch.title);
      setHandle(ch.handle || '');
      setDescription(ch.description || '');
      const downloaded = data.downloadedVideos || [];
      const detected = data.detectedVideos || [];
      setDownloadedVideos(downloaded);
      setDetectedVideos(detected);
      setHasMore(detected.length >= 30);
      if (!localOnly && downloaded.length === 0 && detected.length > 0) {
        setActiveTab('online');
      } else if (localOnly) {
        setActiveTab((tab) => (tab === 'online' ? 'downloaded' : tab));
      }
    } catch (err: any) {
      setError(err.message || t('channel.fetchError'));
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPage();
  }, [dataVersion]);

  const persistProfile = async (patch: Record<string, string>) => {
    if (!channel) return false;
    if (isYoutubeSourcedChannel(channel) && !brandingUnlocked) return false;
    setIsSaving(true);
    setProfileError(null);
    setSaveOk(false);
    try {
      const res = await fetch(`/api/channels/${channel.id}/customize`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setProfileError(data.error || t('edit.updateError'));
        return false;
      }
      await refreshMyChannel();
      notifyDataChanged();
      if (data.channel) {
        setChannel(data.channel);
        setTitle(isUnsetOwnerTitle(data.channel.title) ? '' : data.channel.title);
        setHandle(data.channel.handle || '');
        setDescription(data.channel.description || '');
      }
      setSaveOk(true);
      window.setTimeout(() => setSaveOk(false), 1600);
      return true;
    } catch (err: any) {
      setProfileError(err.message || t('common.networkError'));
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await persistProfile({
      title: title.trim(),
      handle: handle.trim(),
      description: description.trim(),
    });
  };

  const handleImagePick = async (kind: 'avatar' | 'banner', file?: File) => {
    if (!file || !channel) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const ok = await persistProfile(
        kind === 'avatar' ? { avatarUrl: dataUrl } : { bannerUrl: dataUrl }
      );
      if (ok) await loadPage(true);
    } catch (err: any) {
      setProfileError(err.message || t('edit.updateError'));
    }
  };

  const handleResetImage = async (kind: 'avatar' | 'banner') => {
    const ok = await persistProfile(kind === 'avatar' ? { avatarUrl: '' } : { bannerUrl: '' });
    if (ok) await loadPage(true);
  };

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
          setDetectedVideos((prev) => {
            const existingIds = new Set(prev.map((v) => v.id));
            return [...prev, ...newVids.filter((v) => !existingIds.has(v.id))];
          });
        }
        if (newVids.length < 50 || data.hasMore === false) setHasMore(false);
      } else {
        setHasMore(false);
      }
    } catch {
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 w-full px-6 py-12 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-[#ff5a67] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-[#aaa]">{t('channel.loadingInfo')}</span>
        </div>
      </div>
    );
  }

  if (error || !channel) {
    return (
      <div className="flex-1 w-full px-6 py-16 flex flex-col items-center justify-center text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-[#18212c] flex items-center justify-center text-[#aaa]">
          <User className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-white">{error || t('channel.notFound')}</h2>
        <button
          onClick={() => goTo('home')}
          className="bg-white text-black text-xs font-bold px-5 py-2.5 rounded-full hover:bg-white/90 transition cursor-pointer"
        >
          {t('channel.backHome')}
        </button>
      </div>
    );
  }

  const canSwitch = myChannels.length > 1;
  const ytLinked = isYoutubeSourcedChannel(channel);
  const canEdit = !ytLinked || brandingUnlocked;
  const resolvedBanner = bannerSrc(channel.id, channel.banner_url);

  return (
    <div className="flex-1 w-full px-4 sm:px-6 pt-6 pb-8 space-y-4 sm:space-y-6">
      <input
        ref={bannerInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          handleImagePick('banner', file);
        }}
      />
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          handleImagePick('avatar', file);
        }}
      />

      {canEdit ? (
        <div
          role="button"
          tabIndex={0}
          onClick={() => bannerInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              bannerInputRef.current?.click();
            }
          }}
          className="group relative w-full h-28 sm:h-44 md:h-56 rounded-xl sm:rounded-2xl overflow-hidden bg-[#0f151d] border border-white/5 cursor-pointer"
          title={t('mych.changeBanner')}
        >
          {resolvedBanner ? (
            <img src={resolvedBanner} alt={t('edit.banner')} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-[#0f151d] via-[#202020] to-[#0d131b] flex flex-col items-center justify-center gap-2 text-[#657383]">
              <ImageIcon className="w-6 h-6" />
              <span className="text-xs font-medium">{t('mych.addBanner')}</span>
            </div>
          )}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition flex items-center justify-center gap-2">
            <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-semibold flex items-center gap-1.5 bg-black/70 px-3 py-1.5 rounded-full">
              <Camera className="w-3.5 h-3.5" />
              {channel.banner_url ? t('mych.changeBanner') : t('mych.addBanner')}
            </span>
            {channel.banner_url ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleResetImage('banner');
                }}
                className="opacity-0 group-hover:opacity-100 text-white text-xs font-semibold flex items-center gap-1.5 bg-black/70 hover:bg-red-500/80 px-3 py-1.5 rounded-full cursor-pointer"
                title={t('mych.resetDefault')}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t('mych.resetDefault')}</span>
              </button>
            ) : null}
          </div>
        </div>
      ) : resolvedBanner ? (
        <div className="w-full h-28 sm:h-44 md:h-56 rounded-xl sm:rounded-2xl overflow-hidden bg-[#0f151d] shadow-md">
          <img src={resolvedBanner} alt={t('edit.banner')} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="w-full h-20 sm:h-28 rounded-xl sm:rounded-2xl bg-gradient-to-r from-[#0f151d] via-[#202020] to-[#0d131b] border border-white/5" />
      )}

      <form onSubmit={handleSaveProfile} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6 px-1">
        <div className="flex items-center gap-3.5 sm:gap-5 min-w-0 flex-1">
          {canEdit ? (
            <div className="relative group flex-shrink-0">
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="relative cursor-pointer"
                title={t('mych.addAvatar')}
              >
                <ChannelAvatar
                  channelId={channel.id}
                  url={channel.avatar_url}
                  title={title || channel.title}
                  className="w-16 h-16 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-full shadow-xl"
                  textClassName="text-2xl sm:text-3xl"
                />
                <span className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/45 transition flex items-center justify-center gap-1">
                  <Camera className="w-5 h-5 text-white opacity-0 group-hover:opacity-100" />
                </span>
              </button>
              {channel.avatar_url ? (
                <button
                  type="button"
                  onClick={() => handleResetImage('avatar')}
                  className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#18212c] border border-white/10 text-[#aaa] hover:text-white hover:bg-red-500/80 opacity-0 group-hover:opacity-100 transition flex items-center justify-center cursor-pointer z-10"
                  title={t('mych.resetDefault')}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              ) : null}
            </div>
          ) : (
            <ChannelAvatar
              channelId={channel.id}
              url={channel.avatar_url}
              title={title || channel.title}
              className="w-16 h-16 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-full shadow-xl"
              textClassName="text-2xl sm:text-3xl"
            />
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {canEdit ? (
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t('mych.defaultTitle')}
                  className="min-w-0 flex-1 bg-transparent text-lg sm:text-2xl font-bold text-white tracking-tight outline-none placeholder-[#555]"
                />
              ) : (
                <h1 className="text-lg sm:text-2xl font-bold text-white tracking-tight truncate">
                  {ownerDisplayTitle(title || channel.title, t('mych.defaultTitle'))}
                </h1>
              )}
            </div>
            {canEdit ? (
              <input
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="@handle"
                className="w-full bg-transparent text-[11px] sm:text-xs text-[#aaa] outline-none placeholder-[#555] mt-1 font-semibold"
              />
            ) : handle ? (
              <p className="text-[11px] sm:text-xs text-[#aaa] mt-1 font-semibold">
                {handle.startsWith('@') ? handle : `@${handle}`}
              </p>
            ) : null}
            {canEdit ? (
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('mych.bioPh')}
                rows={2}
                className="w-full max-w-2xl bg-transparent text-xs text-[#aaa] outline-none placeholder-[#555] resize-none overflow-hidden leading-relaxed mt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              />
            ) : description ? (
              <ExpandableText text={description} />
            ) : null}
            {profileError && <p className="text-xs text-rose-400 mt-1">{profileError}</p>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 flex-shrink-0">
          {!localOnly && (channel.auto_download_channel_id || ytLinked) && (
            <AutoDownloadControl
              channelId={channel.auto_download_channel_id || channel.linked_youtube_id || channel.id}
              autoDownload={autoDownload ? 1 : 0}
              autoDownloadMode={autoDownloadMode}
              onUpdated={(next) => {
                setAutoDownload(next.auto_download === 1);
                setAutoDownloadMode(next.auto_download_mode === 'all' ? 'all' : 'future');
              }}
            />
          )}
          {canEdit && (
            <button
              type="submit"
              disabled={isSaving}
              className="bg-white hover:bg-white/90 text-black text-xs font-bold px-4 py-2.5 rounded-full transition cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saveOk ? <Check className="w-3.5 h-3.5" /> : null}
              <span>{saveOk ? t('mych.saved') : t('mych.saveProfile')}</span>
            </button>
          )}
          <button
            type="button"
            onClick={openImportModal}
            className="bg-[#18212c] hover:bg-[#23303e] text-white text-xs font-semibold px-4 py-2.5 rounded-full transition cursor-pointer flex items-center gap-1.5 border border-white/5"
          >
            <UploadCloud className="w-3.5 h-3.5 text-[#aaa]" />
            <span>{t('channel.upload')}</span>
          </button>
          {canSwitch && (
            <div className="relative">
              <button
                ref={switchBtnRef}
                type="button"
                onClick={() => setSwitchOpen((open) => !open)}
                className="bg-[#18212c] hover:bg-[#23303e] text-white text-xs font-semibold px-4 py-2.5 rounded-full transition cursor-pointer flex items-center gap-1.5 border border-white/5"
              >
                <span>{t('settings.switchChannel')}</span>
                <ChevronDown className="w-3.5 h-3.5 text-[#aaa]" />
              </button>
              <AnchoredPopover
                open={switchOpen}
                onClose={() => setSwitchOpen(false)}
                anchorRef={switchBtnRef}
                align="end"
                preferredSide="bottom"
                className="w-64 max-w-[calc(100vw-16px)]"
              >
                  {myChannels.map((ch) => {
                    const active = ch.id === channel.id;
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={async () => {
                          setSwitchOpen(false);
                          if (!active) await setActiveOwnerChannel(ch.id);
                        }}
                        className={`va-menu-item ${active ? 'is-active' : ''}`}
                      >
                        <ChannelAvatar channelId={ch.id} url={ch.avatar_url} title={ch.title} className="w-7 h-7 rounded-full" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{ownerDisplayTitle(ch.title, t('mych.defaultTitle'))}</span>
                          {(ch.handle) && (
                            <span className="va-menu-hint truncate">{ch.handle}</span>
                          )}
                        </span>
                        {active && <Check className="w-3.5 h-3.5 text-white/50 flex-shrink-0" />}
                      </button>
                    );
                  })}
              </AnchoredPopover>
            </div>
          )}
        </div>
      </form>

      {ytLinked && (
        <div className="px-1 -mt-1">
          <button
            type="button"
            onClick={() => setBrandingUnlocked((open) => !open)}
            className="text-[11px] text-[#888] hover:text-white transition cursor-pointer inline-flex items-center gap-1.5"
          >
            {brandingUnlocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
            <span>{brandingUnlocked ? t('mych.lockBranding') : t('mych.unlockBranding')}</span>
          </button>
          {!brandingUnlocked && (
            <p className="text-[11px] text-[#666] mt-1 max-w-xl">{t('mych.unlockBrandingHint')}</p>
          )}
        </div>
      )}

      <div className="flex items-center gap-4 sm:gap-6 text-xs sm:text-sm font-semibold select-none pt-2 overflow-x-auto no-scrollbar border-b border-[#18212c]">
        <button
          onClick={() => setActiveTab('downloaded')}
          className={`pb-2.5 relative transition cursor-pointer flex-shrink-0 ${
            activeTab === 'downloaded' ? 'text-white font-bold' : 'text-[#aaa] hover:text-white'
          }`}
        >
          <span>{t('channel.downloaded', { count: downloadedVideos.length })}</span>
          {activeTab === 'downloaded' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full" />}
        </button>

        {!localOnly && (
          <button
            onClick={() => setActiveTab('online')}
            className={`pb-2.5 relative transition cursor-pointer flex-shrink-0 ${
              activeTab === 'online' ? 'text-white font-bold' : 'text-[#aaa] hover:text-white'
            }`}
          >
            <span>{t('channel.online', { count: detectedVideos.length })}</span>
            {activeTab === 'online' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full" />}
          </button>
        )}

        <button
          onClick={() => setActiveTab('about')}
          className={`pb-2.5 relative transition cursor-pointer flex-shrink-0 ${
            activeTab === 'about' ? 'text-white font-bold' : 'text-[#aaa] hover:text-white'
          }`}
        >
          <span>{t('channel.about')}</span>
          {activeTab === 'about' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full" />}
        </button>
      </div>

      {activeTab === 'downloaded' && (
        downloadedVideos.length === 0 ? (
          <div className="py-16 text-center max-w-md mx-auto space-y-3 px-4">
            <div className="w-14 h-14 rounded-full bg-[#18212c] flex items-center justify-center text-[#aaa] mx-auto">
              <HardDrive className="w-7 h-7 text-[#657383]" />
            </div>
            <h3 className="font-semibold text-sm text-white">{t('mych.emptyOwnerTitle')}</h3>
            <p className="text-xs text-[#aaa] pb-2">{t('mych.emptyOwnerBody')}</p>
            <button
              onClick={openImportModal}
              className="bg-white text-black font-semibold text-xs px-5 py-2.5 rounded-full hover:bg-white/90 transition cursor-pointer"
            >
              {t('channel.upload')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-6 sm:gap-y-8">
            {downloadedVideos.map((v) => (
              <VideoCard key={v.id} video={v} onDelete={() => loadPage(true)} />
            ))}
          </div>
        )
      )}

      {activeTab === 'online' && !localOnly && (
        <div className="space-y-8">
          {detectedVideos.length === 0 ? (
            <div className="py-16 text-center max-w-md mx-auto space-y-2 px-4">
              <Film className="w-10 h-10 text-[#657383] mx-auto mb-2" />
              <h3 className="font-semibold text-sm text-white">{t('channel.noOnlineVideos')}</h3>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-6 sm:gap-y-8">
                {detectedVideos.map((v) => (
                  <VideoCard key={v.id} video={v} onDelete={() => loadPage(true)} />
                ))}
              </div>
              {hasMore && (
                <div className="flex flex-col items-center justify-center pt-4 pb-8 gap-2">
                  <button
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                    className="flex items-center gap-2.5 px-6 py-3 rounded-full bg-[#18212c] hover:bg-[#23303e] text-white text-xs font-semibold transition cursor-pointer shadow-sm border border-white/5"
                  >
                    {isLoadingMore ? (
                      <>
                        <Loader2 className="w-4 h-4 text-[#ff5a67] animate-spin" />
                        <span>{t('channel.loadingMore')}</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4" />
                        <span>{t('channel.loadMoreVideos')}</span>
                      </>
                    )}
                  </button>
                  <span className="text-[11px] text-[#657383]">
                    {t('channel.shownOnline', { count: detectedVideos.length })}
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
            <h3 className="font-bold text-white text-sm mb-2">{t('channel.description')}</h3>
            <p className="whitespace-pre-line leading-relaxed text-[#aaa]">
              {channel.description || t('channel.noDescription')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
