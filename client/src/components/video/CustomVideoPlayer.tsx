import React, { useRef, useState, useEffect, useCallback } from 'react';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize, 
  RotateCcw, 
  RotateCw, 
  DownloadCloud, 
  Tv, 
  PictureInPicture,
  Check,
} from 'lucide-react';
import type { Video } from '../../types';
import { useMyTube } from '../../context/MyTubeContext';
import { useI18n } from '../../i18n/I18nProvider';
import { resolveThumbnail } from '../../utils/media';
import { AnchoredPopover } from '../common/AnchoredPopover';
import { applyPlayerPrefs, readPlayerPrefs, writePlayerPrefs } from '../../utils/playerPrefs';

interface CustomVideoPlayerProps {
  video: Video;
  isTheatre?: boolean;
  onToggleTheatre?: () => void;
  autoPlay?: boolean;
  onEnded?: () => void;
}

type FsDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => void;
};

type FsElement = HTMLElement & {
  webkitRequestFullscreen?: () => void;
  webkitRequestFullScreen?: () => void;
};

type FsVideo = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
  webkitExitFullscreen?: () => void;
  webkitDisplayingFullscreen?: boolean;
  webkitPresentationMode?: 'inline' | 'fullscreen' | 'picture-in-picture';
  webkitSetPresentationMode?: (mode: 'inline' | 'fullscreen' | 'picture-in-picture') => void;
};

