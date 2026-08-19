import React, { useState } from 'react';
import { Check, Link2, Loader2, Unlink } from 'lucide-react';
import { useMyTube } from '../../context/MyTubeContext';
import { ChannelAvatar } from '../common/ChannelAvatar';
import { useI18n } from '../../i18n/I18nProvider';
import { ownerDisplayTitle } from '../../utils/channelTitle';
import { AutoDownloadControl } from './AutoDownloadControl';

export const LinkedChannelsSettings: React.FC = () => {
  const {
    myChannel,
    myChannels,
    refreshMyChannel,
    refreshSubscriptions,
    notifyDataChanged,
    setActiveOwnerChannel,
    localOnly,
  } = useMyTube();
  const { t } = useI18n();

  const personal = myChannels.find((c) => String(c.id).startsWith('custom_')) || myChannel;
  const extras = myChannels.filter((c) => !String(c.id).startsWith('custom_'));

  const [primaryHandle, setPrimaryHandle] = useState('');
  const [extraHandle, setExtraHandle] = useState('');
  const [isLinkingPrimary, setIsLinkingPrimary] = useState(false);
  const [isLinkingExtra, setIsLinkingExtra] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshAll = async () => {
    await refreshMyChannel();
    await refreshSubscriptions();
    notifyDataChanged();
  };

  const handlePrimaryLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!primaryHandle.trim() || isLinkingPrimary) return;
    if (!confirm(t('mych.linkYtWarning'))) return;
    setIsLinkingPrimary(true);
    setError(null);
    try {
      const res = await fetch('/api/channels/link-youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: primaryHandle.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || t('mych.notFound'));
        return;
      }
      setPrimaryHandle('');
      await refreshAll();
    } catch (err: any) {
      setError(err.message || t('common.networkError'));
    } finally {
      setIsLinkingPrimary(false);
    }
  };

  const handlePrimaryUnlink = async () => {
    if (!confirm(t('mych.unlinkYtConfirm'))) return;
    setBusyId('primary');
    setError(null);
    try {
      const res = await fetch('/api/channels/unlink-youtube', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || t('edit.updateError'));
        return;
      }
      await refreshAll();
    } catch (err: any) {
      setError(err.message || t('common.networkError'));
    } finally {
      setBusyId(null);
    }
  };

  const handleExtraLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extraHandle.trim() || isLinkingExtra) return;
    setIsLinkingExtra(true);
    setError(null);
    try {
      const res = await fetch('/api/channels/link-extra-youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: extraHandle.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || t('mych.notFound'));
        return;
      }
      setExtraHandle('');
      await refreshAll();
    } catch (err: any) {
      setError(err.message || t('common.networkError'));
    } finally {
      setIsLinkingExtra(false);
    }
  };

  const handleExtraUnlink = async (id: string, title: string) => {
    if (!confirm(t('settings.unlinkExtraConfirm', { title }))) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/channels/${encodeURIComponent(id)}/unclaim`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || t('edit.updateError'));
        return;
      }
      await refreshAll();
    } catch (err: any) {
      setError(err.message || t('common.networkError'));
    } finally {
      setBusyId(null);
    }
  };

  const primaryHandleLabel = personal?.linked_youtube_id
    ? (personal.handle?.startsWith('@') ? personal.handle : personal.handle ? `@${personal.handle}` : personal.linked_youtube_id)
    : '';

  if (localOnly) {
    return (
      <p className="text-xs text-[#aaa]">{t('settings.channelsLocalOnly')}</p>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-4 border-t border-b border-[#272727] py-6">
        <div>
          <h2 className="text-sm font-semibold text-white">{t('settings.primaryLinkTitle')}</h2>
          <p className="text-xs text-[#aaa] mt-1 leading-relaxed max-w-xl">{t('settings.primaryLinkHint')}</p>
        </div>

        {personal?.linked_youtube_id ? (
          <div className="flex items-center justify-between gap-3 bg-[#181818] border border-[#272727] rounded-2xl p-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <ChannelAvatar
                channelId={personal.id}
                url={personal.avatar_url}
                title={ownerDisplayTitle(personal.title, t('mych.defaultTitle'))}
                className="w-10 h-10 rounded-full"
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{ownerDisplayTitle(personal.title, t('mych.defaultTitle'))}</p>
                <p className="text-[11px] text-[#aaa] truncate">{t('mych.linkedAs', { handle: primaryHandleLabel })}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {personal.linked_youtube_id && (
                <AutoDownloadControl
                  channelId={personal.linked_youtube_id}
                  autoDownload={personal.auto_download}
                  autoDownloadMode={personal.auto_download_mode}
                  compact
                />
              )}
              <button
                type="button"
                onClick={handlePrimaryUnlink}
                disabled={busyId === 'primary'}
                className="flex-shrink-0 text-xs font-semibold text-[#aaa] hover:text-white px-3 py-2 rounded-full hover:bg-white/5 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-40"
              >
                {busyId === 'primary' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5" />}
                <span>{t('mych.unlinkYt')}</span>
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handlePrimaryLink} className="flex flex-col sm:flex-row gap-2">
            <input
              value={primaryHandle}
              onChange={(e) => setPrimaryHandle(e.target.value)}
              placeholder={t('mych.linkYtPlaceholder')}
              className="flex-1 bg-[#121212] border border-[#383838] focus:border-white text-white text-xs rounded-xl px-3.5 py-2.5 outline-none transition"
            />
            <button
              type="submit"
              disabled={isLinkingPrimary || !primaryHandle.trim()}
              className="bg-white hover:bg-white/90 text-black text-xs font-bold px-4 py-2.5 rounded-full transition cursor-pointer disabled:opacity-40 flex items-center justify-center gap-1.5"
            >
              {isLinkingPrimary ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
              <span>{t('mych.linkYtSubmit')}</span>
            </button>
          </form>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-white">{t('settings.extraLinkTitle')}</h2>
          <p className="text-xs text-[#aaa] mt-1 leading-relaxed max-w-xl">{t('settings.extraLinkHint')}</p>
        </div>

        {extras.length > 0 && (
          <div className="space-y-2">
            {extras.map((ch) => {
              const isActive = myChannel?.id === ch.id || ch.is_active_owner === 1;
              return (
                <div key={ch.id} className="flex items-center justify-between gap-3 bg-[#181818] border border-[#272727] rounded-2xl p-3.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <ChannelAvatar channelId={ch.id} url={ch.avatar_url} title={ch.title} className="w-10 h-10 rounded-full" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{ch.title}</p>
                      <p className="text-[11px] text-[#aaa] truncate">
                        {ch.handle || ch.id}
                        {isActive ? ` · ${t('settings.currentChannel')}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <AutoDownloadControl
                      channelId={ch.id}
                      autoDownload={ch.auto_download}
                      autoDownloadMode={ch.auto_download_mode}
                      compact
                    />
                    {!isActive && (
                      <button
                        type="button"
                        onClick={() => setActiveOwnerChannel(ch.id)}
                        className="text-xs font-semibold text-[#aaa] hover:text-white px-3 py-2 rounded-full hover:bg-white/5 transition cursor-pointer"
                      >
                        {t('settings.switchChannel')}
                      </button>
                    )}
                    {isActive && <Check className="w-4 h-4 text-[#ff0033] mr-1" />}
                    <button
                      type="button"
                      onClick={() => handleExtraUnlink(ch.id, ch.title)}
                      disabled={busyId === ch.id}
                      className="p-2 text-[#aaa] hover:text-white rounded-full hover:bg-white/5 transition cursor-pointer disabled:opacity-40"
                      title={t('mych.unlinkYt')}
                    >
                      {busyId === ch.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <form onSubmit={handleExtraLink} className="flex flex-col sm:flex-row gap-2">
          <input
            value={extraHandle}
            onChange={(e) => setExtraHandle(e.target.value)}
            placeholder={t('mych.linkYtPlaceholder')}
            className="flex-1 bg-[#121212] border border-[#383838] focus:border-white text-white text-xs rounded-xl px-3.5 py-2.5 outline-none transition"
          />
          <button
            type="submit"
            disabled={isLinkingExtra || !extraHandle.trim()}
            className="bg-[#272727] hover:bg-[#383838] text-white text-xs font-bold px-4 py-2.5 rounded-full transition cursor-pointer disabled:opacity-40 flex items-center justify-center gap-1.5 border border-white/5"
          >
            {isLinkingExtra ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
            <span>{t('settings.addChannel')}</span>
          </button>
        </form>
      </div>

      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
};
