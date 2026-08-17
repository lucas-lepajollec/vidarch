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

export const BottomNav: React.FC = () => {
  const { nav, goTo, openImportModal, activeTask, myChannel } = useMyTube();

  const isHome = nav.page === 'home';
  const isSubs = nav.page === 'subscriptions';
  const isDownloads = nav.page === 'downloads';
  const isLibrary = nav.page === 'library' || nav.page === 'history' || nav.page === 'liked';

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 h-14 md:hidden bg-[#0f0f0f]/95 backdrop-blur-lg border-t border-[#272727] flex items-center justify-around px-1 select-none safe-bottom">
      {/* 1. Accueil */}
      <button
        onClick={() => goTo('home')}
        className={`flex-1 flex flex-col items-center justify-center py-1 gap-1 transition cursor-pointer ${
          isHome ? 'text-white font-bold' : 'text-[#aaa] hover:text-white'
        }`}
      >
        <Home className={`w-5 h-5 ${isHome ? 'text-white' : 'text-[#aaa]'}`} />
        <span className="text-[10px] tracking-tight">Accueil</span>
      </button>

      {/* 2. Abonnements */}
      <button
        onClick={() => goTo('subscriptions')}
        className={`flex-1 flex flex-col items-center justify-center py-1 gap-1 transition cursor-pointer ${
          isSubs ? 'text-white font-bold' : 'text-[#aaa] hover:text-white'
        }`}
      >
        <Tv2 className={`w-5 h-5 ${isSubs ? 'text-[#ff0033]' : 'text-[#aaa]'}`} />
        <span className="text-[10px] tracking-tight">Abonnements</span>
      </button>

      {/* 3. Importer (+) Center Action */}
      <button
        onClick={openImportModal}
        className="flex-1 flex flex-col items-center justify-center py-1 transition cursor-pointer group"
        title="Importer une vidéo ou une chaîne"
      >
        <div className="w-8 h-8 rounded-full bg-white/10 group-hover:bg-white/20 border border-white/10 flex items-center justify-center text-white transition active:scale-95 shadow-sm">
          <Plus className="w-4 h-4 text-[#ff0033]" />
        </div>
      </button>

      {/* 4. Téléchargements */}
      <button
        onClick={() => goTo('downloads')}
        className={`flex-1 flex flex-col items-center justify-center py-1 gap-1 transition cursor-pointer relative ${
          isDownloads ? 'text-white font-bold' : 'text-[#aaa] hover:text-white'
        }`}
      >
        <div className="relative">
          <DownloadCloud className={`w-5 h-5 ${isDownloads ? 'text-[#3ea6ff]' : 'text-[#aaa]'}`} />
          {activeTask && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#ff0033] rounded-full animate-ping" />
          )}
        </div>
        <span className="text-[10px] tracking-tight">
          {activeTask ? `${Math.round(activeTask.progress)}%` : 'Téléchargements'}
        </span>
      </button>

      {/* 5. Vous / Profil */}
      <button
        onClick={() => goTo('library')}
        className={`flex-1 flex flex-col items-center justify-center py-1 gap-1 transition cursor-pointer ${
          isLibrary ? 'text-white font-bold' : 'text-[#aaa] hover:text-white'
        }`}
      >
        {myChannel?.avatar_url ? (
          <img 
            src={myChannel.avatar_url} 
            alt="Vous" 
            className={`w-5 h-5 rounded-full object-cover ${isLibrary ? 'ring-2 ring-white' : ''}`} 
          />
        ) : (
          <User className={`w-5 h-5 ${isLibrary ? 'text-white' : 'text-[#aaa]'}`} />
        )}
        <span className="text-[10px] tracking-tight">Vous</span>
      </button>
    </nav>
  );
};
