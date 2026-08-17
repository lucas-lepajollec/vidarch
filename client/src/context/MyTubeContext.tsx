import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Channel, DownloadTask, SystemStatus } from '../types';

export type PageRoute = 
  | 'home'
  | 'subscriptions'
  | 'library'
  | 'history'
  | 'liked'
  | 'downloads'
  | 'settings'
  | 'channel'
  | 'watch'
  | 'search';

interface NavigationState {
  page: PageRoute;
  videoId?: string;
  channelId?: string;
  query?: string;
}

interface DownloadModalConfig {
  isOpen: boolean;
  url?: string;
  title?: string;
  channelTitle?: string;
  channelId?: string;
  thumbnailUrl?: string;
  videoId?: string;
  durationString?: string;
}

interface MyTubeContextType {
  nav: NavigationState;
  goTo: (page: PageRoute, params?: { videoId?: string; channelId?: string; query?: string }) => void;
  goBack: () => void;
  subscriptions: Channel[];
  refreshSubscriptions: () => Promise<void>;
  queue: DownloadTask[];
  activeTask?: DownloadTask;
  downloadModal: DownloadModalConfig;
  openDownloadModal: (params?: Partial<DownloadModalConfig>) => void;
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
  systemStatus: SystemStatus | null;
  refreshSystemStatus: () => Promise<void>;
  triggerScan: () => Promise<void>;
  isScanning: boolean;
  enqueueDownload: (params: { videoId: string; url?: string; title?: string; channelTitle?: string; channelId?: string; thumbnailUrl?: string; resolution?: string }) => Promise<void>;
  subscribeChannel: (url: string, autoDownload?: boolean, maxResolution?: string) => Promise<boolean>;
  unsubscribeChannel: (channelId: string) => Promise<boolean>;
  dataVersion: number;
  notifyDataChanged: () => void;
}

const MyTubeContext = createContext<MyTubeContextType | null>(null);

export const MyTubeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [navHistory, setNavHistory] = useState<NavigationState[]>([{ page: 'home' }]);
  const [nav, setNav] = useState<NavigationState>({ page: 'home' });
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

    const connectSSE = () => {
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
        refreshSubscriptions();
        refreshSystemStatus();
        notifyDataChanged();
      });

      eventSource.onerror = () => {
        eventSource?.close();
        setTimeout(connectSSE, 3000);
      };
    };

    connectSSE();
    refreshSubscriptions();
    refreshSystemStatus();
    refreshMyChannel();

    return () => {
      eventSource?.close();
    };
  }, [refreshSubscriptions, refreshSystemStatus, refreshMyChannel, notifyDataChanged]);

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

  // Enqueue download
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
      await fetch('/api/downloads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      notifyDataChanged();
    } catch (err) {
      console.error('Error enqueuing download:', err);
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
      // Optimistically update local subscriptions state immediately
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

  // Download modal controls
  const openDownloadModal = (params?: Partial<DownloadModalConfig>) => {
    setDownloadModal({
      isOpen: true,
      url: params?.url || '',
      title: params?.title || '',
      channelTitle: params?.channelTitle || '',
      channelId: params?.channelId || '',
      thumbnailUrl: params?.thumbnailUrl || '',
      videoId: params?.videoId || '',
      durationString: params?.durationString || '',
    });
  };

  const closeDownloadModal = () => {
    setDownloadModal({ isOpen: false });
  };

  const activeTask = queue.find(t => t.status === 'downloading' || t.status === 'processing');

  return (
    <MyTubeContext.Provider
      value={{
        nav,
        goTo,
        goBack,
        subscriptions,
        refreshSubscriptions,
        queue,
        activeTask,
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
        systemStatus,
        refreshSystemStatus,
        triggerScan,
        isScanning,
        enqueueDownload,
        subscribeChannel,
        unsubscribeChannel,
        dataVersion,
        notifyDataChanged,
      }}
    >
      {children}
    </MyTubeContext.Provider>
  );
};

export const useMyTube = () => {
  const ctx = useContext(MyTubeContext);
  if (!ctx) throw new Error('useMyTube must be used within MyTubeProvider');
  return ctx;
};
