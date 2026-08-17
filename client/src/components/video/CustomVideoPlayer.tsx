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
  HardDrive
} from 'lucide-react';
import type { Video } from '../../types';
import { useMyTube } from '../../context/MyTubeContext';

interface CustomVideoPlayerProps {
  video: Video;
  isTheatre?: boolean;
  onToggleTheatre?: () => void;
}

export const CustomVideoPlayer: React.FC<CustomVideoPlayerProps> = ({
  video,
  isTheatre = false,
  onToggleTheatre,
}) => {
  const { enqueueDownload } = useMyTube();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(video.duration || 0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [bufferedEnd, setBufferedEnd] = useState(0);

  const isDownloaded = video.is_downloaded === 1 && !!video.local_video_path;

  // Stream URL or YouTube embed fallback
  const videoSrc = isDownloaded ? `/api/videos/${video.id}/stream` : '';

  // Format time (mm:ss or hh:mm:ss)
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

  // Play / Pause toggle
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

  // Seek
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = target;
      setCurrentTime(target);
    }
  };

  // Skip ±10s
  const skip = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + seconds));
    }
  };

  // Volume
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  // Speed
  const handleSpeedChange = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
    setShowSpeedMenu(false);
  };

  // Fullscreen
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Picture in Picture
  const togglePiP = async () => {
    if (!videoRef.current) return;
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    } else {
      await videoRef.current.requestPictureInPicture();
    }
  };

  // Progress saver
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

  // Keyboard Shortcuts (YouTube-style)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

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
          break;
        case 'l':
        case 'arrowright':
          e.preventDefault();
          skip(10);
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
  }, [isPlaying, isMuted, isFullscreen, onToggleTheatre]);

  // Auto-hide controls timer
  useEffect(() => {
    let timeout: any;
    const handleMouseMove = () => {
      setShowControls(true);
      clearTimeout(timeout);
      if (isPlaying) {
        timeout = setTimeout(() => setShowControls(false), 2800);
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('mousemove', handleMouseMove);
    }
    return () => {
      clearTimeout(timeout);
      if (container) container.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isPlaying]);

  // Save progress periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (isPlaying && currentTime > 0) {
        saveProgress(currentTime);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [isPlaying, currentTime, saveProgress]);

  // Restore saved watch progress
  useEffect(() => {
    if (video.watch_progress && videoRef.current) {
      videoRef.current.currentTime = video.watch_progress;
    }
  }, [video.id]);

  if (!isDownloaded) {
    // Non-downloaded view: show sleek download invite or YouTube iframe
    return (
      <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl flex flex-col items-center justify-center p-6 border border-white/10 text-center">
        <div className="absolute inset-0 opacity-20 bg-cover bg-center" style={{ backgroundImage: `url(${video.thumbnail_url})` }} />
        <div className="relative z-10 max-w-md flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-[#ff0033]/20 border border-[#ff0033]/40 flex items-center justify-center text-[#ff0033] mb-4 shadow-xl shadow-red-500/10">
            <DownloadCloud className="w-8 h-8 animate-bounce" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Vidéo non stockée en local</h2>
          <p className="text-xs text-[#aaa] mb-5">
            Pour regarder cette vidéo avec le lecteur VidArch haute performance et sans publicité, téléchargez-la dans votre bibliothèque locale.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => enqueueDownload({
                videoId: video.id,
                title: video.title,
                channelTitle: video.channel_title,
                channelId: video.channel_id,
                thumbnailUrl: video.thumbnail_url,
              })}
              className="bg-[#ff0033] hover:bg-[#cc0029] text-white text-xs font-semibold px-5 py-2.5 rounded-full flex items-center gap-2 shadow-lg shadow-red-600/30 transition cursor-pointer"
            >
              <DownloadCloud className="w-4 h-4" />
              <span>Télécharger maintenant</span>
            </button>
            <a
              href={`https://www.youtube.com/watch?v=${video.id}`}
              target="_blank"
              rel="noreferrer"
              className="bg-white/10 hover:bg-white/20 text-white text-xs font-medium px-4 py-2.5 rounded-full transition cursor-pointer"
            >
              Regarder sur YouTube
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl group select-none ${
        isFullscreen ? 'rounded-none' : ''
      }`}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        src={videoSrc}
        onClick={togglePlay}
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
            // Periodic autosave every 3s
            if (Math.floor(time) % 3 === 0 && Math.floor(time) > 0) {
              saveProgress(time);
            }
          }
        }}
        onLoadedMetadata={() => {
          if (videoRef.current) {
            setDuration(videoRef.current.duration);
            if (video.watch_progress) {
              videoRef.current.currentTime = video.watch_progress;
            }
          }
        }}
        onEnded={() => {
          setIsPlaying(false);
          saveProgress(duration);
        }}
        className="w-full h-full object-contain cursor-pointer"
      />

      {/* Big Play Indicator on click */}
      {!isPlaying && (
        <div 
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/20 cursor-pointer"
        >
          <div className="w-18 h-18 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-2xl hover:scale-110 transition">
            <Play className="w-8 h-8 fill-current ml-1" />
          </div>
        </div>
      )}

      {/* Bottom Gradient & Controls */}
      <div 
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent pt-12 pb-3 px-4 transition-opacity duration-300 ${
          showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Progress Bar Container */}
        <div className="relative group/bar flex items-center h-4 cursor-pointer mb-2">
          {/* Background Track */}
          <div className="absolute inset-x-0 h-1 group-hover/bar:h-2 bg-white/20 rounded-full transition-all overflow-hidden">
            {/* Buffer bar */}
            {duration > 0 && (
              <div 
                className="h-full bg-white/30" 
                style={{ width: `${(bufferedEnd / duration) * 100}%` }} 
              />
            )}
          </div>

          {/* Current Progress bar */}
          <div 
            className="absolute left-0 h-1 group-hover/bar:h-2 bg-[#ff0033] rounded-full transition-all pointer-events-none"
            style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
          />

          {/* Scrubber Knob */}
          <div 
            className="absolute w-3.5 h-3.5 bg-[#ff0033] rounded-full shadow-md scale-0 group-hover/bar:scale-100 transition-transform pointer-events-none"
            style={{ left: `calc(${duration > 0 ? (currentTime / duration) * 100 : 0}% - 7px)` }}
          />

          {/* Hidden Input Range */}
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>

        {/* Buttons Row */}
        <div className="flex items-center justify-between text-white text-xs">
          {/* Left Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="hover:text-[#ff0033] transition p-1 cursor-pointer"
              title={isPlaying ? "Pause (k/espace)" : "Lecture (k/espace)"}
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
            </button>

            <button
              onClick={() => skip(-10)}
              className="hover:text-white/80 transition p-1 cursor-pointer"
              title="Reculer de 10s (j)"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={() => skip(10)}
              className="hover:text-white/80 transition p-1 cursor-pointer"
              title="Avancer de 10s (l)"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* Volume */}
            <div className="flex items-center gap-1.5 group/vol">
              <button onClick={toggleMute} className="hover:text-white/80 transition p-1 cursor-pointer" title="Muet (m)">
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-16 h-1 bg-white/30 accent-[#ff0033] rounded-lg cursor-pointer"
              />
            </div>

            {/* Timecode */}
            <span className="text-[11px] font-mono text-[#ddd] ml-1">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-3 relative">
            {/* Local file badge */}
            <span className="hidden sm:flex items-center gap-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-medium px-2 py-0.5 rounded-full">
              <HardDrive className="w-3 h-3" />
              <span>Direct Stream</span>
            </span>

            {/* Speed Selector */}
            <div className="relative">
              <button
                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                className="hover:text-white/80 font-bold px-2 py-1 rounded hover:bg-white/10 transition cursor-pointer text-xs"
                title="Vitesse de lecture"
              >
                {playbackRate}x
              </button>

              {showSpeedMenu && (
                <div className="absolute right-0 bottom-8 glass-dropdown rounded-xl py-1 shadow-2xl w-24 border border-white/10 z-50">
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                    <button
                      key={rate}
                      onClick={() => handleSpeedChange(rate)}
                      className={`w-full px-3 py-1.5 text-left text-xs cursor-pointer ${
                        playbackRate === rate ? 'text-[#ff0033] font-bold bg-white/10' : 'text-[#ddd] hover:bg-white/5'
                      }`}
                    >
                      {rate}x {rate === 1 ? '(Normal)' : ''}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* PiP */}
            <button
              onClick={togglePiP}
              className="hover:text-white/80 p-1 rounded hover:bg-white/10 transition cursor-pointer"
              title="Mini-lecteur (p)"
            >
              <PictureInPicture className="w-4 h-4" />
            </button>

            {/* Theatre Mode */}
            {onToggleTheatre && (
              <button
                onClick={onToggleTheatre}
                className="hover:text-white/80 p-1 rounded hover:bg-white/10 transition cursor-pointer"
                title="Mode cinéma (t)"
              >
                <Tv className="w-4 h-4" />
              </button>
            )}

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="hover:text-white/80 p-1 rounded hover:bg-white/10 transition cursor-pointer"
              title="Plein écran (f)"
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
