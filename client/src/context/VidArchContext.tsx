import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Video, Channel, DownloadTask, SystemStatus } from '../types';

export type PageRoute = 'home' | 'subscriptions' | 'library' | 'history' | 'liked' | 'downloads' | 'settings' | 'watch' | 'channel' | 'search';

export interface NavigationState {
  page: PageRoute;
  videoId?: string;
  channelId?: string;
  query?: string;
}

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
  goTo: (page: PageRoute, params?: { videoId?: string; channelId?: string; query?: string }) => void;
  goBack: () => void;
  subscriptions: Channel[];
  refreshSubscriptions: () => Promise<void>;
  subscribeChannel: (url: string, autoDownload?: boolean, maxResolution?: string) => Promise<boolean>;
  unsubscribeChannel: (channelId: string) => Promise<boolean>;
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
  unclaimChannel: (channelId: string) => Promise<boolean>;
  isCreateChannelModalOpen: boolean;
  openCreateChannelModal: () => void;
  closeCreateChannelModal: () => void;
  isEditChannelModalOpen: boolean;
  editingChannel: Channel | null;
  openEditChannelModal: (channel?: Channel) => void;
  closeEditChannelModal: () => void;
  dataVersion: number;
  notifyDataChanged: () => void;
}

const VidArchContext = createContext<VidArchContextType | null>(null);

