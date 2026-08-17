import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Film, 
  ArrowRight,
  HardDrive,
  Tv2,
  History,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import type { Video } from '../types';
import { VideoCard } from '../components/video/VideoCard';
import { useMyTube } from '../context/MyTubeContext';

interface HomeFeedData {
  downloaded: Video[];
  subscriptionsUndownloaded: Video[];
  recentSearches: Video[];
}

export const Home: React.FC = () => {
  const { goTo, openDownloadModal, dataVersion } = useMyTube();
  const [feed, setFeed] = useState<HomeFeedData>({
    downloaded: [],
    subscriptionsUndownloaded: [],
    recentSearches: [],
  });
  const [filteredVideos, setFilteredVideos] = useState<Video[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'downloaded' | 'subscriptions' | 'recent' | 'unwatched'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [quickInput, setQuickInput] = useState('');

  const loadFeed = async () => {
    setIsLoading(true);
    try {
      if (selectedFilter === 'all') {
        const res = await fetch('/api/videos/home-feed');
        if (res.ok) {
          const data = await res.json();
          setFeed(data);
        }
      } else {
        const tabParam = selectedFilter === 'recent' ? 'recent' : selectedFilter;
        const res = await fetch(`/api/videos?tab=${tabParam}`);
        if (res.ok) {
          const data = await res.json();
          setFilteredVideos(data);
        }
      }
    } catch (err) {
      console.error('Error fetching home feed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFeed();
  }, [selectedFilter, dataVersion]);

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickInput.trim()) return;
    if (quickInput.startsWith('http') || quickInput.startsWith('www.')) {
      openDownloadModal({ url: quickInput.trim() });
    } else {
      goTo('search', { query: quickInput.trim() });
    }
    setQuickInput('');
  };

  const hasAnyContent = feed.downloaded.length > 0 || feed.subscriptionsUndownloaded.length > 0 || feed.recentSearches.length > 0 || filteredVideos.length > 0;

  return (
    <div className="flex-1 w-full px-6 pt-3 pb-8 space-y-8">
      {/* Category Chips Bar */}
      <div className="flex items-center gap-2.5 overflow-x-auto pb-1 no-scrollbar select-none">
        {[
          { id: 'all', label: 'Tout (Vue d\'ensemble)' },
          { id: 'downloaded', label: `Téléchargées (${feed.downloaded.length})` },
          { id: 'subscriptions', label: `Flux des abonnements (${feed.subscriptionsUndownloaded.length})` },
          { id: 'unwatched', label: 'À regarder' },
        ].map((filter) => (
          <button
            key={filter.id}
            onClick={() => setSelectedFilter(filter.id as any)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              selectedFilter === filter.id
                ? 'bg-white text-black font-bold shadow-sm'
                : 'bg-[#272727] hover:bg-[#383838] text-[#f1f1f1]'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Empty State / Welcome Hero (when no video is downloaded or scanned yet) */}
      {!hasAnyContent && !isLoading && (
        <div className="relative overflow-hidden rounded-3xl bg-[#181818] border border-[#272727] p-8 sm:p-12 shadow-xl text-center max-w-3xl mx-auto my-6">
          <div className="relative z-10 max-w-2xl mx-auto flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#ff0033] to-[#ff5e00] flex items-center justify-center text-white shadow-xl shadow-red-600/30 mb-6">
              <Film className="w-8 h-8" />
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Bienvenue sur votre archive <span className="text-[#ff0033]">VidArch</span>
            </h1>
            <p className="text-sm text-[#aaa] mt-3 max-w-lg leading-relaxed">
              Téléchargez vos vidéos préférées, abonnez-vous à des chaînes YouTube et profitez d'une lecture locale fluide, sans publicité ni coupure.
            </p>

            {/* Quick action search / paste */}
            <form onSubmit={handleQuickSubmit} className="w-full max-w-lg mt-8 flex items-center bg-[#121212] border border-[#303030] rounded-2xl p-1.5 focus-within:border-[#3ea6ff] focus-within:ring-1 focus-within:ring-[#3ea6ff] transition">
              <Search className="w-5 h-5 text-[#888] ml-3 mr-2" />
              <input
                type="text"
                value={quickInput}
                onChange={(e) => setQuickInput(e.target.value)}
                placeholder="Coller une URL YouTube ou rechercher une chaîne..."
                className="flex-1 bg-transparent text-sm text-white placeholder-[#717171] focus:outline-none"
              />
              <button
                type="submit"
                className="bg-[#ff0033] hover:bg-[#cc0029] text-white px-5 py-2.5 rounded-xl font-semibold text-xs transition flex items-center gap-1.5 shadow-lg shadow-red-600/30 cursor-pointer"
              >
                <span>Rechercher</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>

            {/* Popular Suggestions */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
              <span className="text-xs text-[#717171] mr-1">Suggestions rapides :</span>
              {['@ego_one', '@Veritasium', '@Underscore_', '@Kurzgesagt', '@ScienceEtonnante'].map((s) => (
                <button
                  key={s}
                  onClick={() => goTo('search', { query: s })}
                  className="bg-[#272727] hover:bg-[#383838] text-xs text-[#ddd] px-3 py-1.5 rounded-full border border-white/5 transition cursor-pointer"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8 animate-pulse">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <div key={n} className="space-y-3">
              <div className="w-full aspect-video bg-[#272727] rounded-xl" />
              <div className="flex gap-3">
                <div className="w-9 h-9 rounded-full bg-[#272727] flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-[#272727] rounded w-5/6" />
                  <div className="h-3 bg-[#272727] rounded w-3/5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ALL VIEW: SEPARATED ROWS (Downloaded, Subscriptions Detected, Searches)   */}
      {/* ========================================================================= */}
      {!isLoading && selectedFilter === 'all' && (
        <div className="space-y-10">
          {/* 1. Vidéos téléchargées (Hors-ligne) */}
          {feed.downloaded.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <HardDrive className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    Vidéos téléchargées (Lecture hors-ligne)
                  </h2>
                  <span className="text-xs text-[#aaa] bg-[#272727] px-2 py-0.5 rounded-full font-medium">
                    {feed.downloaded.length}
                  </span>
                </div>
                <button
                  onClick={() => goTo('library')}
                  className="text-xs text-[#3ea6ff] hover:text-[#65b8ff] font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <span>Tout afficher</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
                {feed.downloaded.map((video) => (
                  <VideoCard key={video.id} video={video} onDelete={loadFeed} />
                ))}
              </div>
            </div>
          )}

          {/* 2. Nouveautés des Abonnements (À télécharger) */}
          {feed.subscriptionsUndownloaded.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Tv2 className="w-5 h-5 text-[#ff0033]" />
                  <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    Nouveautés des abonnements (À télécharger)
                  </h2>
                  <span className="text-xs text-[#aaa] bg-[#272727] px-2 py-0.5 rounded-full font-medium">
                    {feed.subscriptionsUndownloaded.length}
                  </span>
                </div>
                <button
                  onClick={() => goTo('subscriptions')}
                  className="text-xs text-[#3ea6ff] hover:text-[#65b8ff] font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <span>Gérer les chaînes</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
                {feed.subscriptionsUndownloaded.map((video) => (
                  <VideoCard key={video.id} video={video} onDelete={loadFeed} />
                ))}
              </div>
            </div>
          )}

          {/* 3. 10 Dernières Vidéos Apparues dans les Recherches */}
          {feed.recentSearches.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    Découvertes récentes (10 dernières vidéos recherchées)
                  </h2>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
                {feed.recentSearches.map((video) => (
                  <VideoCard key={video.id} video={video} onDelete={loadFeed} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* FILTERED VIEW (When user selects a specific chip filter) */}
      {!isLoading && selectedFilter !== 'all' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
          {filteredVideos.map((video) => (
            <VideoCard key={video.id} video={video} onDelete={loadFeed} />
          ))}
        </div>
      )}
    </div>
  );
};
