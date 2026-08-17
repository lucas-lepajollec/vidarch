import React, { useState, useEffect } from 'react';
import { 
  Tv2, 
  CheckCircle2, 
  DownloadCloud,
  Clock
} from 'lucide-react';
import type { Video } from '../types';
import { VideoCard } from '../components/video/VideoCard';
import { useMyTube } from '../context/MyTubeContext';

export const Subscriptions: React.FC = () => {
  const { subscriptions, goTo, dataVersion } = useMyTube();
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadSubscriptionVideos = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/videos?tab=subscriptions');
      if (res.ok) {
        const data = await res.json();
        setVideos(data);
      }
    } catch (err) {
      console.error('Error fetching subscription videos:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSubscriptionVideos();
  }, [subscriptions, dataVersion]);

  // Compute pending un-downloaded videos across all subscriptions
  const unDownloadedFeedVideos = videos.filter(v => !v.is_downloaded);
  const unDownloadedSubsCount = subscriptions.reduce(
    (sum, s) => sum + Math.max(0, (s.total_detected_videos || 0) - (s.downloaded_count || 0)), 
    0
  );
  const pendingCount = Math.max(unDownloadedFeedVideos.length, unDownloadedSubsCount);

  return (
    <div className="flex-1 w-full px-4 sm:px-6 pt-3 pb-8 space-y-5 select-none">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <span>Abonnements</span>
          </h1>
          <p className="text-xs text-[#aaa] mt-0.5">
            {subscriptions.length} chaîne{subscriptions.length > 1 ? 's' : ''} suivie{subscriptions.length > 1 ? 's' : ''}
          </p>
        </div>

        {/* Status metric: non-downloaded videos count */}
        {subscriptions.length > 0 && (
          <div>
            {pendingCount > 0 ? (
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#1e1e1e] border border-[#383838] text-xs shadow-sm">
                <span className="w-2 h-2 rounded-full bg-[#3ea6ff] animate-pulse flex-shrink-0" />
                <span className="text-[#eee] font-medium">
                  <strong className="text-white font-bold mr-1">{pendingCount}</strong>
                  vidéo{pendingCount > 1 ? 's' : ''} non téléchargée{pendingCount > 1 ? 's' : ''}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Toutes les vidéos sont téléchargées</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Channel Avatars Horizontal Bar */}
      {subscriptions.length > 0 && (
        <div className="flex items-center gap-4 overflow-x-auto pb-2 no-scrollbar select-none">
          {subscriptions.map((ch) => (
            <button
              key={ch.id}
                onClick={() => goTo('channel', { channelId: ch.id })}
                className="flex flex-col items-center gap-2 flex-shrink-0 group cursor-pointer"
              >
                <div className="relative w-14 h-14 rounded-full p-0.5 border-2 border-white/10 group-hover:border-[#ff0033] transition-colors">
                  {ch.avatar_url ? (
                    <img src={ch.avatar_url} alt={ch.title} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <div className="w-full h-full rounded-full bg-gradient-to-tr from-[#ff0033] to-[#ff5e00] flex items-center justify-center text-white font-bold text-base">
                      {ch.title.charAt(0).toUpperCase()}
                    </div>
                  )}
                  {ch.auto_download === 1 && (
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-[#0f0f0f]" title="Auto-téléchargement activé" />
                  )}
                </div>
                <span className="text-[11px] text-[#aaa] group-hover:text-white max-w-[70px] truncate text-center transition">
                  {ch.title}
                </span>
              </button>
            ))}
        </div>
      )}

      {/* Empty State (Clean YouTube Native Style) */}
      {subscriptions.length === 0 && !isLoading && (
        <div className="py-20 flex flex-col items-center justify-center text-center max-w-lg mx-auto space-y-4">
          <div className="w-20 h-20 rounded-full bg-[#272727] flex items-center justify-center text-[#aaa]">
            <Tv2 className="w-10 h-10" />
          </div>
          <div>
            <h2 className="font-bold text-lg text-white">Ne manquez aucune vidéo</h2>
            <p className="text-xs text-[#aaa] mt-1 max-w-md">
              Abonnez-vous à vos chaînes YouTube préférées pour retrouver toutes leurs dernières vidéos directement dans ce flux.
            </p>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs text-[#717171] w-full mb-1">Recherches suggérées :</span>
            {['@Veritasium', '@Underscore_', '@Kurzgesagt', '@ScienceEtonnante', '@MKBHD'].map((s) => (
              <button
                key={s}
                onClick={() => goTo('search', { query: s })}
                className="bg-[#272727] hover:bg-[#383838] text-xs text-[#ddd] px-3.5 py-1.5 rounded-full border border-white/5 transition cursor-pointer"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Videos Grid */}
      {videos.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
          {videos.map((video) => (
            <VideoCard 
              key={video.id} 
              video={video} 
              onDelete={loadSubscriptionVideos}
            />
          ))}
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
    </div>
  );
};
