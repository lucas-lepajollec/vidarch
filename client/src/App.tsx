import React, { useState, useEffect } from 'react';
import { MyTubeProvider, useMyTube } from './context/MyTubeContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { DownloadModal } from './components/downloads/DownloadModal';
import { ImportModal } from './components/import/ImportModal';
import { MyChannelModal } from './components/channel/MyChannelModal';
import { EditChannelModal } from './components/channel/EditChannelModal';

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

const MainContent: React.FC = () => {
  const { nav } = useMyTube();
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
        className={`flex-1 pt-14 min-h-screen transition-all duration-150 flex flex-col ml-0 pb-8 ${
          showPersistentSidebar ? (isSidebarOpen ? 'lg:ml-60' : 'lg:ml-[72px]') : 'lg:ml-0'
        }`}
      >
        {renderPage()}
      </main>

      {/* Global Modals (Mounted to body via React Portal) */}
      <DownloadModal />
      <ImportModal />
      <MyChannelModal />
      <EditChannelModal />
    </div>
  );
};

export function App() {
  return (
    <MyTubeProvider>
      <MainContent />
    </MyTubeProvider>
  );
}

export default App;
