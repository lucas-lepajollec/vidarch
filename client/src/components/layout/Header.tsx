import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, 
  Menu, 
  Settings as SettingsIcon, 
  X, 
  Radio, 
  DownloadCloud, 
  Plus, 
  User, 
  Tv2, 
  Sliders, 
  ArrowLeft,
  Users,
  Check,
  UserMinus
} from 'lucide-react';
import { useMyTube } from '../../context/MyTubeContext';
import { VidArchLogo } from '../common/VidArchLogo';

interface HeaderProps {
  onToggleSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const { 
    nav, 
    goTo, 
    activeTask, 
    isScanning, 
    triggerScan, 
    openImportModal, 
    myChannel,
    myChannels,
    setActiveOwnerChannel,
    unclaimChannel,
    openCreateChannelModal, 
    openEditChannelModal 
  } = useMyTube();

  const [searchQuery, setSearchQuery] = useState(nav.query || '');
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      goTo('search', { query: searchQuery.trim() });
      setIsMobileSearchOpen(false);
    }
  };

  useEffect(() => {
    if (nav.query !== undefined) {
      setSearchQuery(nav.query);
    }
  }, [nav.query]);

  // Focus mobile input when search opens
  useEffect(() => {
    if (isMobileSearchOpen && mobileInputRef.current) {
      mobileInputRef.current.focus();
    }
  }, [isMobileSearchOpen]);

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-[#0f0f0f] border-b border-[#272727] px-3 sm:px-4 flex items-center justify-between select-none">
      {/* ========================================================================= */}
      {/* MOBILE FULL-SCREEN SEARCH OVERLAY (when active on mobile)                */}
      {/* ========================================================================= */}
      {isMobileSearchOpen ? (
        <div className="absolute inset-0 z-50 bg-[#0f0f0f] px-2 flex items-center gap-2 animate-in fade-in duration-150">
          <button
            type="button"
            onClick={() => setIsMobileSearchOpen(false)}
            className="p-2 rounded-full hover:bg-white/10 text-[#f1f1f1] cursor-pointer flex-shrink-0"
            title="Fermer la recherche"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <form onSubmit={handleSearchSubmit} className="flex-1 flex items-center">
            <div className="flex-1 flex items-center bg-[#121212] border border-[#303030] rounded-full px-3.5 py-1.5 focus-within:border-[#3ea6ff]">
              <input
                ref={mobileInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher sur VidArch..."
                className="w-full bg-transparent text-[16px] sm:text-sm text-white focus:outline-none placeholder-[#717171]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="p-1 text-[#aaa] hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              type="submit"
              className="p-2 ml-1 text-[#f1f1f1] hover:text-white transition cursor-pointer"
            >
              <Search className="w-4 h-4" />
            </button>
          </form>
        </div>
      ) : null}

      {/* ========================================================================= */}
      {/* STANDARD HEADER ROW                                                       */}
      {/* ========================================================================= */}
      
      {/* Left: Hamburger & Logo */}
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 z-20">
        <button
          onClick={onToggleSidebar}
          className="p-2 hover:bg-white/10 rounded-full transition text-[#f1f1f1] cursor-pointer"
          title="Menu principal"
        >
          <Menu className="w-5 h-5" />
        </button>

        <button
          onClick={() => goTo('home')}
          className="flex items-center cursor-pointer focus:outline-none"
        >
          <VidArchLogo size="md" />
        </button>
      </div>

      {/* Center: Desktop/Tablet Centered & Fixed Search Bar */}
      <div className="hidden sm:flex absolute left-1/2 -translate-x-1/2 w-full max-w-[500px] md:max-w-[560px] lg:max-w-[620px] px-4 justify-center z-10 pointer-events-auto">
        <form onSubmit={handleSearchSubmit} className="flex items-center w-full">
          <div className="flex items-center flex-1 bg-[#121212] border border-[#303030] rounded-l-full px-4 py-1.5 focus-within:border-[#3ea6ff] focus-within:ring-1 focus-within:ring-[#3ea6ff] transition">
            <Search className="w-4 h-4 text-[#888] mr-2 flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher une vidéo ou chaîne..."
              className="w-full bg-transparent text-[16px] sm:text-sm text-[#f1f1f1] placeholder-[#717171] focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-[#888] hover:text-white p-0.5 rounded-full hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            type="submit"
            className="bg-[#222] hover:bg-[#2a2a2a] text-[#f1f1f1] px-5 py-2 border border-l-0 border-[#303030] rounded-r-full flex items-center justify-center transition cursor-pointer flex-shrink-0"
            title="Rechercher"
          >
            <Search className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2 justify-end flex-shrink-0">
        {/* Mobile Search Button (only on < 640px) */}
        <button
          onClick={() => setIsMobileSearchOpen(true)}
          className="sm:hidden p-2 rounded-full hover:bg-white/10 text-[#f1f1f1] transition cursor-pointer"
          title="Rechercher"
        >
          <Search className="w-5 h-5" />
        </button>

        {/* Import Button */}
        <button
          onClick={openImportModal}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-semibold bg-[#222] hover:bg-[#333] text-white transition cursor-pointer border border-white/5 shadow-sm active:scale-98"
          title="Importer une vidéo ou une chaîne"
        >
          <Plus className="w-3.5 h-3.5 text-[#ff0033]" />
          <span className="hidden sm:inline">Importer</span>
        </button>

        {/* Scanner Radar Button */}
        <button
          onClick={triggerScan}
          disabled={isScanning}
          title={isScanning ? "Scan des abonnements en cours..." : "Scanner les abonnements"}
          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-medium transition cursor-pointer ${
            isScanning 
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse' 
              : 'bg-white/5 hover:bg-white/10 text-[#aaa] hover:text-white border border-white/5'
          }`}
        >
          <Radio className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-amber-400' : ''}`} />
          <span className="hidden md:inline">{isScanning ? 'Scan...' : 'Scanner'}</span>
        </button>

        {/* Live Active Download Indicator */}
        {activeTask && (
          <button
            onClick={() => goTo('downloads')}
            title="Téléchargement en cours - Voir la file"
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-semibold bg-[#ff0033]/20 text-[#ff0033] border border-[#ff0033]/30 animate-pulse cursor-pointer shadow-sm"
          >
            <DownloadCloud className="w-3.5 h-3.5 animate-bounce text-[#ff0033]" />
            <span className="text-[11px] font-bold">
              {activeTask.status === 'queued' ? 'En file' : activeTask.status === 'processing' ? 'Finalisation' : `${Math.round(activeTask.progress)}%`}
            </span>
          </button>
        )}

        {/* Settings button (hidden on tiny mobile, accessible in profile dropdown) */}
        <button
          onClick={() => goTo('settings')}
          className={`p-2 rounded-full transition cursor-pointer hidden sm:block ${
            nav.page === 'settings' 
              ? 'bg-white/20 text-white' 
              : 'hover:bg-white/10 text-[#aaa] hover:text-white'
          }`}
          title="Paramètres"
        >
          <SettingsIcon className="w-4 h-4" />
        </button>

        {/* User Profile / Channel Dropdown */}
        <div className="relative" ref={profileMenuRef}>
          <button
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-[#272727] hover:ring-2 hover:ring-white/20 transition cursor-pointer flex-shrink-0"
            title="Compte & Votre Chaîne"
          >
            {myChannel?.avatar_url ? (
              <img src={myChannel.avatar_url} alt={myChannel.title} className="w-full h-full object-cover" />
            ) : myChannel ? (
              <div className="w-full h-full bg-gradient-to-tr from-[#ff0033] to-[#ff5e00] text-white font-bold text-xs flex items-center justify-center">
                {myChannel.title.charAt(0).toUpperCase()}
              </div>
            ) : (
              <div className="w-full h-full bg-[#272727] text-[#aaa] hover:text-white flex items-center justify-center transition">
                <User className="w-4 h-4" />
              </div>
            )}
          </button>

          {/* Profile Menu Dropdown (YouTube Account Switcher Style) */}
          {isProfileMenuOpen && (
            <div className="absolute right-0 top-11 w-72 bg-[#212121] border border-[#383838] rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in duration-100 text-xs select-none max-h-[85vh] overflow-y-auto">
              {/* Header Info */}
              <div className="px-4 py-3 border-b border-[#303030] flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-[#333] flex-shrink-0 flex items-center justify-center">
                  {myChannel?.avatar_url ? (
                    <img src={myChannel.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-5 h-5 text-[#aaa]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="font-bold text-white block truncate text-sm">
                    {myChannel ? myChannel.title : 'Votre Espace'}
                  </span>
                  <span className="text-[#aaa] text-[11px] block truncate">
                    {myChannel?.handle || 'Aucune chaîne configurée'}
                  </span>
                </div>
              </div>

              {/* Primary Actions */}
              <div className="py-1.5 border-b border-[#303030]">
                {myChannel && (
                  <>
                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        goTo('channel', { channelId: myChannel.id });
                      }}
                      className="w-full px-4 py-2.5 flex items-center gap-3 text-[#f1f1f1] hover:bg-[#303030] transition cursor-pointer font-medium"
                    >
                      <Tv2 className="w-4 h-4 text-[#ff0033]" />
                      <span>Afficher votre chaîne</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        openEditChannelModal(myChannel);
                      }}
                      className="w-full px-4 py-2.5 flex items-center gap-3 text-[#f1f1f1] hover:bg-[#303030] transition cursor-pointer font-medium"
                    >
                      <Sliders className="w-4 h-4 text-[#aaa]" />
                      <span>Personnaliser la chaîne</span>
                    </button>
                  </>
                )}
              </div>

              {/* Switch Channel / Account Section */}
              <div className="py-2 border-b border-[#303030]">
                <div className="px-4 pb-1.5 flex items-center justify-between text-[11px] font-semibold text-[#888] uppercase tracking-wider">
                  <span>Changer de chaîne</span>
                  <Users className="w-3.5 h-3.5 text-[#717171]" />
                </div>

                {/* Owned Channels List */}
                <div className="space-y-0.5 max-h-44 overflow-y-auto">
                  {myChannels.map((ch) => {
                    const isActive = myChannel?.id === ch.id;
                    return (
                      <button
                        key={ch.id}
                        onClick={async () => {
                          await setActiveOwnerChannel(ch.id);
                          setIsProfileMenuOpen(false);
                          goTo('channel', { channelId: ch.id });
                        }}
                        className={`w-full px-4 py-2 flex items-center justify-between transition cursor-pointer ${
                          isActive ? 'bg-[#2a2a2a] text-white font-bold' : 'hover:bg-[#282828] text-[#ccc]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-full overflow-hidden bg-[#333] flex-shrink-0 flex items-center justify-center">
                            {ch.avatar_url ? (
                              <img src={ch.avatar_url} alt={ch.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-tr from-[#ff0033] to-[#ff5e00] text-white text-[10px] font-bold flex items-center justify-center">
                                {ch.title.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 text-left">
                            <span className="block truncate text-xs font-semibold">{ch.title}</span>
                            <span className="block truncate text-[10px] text-[#888]">{ch.handle || 'Chaîne'}</span>
                          </div>
                        </div>

                        {isActive && <Check className="w-4 h-4 text-[#ff0033] flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>

                {/* Create / Import another channel */}
                <button
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    openCreateChannelModal();
                  }}
                  className="w-full px-4 py-2 mt-1 flex items-center gap-3 text-[#3ea6ff] hover:bg-[#303030] transition cursor-pointer font-medium"
                >
                  <Plus className="w-4 h-4" />
                  <span>Ajouter / Créer une autre chaîne</span>
                </button>

                {/* Dissociate / Unclaim current channel */}
                {myChannel && (
                  <button
                    onClick={async () => {
                      if (confirm(`Dissocier "${myChannel.title}" de votre profil créateur ? (Elle redeviendra une chaîne normale)`)) {
                        await unclaimChannel(myChannel.id);
                        setIsProfileMenuOpen(false);
                      }
                    }}
                    className="w-full px-4 py-2 flex items-center gap-3 text-red-400 hover:bg-red-500/10 transition cursor-pointer font-medium"
                  >
                    <UserMinus className="w-4 h-4" />
                    <span>Dissocier cette chaîne</span>
                  </button>
                )}
              </div>

              {/* Settings */}
              <div className="pt-1.5">
                <button
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    goTo('settings');
                  }}
                  className="w-full px-4 py-2.5 flex items-center gap-3 text-[#f1f1f1] hover:bg-[#303030] transition cursor-pointer font-medium"
                >
                  <SettingsIcon className="w-4 h-4 text-[#aaa]" />
                  <span>Paramètres</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
