import React, { useState, useEffect, useCallback } from 'react';
import type { Video } from '../types';
import { VideoCard } from '../components/video/VideoCard';
import { useMyTube } from '../context/MyTubeContext';
import { useI18n } from '../i18n/I18nProvider';

interface HomeFeedData {
  downloaded: Video[];
  subscriptionsUndownloaded: Video[];
  recentSearches: Video[];
  totals: {
    downloaded: number;
    subscriptionsUndownloaded: number;
    recentSearches: number;
  };
}

const HOME_SECTION_LIMIT = 8;

export const Home: React.FC = () => {
  const { dataVersion, localOnly } = useMyTube();
  const { t } = useI18n();
  const [feed, setFeed] = useState<HomeFeedData>({
    downloaded: [],
    subscriptionsUndownloaded: [],
    recentSearches: [],
    totals: {
      downloaded: 0,
      subscriptionsUndownloaded: 0,
      recentSearches: 0,
    },
  });
  const [filteredVideos, setFilteredVideos] = useState<Video[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'downloaded' | 'subscriptions' | 'recent' | 'unwatched'>('all');
  const [isLoading, setIsLoading] = useState(true);

  const loadFeed = useCallback(async () => {
    setIsLoading(true);
    try {
      if (selectedFilter === 'all') {
        const res = await fetch('/api/videos/home-feed');
        if (res.ok) {
          const data = await res.json();
          setFeed({
            ...data,
            totals: data.totals || {
              downloaded: data.downloaded?.length || 0,
              subscriptionsUndownloaded: data.subscriptionsUndownloaded?.length || 0,
              recentSearches: data.recentSearches?.length || 0,
            },
          });
        }
      } else {
        const tabParam = selectedFilter === 'subscriptions' ? 'subscription-discoveries' : selectedFilter;
        const res = await fetch(`/api/videos?tab=${tabParam}&limit=100`);
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
  }, [selectedFilter]);

  useEffect(() => {
    void loadFeed();
  }, [dataVersion, loadFeed]);

  const hasAnyContent = feed.downloaded.length > 0 || feed.subscriptionsUndownloaded.length > 0 || feed.recentSearches.length > 0 || filteredVideos.length > 0;

  return (
    <div className="flex-1 w-full px-4 sm:px-6 pt-6 pb-10 space-y-9">
      {hasAnyContent && (
      <div className="va-filter-rail flex items-center gap-1.5 overflow-x-auto no-scrollbar select-none">
        {[
          { id: 'all', label: t('home.filterAll') },
          { id: 'downloaded', label: t('home.filterDownloaded', { count: feed.totals.downloaded }) },
          ...(!localOnly ? [
            { id: 'subscriptions', label: t('home.filterSubs', { count: feed.totals.subscriptionsUndownloaded }) },
            { id: 'recent', label: t('home.recentTitle') },
          ] : []),
          { id: 'unwatched', label: t('home.filterUnwatched') },
        ].map((filter) => (
          <button
            key={filter.id}
            onClick={() => setSelectedFilter(filter.id as any)}
            className={`va-filter px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              selectedFilter === filter.id
                ? 'is-active font-bold'
                : 'bg-[#18212c] hover:bg-[#23303e] text-[#f4f7fb]'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>
      )}

      {!hasAnyContent && !isLoading && (
        <div className="max-w-xl pt-10 sm:pt-16 md:pt-20">
          <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-[#ff5a67]">
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
              <div className="w-full aspect-video bg-[#18212c] rounded-xl" />
              <div className="flex gap-3">
                <div className="w-9 h-9 rounded-full bg-[#18212c] flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-[#18212c] rounded w-5/6" />
                  <div className="h-3 bg-[#18212c] rounded w-3/5" />
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
                <h2 className="va-section-heading text-lg font-semibold text-white tracking-tight">
                  {t('home.downloadedTitle')}
                  <span className="ml-2 text-sm font-normal text-[#657383]">{feed.totals.downloaded}</span>
                </h2>
                {feed.totals.downloaded > HOME_SECTION_LIMIT && (
                  <button
                    onClick={() => setSelectedFilter('downloaded')}
                    className="text-xs font-medium text-[#aaa] hover:text-white transition cursor-pointer shrink-0"
                  >
                    {t('home.showAll')}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
                {feed.downloaded.slice(0, HOME_SECTION_LIMIT).map((video) => (
                  <VideoCard key={video.id} video={video} onDelete={loadFeed} />
                ))}
              </div>
            </div>
          )}

          {/* 2. Nouveautés des Abonnements (À télécharger) */}
          {!localOnly && feed.subscriptionsUndownloaded.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="va-section-heading text-lg font-semibold text-white tracking-tight">
                  {t('home.subsTitle')}
                  <span className="ml-2 text-sm font-normal text-[#657383]">{feed.totals.subscriptionsUndownloaded}</span>
                </h2>
                {feed.totals.subscriptionsUndownloaded > HOME_SECTION_LIMIT && (
                  <button
                    onClick={() => setSelectedFilter('subscriptions')}
                    className="text-xs font-medium text-[#aaa] hover:text-white transition cursor-pointer shrink-0"
                  >
                    {t('home.showAll')}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
                {feed.subscriptionsUndownloaded.slice(0, HOME_SECTION_LIMIT).map((video) => (
                  <VideoCard key={video.id} video={video} onDelete={loadFeed} />
                ))}
              </div>
            </div>
          )}

          {/* 3. Découvertes récentes issues des recherches */}
          {!localOnly && feed.recentSearches.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="va-section-heading text-lg font-semibold text-white tracking-tight">
                  {t('home.recentTitle')}
                  <span className="ml-2 text-sm font-normal text-[#657383]">{feed.totals.recentSearches}</span>
                </h2>
                {feed.totals.recentSearches > HOME_SECTION_LIMIT && (
                  <button
                    onClick={() => setSelectedFilter('recent')}
                    className="text-xs font-medium text-[#aaa] hover:text-white transition cursor-pointer shrink-0"
                  >
                    {t('home.showAll')}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
                {feed.recentSearches.slice(0, HOME_SECTION_LIMIT).map((video) => (
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
