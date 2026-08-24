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
  Check,
} from 'lucide-react';
import { useMyTube } from '../../context/MyTubeContext';
import { useDownloadQueue } from '../../context/VidArchContext';
import { VidArchLogo } from '../common/VidArchLogo';
import { ChannelAvatar } from '../common/ChannelAvatar';
import { useI18n } from '../../i18n/I18nProvider';
import { ownerDisplayTitle } from '../../utils/channelTitle';
import { AnchoredPopover } from '../common/AnchoredPopover';

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
  <ul>
    {items.map((item) => (
      <li key={item.id} className="flex items-center gap-0.5">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(item.query)}
          className="va-menu-item !w-auto flex-1 min-w-0"
        >
          <Clock className="va-menu-icon" />
          <span className="truncate">{item.query}</span>
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onRemove(item.id)}
          className="p-1.5 mr-0.5 rounded-lg text-[#8794a3] hover:text-white hover:bg-white/[0.06] cursor-pointer flex-shrink-0"
          title={removeLabel}
          aria-label={removeLabel}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </li>
    ))}
  </ul>
);

interface HeaderProps {
  onToggleSidebar: () => void;
}

const MenuProgress: React.FC<{ value?: number; indeterminate?: boolean }> = ({ value, indeterminate }) => (
  <span className="mt-1.5 block h-0.5 w-full rounded-full bg-white/10 overflow-hidden">
    <span
      className={`block h-full rounded-full bg-[#73c7e8] ${indeterminate ? 'menu-progress-indeterminate' : 'progress-fill'}`}
      style={indeterminate ? undefined : { width: `${Math.min(100, Math.max(4, value || 0))}%` }}
    />
  </span>
);

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const { 
    nav, 
    goTo, 
    isScanning, 
    triggerScan, 
    openImportModal, 
    myChannel,
    myChannels,
    setActiveOwnerChannel,
    localOnly,
    scanEnabled,
  } = useMyTube();
  const { activeTask } = useDownloadQueue();
  const { t } = useI18n();

  const [searchQuery, setSearchQuery] = useState(nav.query || '');
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const desktopSearchRef = useRef<HTMLDivElement>(null);
  const accountBtnRef = useRef<HTMLButtonElement>(null);
  const [accountOpen, setAccountOpen] = useState(false);

  const hasActivity = isScanning || !!activeTask;
  const ownedChannels = myChannels.length > 0 ? myChannels : (myChannel ? [myChannel] : []);

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
    <header className="va-header fixed top-0 left-0 right-0 z-50 h-14 bg-[#090d12] border-b border-[#18212c] px-3 sm:px-4 flex items-center justify-between select-none overflow-visible">
      {/* ========================================================================= */}
      {/* MOBILE FULL-SCREEN SEARCH OVERLAY (when active on mobile)                */}
      {/* ========================================================================= */}
      {isMobileSearchOpen ? (
        <div className="fixed inset-0 z-50 bg-[#090d12] flex flex-col animate-in fade-in duration-300">
          <div className="h-14 px-2 flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => {
                setIsMobileSearchOpen(false);
                setHistoryOpen(false);
              }}
              className="p-2 rounded-full hover:bg-white/10 text-[#f4f7fb] cursor-pointer flex-shrink-0"
              title={t('header.searchClose')}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <form onSubmit={handleSearchSubmit} className="flex-1 flex items-center">
              <div className="flex-1 flex items-center bg-[#0c1118] border border-[#24303d] rounded-full px-3.5 py-1.5 focus-within:border-[#73c7e8]">
                <input
                  ref={mobileInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={openSearchHistory}
                  placeholder={localOnly ? t('header.searchPlaceholderLocal') : t('header.searchPlaceholder')}
                  className="w-full bg-transparent text-[16px] sm:text-sm text-white focus:outline-none placeholder-[#657383]"
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
                className="p-2 ml-1 text-[#f4f7fb] hover:text-white transition cursor-pointer"
              >
                <Search className="w-4 h-4" />
              </button>
            </form>
          </div>

          {showHistory && (
            <div className="flex-1 overflow-y-auto border-t border-[#18212c]">
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
      <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0 z-20">
        <button
          onClick={onToggleSidebar}
          className="p-2 hover:bg-white/10 rounded-full transition text-[#f4f7fb] cursor-pointer"
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

      {/* Center: Desktop search — lg+ only so landscape phones keep the portrait icon */}
      <div className="hidden lg:flex absolute left-1/2 -translate-x-1/2 w-full max-w-[500px] md:max-w-[560px] lg:max-w-[620px] px-4 justify-center z-10 pointer-events-auto">
        <div ref={desktopSearchRef} className="relative w-full">
          <form onSubmit={handleSearchSubmit} className="va-search-shell flex items-center w-full">
            <div className="flex items-center flex-1 bg-transparent px-4 py-1.5 transition">
              <Search className="w-4 h-4 text-[#888] mr-2 flex-shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={openSearchHistory}
                onClick={openSearchHistory}
                placeholder={localOnly ? t('header.searchPlaceholderLocal') : t('header.searchPlaceholder')}
                className="w-full bg-transparent text-[16px] sm:text-sm text-[#f4f7fb] placeholder-[#657383] focus:outline-none"
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
              className="va-search-button text-[#f4f7fb] px-5 py-2 border-0 flex items-center justify-center transition cursor-pointer flex-shrink-0"
              title={t('header.search')}
            >
              <Search className="w-4 h-4" />
            </button>
          </form>

          {showHistory && (
            <div className="absolute top-full left-0 right-0 mt-1.5 max-h-[min(24rem,calc(100dvh-4.5rem))] overflow-y-auto va-menu z-50">
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

      {/* Right: Search (mobile) + Settings + Account */}
      <div className="flex items-center gap-1 sm:gap-1.5 justify-end flex-shrink-0">
        <button
          onClick={() => setIsMobileSearchOpen(true)}
          className="lg:hidden p-2 rounded-full hover:bg-white/10 text-[#f4f7fb] transition cursor-pointer"
          title={t('header.search')}
        >
          <Search className="w-5 h-5" />
        </button>

        <button
          onClick={() => goTo('settings')}
          className={`p-2 rounded-full transition cursor-pointer ${
            nav.page === 'settings' 
              ? 'bg-white/20 text-white' 
              : 'hover:bg-white/10 text-[#aaa] hover:text-white'
          }`}
          title={t('nav.settings')}
        >
          <SettingsIcon className="w-4 h-4" />
        </button>

        <div className="relative">
          <button
            ref={accountBtnRef}
            type="button"
            onClick={() => setAccountOpen((open) => !open)}
            className="relative w-8 h-8 rounded-full flex items-center justify-center bg-[#18212c] cursor-pointer flex-shrink-0 outline-none hover:opacity-90 transition"
            title={t('nav.yourChannel')}
          >
            <span className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center">
              {myChannel ? (
                <ChannelAvatar
                  channelId={myChannel.id}
                  url={myChannel.avatar_url}
                  title={ownerDisplayTitle(myChannel.title, t('mych.defaultTitle'))}
                  className="w-full h-full rounded-full"
                  textClassName="text-xs"
                />
              ) : (
                <span className="w-full h-full bg-[#18212c] text-[#aaa] flex items-center justify-center">
                  <User className="w-4 h-4" />
                </span>
              )}
            </span>
            {hasActivity && (
              <span className="activity-dot absolute top-0 left-0 pointer-events-none" />
            )}
          </button>

          <AnchoredPopover
            open={accountOpen}
            onClose={() => setAccountOpen(false)}
            anchorRef={accountBtnRef}
            align="end"
            preferredSide="bottom"
            className="w-72 max-w-[calc(100vw-16px)]"
          >
            <p className="va-menu-label">
              {ownedChannels.length > 1 ? t('header.yourChannels') : t('nav.yourChannel')}
            </p>
            {ownedChannels.length > 0 ? (
              ownedChannels.map((ch) => {
                const active = myChannel?.id === ch.id;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={async () => {
                      if (!active) await setActiveOwnerChannel(ch.id);
                      setAccountOpen(false);
                      goTo('mychannel');
                    }}
                    className={`va-menu-item ${active ? 'is-active' : ''}`}
                  >
                    <ChannelAvatar
                      channelId={ch.id}
                      url={ch.avatar_url}
                      title={ownerDisplayTitle(ch.title, t('mych.defaultTitle'))}
                      className="w-7 h-7 rounded-full"
                      textClassName="text-[10px]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">
                        {ownerDisplayTitle(ch.title, t('mych.defaultTitle'))}
                      </span>
                      {(ch.handle) && (
                        <span className="va-menu-hint truncate">{ch.handle}</span>
                      )}
                    </span>
                    {active && <Check className="w-3.5 h-3.5 text-white/50 flex-shrink-0" />}
                  </button>
                );
              })
            ) : (
              <button
                type="button"
                onClick={() => {
                  setAccountOpen(false);
                  goTo('mychannel');
                }}
                className="va-menu-item"
              >
                {t('header.goToChannel')}
              </button>
            )}

            <div className="va-menu-sep" />

            <button
              type="button"
              onClick={() => {
                setAccountOpen(false);
                openImportModal();
              }}
              className="va-menu-item"
            >
              <Plus className="va-menu-icon" />
              <span>{t('header.import')}</span>
            </button>

            {!localOnly && scanEnabled && (
              <button
                type="button"
                onClick={() => {
                  if (!isScanning) void triggerScan();
                }}
                disabled={isScanning}
                className="va-menu-item items-start"
              >
                <RefreshCw className="va-menu-icon mt-0.5" />
                <span className="min-w-0 flex-1">
                  <span>{isScanning ? t('header.scanning') : t('header.scan')}</span>
                  {isScanning && <MenuProgress indeterminate />}
                </span>
              </button>
            )}

            {activeTask && (
              <button
                type="button"
                onClick={() => {
                  setAccountOpen(false);
                  goTo('downloads');
                }}
                className="va-menu-item items-start"
              >
                <Download className="va-menu-icon mt-0.5" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate">
                      {activeTask.status === 'queued'
                        ? t('header.queued')
                        : activeTask.status === 'processing'
                          ? t('header.processing')
                          : t('header.downloadInProgress')}
                    </span>
                    {activeTask.status === 'downloading' && (
                      <span className="text-[11px] tabular-nums font-medium text-white/45 flex-shrink-0">
                        {Math.round(activeTask.progress)}%
                      </span>
                    )}
                  </span>
                  {activeTask.title && (
                    <span className="va-menu-hint truncate">{activeTask.title}</span>
                  )}
                  <MenuProgress
                    value={activeTask.status === 'downloading' ? activeTask.progress : undefined}
                    indeterminate={activeTask.status !== 'downloading'}
                  />
                </span>
              </button>
            )}
          </AnchoredPopover>
        </div>
      </div>
    </header>
  );
};