export const CustomVideoPlayer: React.FC<CustomVideoPlayerProps> = React.memo(({
  video,
  isTheatre = false,
  onToggleTheatre,
  autoPlay = false,
  onEnded,
}) => {
  const { openDownloadModal } = useMyTube();
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speedBtnRef = useRef<HTMLButtonElement>(null);
  const speedOpenRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(video.duration || 0);
  const [volume, setVolume] = useState(() => readPlayerPrefs().volume);
  const [isMuted, setIsMuted] = useState(() => readPlayerPrefs().muted);
  const [playbackRate, setPlaybackRate] = useState(() => readPlayerPrefs().playbackRate);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [playbackQuality, setPlaybackQuality] = useState('');
  const [frameRatio, setFrameRatio] = useState(16 / 9);
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);

  const isDownloaded = video.is_downloaded === 1 && !!video.local_video_path;
  const videoSrc = isDownloaded ? `/api/videos/${video.id}/stream` : '';
  const controlsVisible = showControls || !isPlaying;
  speedOpenRef.current = showSpeedMenu;

  const refreshPlaybackQuality = () => {
    const el = videoRef.current;
    if (!el || !el.videoHeight) return;
    setPlaybackQuality(`${el.videoHeight}p`);
    if (el.videoWidth > 0 && el.videoHeight > 0) {
      setFrameRatio(el.videoWidth / el.videoHeight);
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const seconds = Math.floor(secs % 60);
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${mins}:${seconds.toString().padStart(2, '0')}`;
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = target;
      setCurrentTime(target);
    }
  };

  const skip = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + seconds));
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    const muted = val === 0;
    setVolume(val);
    setIsMuted(muted);
    writePlayerPrefs({ volume: val, muted });
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = muted;
    }
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    writePlayerPrefs({ muted: next, volume });
    if (videoRef.current) {
      videoRef.current.muted = next;
      videoRef.current.volume = volume;
    }
  };

  const handleSpeedChange = (rate: number) => {
    setPlaybackRate(rate);
    writePlayerPrefs({ playbackRate: rate });
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
    setShowSpeedMenu(false);
    speedOpenRef.current = false;
  };

  const nativeFullscreenActive = () => {
    const doc = document as FsDocument;
    const video = videoRef.current as FsVideo | null;
    return !!(
      document.fullscreenElement ||
      doc.webkitFullscreenElement ||
      video?.webkitDisplayingFullscreen ||
      video?.webkitPresentationMode === 'fullscreen'
    );
  };

  const requestNativeFullscreen = (el: HTMLElement) => {
    const node = el as FsElement;
    const opts: FullscreenOptions = { navigationUI: 'hide' };
    if (node.requestFullscreen) return node.requestFullscreen(opts);
    if (node.webkitRequestFullscreen) {
      node.webkitRequestFullscreen();
      return Promise.resolve();
    }
    if (node.webkitRequestFullScreen) {
      node.webkitRequestFullScreen();
      return Promise.resolve();
    }
    return Promise.reject(new Error('fullscreen unsupported'));
  };

  const toggleFullscreen = () => {
    const video = videoRef.current as FsVideo | null;
    const container = containerRef.current;
    if (!video) return;

    if (nativeFullscreenActive()) {
      if (video.webkitPresentationMode === 'fullscreen' && video.webkitSetPresentationMode) {
        video.webkitSetPresentationMode('inline');
        return;
      }
      if (video.webkitDisplayingFullscreen && video.webkitExitFullscreen) {
        video.webkitExitFullscreen();
        return;
      }
      const doc = document as FsDocument;
      if (document.exitFullscreen && document.fullscreenElement) {
        void document.exitFullscreen();
      } else {
        doc.webkitExitFullscreen?.();
      }
      return;
    }

    // iOS/iPadOS: only the video element's WebKit APIs leave Safari chrome.
    try {
      if (video.webkitSetPresentationMode) {
        video.webkitSetPresentationMode('fullscreen');
        return;
      }
      if (video.webkitEnterFullscreen) {
        video.webkitEnterFullscreen();
        return;
      }
    } catch (_) {}

    const target = container || video;
    void requestNativeFullscreen(target).catch(() => {
      void requestNativeFullscreen(video).catch(() => {});
    });
  };

  const togglePiP = async () => {
    if (!videoRef.current) return;
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    } else {
      await videoRef.current.requestPictureInPicture();
    }
  };

  const saveProgress = useCallback(async (time: number) => {
    try {
      await fetch(`/api/videos/${video.id}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          progress: time,
          is_watched: duration > 0 && time >= duration * 0.9,
        }),
      });
    } catch (_) {}
  }, [video.id, duration]);

  const bumpControls = useCallback((visible = true) => {
    setShowControls(visible);
    if (!visible) setShowSpeedMenu(false);
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    const playing = videoRef.current ? !videoRef.current.paused : false;
    if (visible && playing) {
      hideTimerRef.current = setTimeout(() => {
        if (speedOpenRef.current) return;
        setShowControls(false);
        setShowSpeedMenu(false);
      }, 3000);
    }
  }, []);

  const handleSurfaceClick = () => {
    if (isCoarsePointer) {
      if (showControls && isPlaying) bumpControls(false);
      else bumpControls(true);
      return;
    }
    togglePlay();
  };

  useEffect(() => {
    const mq = window.matchMedia('(hover: none), (pointer: coarse)');
    const sync = () => setIsCoarsePointer(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      if (!container.contains(document.activeElement) && document.activeElement !== container) {
        if (!container.matches(':hover')) return;
      }

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'j':
        case 'arrowleft':
          e.preventDefault();
          skip(-10);
          bumpControls(true);
          break;
        case 'l':
        case 'arrowright':
          e.preventDefault();
          skip(10);
          bumpControls(true);
          break;
        case 't':
          e.preventDefault();
          if (onToggleTheatre) onToggleTheatre();
          break;
        case 'p':
          e.preventDefault();
          togglePiP();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, isMuted, isFullscreen, onToggleTheatre, bumpControls]);

  useEffect(() => {
    setFrameRatio(16 / 9);
  }, [video.id]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    applyPlayerPrefs(el);
  }, [videoSrc, video.id]);

  useEffect(() => {
    const syncFs = () => setIsFullscreen(nativeFullscreenActive());
    document.addEventListener('fullscreenchange', syncFs);
    document.addEventListener('webkitfullscreenchange', syncFs);
    return () => {
      document.removeEventListener('fullscreenchange', syncFs);
      document.removeEventListener('webkitfullscreenchange', syncFs);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current as FsVideo | null;
    if (!video) return;
    const sync = () => setIsFullscreen(nativeFullscreenActive());
    video.addEventListener('webkitbeginfullscreen', sync);
    video.addEventListener('webkitendfullscreen', sync);
    video.addEventListener('webkitpresentationmodechanged', sync);
    return () => {
      video.removeEventListener('webkitbeginfullscreen', sync);
      video.removeEventListener('webkitendfullscreen', sync);
      video.removeEventListener('webkitpresentationmodechanged', sync);
    };
  }, [isDownloaded, video.id]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || isCoarsePointer) return;
    const onMove = () => bumpControls(true);
    container.addEventListener('mousemove', onMove);
    return () => container.removeEventListener('mousemove', onMove);
  }, [bumpControls, isCoarsePointer]);

  useEffect(() => {
    if (isPlaying) bumpControls(true);
    else {
      setShowControls(true);
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    }
  }, [isPlaying, bumpControls]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (isPlaying && currentTime > 0) {
        saveProgress(currentTime);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [isPlaying, currentTime, saveProgress]);

  useEffect(() => {
    if (video.watch_progress && videoRef.current) {
      videoRef.current.currentTime = video.watch_progress;
    }
  }, [video.id]);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  if (!isDownloaded) {
    return (
      <div
        className="vidarch-player relative bg-black overflow-hidden flex flex-col items-center justify-center p-6 sm:p-8 text-center min-h-[12rem]"
        style={{ ['--player-ratio' as string]: 16 / 9 }}
      >
        <img
          src={resolveThumbnail(video)}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-25"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/40" />
        <div className="relative z-10 max-w-sm flex flex-col items-center">
          <p className="text-sm font-medium text-white mb-1">{t('player.notLocal')}</p>
          <p className="text-xs text-[#aaa] mb-5 leading-relaxed">
            {t('player.notLocalBody')}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => openDownloadModal({
                videoId: video.id,
                url: `https://www.youtube.com/watch?v=${video.id}`,
                title: video.title,
                channelTitle: video.channel_title,
                channelId: video.channel_id,
                thumbnailUrl: video.thumbnail_url,
                durationString: video.duration_string,
              })}
              className="bg-white hover:bg-white/90 text-black text-xs font-semibold px-4 py-2 rounded-full flex items-center gap-1.5 transition-colors duration-200 cursor-pointer"
            >
              <DownloadCloud className="w-3.5 h-3.5" />
              <span>{t('player.downloadNow')}</span>
            </button>
            <a
              href={`https://www.youtube.com/watch?v=${video.id}`}
              target="_blank"
              rel="noreferrer"
              className="bg-white/10 hover:bg-white/15 text-white text-xs font-medium px-4 py-2 rounded-full transition-colors duration-200 cursor-pointer"
            >
              {t('player.watchYt')}
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`vidarch-player relative bg-black overflow-hidden group select-none ${
        isFullscreen ? 'is-fullscreen rounded-none' : isTheatre ? 'is-theatre' : ''
      }`}
      style={{ ['--player-ratio' as string]: frameRatio }}
      tabIndex={0}
    >
      <video
        ref={videoRef}
        src={videoSrc}
        playsInline
        preload="metadata"
        onPlay={() => {
          setIsPlaying(true);
          if (videoRef.current) {
            saveProgress(Math.max(1, videoRef.current.currentTime));
          }
        }}
        onPause={() => {
          setIsPlaying(false);
          if (videoRef.current) {
            saveProgress(videoRef.current.currentTime);
          }
        }}
        onTimeUpdate={() => {
          if (videoRef.current) {
            const time = videoRef.current.currentTime;
            setCurrentTime(time);
            if (videoRef.current.buffered.length > 0) {
              setBufferedEnd(videoRef.current.buffered.end(videoRef.current.buffered.length - 1));
            }
            if (Math.floor(time) % 3 === 0 && Math.floor(time) > 0) {
              saveProgress(time);
            }
          }
        }}
        onLoadedMetadata={() => {
          if (videoRef.current) {
            applyPlayerPrefs(videoRef.current);
            const dur = videoRef.current.duration;
            setDuration(dur);
            refreshPlaybackQuality();
            const progress = video.watch_progress || 0;
            if (progress > 1 && dur && progress < dur * 0.92) {
              videoRef.current.currentTime = progress;
            }
            if (autoPlay) {
              void videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
            }
          }
        }}
        onLoadedData={refreshPlaybackQuality}
        onEnded={() => {
          setIsPlaying(false);
          saveProgress(duration);
          onEnded?.();
        }}
        className="absolute inset-0 w-full h-full object-contain bg-black pointer-events-none"
      />

      <div
        className="absolute inset-0 z-10"
        onClick={handleSurfaceClick}
      >
        <div
          className={`absolute inset-0 flex items-center justify-center gap-10 sm:gap-16 transition-opacity duration-200 ${
            controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              skip(-10);
              bumpControls(true);
            }}
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-black/55 backdrop-blur-md border border-white/15 flex items-center justify-center text-white hover:bg-black/70 transition cursor-pointer"
            title={t('player.rewind')}
          >
            <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
              bumpControls(true);
            }}
            className="w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem] rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-2xl hover:scale-105 transition cursor-pointer"
            title={isPlaying ? t('player.pause') : t('player.play')}
          >
            {isPlaying ? (
              <Pause className="w-8 h-8 fill-current" />
            ) : (
              <Play className="w-8 h-8 fill-current ml-1" />
            )}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              skip(10);
              bumpControls(true);
            }}
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-black/55 backdrop-blur-md border border-white/15 flex items-center justify-center text-white hover:bg-black/70 transition cursor-pointer"
            title={t('player.forward')}
          >
            <RotateCw className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>
      </div>

      <div 
        className={`absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/40 to-transparent pt-10 sm:pt-12 pb-[max(0.5rem,env(safe-area-inset-bottom))] px-2.5 sm:px-4 transition-opacity duration-300 ${
          controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={(e) => e.stopPropagation()}
        onMouseMove={() => {
          if (!isCoarsePointer) bumpControls(true);
        }}
      >
        <div className="relative group/bar flex items-center h-5 sm:h-4 cursor-pointer mb-2">
          <div className="absolute inset-x-0 h-1.5 sm:h-1 group-hover/bar:h-2 bg-white/20 rounded-full transition-all overflow-hidden">
            {duration > 0 && (
              <div 
                className="h-full bg-white/30" 
                style={{ width: `${(bufferedEnd / duration) * 100}%` }} 
              />
            )}
          </div>
          <div 
            className="absolute left-0 h-1.5 sm:h-1 group-hover/bar:h-2 bg-[#ff5a67] rounded-full transition-all pointer-events-none"
            style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
          />
          <div 
            className="absolute w-3.5 h-3.5 bg-[#ff5a67] rounded-full shadow-md scale-100 sm:scale-0 sm:group-hover/bar:scale-100 transition-transform pointer-events-none"
            style={{ left: `calc(${duration > 0 ? (currentTime / duration) * 100 : 0}% - 7px)` }}
          />
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={(e) => {
              handleSeek(e);
              bumpControls(true);
            }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>

        <div className="flex items-center justify-between text-white text-xs gap-1.5 sm:gap-2">
          <div className="flex items-center gap-1 sm:gap-2 min-w-0">
            <button
              onClick={() => {
                togglePlay();
                bumpControls(true);
              }}
              className="hover:text-[#ff5a67] transition p-1 cursor-pointer"
              title={isPlaying ? t('player.pause') : t('player.play')}
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
            </button>

            <div className="flex items-center gap-1 group/vol">
              <button onClick={toggleMute} className="hover:text-white/80 transition p-1 cursor-pointer" title={t('player.mute')}>
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  handleVolumeChange(e);
                  bumpControls(true);
                }}
                className="w-14 sm:w-16 h-1 bg-white/30 accent-[#ff5a67] rounded-lg cursor-pointer"
              />
            </div>

            <span className="text-[10px] sm:text-[11px] font-mono text-[#ddd] ml-0.5 tabular-nums whitespace-nowrap">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-0.5 sm:gap-2 relative flex-shrink-0">
            {(playbackQuality || video.resolution) && (
              <span className="text-[10px] sm:text-[11px] font-medium text-[#ddd] tabular-nums px-1">
                {playbackQuality || video.resolution}
              </span>
            )}

            <div className="relative">
              <button
                ref={speedBtnRef}
                onClick={() => {
                  setShowSpeedMenu(!showSpeedMenu);
                  bumpControls(true);
                }}
                className="hover:text-white/80 font-bold px-1.5 sm:px-2 py-1 rounded hover:bg-white/10 transition cursor-pointer text-xs"
                title={t('player.speed')}
              >
                {playbackRate}x
              </button>

              <AnchoredPopover
                open={showSpeedMenu}
                onClose={() => {
                  setShowSpeedMenu(false);
                  speedOpenRef.current = false;
                }}
                anchorRef={speedBtnRef}
                align="end"
                preferredSide="top"
                className="w-28"
              >
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                    <button
                      key={rate}
                      onClick={() => handleSpeedChange(rate)}
                      className={`va-menu-item ${playbackRate === rate ? 'is-active' : ''}`}
                    >
                      <span className="flex-1">{rate === 1 ? t('player.normal') : `${rate}x`}</span>
                      {playbackRate === rate ? <Check className="w-3.5 h-3.5 text-white/50 flex-shrink-0" /> : null}
                    </button>
                  ))}
              </AnchoredPopover>
            </div>

            <button
              onClick={togglePiP}
              className="hidden sm:inline-flex hover:text-white/80 p-1 rounded hover:bg-white/10 transition cursor-pointer"
              title={t('player.pip')}
            >
              <PictureInPicture className="w-4 h-4" />
            </button>

            {onToggleTheatre && (
              <button
                onClick={onToggleTheatre}
                className={`hidden md:inline-flex p-1 rounded hover:bg-white/10 transition cursor-pointer ${
                  isTheatre ? 'text-white' : 'text-[#ddd] hover:text-white'
                }`}
                title={t('player.theatre')}
              >
                <Tv className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                bumpControls(true);
                toggleFullscreen();
              }}
              className="hover:text-white/80 p-1 rounded hover:bg-white/10 transition cursor-pointer"
              title={t('player.fullscreen')}
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
