import React, { useState, useEffect, useRef } from 'react';
import { 
  Check, 
  Loader2, 
  Upload, 
  ArrowLeft,
  ShieldCheck,
  Cpu,
  Sliders,
  HardDrive,
  RefreshCw,
  Trash2,
  Copy,
  Radio,
  Folder,
  CheckCircle2,
  ExternalLink,
  Lock,
  Globe,
  Tv2,
  Database
} from 'lucide-react';
import { useMyTube } from '../context/MyTubeContext';
import { useI18n } from '../i18n/I18nProvider';
import { UI_LANGUAGES } from '../i18n/messages';
import { LinkedChannelsSettings } from '../components/channel/LinkedChannelsSettings';

type SettingsTab = 'language' | 'channels' | 'general' | 'scanner' | 'cookies' | 'storage' | 'system' | 'security';

export const Settings: React.FC = () => {
  const { systemStatus, refreshSystemStatus, triggerScan, isScanning, subscriptions, goBack, auth, refreshAuth, logout, localOnly, setLocalOnly, scanEnabled, setScanEnabled, uiLanguage, setUiLanguage } = useMyTube();
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [activeTab, setActiveTab] = useState<SettingsTab>('language');
  const [isUpdatingYtdlp, setIsUpdatingYtdlp] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);

  const [cookiesText, setCookiesText] = useState('');
  const [showCookiesEditor, setShowCookiesEditor] = useState(false);
  const [isSavingCookies, setIsSavingCookies] = useState(false);
  const [cookiesMessage, setCookiesMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [scanInterval, setScanInterval] = useState('60');
  const [defaultResolution, setDefaultResolution] = useState('1080p');
  const [autoDownloadNewSubs, setAutoDownloadNewSubs] = useState(false);
  const [concurrentDownloads, setConcurrentDownloads] = useState('2');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [isCleaningCache, setIsCleaningCache] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<string | null>(null);
  const [copiedPath, setCopiedPath] = useState(false);
  const [autoUpdateYtdlp, setAutoUpdateYtdlp] = useState(true);
  const [newPassword, setNewPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    refreshSystemStatus();
    fetch('/api/system/settings')
      .then(res => res.json())
      .then(data => {
        if (data.auto_scan_interval) setScanInterval(data.auto_scan_interval);
        if (data.default_max_resolution) setDefaultResolution(data.default_max_resolution);
        if (data.auto_download_new_subs !== undefined) setAutoDownloadNewSubs(data.auto_download_new_subs === '1');
        if (data.auto_update_ytdlp !== undefined) setAutoUpdateYtdlp(data.auto_update_ytdlp !== 'false');
        if (data.concurrent_downloads) setConcurrentDownloads(String(data.concurrent_downloads));
      })
      .catch(() => {});
  }, [refreshSystemStatus]);

  const handleUpdateYtdlp = async () => {
    setIsUpdatingYtdlp(true);
    setUpdateMessage(null);
    try {
      const res = await fetch('/api/system/update-ytdlp', { method: 'POST' });
      const data = await res.json();
      setUpdateMessage(data.message || (data.success ? t('settings.ytdlpUpToDate') : t('settings.updateFailed')));
      await refreshSystemStatus();
      showToast(t('settings.ytdlpUpdated'));
    } catch (err: any) {
      setUpdateMessage(t('settings.errorPrefix', { msg: err.message }));
    } finally {
      setIsUpdatingYtdlp(false);
    }
  };

  const handleSaveCookies = async () => {
    if (!cookiesText.trim()) return;
    setIsSavingCookies(true);
    setCookiesMessage(null);
    try {
      const res = await fetch('/api/system/cookies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: cookiesText }),
      });
      const data = await res.json();
      if (data.success) {
        setCookiesMessage({ type: 'success', text: t('settings.cookiesSaved') });
        setShowCookiesEditor(false);
        await refreshSystemStatus();
        showToast(t('settings.cookiesSavedToast'));
      }
    } catch (err: any) {
      setCookiesMessage({ type: 'error', text: t('settings.errorPrefix', { msg: err.message }) });
    } finally {
      setIsSavingCookies(false);
    }
  };

  const handleDeleteCookies = async () => {
    if (!confirm(t('settings.deleteCookiesConfirm'))) return;
    try {
      const res = await fetch('/api/system/cookies', { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setCookiesText('');
        setShowCookiesEditor(false);
        setCookiesMessage({ type: 'success', text: t('settings.cookiesDeleted') });
        await refreshSystemStatus();
        showToast(t('settings.anonModeToast'));
      }
    } catch (err: any) {
      showToast(t('settings.errorPrefix', { msg: err.message }));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setCookiesText(content);
        setShowCookiesEditor(true);
      }
    };
    reader.readAsText(file);
  };

  const handleSaveGeneralSettings = async (overrideInterval?: string, overrideRes?: string, overrideAutoDl?: boolean, overrideConcurrent?: string) => {
    const newInterval = overrideInterval !== undefined ? overrideInterval : scanInterval;
    const newRes = overrideRes !== undefined ? overrideRes : defaultResolution;
    const newAutoDl = overrideAutoDl !== undefined ? overrideAutoDl : autoDownloadNewSubs;
    const newConcurrent = overrideConcurrent !== undefined ? overrideConcurrent : concurrentDownloads;
    
    try {
      const res = await fetch('/api/system/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auto_scan_interval: newInterval,
          default_max_resolution: newRes,
          auto_download_new_subs: newAutoDl ? '1' : '0',
          concurrent_downloads: newConcurrent,
        }),
      });
      if (res.ok) {
        showToast(t('settings.saved'));
      }
    } catch (err: any) {
      showToast(t('settings.errorPrefix', { msg: err.message }));
    }
  };

  const handleCleanupCache = async () => {
    setIsCleaningCache(true);
    setCleanupResult(null);
    try {
      const res = await fetch('/api/system/cleanup-cache', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setCleanupResult(t('settings.cacheCleaned', { videos: data.cleanedVideos || 0, searches: data.cleanedSearchHistory || 0 }));
        showToast(t('settings.cacheCleanedToast'));
        await refreshSystemStatus();
      }
    } catch (err: any) {
      setCleanupResult(t('settings.errorPrefix', { msg: err.message }));
    } finally {
      setIsCleaningCache(false);
    }
  };

  const handleCopyPath = () => {
    if (systemStatus?.downloadsDir) {
      navigator.clipboard?.writeText(systemStatus.downloadsDir);
      setCopiedPath(true);
      setTimeout(() => setCopiedPath(false), 2000);
      showToast(t('settings.pathCopied'));
    }
  };

  const navItems: Array<{ id: SettingsTab; label: string; icon: React.FC<{ className?: string }> }> = [
    { id: 'language', label: t('settings.tabLanguage'), icon: Globe },
    { id: 'channels', label: t('settings.tabChannels'), icon: Tv2 },
    { id: 'general', label: t('settings.tabGeneral'), icon: Sliders },
    ...(!localOnly ? [{ id: 'scanner' as SettingsTab, label: t('settings.tabScanner'), icon: Radio }] : []),
    { id: 'cookies', label: t('settings.tabCookies'), icon: ShieldCheck },
    { id: 'storage', label: t('settings.tabStorage'), icon: HardDrive },
    { id: 'system', label: t('settings.tabSystem'), icon: Cpu },
    { id: 'security', label: t('settings.tabSecurity'), icon: Lock },
  ];

  return (
    <div className="flex-1 flex flex-col md:flex-row min-h-[calc(100vh-3.5rem)] text-[#f4f7fb]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#111821] border border-[#23303e] text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="w-2 h-2 rounded-full bg-[#73c7e8]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Left Sidebar / Horizontal Tab bar on mobile (Classic YouTube Studio / Account Style) */}
      <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-[#18212c] px-3 py-3 sm:px-4 sm:py-4 md:px-6 md:pt-8 md:pb-6 flex-shrink-0 md:sticky md:top-14 md:h-[calc(100vh-3.5rem)] overflow-x-auto md:overflow-y-auto no-scrollbar bg-[#090d12]">
        <div className="flex items-center justify-between md:flex-col md:items-stretch gap-2 md:gap-6 mb-2 md:mb-8">
          <button
            onClick={goBack}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#aaa] hover:text-white px-2 py-1.5 rounded-lg hover:bg-[#18212c] transition cursor-pointer self-start"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('settings.back')}</span>
          </button>

          <h2 className="hidden md:block text-sm font-bold uppercase tracking-wider px-3 text-[#aaa]">
            {t('settings.title')}
          </h2>
        </div>

        <nav className="flex md:flex-col gap-1.5 md:gap-1 overflow-x-auto no-scrollbar pb-1 md:pb-0">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex-shrink-0 md:w-full flex items-center gap-2.5 sm:gap-3 px-3 py-2 sm:py-2.5 rounded-xl text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-[#18212c] text-white font-bold'
                    : 'text-[#aaa] hover:bg-[#0f151d] hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[#657383]'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 md:p-10 max-w-4xl">
        
        {/* TAB 1: GÉNÉRAL */}
        {activeTab === 'language' && (
          <div className="space-y-8">
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">{t('settings.tabLanguage')}</h1>
              <p className="text-xs text-[#aaa] mt-1">{t('settings.uiLanguageHint')}</p>
            </div>

            <div className="divide-y divide-[#18212c] border-t border-b border-[#18212c]">
              <div className="py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-0.5 max-w-lg">
                  <span className="text-sm font-semibold text-white block">{t('settings.uiLanguage')}</span>
                  <span className="text-xs text-[#aaa] block">{t('settings.uiLanguageHint')}</span>
                </div>
                <select
                  value={uiLanguage}
                  onChange={async (e) => {
                    const next = e.target.value as typeof uiLanguage;
                    await setUiLanguage(next);
                    showToast(t('settings.saved'));
                  }}
                  className="va-select"
                >
                  {UI_LANGUAGES.map((lang) => (
                    <option key={lang.id} value={lang.id}>{lang.label}</option>
                  ))}
                </select>
              </div>

              <div className="py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-0.5 max-w-lg">
                  <span className="text-sm font-semibold text-white block">{t('settings.localOnly')}</span>
                  <span className="text-xs text-[#aaa] block">{t('settings.localOnlyHint')}</span>
                </div>
                <button
                  onClick={() => { setLocalOnly(!localOnly); showToast(t('settings.saved')); }}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    localOnly ? 'bg-[#ff5a67]' : 'bg-[#18212c]'
                  }`}
                  title={localOnly ? t('settings.localOnlyOn') : t('settings.localOnlyOff')}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      localOnly ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'channels' && (
          <div className="space-y-8">
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">{t('settings.channelsTitle')}</h1>
              <p className="text-xs text-[#aaa] mt-1">{t('settings.channelsHint')}</p>
            </div>
            <LinkedChannelsSettings />
          </div>
        )}

        {activeTab === 'general' && (
          <div className="space-y-8">
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">{t('settings.generalTitle')}</h1>
              <p className="text-xs text-[#aaa] mt-1">
                {t('settings.generalHint')}
              </p>
            </div>

            <div className="divide-y divide-[#18212c] border-t border-b border-[#18212c]">
              {/* Row: Résolution par défaut */}
              <div className="py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <span className="text-sm font-semibold text-white block">{t('settings.defaultQuality')}</span>
                  <span className="text-xs text-[#aaa] block">
                    {t('settings.defaultQualityHint')}
                  </span>
                </div>

                <div className="flex-shrink-0">
                  <select
                    value={defaultResolution}
                    onChange={(e) => {
                      setDefaultResolution(e.target.value);
                      handleSaveGeneralSettings(scanInterval, e.target.value, autoDownloadNewSubs);
                    }}
                    className="va-select"
                  >
                    <option value="2160p">{t('settings.q4k')}</option>
                    <option value="1440p">{t('settings.q2k')}</option>
                    <option value="1080p">{t('settings.q1080rec')}</option>
                    <option value="720p">{t('settings.q720')}</option>
                  </select>
                </div>
              </div>

              {/* Row: Auto-téléchargement pour les nouveaux abonnements */}
              <div className="py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-0.5 max-w-lg">
                  <span className="text-sm font-semibold text-white block">
                    {t('settings.autoDownload')}
                  </span>
                  <span className="text-xs text-[#aaa] block">
                    {t('settings.autoDownloadHint')}
                  </span>
                </div>

                <div className="flex-shrink-0">
                  <button
                    onClick={() => {
                      const nextVal = !autoDownloadNewSubs;
                      setAutoDownloadNewSubs(nextVal);
                      handleSaveGeneralSettings(scanInterval, defaultResolution, nextVal);
                    }}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      autoDownloadNewSubs ? 'bg-[#ff5a67]' : 'bg-[#18212c]'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        autoDownloadNewSubs ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Row: Téléchargements simultanés */}
              <div className="py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-0.5 max-w-lg">
                  <span className="text-sm font-semibold text-white block">
                    {t('settings.concurrentDl')}
                  </span>
                  <span className="text-xs text-[#aaa] block">
                    {t('settings.concurrentDlHint')}
                  </span>
                </div>

                <div className="flex-shrink-0">
                  <select
                    value={concurrentDownloads}
                    onChange={(e) => {
                      setConcurrentDownloads(e.target.value);
                      handleSaveGeneralSettings(scanInterval, defaultResolution, autoDownloadNewSubs, e.target.value);
                    }}
                    className="va-select"
                  >
                    <option value="1">{t('settings.concurrent1')}</option>
                    <option value="2">{t('settings.concurrent2')}</option>
                    <option value="3">{t('settings.concurrent3')}</option>
                    <option value="4">{t('settings.concurrent4')}</option>
                  </select>
                </div>
              </div>

              {/* Row: Répertoire local */}
              <div className="py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <span className="text-sm font-semibold text-white block">{t('settings.mediaFolder')}</span>
                  <span className="text-xs text-[#aaa] block font-mono text-[11px]">
                    {systemStatus?.downloadsDir || 'downloads/'}
                  </span>
                </div>

                <div className="flex-shrink-0">
                  <button
                    onClick={handleCopyPath}
                    className="bg-[#18212c] hover:bg-[#23303e] text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition cursor-pointer flex items-center gap-1.5"
                  >
                    {copiedPath ? <Check className="w-3.5 h-3.5 text-[#73c7e8]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedPath ? t('settings.copied') : t('settings.copy')}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SCANNER */}
        {activeTab === 'scanner' && (
          <div className="space-y-8">
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">{t('settings.scannerTitle')}</h1>
              <p className="text-xs text-[#aaa] mt-1">
                {t('settings.scannerHint')}
              </p>
            </div>

            <div className="divide-y divide-[#18212c] border-t border-b border-[#18212c]">
              <div className="py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-0.5 max-w-lg">
                  <span className="text-sm font-semibold text-white block">{t('settings.scanEnabled')}</span>
                  <span className="text-xs text-[#aaa] block">
                    {scanEnabled ? t('settings.scanEnabledHint') : t('settings.scanEnabledOffHint')}
                  </span>
                </div>
                <div className="flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setScanEnabled(!scanEnabled)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      scanEnabled ? 'bg-[#ff5a67]' : 'bg-[#18212c]'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        scanEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Row: Fréquence */}
              <div className="py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <span className="text-sm font-semibold text-white block">{t('settings.scanFreq')}</span>
                  <span className="text-xs text-[#aaa] block">
                    {t('settings.scanFreqHint')}
                  </span>
                </div>

                <div className="flex-shrink-0">
                  <select
                    value={scanInterval}
                    onChange={(e) => {
                      setScanInterval(e.target.value);
                      handleSaveGeneralSettings(e.target.value, defaultResolution, autoDownloadNewSubs);
                    }}
                    className="va-select"
                  >
                    <option value="30">{t('settings.every30')}</option>
                    <option value="60">{t('settings.everyHour')}</option>
                    <option value="360">{t('settings.every6h')}</option>
                    <option value="720">{t('settings.every12h')}</option>
                    <option value="1440">{t('settings.everyDay')}</option>
                  </select>
                </div>
              </div>

              {scanEnabled && (
              <div className="py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <span className="text-sm font-semibold text-white block">{t('settings.manualSync')}</span>
                  <span className="text-xs text-[#aaa] block">
                    {t('settings.manualSyncHint', { count: subscriptions.length })}
                  </span>
                </div>

                <div className="flex-shrink-0">
                  <button
                    onClick={triggerScan}
                    disabled={isScanning}
                    className="bg-white hover:bg-white/90 text-black text-xs font-bold px-4 py-2 rounded-full transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
                  >
                    <Radio className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-[#ff5a67]' : 'text-black'}`} />
                    <span>{isScanning ? t('settings.scanning') : t('settings.scanNow')}</span>
                  </button>
                </div>
              </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: COOKIES */}
        {activeTab === 'cookies' && (
          <div className="space-y-8">
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">{t('settings.cookiesTitle')}</h1>
              <p className="text-xs text-[#aaa] mt-1">
                {t('settings.cookiesHint')}
              </p>
            </div>

            <div className="divide-y divide-[#18212c] border-t border-b border-[#18212c]">
              {/* Row: Statut */}
              <div className="py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <span className="text-sm font-semibold text-white block">{t('settings.sessionState')}</span>
                  <span className="text-xs text-[#aaa] block">
                    {systemStatus?.hasCookies ? t('settings.cookiesActiveHint') : t('settings.cookiesNoneHint')}
                  </span>
                </div>

                <div className="flex-shrink-0">
                  {systemStatus?.hasCookies ? (
                    <span className="inline-flex items-center gap-2 text-xs text-[#c7d0da] font-medium bg-[#111821] px-3 py-2 rounded-lg border border-[#24303d]">
                      <Check className="w-3.5 h-3.5 text-[#8794a3]" />
                      <span>{t('settings.cookiesActive')}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2 text-xs text-[#c7d0da] font-medium bg-[#111821] px-3 py-2 rounded-lg border border-[#24303d]">
                      <Lock className="w-3.5 h-3.5 text-[#8794a3]" />
                      <span>{t('settings.anonymous')}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Row: Actions */}
              <div className="py-5 space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    accept=".txt" 
                    className="hidden" 
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-white hover:bg-white/90 text-black text-xs font-bold px-4 py-2 rounded-full transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{t('settings.importCookies')}</span>
                  </button>

                  <button
                    onClick={() => setShowCookiesEditor(!showCookiesEditor)}
                    className="bg-[#18212c] hover:bg-[#23303e] text-white text-xs font-semibold px-4 py-2 rounded-full transition cursor-pointer"
                  >
                    {showCookiesEditor ? t('settings.hideEditor') : t('settings.manualEditor')}
                  </button>

                  {systemStatus?.hasCookies && (
                    <button
                      onClick={handleDeleteCookies}
                      className="bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold px-4 py-2 rounded-full transition cursor-pointer flex items-center gap-1.5 border border-red-500/20"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{t('common.delete')}</span>
                    </button>
                  )}
                </div>

                {/* Editor */}
                {showCookiesEditor && (
                  <div className="p-4 bg-[#0d131b] border border-[#18212c] rounded-xl space-y-3">
                    <textarea
                      rows={5}
                      value={cookiesText}
                      onChange={(e) => setCookiesText(e.target.value)}
                      placeholder="# Netscape HTTP Cookie File&#10;.youtube.com  TRUE  /  TRUE  1786520000  VISITOR_INFO1_LIVE  ..."
                      className="w-full bg-[#1e1e1e] border border-[#333] rounded-lg p-3 text-xs font-mono text-white placeholder-[#555] focus:outline-none focus:border-white"
                    />
                    <div className="flex justify-end">
                      <button
                        onClick={handleSaveCookies}
                        disabled={isSavingCookies || !cookiesText.trim()}
                        className="bg-white hover:bg-white/90 text-black text-xs font-bold px-4 py-1.5 rounded-full transition cursor-pointer disabled:opacity-40"
                      >
                        {isSavingCookies ? t('settings.savingCookies') : t('common.save')}
                      </button>
                    </div>
                  </div>
                )}

                {cookiesMessage && (
                  <div className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                    cookiesMessage.type === 'success' ? 'text-[#b8d9e6] bg-[#73c7e8]/10' : 'text-red-400 bg-red-500/10'
                  }`}>
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span>{cookiesMessage.text}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: STOCKAGE */}
        {activeTab === 'storage' && (
          <div className="space-y-8">
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">{t('settings.storageTitle')}</h1>
              <p className="text-xs text-[#aaa] mt-1">
                {t('settings.storageHint')}
              </p>
            </div>

            <div className="divide-y divide-[#18212c] border-t border-b border-[#18212c]">
              {/* Row: Espace disque */}
              <div className="py-5 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-sm font-semibold text-white block">{t('settings.diskUsed')}</span>
                  <span className="text-xs text-[#aaa] block">{t('settings.diskUsedHint')}</span>
                </div>
                <span className="font-mono text-sm font-bold text-white">
                  {systemStatus?.storageFormatted || '0 Mo'}
                </span>
              </div>

              {/* Row: Vidéos archivées */}
              <div className="py-5 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-sm font-semibold text-white block">{t('settings.archivedVideos')}</span>
                  <span className="text-xs text-[#aaa] block">{t('settings.archivedHint')}</span>
                </div>
                <span className="text-sm font-bold text-white">
                  {t('settings.videoCount', { count: systemStatus?.downloadedCount || 0 })}
                </span>
              </div>

              {/* Row: Purge cache */}
              <div className="py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <span className="text-sm font-semibold text-white block">{t('settings.cleanup')}</span>
                  <span className="text-xs text-[#aaa] block">
                    {t('settings.cleanupHint')}
                  </span>
                </div>

                <div className="flex-shrink-0">
                  <button
                    onClick={handleCleanupCache}
                    disabled={isCleaningCache}
                    className="bg-[#111821] hover:bg-[#18212c] border border-[#24303d] text-[#d8dfe7] text-xs font-semibold px-4 py-2 rounded-lg transition cursor-pointer flex items-center gap-2"
                  >
                    {isCleaningCache ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 text-[#8794a3]" />}
                    <span>{isCleaningCache ? t('settings.cleaning') : t('settings.purgeCache')}</span>
                  </button>
                </div>
              </div>
            </div>

            {cleanupResult && (
              <div className="p-3 bg-[#73c7e8]/10 text-[#b8d9e6] text-xs rounded-lg flex items-center gap-2">
                <Check className="w-4 h-4" />
                <span>{cleanupResult}</span>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: SYSTÈME */}
        {activeTab === 'system' && (
          <div className="space-y-8">
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">{t('settings.systemTitle')}</h1>
              <p className="text-xs text-[#aaa] mt-1">
                {t('settings.systemHint')}
              </p>
            </div>

            <div className="divide-y divide-[#18212c] border-t border-b border-[#18212c]">
              {/* Row: yt-dlp version */}
              <div className="py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <span className="text-sm font-semibold text-white block">{t('settings.ytdlpVersion')}</span>
                  <span className="text-xs text-[#aaa] block font-mono">
                    {systemStatus?.ytdlpVersion || t('settings.detecting')}
                  </span>
                </div>

                <div className="flex-shrink-0">
                  <button
                    onClick={handleUpdateYtdlp}
                    disabled={isUpdatingYtdlp}
                    className="bg-white hover:bg-white/90 text-black text-xs font-bold px-4 py-2 rounded-full transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
                  >
                    {isUpdatingYtdlp ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>{t('settings.updating')}</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>{t('settings.update')}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Row: Chemin binaire */}
              <div className="py-5 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-sm font-semibold text-white block">{t('settings.binaryPath')}</span>
                  <span className="text-xs text-[#aaa] block">{t('settings.binaryHint')}</span>
                </div>
                <span className="font-mono text-xs text-[#888] truncate max-w-xs">
                  {systemStatus?.ytdlpPath || 'PATH'}
                </span>
              </div>

              <div className="py-5 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-sm font-semibold text-white block">{t('settings.autoYtdlp')}</span>
                  <span className="text-xs text-[#aaa] block">{t('settings.autoYtdlpHint')}</span>
                </div>
                <button
                  onClick={async () => {
                    const next = !autoUpdateYtdlp;
                    setAutoUpdateYtdlp(next);
                    await fetch('/api/system/settings', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ auto_update_ytdlp: next ? 'true' : 'false' }),
                    });
                    showToast(next ? t('settings.autoOn') : t('settings.autoOff'));
                  }}
                  className={`w-11 h-6 rounded-full transition ${autoUpdateYtdlp ? 'bg-[#73c7e8]/65' : 'bg-[#26313d]'}`}
                >
                  <span className={`block w-5 h-5 bg-white rounded-full transition ${autoUpdateYtdlp ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
              <div className="py-5 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-sm font-semibold text-white block">{t('settings.database')}</span>
                  <span className="text-xs text-[#aaa] block">{t('settings.databaseHint')}</span>
                </div>
                <span className="inline-flex items-center gap-2 text-xs text-[#c7d0da] font-medium bg-[#111821] border border-[#24303d] px-3 py-2 rounded-lg">
                  <Database className="w-3.5 h-3.5 text-[#8794a3]" />
                  {t('settings.sqliteWal')}
                </span>
              </div>
            </div>

            {updateMessage && (
              <div className="p-3 bg-[#0f151d] border border-[#18212c] text-xs font-mono text-[#ddd] rounded-lg">
                {updateMessage}
              </div>
            )}
          </div>
        )}

        {activeTab === 'security' && (
          <div className="space-y-8">
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">{t('settings.securityTitle')}</h1>
              <p className="text-xs text-[#aaa] mt-1">
                {t('settings.securityHint')}
              </p>
            </div>

            <div className="divide-y divide-[#18212c] border-t border-b border-[#18212c]">
              <div className="py-5 space-y-3">
                <span className="text-sm font-semibold text-white block">
                  {auth.envLocked ? t('settings.pwEnv') : auth.required ? t('settings.pwChange') : t('settings.pwEnable')}
                </span>
                <span className="text-xs text-[#aaa] block">
                  {auth.envLocked
                    ? t('settings.pwEnvHint')
                    : t('settings.pwHint')}
                </span>
                {!auth.envLocked && (
                  <div className="space-y-2 max-w-sm">
                    {auth.required && (
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder={t('settings.pwCurrent')}
                        className="w-full bg-[#0c1118] border border-[#23303e] text-sm rounded-xl px-3 py-2 outline-none focus:border-white"
                      />
                    )}
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder={auth.required ? t('settings.pwNew') : t('settings.pwChoose')}
                      className="w-full bg-[#0c1118] border border-[#23303e] text-sm rounded-xl px-3 py-2 outline-none focus:border-white"
                    />
                    <button
                      onClick={async () => {
                        setAuthMessage(null);
                        try {
                          const endpoint = auth.required ? '/api/auth/password' : '/api/auth/setup';
                          const body = auth.required
                            ? { currentPassword, newPassword }
                            : { password: newPassword };
                          const res = await fetch(endpoint, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(body),
                          });
                          const data = await res.json();
                          if (!res.ok) {
                            setAuthMessage(data.error || t('common.error'));
                            return;
                          }
                          setNewPassword('');
                          setCurrentPassword('');
                          setAuthMessage(t('settings.pwSaved'));
                          await refreshAuth();
                          showToast(t('settings.securityUpdated'));
                        } catch (err: any) {
                          setAuthMessage(t('settings.errorPrefix', { msg: err.message }));
                        }
                      }}
                      disabled={newPassword.length < 6}
                      className="bg-white text-black text-xs font-bold px-4 py-2 rounded-full disabled:opacity-40"
                    >
                      {t('common.save')}
                    </button>
                  </div>
                )}
                {authMessage && <p className="text-xs text-[#aaa]">{authMessage}</p>}
              </div>

              {auth.required && !auth.envLocked && (
                <div className="py-5 flex items-center justify-between gap-4">
                  <div>
                    <span className="text-sm font-semibold text-white block">{t('settings.disableAuth')}</span>
                    <span className="text-xs text-[#aaa] block">{t('settings.disableAuthHint')}</span>
                  </div>
                  <button
                    onClick={async () => {
                      if (!confirm(t('settings.disableConfirm'))) return;
                      const res = await fetch('/api/auth/disable', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ currentPassword }),
                      });
                      const data = await res.json();
                      if (!res.ok) {
                        setAuthMessage(data.error || t('common.error'));
                        return;
                      }
                      await refreshAuth();
                      showToast(t('settings.disabled'));
                    }}
                    className="text-xs text-red-400 hover:bg-red-500/10 px-3 py-2 rounded-lg"
                  >
                    {t('settings.disable')}
                  </button>
                </div>
              )}

              {auth.required && (
                <div className="py-5 flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">{t('settings.session')}</span>
                  <button
                    onClick={() => logout()}
                    className="text-xs bg-[#18212c] hover:bg-[#23303e] px-4 py-2 rounded-full"
                  >
                    {t('settings.logout')}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Legal Disclaimer Footer */}
        <div className="pt-8 border-t border-[#18212c]/60 text-center sm:text-left">
          <p className="text-[11px] text-[#657383] leading-relaxed">
            {t('settings.legal')}
          </p>
        </div>

      </main>
    </div>
  );
};
