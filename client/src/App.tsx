import React, { useState, useEffect } from 'react';
import { MyTubeProvider, useMyTube } from './context/MyTubeContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { DownloadModal } from './components/downloads/DownloadModal';
import { ImportModal } from './components/import/ImportModal';
import { EditChannelModal } from './components/channel/EditChannelModal';
import { DownloadNotice } from './components/common/DownloadNotice';

// Pages
import { Home } from './pages/Home';
import { Subscriptions } from './pages/Subscriptions';
import { Library } from './pages/Library';
import { HistoryPage } from './pages/History';
import { LikedPage } from './pages/Liked';
import { ChannelDetail } from './pages/ChannelDetail';
import { Watch } from './pages/Watch';
import { Downloads } from './pages/Downloads';
import { Settings } from './pages/Settings';
import { SearchPage } from './pages/Search';
import { LoginPage } from './pages/Login';
import { MyChannel } from './pages/MyChannel';
import { I18nProvider } from './i18n/I18nProvider';
import { BottomNav } from './components/layout/BottomNav';

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
        return <LikedPage />;
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
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-[#ff0033] border-t-transparent rounded-full animate-spin" />
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
    <div className="min-h-screen bg-[#0f0f0f] text-[#f1f1f1] flex flex-col selection:bg-[#ff0033] selection:text-white">
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
        className={`flex-1 pt-14 min-h-screen flex flex-col ml-0 pb-8 transition-[margin] duration-300 ease-out-smooth ${
          showPersistentSidebar ? (isSidebarOpen ? 'lg:ml-60' : 'lg:ml-[72px]') : 'lg:ml-0'
        }`}
      >
        <div
          key={`${nav.page}:${nav.videoId || ''}:${nav.channelId || ''}:${nav.query || ''}`}
          className="page-enter flex-1 flex flex-col"
        >
          {renderPage()}
        </div>
      </main>

      {!isWatchPage && !isSettingsPage && <BottomNav />}

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
