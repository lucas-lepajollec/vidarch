import React, { useState, useEffect, useRef } from 'react';
import { 
  Check, 
  AlertCircle, 
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
  ExternalLink
} from 'lucide-react';
import { useMyTube } from '../context/MyTubeContext';

type SettingsTab = 'general' | 'scanner' | 'cookies' | 'storage' | 'system';

export const Settings: React.FC = () => {
  const { systemStatus, refreshSystemStatus, triggerScan, isScanning, subscriptions, goBack } = useMyTube();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [isUpdatingYtdlp, setIsUpdatingYtdlp] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);

  const [cookiesText, setCookiesText] = useState('');
  const [showCookiesEditor, setShowCookiesEditor] = useState(false);
  const [isSavingCookies, setIsSavingCookies] = useState(false);
  const [cookiesMessage, setCookiesMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [scanInterval, setScanInterval] = useState('60');
  const [defaultResolution, setDefaultResolution] = useState('1080p');
  const [autoDownloadNewSubs, setAutoDownloadNewSubs] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [isCleaningCache, setIsCleaningCache] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<string | null>(null);
  const [copiedPath, setCopiedPath] = useState(false);

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
      })
      .catch(() => {});
  }, [refreshSystemStatus]);

  const handleUpdateYtdlp = async () => {
    setIsUpdatingYtdlp(true);
    setUpdateMessage(null);
    try {
      const res = await fetch('/api/system/update-ytdlp', { method: 'POST' });
      const data = await res.json();
      setUpdateMessage(data.message || (data.success ? 'yt-dlp est à jour !' : 'Erreur de mise à jour'));
      await refreshSystemStatus();
      showToast('yt-dlp mis à jour');
    } catch (err: any) {
      setUpdateMessage(`Erreur: ${err.message}`);
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
        setCookiesMessage({ type: 'success', text: 'Cookies Netscape enregistrés et actifs.' });
        setShowCookiesEditor(false);
        await refreshSystemStatus();
        showToast('Cookies enregistrés');
      }
    } catch (err: any) {
      setCookiesMessage({ type: 'error', text: `Erreur: ${err.message}` });
    } finally {
      setIsSavingCookies(false);
    }
  };

  const handleDeleteCookies = async () => {
    if (!confirm('Supprimer les cookies et repasser en mode anonyme ?')) return;
    try {
      const res = await fetch('/api/system/cookies', { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setCookiesText('');
        setShowCookiesEditor(false);
        setCookiesMessage({ type: 'success', text: 'Cookies supprimés. Mode anonyme actif.' });
        await refreshSystemStatus();
        showToast('Mode anonyme actif');
      }
    } catch (err: any) {
      showToast(`Erreur: ${err.message}`);
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

  const handleSaveGeneralSettings = async (overrideInterval?: string, overrideRes?: string, overrideAutoDl?: boolean) => {
    const newInterval = overrideInterval !== undefined ? overrideInterval : scanInterval;
    const newRes = overrideRes !== undefined ? overrideRes : defaultResolution;
    const newAutoDl = overrideAutoDl !== undefined ? overrideAutoDl : autoDownloadNewSubs;
    
    try {
      const res = await fetch('/api/system/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auto_scan_interval: newInterval,
          default_max_resolution: newRes,
          auto_download_new_subs: newAutoDl ? '1' : '0',
        }),
      });
      if (res.ok) {
        showToast('Paramètre enregistré');
      }
    } catch (err: any) {
      showToast(`Erreur: ${err.message}`);
    }
  };

  const handleCleanupCache = async () => {
    setIsCleaningCache(true);
    setCleanupResult(null);
    try {
      const res = await fetch('/api/system/cleanup-cache', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setCleanupResult(`Cache nettoyé : ${data.cleanedVideos || 0} vidéos éphémères et ${data.cleanedSearchHistory || 0} requêtes purgées.`);
        showToast('Cache nettoyé');
        await refreshSystemStatus();
      }
    } catch (err: any) {
      setCleanupResult(`Erreur: ${err.message}`);
    } finally {
      setIsCleaningCache(false);
    }
  };

  const handleCopyPath = () => {
    if (systemStatus?.downloadsDir) {
      navigator.clipboard?.writeText(systemStatus.downloadsDir);
      setCopiedPath(true);
      setTimeout(() => setCopiedPath(false), 2000);
      showToast('Chemin copié');
    }
  };

  const navItems: Array<{ id: SettingsTab; label: string; icon: React.FC<{ className?: string }> }> = [
    { id: 'general', label: 'Général & Qualité', icon: Sliders },
    { id: 'scanner', label: 'Scanner & Synchronisation', icon: Radio },
    { id: 'cookies', label: 'Cookies & Anti-Bot', icon: ShieldCheck },
    { id: 'storage', label: 'Stockage & Fichiers', icon: HardDrive },
    { id: 'system', label: 'Système & yt-dlp', icon: Cpu },
  ];

  return (
    <div className="flex-1 flex flex-col md:flex-row min-h-[calc(100vh-3.5rem)] text-[#f1f1f1]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#212121] border border-[#383838] text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Left Sidebar / Horizontal Tab bar on mobile (Classic YouTube Studio / Account Style) */}
      <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-[#272727] p-3 sm:p-4 md:p-6 flex-shrink-0 md:sticky md:top-14 md:h-[calc(100vh-3.5rem)] overflow-x-auto md:overflow-y-auto no-scrollbar bg-[#0f0f0f]">
        <div className="flex items-center justify-between md:block mb-2 md:mb-6">
          <button
            onClick={goBack}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#aaa] hover:text-white px-2 py-1.5 rounded-lg hover:bg-[#272727] transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Retour</span>
          </button>

          <h2 className="hidden md:block text-sm font-bold text-white uppercase tracking-wider px-3 mb-3 text-[#aaa]">
            Paramètres
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
                    ? 'bg-[#272727] text-white font-bold'
                    : 'text-[#aaa] hover:bg-[#181818] hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[#717171]'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 md:p-10 max-w-4xl">
        
        {/* TAB 1: GÉNÉRAL */}
        {activeTab === 'general' && (
          <div className="space-y-8">
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Général & Qualité</h1>
              <p className="text-xs text-[#aaa] mt-1">
                Définissez la résolution cible et les règles de téléchargement pour votre archive.
              </p>
            </div>

            <div className="divide-y divide-[#272727] border-t border-b border-[#272727]">
              {/* Row: Résolution par défaut */}
              <div className="py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <span className="text-sm font-semibold text-white block">Qualité vidéo par défaut</span>
                  <span className="text-xs text-[#aaa] block">
                    Résolution visée lors du téléchargement d'une vidéo ou d'une chaîne
                  </span>
                </div>

                <div className="flex-shrink-0">
                  <select
                    value={defaultResolution}
                    onChange={(e) => {
                      setDefaultResolution(e.target.value);
                      handleSaveGeneralSettings(scanInterval, e.target.value, autoDownloadNewSubs);
                    }}
                    className="bg-[#272727] hover:bg-[#383838] text-white text-xs font-medium px-4 py-2 rounded-lg border border-[#383838] focus:outline-none focus:border-white transition cursor-pointer"
                  >
                    <option value="2160p">4K Ultra HD (2160p)</option>
                    <option value="1440p">2K Quad HD (1440p)</option>
                    <option value="1080p">1080p Full HD (Recommandé)</option>
                    <option value="720p">720p HD</option>
                  </select>
                </div>
              </div>

              {/* Row: Auto-téléchargement pour les nouveaux abonnements */}
              <div className="py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-0.5 max-w-lg">
                  <span className="text-sm font-semibold text-white block">
                    Auto-téléchargement des nouveaux abonnements
                  </span>
                  <span className="text-xs text-[#aaa] block">
                    Télécharger automatiquement sur le disque les nouvelles vidéos des chaînes auxquelles vous vous abonnez
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
                      autoDownloadNewSubs ? 'bg-[#ff0033]' : 'bg-[#272727]'
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

              {/* Row: Répertoire local */}
              <div className="py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <span className="text-sm font-semibold text-white block">Dossier des médias</span>
                  <span className="text-xs text-[#aaa] block font-mono text-[11px]">
                    {systemStatus?.downloadsDir || 'downloads/'}
                  </span>
                </div>

                <div className="flex-shrink-0">
                  <button
                    onClick={handleCopyPath}
                    className="bg-[#272727] hover:bg-[#383838] text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition cursor-pointer flex items-center gap-1.5"
                  >
                    {copiedPath ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedPath ? 'Copié' : 'Copier'}</span>
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
              <h1 className="text-xl font-bold text-white tracking-tight">Scanner & Synchronisation</h1>
              <p className="text-xs text-[#aaa] mt-1">
                Configurez la fréquence à laquelle VidArch surveille les nouvelles vidéos de vos abonnements.
              </p>
            </div>

            <div className="divide-y divide-[#272727] border-t border-b border-[#272727]">
              {/* Row: Fréquence */}
              <div className="py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <span className="text-sm font-semibold text-white block">Fréquence du scan automatique</span>
                  <span className="text-xs text-[#aaa] block">
                    Recherche des nouveaux uploads sur les chaînes abonnées
                  </span>
                </div>

                <div className="flex-shrink-0">
                  <select
                    value={scanInterval}
                    onChange={(e) => {
                      setScanInterval(e.target.value);
                      handleSaveGeneralSettings(e.target.value, defaultResolution, autoDownloadNewSubs);
                    }}
                    className="bg-[#272727] hover:bg-[#383838] text-white text-xs font-medium px-4 py-2 rounded-lg border border-[#383838] focus:outline-none focus:border-white transition cursor-pointer"
                  >
                    <option value="30">Toutes les 30 minutes</option>
                    <option value="60">Toutes les heures (Recommandé)</option>
                    <option value="360">Toutes les 6 heures</option>
                    <option value="720">Toutes les 12 heures</option>
                    <option value="1440">Une fois par jour (24h)</option>
                  </select>
                </div>
              </div>

              {/* Row: Scan manuel */}
              <div className="py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <span className="text-sm font-semibold text-white block">Synchronisation manuelle</span>
                  <span className="text-xs text-[#aaa] block">
                    Analyser immédiatement l'ensemble de vos {subscriptions.length} abonnements
                  </span>
                </div>

                <div className="flex-shrink-0">
                  <button
                    onClick={triggerScan}
                    disabled={isScanning}
                    className="bg-white hover:bg-white/90 text-black text-xs font-bold px-4 py-2 rounded-full transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
                  >
                    <Radio className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-[#ff0033]' : 'text-black'}`} />
                    <span>{isScanning ? 'Scan en cours...' : 'Lancer un scan'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: COOKIES */}
        {activeTab === 'cookies' && (
          <div className="space-y-8">
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Cookies & Authentification</h1>
              <p className="text-xs text-[#aaa] mt-1">
                Importez un fichier cookies.txt pour contourner les restrictions d'âge et les blocages anti-bot.
              </p>
            </div>

            <div className="divide-y divide-[#272727] border-t border-b border-[#272727]">
              {/* Row: Statut */}
              <div className="py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <span className="text-sm font-semibold text-white block">État de la session</span>
                  <span className="text-xs text-[#aaa] block">
                    {systemStatus?.hasCookies ? 'Fichier cookies.txt actif et chargé par yt-dlp' : 'Aucun cookie configuré (requêtes anonymes publiques)'}
                  </span>
                </div>

                <div className="flex-shrink-0">
                  {systemStatus?.hasCookies ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-semibold bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
                      <Check className="w-3.5 h-3.5" />
                      <span>Cookies actifs</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs text-amber-400 font-semibold bg-amber-500/10 px-3 py-1.5 rounded-full border border-amber-500/20">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Mode Anonyme</span>
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
                    <span>Importer cookies.txt</span>
                  </button>

                  <button
                    onClick={() => setShowCookiesEditor(!showCookiesEditor)}
                    className="bg-[#272727] hover:bg-[#383838] text-white text-xs font-semibold px-4 py-2 rounded-full transition cursor-pointer"
                  >
                    {showCookiesEditor ? 'Masquer l\'éditeur' : 'Éditeur manuel'}
                  </button>

                  {systemStatus?.hasCookies && (
                    <button
                      onClick={handleDeleteCookies}
                      className="bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold px-4 py-2 rounded-full transition cursor-pointer flex items-center gap-1.5 border border-red-500/20"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Supprimer</span>
                    </button>
                  )}
                </div>

                {/* Editor */}
                {showCookiesEditor && (
                  <div className="p-4 bg-[#141414] border border-[#272727] rounded-xl space-y-3">
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
                        {isSavingCookies ? 'Enregistrement...' : 'Enregistrer'}
                      </button>
                    </div>
                  </div>
                )}

                {cookiesMessage && (
                  <div className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                    cookiesMessage.type === 'success' ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'
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
              <h1 className="text-xl font-bold text-white tracking-tight">Stockage & Fichiers</h1>
              <p className="text-xs text-[#aaa] mt-1">
                Visualisez l'occupation disque et maintenez la base de données propre.
              </p>
            </div>

            <div className="divide-y divide-[#272727] border-t border-b border-[#272727]">
              {/* Row: Espace disque */}
              <div className="py-5 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-sm font-semibold text-white block">Espace disque utilisé</span>
                  <span className="text-xs text-[#aaa] block">Volume total des vidéos et miniatures téléchargées</span>
                </div>
                <span className="font-mono text-sm font-bold text-white">
                  {systemStatus?.storageFormatted || '0 Mo'}
                </span>
              </div>

              {/* Row: Vidéos archivées */}
              <div className="py-5 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-sm font-semibold text-white block">Vidéos archivées</span>
                  <span className="text-xs text-[#aaa] block">Fichiers multimédias disponibles hors-ligne</span>
                </div>
                <span className="text-sm font-bold text-white">
                  {systemStatus?.downloadedCount || 0} vidéo{(systemStatus?.downloadedCount || 0) > 1 ? 's' : ''}
                </span>
              </div>

              {/* Row: Purge cache */}
              <div className="py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <span className="text-sm font-semibold text-white block">Nettoyage du cache éphémère</span>
                  <span className="text-xs text-[#aaa] block">
                    Purger les recherches passées et optimiser l'espace de la base de données
                  </span>
                </div>

                <div className="flex-shrink-0">
                  <button
                    onClick={handleCleanupCache}
                    disabled={isCleaningCache}
                    className="bg-[#272727] hover:bg-[#383838] text-white text-xs font-semibold px-4 py-2 rounded-lg transition cursor-pointer flex items-center gap-2"
                  >
                    {isCleaningCache ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 text-amber-400" />}
                    <span>{isCleaningCache ? 'Nettoyage...' : 'Purger le cache'}</span>
                  </button>
                </div>
              </div>
            </div>

            {cleanupResult && (
              <div className="p-3 bg-emerald-500/10 text-emerald-400 text-xs rounded-lg flex items-center gap-2">
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
              <h1 className="text-xl font-bold text-white tracking-tight">Système & yt-dlp</h1>
              <p className="text-xs text-[#aaa] mt-1">
                Informations sur le runtime et le moteur d'extraction.
              </p>
            </div>

            <div className="divide-y divide-[#272727] border-t border-b border-[#272727]">
              {/* Row: yt-dlp version */}
              <div className="py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <span className="text-sm font-semibold text-white block">Version de yt-dlp</span>
                  <span className="text-xs text-[#aaa] block font-mono">
                    {systemStatus?.ytdlpVersion || 'Détection...'}
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
                        <span>Mise à jour...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Mettre à jour</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Row: Chemin binaire */}
              <div className="py-5 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-sm font-semibold text-white block">Emplacement du binaire</span>
                  <span className="text-xs text-[#aaa] block">Chemin d'accès au binaire d'extraction</span>
                </div>
                <span className="font-mono text-xs text-[#888] truncate max-w-xs">
                  {systemStatus?.ytdlpPath || 'PATH'}
                </span>
              </div>

              {/* Row: Base de données */}
              <div className="py-5 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-sm font-semibold text-white block">Base de données</span>
                  <span className="text-xs text-[#aaa] block">Moteur de stockage local indexé</span>
                </div>
                <span className="text-xs text-emerald-400 font-medium bg-emerald-500/10 px-2.5 py-1 rounded-full">
                  SQLite (Mode WAL)
                </span>
              </div>
            </div>

            {updateMessage && (
              <div className="p-3 bg-[#181818] border border-[#272727] text-xs font-mono text-[#ddd] rounded-lg">
                {updateMessage}
              </div>
            )}
          </div>
        )}

        {/* Legal Disclaimer Footer */}
        <div className="pt-8 border-t border-[#272727]/60 text-center sm:text-left">
          <p className="text-[11px] text-[#717171] leading-relaxed">
            <strong className="text-[#888]">VidArch</strong> est un logiciel libre et auto-hébergé à but personnel. Il n'est en aucun cas affilié, sponsorisé ou approuvé par Google LLC ou YouTube LLC. YouTube est une marque déposée de Google LLC.
          </p>
        </div>

      </main>
    </div>
  );
};
