import React from 'react';
import { 
  Home, 
  Tv2, 
  Plus, 
  DownloadCloud, 
  FolderHeart,
  User
} from 'lucide-react';
import { useMyTube } from '../../context/MyTubeContext';
import { ChannelAvatar } from '../common/ChannelAvatar';
import { useI18n } from '../../i18n/I18nProvider';
import { ownerDisplayTitle } from '../../utils/channelTitle';

export const BottomNav: React.FC = () => {
  const { nav, goTo, openImportModal, activeTask, myChannel } = useMyTube();
  const { t } = useI18n();

  const isHome = nav.page === 'home';
  const isSubs = nav.page === 'subscriptions';
  const isDownloads = nav.page === 'downloads';
  const isLibrary = nav.page === 'library' || nav.page === 'history' || nav.page === 'liked';

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 h-14 md:hidden bg-[#0f0f0f]/95 backdrop-blur-lg border-t border-[#272727] flex items-center justify-around px-1 select-none safe-bottom">
      <button
        onClick={() => goTo('home')}
        className={`flex-1 flex flex-col items-center justify-center py-1 gap-1 transition cursor-pointer ${
          isHome ? 'text-white font-bold' : 'text-[#aaa] hover:text-white'
        }`}
      >
        <Home className={`w-5 h-5 ${isHome ? 'text-white' : 'text-[#aaa]'}`} />
        <span className="text-[10px] tracking-tight">{t('nav.home')}</span>
      </button>

      <button
        onClick={() => goTo('subscriptions')}
        className={`flex-1 flex flex-col items-center justify-center py-1 gap-1 transition cursor-pointer ${
          isSubs ? 'text-white font-bold' : 'text-[#aaa] hover:text-white'
        }`}
      >
        <Tv2 className={`w-5 h-5 ${isSubs ? 'text-[#ff0033]' : 'text-[#aaa]'}`} />
        <span className="text-[10px] tracking-tight">{t('nav.subscriptions')}</span>
      </button>

      <button
        onClick={openImportModal}
        className="flex-1 flex flex-col items-center justify-center py-1 transition cursor-pointer group"
        title={t('header.importTitle')}
      >
        <div className="w-8 h-8 rounded-full bg-white/10 group-hover:bg-white/20 border border-white/10 flex items-center justify-center text-white transition active:scale-95 shadow-sm">
          <Plus className="w-4 h-4 text-[#ff0033]" />
        </div>
      </button>

      <button
        onClick={() => goTo('downloads')}
        className={`flex-1 flex flex-col items-center justify-center py-1 gap-1 transition cursor-pointer relative ${
          isDownloads ? 'text-white font-bold' : 'text-[#aaa] hover:text-white'
        }`}
      >
        <div className="relative">
          <DownloadCloud className={`w-5 h-5 ${isDownloads || activeTask ? 'text-white' : 'text-[#aaa]'}`} />
          {activeTask && (
            <span className="absolute -bottom-0.5 left-0 right-0 h-0.5 rounded-full bg-white/15 overflow-hidden">
              <span
                className={`block h-full rounded-full bg-[#ff0033] ${
                  activeTask.status === 'downloading' ? 'progress-fill' : 'animate-pulse-subtle'
                }`}
                style={{
                  width: activeTask.status === 'downloading' ? `${Math.max(12, activeTask.progress || 0)}%` : '45%',
                }}
              />
            </span>
          )}
        </div>
        <span className="text-[10px] tracking-tight">
          {activeTask ? `${Math.round(activeTask.progress)}%` : t('nav.downloads')}
        </span>
      </button>

      <button
        onClick={() => goTo('library')}
        className={`flex-1 flex flex-col items-center justify-center py-1 gap-1 transition cursor-pointer ${
          isLibrary ? 'text-white font-bold' : 'text-[#aaa] hover:text-white'
        }`}
      >
        {myChannel ? (
          <ChannelAvatar
            channelId={myChannel.id}
            url={myChannel.avatar_url}
            title={ownerDisplayTitle(myChannel.title, t('mych.defaultTitle'))}
            className={`w-5 h-5 rounded-full ${isLibrary ? 'ring-2 ring-white' : ''}`}
            textClassName="text-[8px]"
          />
        ) : (
          <User className={`w-5 h-5 ${isLibrary ? 'text-white' : 'text-[#aaa]'}`} />
        )}
        <span className="text-[10px] tracking-tight">{t('nav.you')}</span>
      </button>
    </nav>
  );
};
