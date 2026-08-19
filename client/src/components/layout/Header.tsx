import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, 
  Menu, 
  Settings as SettingsIcon, 
  X, 
  Download, 
  Plus, 
  User, 
  ArrowLeft,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { useMyTube } from '../../context/MyTubeContext';
import { VidArchLogo } from '../common/VidArchLogo';
import { ChannelAvatar } from '../common/ChannelAvatar';
import { useI18n } from '../../i18n/I18nProvider';
import { ownerDisplayTitle } from '../../utils/channelTitle';

interface SearchHistoryItem {
  id: string;
  query: string;
}

const SearchHistoryList: React.FC<{
  items: SearchHistoryItem[];
  onPick: (query: string) => void;
  onRemove: (id: string) => void;
  removeLabel: string;
}> = ({ items, onPick, onRemove, removeLabel }) => (
  <ul className="py-1.5">
    {items.map((item) => (
      <li key={item.id} className="flex items-center hover:bg-[#3d3d3d]">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(item.query)}
          className="flex-1 min-w-0 flex items-center gap-3 px-4 py-2.5 text-left cursor-pointer"
        >
          <Clock className="w-4 h-4 text-[#aaa] flex-shrink-0" />
          <span className="flex-1 text-sm text-white truncate">{item.query}</span>
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onRemove(item.id)}
          className="p-2 mr-2 rounded-full text-[#aaa] hover:text-white hover:bg-white/10 cursor-pointer flex-shrink-0"
          title={removeLabel}
          aria-label={removeLabel}
        >
          <X className="w-4 h-4" />
        </button>
      </li>
    ))}
  </ul>
);

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
    localOnly,
    scanEnabled,
  } = useMyTube();
  const { t } = useI18n();

  const [searchQuery, setSearchQuery] = useState(nav.query || '');
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const desktopSearchRef = useRef<HTMLDivElement>(null);

  const loadSearchHistory = async () => {
    try {
      const res = await fetch('/api/history/searches');
      if (res.ok) {
        const data = await res.json();
        setSearchHistory(Array.isArray(data) ? data : []);
      }
    } catch {
      // Keep the last known list if the request fails.
    }
  };

  const openSearchHistory = () => {
    setHistoryOpen(true);
    void loadSearchHistory();
  };

  const filteredHistory = (() => {
    const q = searchQuery.trim().toLowerCase();
    const list = q
      ? searchHistory.filter((s) => s.query.toLowerCase().includes(q))
      : searchHistory;
    return list.slice(0, 8);
  })();

  const showHistory = historyOpen && filteredHistory.length > 0;

  const runSearch = (query: string) => {
    const next = query.trim();
    if (!next) return;
    setSearchQuery(next);
    goTo('search', { query: next });
    setHistoryOpen(false);
    setIsMobileSearchOpen(false);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch(searchQuery);
  };

  const handleRemoveHistory = async (id: string) => {
    try {
      await fetch(`/api/history/searches/${encodeURIComponent(id)}`, { method: 'DELETE' });
      setSearchHistory((prev) => prev.filter((s) => s.id !== id));
    } catch {
      // Ignore; the row stays until the next refresh.
    }
  };

  useEffect(() => {
    if (nav.query !== undefined) {
      setSearchQuery(nav.query);
    }
  }, [nav.query]);

  useEffect(() => {
    if (!isMobileSearchOpen) return;
    mobileInputRef.current?.focus();
    setHistoryOpen(true);
    void loadSearchHistory();
  }, [isMobileSearchOpen]);

  useEffect(() => {
    if (!historyOpen || isMobileSearchOpen) return;
    const onDocDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (desktopSearchRef.current?.contains(target)) return;
      setHistoryOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setHistoryOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [historyOpen, isMobileSearchOpen]);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-[#0f0f0f] border-b border-[#272727] px-3 sm:px-4 flex items-center justify-between select-none overflow-visible">
      {/* ========================================================================= */}
      {/* MOBILE FULL-SCREEN SEARCH OVERLAY (when active on mobile)                */}
      {/* ========================================================================= */}
      {isMobileSearchOpen ? (
        <div className="fixed inset-0 z-50 bg-[#0f0f0f] flex flex-col animate-in fade-in duration-300">
          <div className="h-14 px-2 flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => {
                setIsMobileSearchOpen(false);
                setHistoryOpen(false);
              }}
              className="p-2 rounded-full hover:bg-white/10 text-[#f1f1f1] cursor-pointer flex-shrink-0"
              title={t('header.searchClose')}
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
                  onFocus={openSearchHistory}
                  placeholder={localOnly ? t('header.searchPlaceholderLocal') : t('header.searchPlaceholder')}
                  className="w-full bg-transparent text-[16px] sm:text-sm text-white focus:outline-none placeholder-[#717171]"
                  autoComplete="off"
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

          {showHistory && (
            <div className="flex-1 overflow-y-auto border-t border-[#272727]">
              <SearchHistoryList
                items={filteredHistory}
                onPick={runSearch}
                onRemove={handleRemoveHistory}
                removeLabel={t('history.removeSearch')}
              />
            </div>
          )}
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
          title={t('nav.menu')}
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
        <div ref={desktopSearchRef} className="relative w-full">
          <form onSubmit={handleSearchSubmit} className="flex items-center w-full">
            <div className="flex items-center flex-1 bg-[#121212] border border-[#303030] rounded-l-full px-4 py-1.5 focus-within:border-[#3ea6ff] focus-within:ring-1 focus-within:ring-[#3ea6ff] transition">
              <Search className="w-4 h-4 text-[#888] mr-2 flex-shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={openSearchHistory}
                onClick={openSearchHistory}
                placeholder={localOnly ? t('header.searchPlaceholderLocal') : t('header.searchPlaceholder')}
                className="w-full bg-transparent text-[16px] sm:text-sm text-[#f1f1f1] placeholder-[#717171] focus:outline-none"
                autoComplete="off"
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
              title={t('header.search')}
            >
              <Search className="w-4 h-4" />
            </button>
          </form>

          {showHistory && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#212121] rounded-xl border border-[#303030] shadow-[0_8px_28px_rgba(0,0,0,0.55)] overflow-hidden z-50">
              <SearchHistoryList
                items={filteredHistory}
                onPick={runSearch}
                onRemove={handleRemoveHistory}
                removeLabel={t('history.removeSearch')}
              />
            </div>
          )}
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2 justify-end flex-shrink-0">
        {/* Mobile Search Button (only on < 640px) */}
        <button
          onClick={() => setIsMobileSearchOpen(true)}
          className="sm:hidden p-2 rounded-full hover:bg-white/10 text-[#f1f1f1] transition cursor-pointer"
          title={t('header.search')}
        >
          <Search className="w-5 h-5" />
        </button>

        {/* Import Button */}
        <button
          onClick={openImportModal}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-semibold bg-[#222] hover:bg-[#333] text-white transition cursor-pointer border border-white/5 shadow-sm active:scale-98"
          title={localOnly ? t('header.importTitleLocal') : t('header.importTitle')}
        >
          <Plus className="w-3.5 h-3.5 text-[#ff0033]" />
          <span className="hidden sm:inline">{t('header.import')}</span>
        </button>

        {!localOnly && scanEnabled && (
        <button
          onClick={triggerScan}
          disabled={isScanning}
          title={isScanning ? t('nav.scanning') : t('nav.scan')}
          className={`relative flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-medium border border-white/5 cursor-pointer transition-colors duration-200 overflow-hidden ${
            isScanning
              ? 'bg-[#2a2a2a] text-white'
              : 'bg-[#222] hover:bg-[#333] text-[#aaa] hover:text-white'
          }`}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
          <span className="hidden md:inline">{isScanning ? t('header.scanning') : t('header.scan')}</span>
        </button>
        )}

        {/* Live Active Download Indicator */}
        {activeTask && (
          <button
            onClick={() => goTo('downloads')}
            title={t('header.queueTitle')}
            className="relative flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-medium bg-[#2a2a2a] hover:bg-[#333] text-white border border-white/10 cursor-pointer transition-colors duration-200 overflow-hidden"
          >
            <Download className={`w-3.5 h-3.5 ${activeTask.status === 'downloading' ? 'animate-download-nudge' : ''}`} />
            <span className="text-[11px] tabular-nums font-semibold">
              {activeTask.status === 'queued'
                ? t('header.queued')
                : activeTask.status === 'processing'
                  ? t('header.processing')
                  : `${Math.round(activeTask.progress)}%`}
            </span>
            <span className={`activity-bar ${activeTask.status !== 'downloading' ? 'activity-bar-indeterminate' : ''}`}>
              <span
                className="activity-bar-fill"
                style={{ width: activeTask.status === 'downloading' ? `${Math.max(8, activeTask.progress || 0)}%` : undefined }}
              />
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
          title={t('nav.settings')}
        >
          <SettingsIcon className="w-4 h-4" />
        </button>

        {/* User Profile / Channel */}
        <button
          onClick={() => goTo('mychannel')}
          className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-[#272727] cursor-pointer flex-shrink-0 outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none hover:opacity-90 transition"
          title={t('nav.yourChannel')}
        >
          {myChannel ? (
            <ChannelAvatar
              channelId={myChannel.id}
              url={myChannel.avatar_url}
              title={ownerDisplayTitle(myChannel.title, t('mych.defaultTitle'))}
              className="w-full h-full rounded-full"
              textClassName="text-xs"
            />
          ) : (
            <div className="w-full h-full bg-[#272727] text-[#aaa] hover:text-white flex items-center justify-center transition">
              <User className="w-4 h-4" />
            </div>
          )}
        </button>
      </div>
    </header>
  );
};

