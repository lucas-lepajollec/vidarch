import React from 'react';
import { 
  Home, 
  Tv2, 
  DownloadCloud, 
  FolderHeart, 
  History, 
  ThumbsUp, 
  Settings as SettingsIcon, 
  ChevronRight,
  Radio,
  X,
  Menu,
  User,
  Sparkles
} from 'lucide-react';
import { useMyTube } from '../../context/MyTubeContext';
import { VidArchLogo } from '../common/VidArchLogo';
import type { PageRoute } from '../../context/MyTubeContext';

interface SidebarProps {
  isOpen: boolean;
  isOverlay?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, isOverlay = false, onClose }) => {
  const { 
    nav, 
    goTo, 
    subscriptions, 
    isScanning, 
    triggerScan, 
    myChannel, 
    openCreateChannelModal,
    activeTask,
  } = useMyTube();

  const navItems: Array<{ id: PageRoute; label: string; icon: React.FC<{ className?: string }> }> = [
    { id: 'home', label: 'Accueil', icon: Home },
    { id: 'subscriptions', label: 'Abonnements', icon: Tv2 },
    { id: 'downloads', label: 'Téléchargements', icon: DownloadCloud },
  ];

  const libraryItems: Array<{ id: PageRoute; label: string; icon: React.FC<{ className?: string }> }> = [
    { id: 'library', label: 'Bibliothèque', icon: FolderHeart },
    { id: 'history', label: 'Historique', icon: History },
    { id: 'liked', label: 'Vidéos "J\'aime"', icon: ThumbsUp },
  ];

  const handleItemClick = (pageId: PageRoute) => {
    goTo(pageId);
    if (isOverlay && onClose) onClose();
  };

  const handleChannelClick = (channelId: string) => {
    goTo('channel', { channelId });
    if (isOverlay && onClose) onClose();
  };

  // OVERLAY DRAWER (When on watch page or small screens)
  if (isOverlay) {
    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 z-50 flex select-none">
        {/* Backdrop Overlay */}
        <div 
          onClick={onClose}
          className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity duration-200"
        />

        {/* Drawer Panel */}
        <aside className="relative z-50 w-64 max-w-[80vw] h-full bg-[#0f0f0f] border-r border-[#272727] flex flex-col shadow-2xl overflow-y-auto">
          {/* Drawer Header with Logo & Close */}
          <div className="h-14 flex items-center justify-between px-4 border-b border-[#272727] flex-shrink-0">
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="p-2 hover:bg-[#272727] rounded-full text-white cursor-pointer transition"
                title="Fermer le menu"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div 
                onClick={() => handleItemClick('home')}
                className="cursor-pointer"
              >
                <VidArchLogo size="sm" />
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-[#aaa] hover:text-white rounded-full hover:bg-[#272727] transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Drawer Content */}
          <div className="flex-1 px-3 py-3 space-y-4 overflow-y-auto text-sm">
            {/* Primary Navigation */}
            <div className="space-y-1 pb-3 border-b border-[#272727]">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = nav.page === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleItemClick(item.id)}
                    className={`w-full flex items-center gap-5 px-3 py-2.5 rounded-xl transition cursor-pointer text-left font-medium ${
                      isActive
                        ? 'bg-[#272727] text-white font-semibold'
                        : 'text-[#f1f1f1] hover:bg-[#272727]/60'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${isActive ? 'text-[#ff0033]' : 'text-[#f1f1f1]'}`} />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.id === 'downloads' && activeTask && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#ff0033]/20 text-[#ff0033] border border-[#ff0033]/30 animate-pulse">
                        {Math.round(activeTask.progress)}%
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Library Navigation */}
            <div className="py-2 border-b border-[#272727] space-y-1">
              <div 
                onClick={() => handleItemClick('library')}
                className="flex items-center justify-between px-3 py-1.5 text-[#f1f1f1] font-semibold text-sm cursor-pointer hover:text-white group"
              >
                <span>Vous</span>
                <ChevronRight className="w-4 h-4 text-[#aaa] group-hover:translate-x-0.5 transition-transform" />
              </div>

              {/* Your Channel Button */}
              <button
                onClick={() => {
                  if (myChannel) {
                    handleChannelClick(myChannel.id);
                  } else {
                    openCreateChannelModal();
                    if (isOverlay && onClose) onClose();
                  }
                }}
                className={`w-full flex items-center gap-5 px-3 py-2.5 rounded-xl transition cursor-pointer text-left ${
                  nav.page === 'channel' && nav.channelId === myChannel?.id
                    ? 'bg-[#272727] text-white font-semibold'
                    : 'text-[#f1f1f1] hover:bg-[#272727]/60'
                }`}
              >
                {myChannel?.avatar_url ? (
                  <img src={myChannel.avatar_url} alt="Votre chaîne" className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <User className="w-5 h-5 text-[#aaa] flex-shrink-0" />
                )}
                <span className="truncate">{myChannel ? myChannel.title : 'Votre chaîne'}</span>
              </button>

              {libraryItems.map((item) => {
                const Icon = item.icon;
                const isActive = nav.page === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleItemClick(item.id)}
                    className={`w-full flex items-center gap-5 px-3 py-2.5 rounded-xl transition cursor-pointer text-left ${
                      isActive
                        ? 'bg-[#272727] text-white font-semibold'
                        : 'text-[#f1f1f1] hover:bg-[#272727]/60'
                    }`}
                  >
                    <Icon className="w-5 h-5 text-[#aaa]" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Subscriptions List */}
            <div className="py-2 flex-1">
              <div className="flex items-center justify-between px-3 py-1.5 text-[#f1f1f1] font-semibold text-sm">
                <span>Abonnements</span>
                <button
                  onClick={triggerScan}
                  disabled={isScanning}
                  className="text-[#888] hover:text-[#3ea6ff] p-1 rounded-full hover:bg-[#272727] cursor-pointer transition"
                  title="Vérifier les nouvelles vidéos"
                >
                  <Radio className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-amber-400' : ''}`} />
                </button>
              </div>

              {subscriptions.length > 0 && (
                <div className="space-y-0.5 mt-1">
                  {subscriptions.slice(0, 30).map((channel) => (
                    <button
                      key={channel.id}
                      onClick={() => handleChannelClick(channel.id)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl transition cursor-pointer text-left text-xs text-[#f1f1f1] hover:bg-[#272727]/60"
                    >
                      {channel.avatar_url ? (
                        <img
                          src={channel.avatar_url}
                          alt={channel.title}
                          className="w-6 h-6 rounded-full object-cover flex-shrink-0 bg-white/10"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#ff0033] to-[#ff5e00] flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0">
                          {channel.title.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="truncate flex-1">{channel.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Settings */}
            <div className="pt-2 border-t border-[#272727]">
              <button
                onClick={() => handleItemClick('settings')}
                className="w-full flex items-center gap-5 px-3 py-2.5 rounded-xl transition cursor-pointer text-left text-[#aaa] hover:bg-[#272727]/60 hover:text-white"
              >
                <SettingsIcon className="w-5 h-5" />
                <span>Paramètres</span>
              </button>
            </div>
          </div>
        </aside>
      </div>
    );
  }

  // STANDARD PERSISTENT SIDEBAR (Home, Subscriptions, Library, etc. - Desktop only)
  if (!isOpen) {
    // Mini icon-only sidebar (fixed to viewport left on desktop)
    return (
      <aside 
        className="hidden lg:flex fixed top-14 left-0 bottom-0 w-18 bg-[#0f0f0f] border-r border-[#272727] flex-col items-center py-3 gap-1 select-none z-40"
        style={{ width: '72px' }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = nav.page === item.id;
          return (
            <button
              key={item.id}
              onClick={() => goTo(item.id)}
              className={`w-14 py-3 flex flex-col items-center justify-center rounded-xl transition text-[10px] gap-1.5 cursor-pointer ${
                isActive ? 'bg-[#272727] text-white font-semibold' : 'text-[#aaa] hover:bg-[#272727]/60 hover:text-white'
              }`}
              title={item.label}
            >
              <Icon className="w-5 h-5" />
              <span className="truncate max-w-[56px]">{item.label}</span>
            </button>
          );
        })}
      </aside>
    );
  }

  return (
    <aside 
      className="hidden lg:flex fixed top-14 left-0 bottom-0 w-60 bg-[#0f0f0f] border-r border-[#272727] flex-col overflow-y-auto px-3 py-3 select-none z-40 text-sm"
      style={{ width: '240px' }}
    >
      {/* Primary Section */}
      <div className="space-y-1 pb-3 border-b border-[#272727]">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = nav.page === item.id;
          return (
            <button
              key={item.id}
              onClick={() => goTo(item.id)}
              className={`w-full flex items-center gap-5 px-3 py-2.5 rounded-xl transition cursor-pointer text-left font-medium ${
                isActive
                  ? 'bg-[#272727] text-white font-semibold shadow-sm'
                  : 'text-[#f1f1f1] hover:bg-[#272727]/60'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-[#ff0033]' : 'text-[#f1f1f1]'}`} />
              <span className="flex-1 truncate">{item.label}</span>
              {item.id === 'downloads' && activeTask && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#ff0033]/20 text-[#ff0033] border border-[#ff0033]/30 animate-pulse">
                  {Math.round(activeTask.progress)}%
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Library / "Vous" Section */}
      <div className="py-3 border-b border-[#272727] space-y-1">
        <div 
          onClick={() => goTo('library')}
          className="flex items-center justify-between px-3 py-1.5 text-[#f1f1f1] font-semibold text-sm cursor-pointer hover:text-white group"
        >
          <span>Vous</span>
          <ChevronRight className="w-4 h-4 text-[#aaa] group-hover:translate-x-0.5 transition-transform" />
        </div>

        {/* Your Channel Button */}
        <button
          onClick={() => {
            if (myChannel) {
              goTo('channel', { channelId: myChannel.id });
            } else {
              openCreateChannelModal();
            }
          }}
          className={`w-full flex items-center gap-5 px-3 py-2.5 rounded-xl transition cursor-pointer text-left ${
            nav.page === 'channel' && nav.channelId === myChannel?.id
              ? 'bg-[#272727] text-white font-semibold'
              : 'text-[#f1f1f1] hover:bg-[#272727]/60'
          }`}
        >
          {myChannel?.avatar_url ? (
            <img src={myChannel.avatar_url} alt="Votre chaîne" className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
          ) : (
            <User className="w-5 h-5 text-[#aaa] flex-shrink-0" />
          )}
          <span className="truncate">{myChannel ? myChannel.title : 'Votre chaîne'}</span>
        </button>

        {libraryItems.map((item) => {
          const Icon = item.icon;
          const isActive = nav.page === item.id;
          return (
            <button
              key={item.id}
              onClick={() => goTo(item.id)}
              className={`w-full flex items-center gap-5 px-3 py-2.5 rounded-xl transition cursor-pointer text-left ${
                isActive
                  ? 'bg-[#272727] text-white font-semibold'
                  : 'text-[#f1f1f1] hover:bg-[#272727]/60'
              }`}
            >
              <Icon className="w-5 h-5 text-[#aaa]" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Subscriptions Section */}
      <div className="py-3 border-b border-[#272727] flex-1">
        <div className="flex items-center justify-between px-3 py-1.5 text-[#f1f1f1] font-semibold text-sm">
          <span>Abonnements</span>
          <button
            onClick={triggerScan}
            disabled={isScanning}
            className="text-[#888] hover:text-[#3ea6ff] p-1 rounded-full hover:bg-[#272727] cursor-pointer transition"
            title="Vérifier les nouvelles vidéos"
          >
            <Radio className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>

        {subscriptions.length === 0 ? (
          <div className="px-3 py-4 text-center">
            <p className="text-xs text-[#888] mb-1 font-medium">Aucun abonnement</p>
            <p className="text-[11px] text-[#666] leading-snug">
              Recherchez une chaîne en haut pour vous abonner.
            </p>
          </div>
        ) : (
          <div className="space-y-0.5 mt-1">
            {subscriptions.slice(0, 25).map((channel) => {
              const isCurrentChannel = nav.page === 'channel' && nav.channelId === channel.id;
              const hasNew = (channel.total_detected_videos || 0) > (channel.downloaded_count || 0);

              return (
                <button
                  key={channel.id}
                  onClick={() => goTo('channel', { channelId: channel.id })}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition cursor-pointer text-left text-xs ${
                    isCurrentChannel
                      ? 'bg-[#272727] text-white font-medium'
                      : 'text-[#f1f1f1] hover:bg-[#272727]/60'
                  }`}
                >
                  {channel.avatar_url ? (
                    <img
                      src={channel.avatar_url}
                      alt={channel.title}
                      className="w-6 h-6 rounded-full object-cover flex-shrink-0 bg-white/10"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#ff0033] to-[#ff5e00] flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0">
                      {channel.title.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="truncate flex-1">{channel.title}</span>
                  {hasNew && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#3ea6ff] flex-shrink-0" title="Nouvelles vidéos disponibles" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Settings */}
      <div className="pt-2">
        <button
          onClick={() => goTo('settings')}
          className={`w-full flex items-center gap-5 px-3 py-2.5 rounded-xl transition cursor-pointer text-left ${
            nav.page === 'settings'
              ? 'bg-[#272727] text-white font-semibold'
              : 'text-[#aaa] hover:bg-[#272727]/60 hover:text-white'
          }`}
        >
          <SettingsIcon className="w-5 h-5" />
          <span>Paramètres</span>
        </button>
      </div>
    </aside>
  );
};