export const VidArchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [nav, setNav] = useState<NavigationState>({ page: 'home' });
  const [navHistory, setNavHistory] = useState<NavigationState[]>([{ page: 'home' }]);
  const [subscriptions, setSubscriptions] = useState<Channel[]>([]);
  const [queue, setQueue] = useState<DownloadTask[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [downloadModal, setDownloadModal] = useState<DownloadModalConfig>({ isOpen: false });
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [myChannel, setMyChannel] = useState<Channel | null>(null);
  const [myChannels, setMyChannels] = useState<Channel[]>([]);
  const [isCreateChannelModalOpen, setIsCreateChannelModalOpen] = useState(false);
  const [isEditChannelModalOpen, setIsEditChannelModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [dataVersion, setDataVersion] = useState(0);

  const notifyDataChanged = useCallback(() => {
    setDataVersion(v => v + 1);
  }, []);

  const openImportModal = useCallback(() => {
    setIsImportModalOpen(true);
  }, []);

  const closeImportModal = useCallback(() => {
    setIsImportModalOpen(false);
  }, []);

  const openCreateChannelModal = useCallback(() => {
    setIsCreateChannelModalOpen(true);
  }, []);

  const closeCreateChannelModal = useCallback(() => {
    setIsCreateChannelModalOpen(false);
  }, []);

  const openEditChannelModal = useCallback((channel?: Channel) => {
    setEditingChannel(channel || myChannel || null);
    setIsEditChannelModalOpen(true);
  }, [myChannel]);

  const closeEditChannelModal = useCallback(() => {
    setIsEditChannelModalOpen(false);
    setEditingChannel(null);
  }, []);

  // Navigation handlers
  const goTo = useCallback((page: PageRoute, params?: { videoId?: string; channelId?: string; query?: string }) => {
    const nextState: NavigationState = { page, ...params };
    setNavHistory(prev => [...prev, nextState]);
    setNav(nextState);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const goBack = useCallback(() => {
    if (navHistory.length > 1) {
      const newHistory = [...navHistory];
      newHistory.pop();
      const prev = newHistory[newHistory.length - 1];
      setNavHistory(newHistory);
      setNav(prev);
    } else {
      setNav({ page: 'home' });
    }
  }, [navHistory]);

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

  // Load download queue directly via REST
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

  // Load my personal channel
  const refreshMyChannel = useCallback(async () => {
    try {
      const res = await fetch('/api/channels/my-channel');
      if (res.ok) {
        const data = await res.json();
        setMyChannel(data);
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
      const res = await fetch(`/api/channels/${channelId}/set-active-owner`, { method: 'POST' });
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

  const unclaimChannel = useCallback(async (channelId: string) => {
    try {
      const res = await fetch(`/api/channels/${channelId}/unclaim`, { method: 'POST' });
      if (res.ok) {
        await refreshMyChannel();
        notifyDataChanged();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error unclaiming channel:', err);
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

  // Subscribe to SSE for live queue progress & live reactive updates
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: any = null;

    const connectSSE = () => {
      try {
        eventSource = new EventSource('/api/downloads/events');

        eventSource.addEventListener('queue', (e) => {
          try {
            const data = JSON.parse(e.data);
            setQueue(data);
          } catch (_) {}
        });

        eventSource.addEventListener('progress', (e) => {
          try {
            const prog = JSON.parse(e.data);
            setQueue(prev => prev.map(item => item.id === prog.id ? {
              ...item,
              progress: prog.progress,
              speed: prog.speed,
              eta: prog.eta,
              status: prog.status.includes('Traitement') ? 'processing' : 'downloading',
            } : item));
          } catch (_) {}
        });

        eventSource.addEventListener('completed', () => {
          refreshQueue();
          refreshSubscriptions();
          refreshSystemStatus();
          notifyDataChanged();
        });

        eventSource.addEventListener('failed', () => {
          refreshQueue();
          notifyDataChanged();
        });

        eventSource.onerror = () => {
          eventSource?.close();
          clearTimeout(reconnectTimeout);
          reconnectTimeout = setTimeout(connectSSE, 3000);
        };
      } catch (_) {
        reconnectTimeout = setTimeout(connectSSE, 3000);
      }
    };

    connectSSE();
    refreshQueue();
    refreshSubscriptions();
    refreshSystemStatus();
    refreshMyChannel();

    return () => {
      clearTimeout(reconnectTimeout);
      eventSource?.close();
    };
  }, [refreshQueue, refreshSubscriptions, refreshSystemStatus, refreshMyChannel, notifyDataChanged]);

  // Fallback Polling: while any downloads are in progress or queued, refresh every 1.5s
  useEffect(() => {
    const hasActive = queue.some(t => t.status === 'downloading' || t.status === 'processing' || t.status === 'queued');
    if (!hasActive && nav.page !== 'downloads') return;

    const interval = setInterval(() => {
      refreshQueue();
    }, 1500);

    return () => clearInterval(interval);
  }, [queue, nav.page, refreshQueue]);

  // Trigger manual scanner
  const triggerScan = async () => {
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
  };

  // Enqueue download with instant optimistic feedback
  const enqueueDownload = async (params: {
    videoId: string;
    url?: string;
    title?: string;
    channelTitle?: string;
    channelId?: string;
    thumbnailUrl?: string;
    resolution?: string;
  }) => {
    try {
      const res = await fetch('/api/downloads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.item) {
          setQueue(prev => [data.item, ...prev.filter(i => i.id !== data.item.id)]);
        }
      }
      
      await refreshQueue();
      notifyDataChanged();
    } catch (err) {
      console.error('Error enqueuing download:', err);
      await refreshQueue();
    }
  };

  // Subscribe channel
  const subscribeChannel = async (url: string, autoDownload = false, maxResolution = '1080p') => {
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
  };

  // Unsubscribe channel
  const unsubscribeChannel = async (channelId: string) => {
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
  };

  const openDownloadModal = useCallback((config: Omit<DownloadModalConfig, 'isOpen'>) => {
    setDownloadModal({
      isOpen: true,
      ...config,
    });
  }, []);

  const closeDownloadModal = useCallback(() => {
    setDownloadModal({ isOpen: false });
  }, []);

  // Active task matches any downloading, processing, or queued task
  const activeTask = queue.find(t => t.status === 'downloading' || t.status === 'processing' || t.status === 'queued');

  return (
    <VidArchContext.Provider
      value={{
        nav,
        goTo,
        goBack,
        subscriptions,
        refreshSubscriptions,
        subscribeChannel,
        unsubscribeChannel,
        queue,
        refreshQueue,
        activeTask,
        enqueueDownload,
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
        unclaimChannel,
        isCreateChannelModalOpen,
        openCreateChannelModal,
        closeCreateChannelModal,
        isEditChannelModalOpen,
        editingChannel,
        openEditChannelModal,
        closeEditChannelModal,
        dataVersion,
        notifyDataChanged,
      }}
    >
      {children}
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

// Backwards compatibility alias
export const useMyTube = useVidArch;
export const MyTubeProvider = VidArchProvider;
