import React, { useState, useEffect } from 'react';
import type { Video } from '../types';
import { VideoCard } from '../components/video/VideoCard';
import { useMyTube } from '../context/MyTubeContext';
import { useI18n } from '../i18n/I18nProvider';

interface HomeFeedData {
  downloaded: Video[];
  subscriptionsUndownloaded: Video[];
  recentSearches: Video[];
}

export const Home: React.FC = () => {
  const { goTo, dataVersion, localOnly } = useMyTube();
  const { t } = useI18n();
  const [feed, setFeed] = useState<HomeFeedData>({
    downloaded: [],
    subscriptionsUndownloaded: [],
    recentSearches: [],
  });
  const [filteredVideos, setFilteredVideos] = useState<Video[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'downloaded' | 'subscriptions' | 'recent' | 'unwatched'>('all');
  const [isLoading, setIsLoading] = useState(true);

  const loadFeed = async () => {
    const firstLoad = !feed.downloaded.length && !filteredVideos.length;
    if (firstLoad) setIsLoading(true);
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

  const hasAnyContent = feed.downloaded.length > 0 || feed.subscriptionsUndownloaded.length > 0 || feed.recentSearches.length > 0 || filteredVideos.length > 0;

  return (
    <div className="flex-1 w-full px-6 pt-6 pb-8 space-y-8">
      {hasAnyContent && (
      <div className="flex items-center gap-2.5 overflow-x-auto pb-1 no-scrollbar select-none">
        {[
          { id: 'all', label: t('home.filterAll') },
          { id: 'downloaded', label: t('home.filterDownloaded', { count: feed.downloaded.length }) },
          ...(!localOnly ? [{ id: 'subscriptions', label: t('home.filterSubs', { count: feed.subscriptionsUndownloaded.length }) }] : []),
          { id: 'unwatched', label: t('home.filterUnwatched') },
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
      )}

      {!hasAnyContent && !isLoading && (
        <div className="max-w-xl pt-10 sm:pt-16 md:pt-20">
          <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-[#ff0033]">
            {t('home.welcomeEyebrow')}
          </p>
          <h1 className="mt-4 text-3xl sm:text-[2.6rem] font-semibold text-white tracking-tight leading-[1.15]">
            {t('home.welcomeTitle')}
          </h1>
          <p className="mt-5 text-[15px] text-[#aaa] leading-relaxed">
            {localOnly ? t('home.welcomeBodyLocal') : t('home.welcomeBody')}
          </p>
          <p className="mt-8 text-xs text-[#666] leading-relaxed">
            {localOnly ? t('home.welcomeHintLocal') : t('home.welcomeHint')}
          </p>
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
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="text-lg font-semibold text-white tracking-tight">
                  {t('home.downloadedTitle')}
                  <span className="ml-2 text-sm font-normal text-[#717171]">{feed.downloaded.length}</span>
                </h2>
                <button
                  onClick={() => goTo('library')}
                  className="text-xs font-medium text-[#aaa] hover:text-white transition cursor-pointer shrink-0"
                >
                  {t('home.showAll')}
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
          {!localOnly && feed.subscriptionsUndownloaded.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="text-lg font-semibold text-white tracking-tight">
                  {t('home.subsTitle')}
                  <span className="ml-2 text-sm font-normal text-[#717171]">{feed.subscriptionsUndownloaded.length}</span>
                </h2>
                <button
                  onClick={() => goTo('subscriptions')}
                  className="text-xs font-medium text-[#aaa] hover:text-white transition cursor-pointer shrink-0"
                >
                  {t('home.manageChannels')}
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
          {!localOnly && feed.recentSearches.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white tracking-tight">
                {t('home.recentTitle')}
              </h2>

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
