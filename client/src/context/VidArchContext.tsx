/* oxlint-disable react/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { Channel, DownloadTask, SystemStatus, PageRoute, NavigationState, AuthStatus } from '../types';
import { navToPath, pathToNav } from '../utils/routes';
import { parseQualityNote } from '../utils/qualityNote';
import { useI18n } from '../i18n/I18nProvider';
import type { UiLanguage } from '../i18n/messages';
import { isDemoMode } from '../demo/config';

export type { PageRoute, NavigationState };

export type DownloadQualityNotice = {
  title: string;
  videoId?: string;
  requested: string;
  actual: string;
  direction: 'lower' | 'higher';
};

export interface DownloadModalConfig {
  isOpen: boolean;
  videoId?: string;
  url?: string;
  title?: string;
  channelTitle?: string;
  channelId?: string;
  thumbnailUrl?: string;
  durationString?: string;
}

interface VidArchContextType {
  nav: NavigationState;
  goTo: (page: PageRoute, params?: { videoId?: string; channelId?: string; query?: string; playlistId?: string; playlistShuffle?: boolean }) => void;
  goBack: () => void;
  subscriptions: Channel[];
  refreshSubscriptions: () => Promise<void>;
  subscribeChannel: (url: string, autoDownload?: boolean, maxResolution?: string) => Promise<boolean>;
  unsubscribeChannel: (channelId: string) => Promise<boolean>;
  systemStatus: SystemStatus | null;
  refreshSystemStatus: () => Promise<void>;
  isScanning: boolean;
  triggerScan: () => Promise<void>;
  downloadModal: DownloadModalConfig;
  openDownloadModal: (config: Omit<DownloadModalConfig, 'isOpen'>) => void;
  closeDownloadModal: () => void;
  isImportModalOpen: boolean;
  openImportModal: () => void;
  closeImportModal: () => void;
  myChannel: Channel | null;
  myChannels: Channel[];
  refreshMyChannel: () => Promise<void>;
  setActiveOwnerChannel: (channelId: string) => Promise<boolean>;
  isEditChannelModalOpen: boolean;
  editingChannel: Channel | null;
  openEditChannelModal: (channel?: Channel) => void;
  closeEditChannelModal: () => void;
  dataVersion: number;
  notifyDataChanged: () => void;
  auth: AuthStatus;
  refreshAuth: () => Promise<void>;
  markAuthenticated: () => void;
  logout: () => Promise<void>;
  localOnly: boolean;
  scanEnabled: boolean;
  uiLanguage: UiLanguage;
  setLocalOnly: (value: boolean) => Promise<void>;
  setScanEnabled: (value: boolean) => Promise<void>;
  setUiLanguage: (lang: UiLanguage) => Promise<void>;
  downloadNotice: DownloadQualityNotice | null;
  dismissDownloadNotice: () => void;
}

interface DownloadQueueContextType {
  queue: DownloadTask[];
  refreshQueue: () => Promise<void>;
  activeTask?: DownloadTask;
  enqueueDownload: (params: {
    videoId: string;
    url?: string;
    title?: string;
    channelTitle?: string;
    channelId?: string;
    thumbnailUrl?: string;
    resolution?: string;
  }) => Promise<void>;
}

const VidArchContext = createContext<VidArchContextType | null>(null);
const DownloadQueueContext = createContext<DownloadQueueContextType | null>(null);

const DownloadQueueProvider: React.FC<{
  children: React.ReactNode;
  navPage: string;
  authReady: boolean;
  notifyDataChanged: () => void;
  refreshSubscriptions: () => Promise<void>;
  refreshSystemStatus: () => Promise<void>;
  onCompleted: (data: { title?: string; videoId?: string; qualityNote?: string | null }) => void;
}> = ({
  children,
  navPage,
  authReady,
  notifyDataChanged,
  refreshSubscriptions,
  refreshSystemStatus,
  onCompleted,
}) => {
  const [queue, setQueue] = useState<DownloadTask[]>([]);

  const refreshQueue = useCallback(async () => {
    try {
      const res = await fetch('/api/downloads/queue');
      if (res.ok) {
        const data: DownloadTask[] = await res.json();
        setQueue(data);
      }
    } catch (err) {
      console.error('Error fetching download queue:', err);
    }
  }, []);

  useEffect(() => {
    if (!authReady) return;

    let eventSource: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    const connectSSE = () => {
      if (isDemoMode) return;
      try {
        eventSource = new EventSource('/api/downloads/events');

        eventSource.addEventListener('queue', (e) => {
          try {
            setQueue(JSON.parse(e.data));
          } catch {}
        });

        eventSource.addEventListener('progress', (e) => {
          try {
            const prog = JSON.parse(e.data);
            setQueue((prev) => prev.map((item) => item.id === prog.id ? {
              ...item,
              progress: prog.progress,
              speed: prog.speed,
              eta: prog.eta,
              status: String(prog.status || '').includes('Traitement') ? 'processing' : 'downloading',
            } : item));
          } catch {}
        });

        eventSource.addEventListener('completed', (e) => {
          void refreshQueue();
          void refreshSubscriptions();
          void refreshSystemStatus();
          notifyDataChanged();
          try {
            onCompleted(JSON.parse(e.data));
          } catch {}
        });

        eventSource.addEventListener('failed', () => {
          void refreshQueue();
          notifyDataChanged();
        });

        eventSource.onerror = () => {
          eventSource?.close();
          if (reconnectTimeout) clearTimeout(reconnectTimeout);
          reconnectTimeout = setTimeout(connectSSE, 3000);
        };
      } catch {
        reconnectTimeout = setTimeout(connectSSE, 3000);
      }
    };

    connectSSE();
    void refreshQueue();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      eventSource?.close();
    };
  }, [authReady, refreshQueue, refreshSubscriptions, refreshSystemStatus, notifyDataChanged, onCompleted]);

  const hasActive = queue.some((t) => t.status === 'downloading' || t.status === 'processing' || t.status === 'queued');

  useEffect(() => {
    if (!hasActive && navPage !== 'downloads') return;
    const interval = setInterval(() => {
      void refreshQueue();
    }, 1500);
    return () => clearInterval(interval);
  }, [hasActive, navPage, refreshQueue]);

  const enqueueDownload = useCallback(async (params: {
    videoId: string;
    url?: string;
    title?: string;
    channelTitle?: string;
    channelId?: string;
    thumbnailUrl?: string;
    resolution?: string;
  }) => {
    const res = await fetch('/api/downloads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to queue download');
    }

    if (data.item) {
      setQueue((prev) => [data.item, ...prev.filter((i) => i.id !== data.item.id)]);
    }
    await refreshQueue();
    notifyDataChanged();
  }, [refreshQueue, notifyDataChanged]);

  const activeTask = queue.find((t) => t.status === 'downloading' || t.status === 'processing' || t.status === 'queued');

  const value = useMemo<DownloadQueueContextType>(() => ({
    queue,
    refreshQueue,
    activeTask,
    enqueueDownload,
  }), [queue, refreshQueue, activeTask, enqueueDownload]);

  return (
    <DownloadQueueContext.Provider value={value}>
      {children}
    </DownloadQueueContext.Provider>
  );
};

export const VidArchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { language, setLanguage } = useI18n();
  const [nav, setNav] = useState<NavigationState>(() =>
    typeof window !== 'undefined' ? pathToNav(window.location.pathname, window.location.search) : { page: 'home' }
  );
  const [auth, setAuth] = useState<AuthStatus>({
    loading: true,
    required: false,
    authenticated: false,
    setupAvailable: true,
    envLocked: false,
  });
  const [subscriptions, setSubscriptions] = useState<Channel[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [downloadModal, setDownloadModal] = useState<DownloadModalConfig>({ isOpen: false });
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [myChannel, setMyChannel] = useState<Channel | null>(null);
  const [myChannels, setMyChannels] = useState<Channel[]>([]);
  const [isEditChannelModalOpen, setIsEditChannelModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [dataVersion, setDataVersion] = useState(0);
  const [localOnly, setLocalOnlyState] = useState(false);
  const [scanEnabled, setScanEnabledState] = useState(true);
  const [downloadNotice, setDownloadNotice] = useState<DownloadQualityNotice | null>(null);

  const notifyDataChanged = useCallback(() => {
    setDataVersion(v => v + 1);
  }, []);

  const persistSettings = useCallback(async (patch: Record<string, string>) => {
    const res = await fetch('/api/system/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error('Failed to save settings');
  }, []);

  const setLocalOnly = useCallback(async (value: boolean) => {
    setLocalOnlyState(value);
    try {
      await persistSettings({ local_only: value ? 'true' : 'false' });
    } catch {
      setLocalOnlyState(!value);
      return;
    }
    notifyDataChanged();
  }, [persistSettings, notifyDataChanged]);

  const setScanEnabled = useCallback(async (value: boolean) => {
    setScanEnabledState(value);
    try {
      await persistSettings({ scan_enabled: value ? 'true' : 'false' });
    } catch {
      setScanEnabledState(!value);
      return;
    }
    notifyDataChanged();
  }, [persistSettings, notifyDataChanged]);

  const setUiLanguage = useCallback(async (lang: UiLanguage) => {
    setLanguage(lang);
    try {
      await persistSettings({ ui_language: lang });
    } catch {}
    notifyDataChanged();
    try {
      const [subsRes, mineRes] = await Promise.all([
        fetch('/api/channels'),
        fetch('/api/channels/my-channel'),
      ]);
      if (subsRes.ok) setSubscriptions(await subsRes.json());
      if (mineRes.ok) setMyChannel(await mineRes.json());
    } catch {}
  }, [persistSettings, setLanguage, notifyDataChanged]);

  const openImportModal = useCallback(() => {
    setDownloadModal({ isOpen: false });
    setIsImportModalOpen(true);
  }, []);

  const closeImportModal = useCallback(() => {
    setIsImportModalOpen(false);
  }, []);

  const openEditChannelModal = useCallback((channel?: Channel) => {
    setEditingChannel(channel || myChannel || null);
    setIsEditChannelModalOpen(true);
  }, [myChannel]);

  const closeEditChannelModal = useCallback(() => {
    setIsEditChannelModalOpen(false);
    setEditingChannel(null);
  }, []);

  const goTo = useCallback((page: PageRoute, params?: { videoId?: string; channelId?: string; query?: string; playlistId?: string; playlistShuffle?: boolean }) => {
    const nextState: NavigationState = { page, ...params };
    setNav(nextState);
    const path = navToPath(nextState);
    if (window.location.pathname + window.location.search !== path) {
      window.history.pushState(nextState, '', path);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const goBack = useCallback(() => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      goTo('home');
    }
  }, [goTo]);

  useEffect(() => {
    const onPop = () => {
      setNav(pathToNav(window.location.pathname, window.location.search));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const refreshAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/status');
      if (res.ok) {
        const data = await res.json();
        setAuth({
          loading: false,
          required: !!data.required,
          authenticated: !!data.authenticated,
          setupAvailable: !!data.setupAvailable,
          envLocked: !!data.envLocked,
        });
        return;
      }
    } catch {}
    setAuth((prev) => ({ ...prev, loading: false }));
  }, []);

  const markAuthenticated = useCallback(() => {
    setAuth((prev) => ({ ...prev, loading: false, required: true, authenticated: true, setupAvailable: false }));
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    await refreshAuth();
  }, [refreshAuth]);

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  useEffect(() => {
    if (auth.loading) return;
    if (auth.required && !auth.authenticated) return;
    fetch('/api/system/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setLocalOnlyState(data.local_only === 'true');
        setScanEnabledState(data.scan_enabled !== 'false');
        if (data.ui_language === 'en' || data.ui_language === 'fr' || data.ui_language === 'es' || data.ui_language === 'de') {
          setLanguage(data.ui_language);
        }
      })
      .catch(() => {});
  }, [auth.loading, auth.required, auth.authenticated, setLanguage]);

  // Load subscriptions
  const refreshSubscriptions = useCallback(async () => {
    try {
      const res = await fetch('/api/channels');
      if (res.ok) {
        const data = await res.json();
        setSubscriptions(data);
      }
    } catch (err) {
      console.error('Error fetching subscriptions:', err);
    }
  }, []);

  // Load my personal channel
  const refreshMyChannel = useCallback(async () => {
    try {
      const res = await fetch('/api/channels/my-channel');
      if (res.ok) {
        const data = await res.json();
        setMyChannel(data && data.id ? data : null);
      }
      const resList = await fetch('/api/channels/my-channels');
      if (resList.ok) {
        const dataList = await resList.json();
        setMyChannels(dataList);
      }
    } catch (err) {
      console.error('Error fetching my channel:', err);
    }
  }, []);

  const setActiveOwnerChannel = useCallback(async (channelId: string) => {
    try {
      const res = await fetch(`/api/channels/${encodeURIComponent(channelId)}/set-active-owner`, { method: 'POST' });
      if (res.ok) {
        await refreshMyChannel();
        notifyDataChanged();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error setting active channel:', err);
      return false;
    }
  }, [refreshMyChannel, notifyDataChanged]);

  // Load system status
  const refreshSystemStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/system/status');
      if (res.ok) {
        const data = await res.json();
        setSystemStatus(data);
        setIsScanning(data.isScanning);
      }
    } catch (err) {
      console.error('Error fetching system status:', err);
    }
  }, []);

  useEffect(() => {
    if (auth.loading) return;
    if (auth.required && !auth.authenticated) return;
    refreshSubscriptions();
    refreshSystemStatus();
    refreshMyChannel();
  }, [refreshSubscriptions, refreshSystemStatus, refreshMyChannel, auth.loading, auth.required, auth.authenticated]);

  // Trigger manual scanner
  const triggerScan = useCallback(async () => {
    if (localOnly || !scanEnabled) return;
    setIsScanning(true);
    try {
      await fetch('/api/system/scan', { method: 'POST' });
      await refreshSubscriptions();
      await refreshSystemStatus();
      notifyDataChanged();
    } catch (err) {
      console.error('Error triggering scan:', err);
    } finally {
      setIsScanning(false);
    }
  }, [localOnly, scanEnabled, refreshSubscriptions, refreshSystemStatus, notifyDataChanged]);

  const subscribeChannel = useCallback(async (url: string, autoDownload = false, maxResolution = '1080p') => {
    try {
      const res = await fetch('/api/channels/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, autoDownload, maxResolution }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.channel) {
          setSubscriptions(prev => {
            if (prev.some(s => s.id === data.channel.id)) return prev;
            return [...prev, {
              ...data.channel,
              is_subscribed: 1,
              downloaded_count: 0,
              total_detected_videos: data.channel.videos?.length || 0,
            }];
          });
        }
        await refreshSubscriptions();
        notifyDataChanged();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error subscribing:', err);
      return false;
    }
  }, [refreshSubscriptions, notifyDataChanged]);

  const unsubscribeChannel = useCallback(async (channelId: string) => {
    try {
      setSubscriptions(prev => prev.filter(s => s.id !== channelId && s.handle !== channelId && `@${s.handle?.replace(/^@/, '')}` !== `@${channelId.replace(/^@/, '')}`));

      const res = await fetch(`/api/channels/${encodeURIComponent(channelId)}/unsubscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId })
      });

      if (!res.ok) {
        await fetch(`/api/channels/${encodeURIComponent(channelId)}`, { method: 'DELETE' });
      }

      await refreshSubscriptions();
      notifyDataChanged();
      return true;
    } catch (err) {
      console.error('Error unsubscribing:', err);
      return false;
    }
  }, [refreshSubscriptions, notifyDataChanged]);

  const openDownloadModal = useCallback((config: Omit<DownloadModalConfig, 'isOpen'>) => {
    setIsImportModalOpen(false);
    setDownloadModal({
      isOpen: true,
      ...config,
    });
  }, []);

  const closeDownloadModal = useCallback(() => {
    setDownloadModal({ isOpen: false });
  }, []);

  const dismissDownloadNotice = useCallback(() => {
    setDownloadNotice(null);
  }, []);

  const onQueueCompleted = useCallback((data: { title?: string; videoId?: string; qualityNote?: string | null }) => {
    const note = parseQualityNote(data.qualityNote);
    if (!note) return;
    setDownloadNotice({
      title: String(data.title || '').length > 48
        ? `${String(data.title).slice(0, 45)}…`
        : (data.title || ''),
      videoId: data.videoId,
      requested: note.requested,
      actual: note.actual,
      direction: note.direction,
    });
  }, []);

  const value = useMemo<VidArchContextType>(() => ({
    nav,
    goTo,
    goBack,
    subscriptions,
    refreshSubscriptions,
    subscribeChannel,
    unsubscribeChannel,
    systemStatus,
    refreshSystemStatus,
    isScanning,
    triggerScan,
    downloadModal,
    openDownloadModal,
    closeDownloadModal,
    isImportModalOpen,
    openImportModal,
    closeImportModal,
    myChannel,
    myChannels,
    refreshMyChannel,
    setActiveOwnerChannel,
    isEditChannelModalOpen,
    editingChannel,
    openEditChannelModal,
    closeEditChannelModal,
    dataVersion,
    notifyDataChanged,
    auth,
    refreshAuth,
    markAuthenticated,
    logout,
    localOnly,
    scanEnabled,
    uiLanguage: language,
    setLocalOnly,
    setScanEnabled,
    setUiLanguage,
    downloadNotice,
    dismissDownloadNotice,
  }), [
    nav, goTo, goBack, subscriptions, refreshSubscriptions, subscribeChannel, unsubscribeChannel,
    systemStatus, refreshSystemStatus, isScanning, triggerScan, downloadModal, openDownloadModal,
    closeDownloadModal, isImportModalOpen, openImportModal, closeImportModal, myChannel, myChannels,
    refreshMyChannel, setActiveOwnerChannel, isEditChannelModalOpen, editingChannel, openEditChannelModal,
    closeEditChannelModal, dataVersion, notifyDataChanged, auth, refreshAuth, markAuthenticated, logout,
    localOnly, scanEnabled, language, setLocalOnly, setScanEnabled, setUiLanguage, downloadNotice,
    dismissDownloadNotice,
  ]);

  const authReady = !auth.loading && (!auth.required || auth.authenticated);

  return (
    <VidArchContext.Provider value={value}>
      <DownloadQueueProvider
        navPage={nav.page}
        authReady={authReady}
        notifyDataChanged={notifyDataChanged}
        refreshSubscriptions={refreshSubscriptions}
        refreshSystemStatus={refreshSystemStatus}
        onCompleted={onQueueCompleted}
      >
        {children}
      </DownloadQueueProvider>
    </VidArchContext.Provider>
  );
};

export const useVidArch = () => {
  const ctx = useContext(VidArchContext);
  if (!ctx) {
    throw new Error('useVidArch must be used within a VidArchProvider');
  }
  return ctx;
};

export const useDownloadQueue = () => {
  const ctx = useContext(DownloadQueueContext);
  if (!ctx) {
    throw new Error('useDownloadQueue must be used within a VidArchProvider');
  }
  return ctx;
};

// Backwards compatibility alias
export const useMyTube = useVidArch;
export const MyTubeProvider = VidArchProvider;
