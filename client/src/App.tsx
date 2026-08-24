import React, { useState, useEffect, lazy, Suspense } from 'react';
import { MyTubeProvider, useMyTube } from './context/MyTubeContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { DownloadModal } from './components/downloads/DownloadModal';
import { ImportModal } from './components/import/ImportModal';
import { EditChannelModal } from './components/channel/EditChannelModal';
import { DownloadNotice } from './components/common/DownloadNotice';
import { LoginPage } from './pages/Login';
import { I18nProvider } from './i18n/I18nProvider';

const Home = lazy(() => import('./pages/Home').then((m) => ({ default: m.Home })));
const Subscriptions = lazy(() => import('./pages/Subscriptions').then((m) => ({ default: m.Subscriptions })));
const Library = lazy(() => import('./pages/Library').then((m) => ({ default: m.Library })));
const HistoryPage = lazy(() => import('./pages/History').then((m) => ({ default: m.HistoryPage })));
const Playlists = lazy(() => import('./pages/Playlists').then((m) => ({ default: m.Playlists })));
const PlaylistDetail = lazy(() => import('./pages/PlaylistDetail').then((m) => ({ default: m.PlaylistDetail })));
const ChannelDetail = lazy(() => import('./pages/ChannelDetail').then((m) => ({ default: m.ChannelDetail })));
const Watch = lazy(() => import('./pages/Watch').then((m) => ({ default: m.Watch })));
const Downloads = lazy(() => import('./pages/Downloads').then((m) => ({ default: m.Downloads })));
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })));
const SearchPage = lazy(() => import('./pages/Search').then((m) => ({ default: m.SearchPage })));
const MyChannel = lazy(() => import('./pages/MyChannel').then((m) => ({ default: m.MyChannel })));

const PageFallback = (
  <div className="flex-1 flex items-center justify-center min-h-[50vh]">
    <div className="w-10 h-10 border-2 border-[#ff5a67] border-t-transparent rounded-full animate-spin" />
  </div>
);

const MainContent: React.FC = () => {
  const { nav, auth, markAuthenticated, refreshAuth } = useMyTube();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const renderPage = () => {
    switch (nav.page) {
      case 'home':
        return <Home />;
      case 'subscriptions':
        return <Subscriptions />;
      case 'library':
        return <Library />;
      case 'history':
        return <HistoryPage />;
      case 'liked':
        return <PlaylistDetail />;
      case 'playlists':
        return nav.playlistId ? <PlaylistDetail /> : <Playlists />;
      case 'channel':
        return <ChannelDetail />;
      case 'watch':
        return <Watch />;
      case 'downloads':
        return <Downloads />;
      case 'settings':
        return <Settings />;
      case 'search':
        return <SearchPage />;
      case 'mychannel':
        return <MyChannel />;
      default:
        return <Home />;
    }
  };

  const isWatchPage = nav.page === 'watch';
  const isSettingsPage = nav.page === 'settings';
  const showPersistentSidebar = !isWatchPage && !isSettingsPage;

  // Toggle burger menu behavior depending on screen width & page
  const handleToggleSidebar = () => {
    if (window.innerWidth < 1024 || isWatchPage) {
      setIsDrawerOpen(prev => !prev);
    } else {
      setIsSidebarOpen(prev => !prev);
    }
  };

  // Close drawer on navigation
  useEffect(() => {
    setIsDrawerOpen(false);
  }, [nav.page, nav.videoId, nav.channelId, nav.query]);

  if (auth.loading) {
    return (
      <div className="min-h-screen bg-[#090d12] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-[#ff5a67] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (auth.required && !auth.authenticated) {
    return (
      <LoginPage
        setupAvailable={auth.setupAvailable}
        onAuthenticated={() => {
          markAuthenticated();
          refreshAuth();
        }}
      />
    );
  }

  return (
    <div className="vidarch-shell min-h-screen bg-[#090d12] text-[#f4f7fb] flex flex-col selection:bg-[#ff5a67] selection:text-white">
      {/* Top Fixed Header */}
      <Header onToggleSidebar={handleToggleSidebar} />

      {/* Persistent Left Sidebar on standard desktop pages (>= 1024px) */}
      {showPersistentSidebar && (
        <Sidebar isOpen={isSidebarOpen} />
      )}

      {/* Overlay Drawer Sidebar (Mobile, Tablet & Watch page) */}
      <Sidebar 
        isOpen={isDrawerOpen} 
        isOverlay={true} 
        onClose={() => setIsDrawerOpen(false)} 
      />

      {/* Main Content Area */}
      <main 
        className={`flex-1 pt-14 min-h-screen flex flex-col ml-0 transition-[margin] duration-200 ease-out-smooth ${
          showPersistentSidebar ? (isSidebarOpen ? 'lg:ml-60' : 'lg:ml-[72px]') : 'lg:ml-0'
        }`}
      >
        <div
          key={`${nav.page}:${nav.videoId || ''}:${nav.channelId || ''}:${nav.query || ''}`}
          className="page-enter flex-1 flex flex-col"
        >
          <Suspense fallback={PageFallback}>
            {renderPage()}
          </Suspense>
        </div>
      </main>

      {/* Global Modals (Mounted to body via React Portal) */}
      <DownloadModal />
      <ImportModal />
      <EditChannelModal />
      <DownloadNotice />
    </div>
  );
};

export function App() {
  return (
    <I18nProvider>
      <MyTubeProvider>
        <MainContent />
      </MyTubeProvider>
    </I18nProvider>
  );
}

export default App;
