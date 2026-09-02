import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Maximize, Minimize, Pause, Play, RotateCcw, RotateCw, Tv, Volume2, VolumeX } from 'lucide-react';
import type { Video } from '../types';
import { resolveThumbnail } from '../utils/media';
import { useI18n } from '../i18n/I18nProvider';

type DemoVideoSurfaceProps = {
  video: Video;
  isTheatre: boolean;
  onToggleTheatre?: () => void;
  autoPlay?: boolean;
  onEnded?: () => void;
};
function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

export const DemoVideoSurface: React.FC<DemoVideoSurfaceProps> = ({
  video,
  isTheatre,
  onToggleTheatre,
  autoPlay = false,
  onEnded,
}) => {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const duration = Math.max(30, video.duration || 300);
  const [playing, setPlaying] = useState(autoPlay);
  const [currentTime, setCurrentTime] = useState(Math.min(video.watch_progress || 0, duration));
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.72);
  const [speed, setSpeed] = useState(1);
  const [showSpeeds, setShowSpeeds] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setCurrentTime((time) => {
        const next = Math.min(duration, time + 0.25 * speed);
        if (next >= duration) {
          setPlaying(false);
          onEnded?.();
        }
        return next;
      });
    }, 250);
    return () => window.clearInterval(timer);
  }, [duration, onEnded, playing, speed]);

  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const progress = (currentTime / duration) * 100;
  const thumbnail = useMemo(() => resolveThumbnail(video), [video]);

  const skip = (delta: number) => setCurrentTime((time) => Math.max(0, Math.min(duration, time + delta)));
  const toggleFullscreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await containerRef.current?.requestFullscreen();
    }
  };

  return (
    <div
      ref={containerRef}
      className={`vidarch-player relative isolate overflow-hidden bg-black text-white ${isTheatre ? 'is-theatre' : ''}`}
      style={{ ['--player-ratio' as string]: 16 / 9 }}
      tabIndex={0}
      aria-label={t('demo.syntheticPlayer')}
    >
      <img src={thumbnail} alt="" className={`absolute inset-0 h-full w-full object-cover transition duration-700 ${playing ? 'scale-[1.025]' : 'scale-100'}`} />
      <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(0,0,0,.16),transparent_42%,rgba(255,90,103,.12))]" />
      <div className={`absolute inset-0 opacity-40 mix-blend-screen ${playing ? 'demo-video-motion' : ''}`} aria-hidden>
        <div className="absolute -left-[20%] top-[12%] h-[36%] w-[75%] rounded-full bg-[#73c7e8]/15 blur-3xl" />
        <div className="absolute -right-[15%] bottom-[5%] h-[45%] w-[70%] rounded-full bg-[#ff5a67]/18 blur-3xl" />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/5 to-black/18" />
      <div className="absolute left-4 top-4 rounded-full border border-white/15 bg-black/45 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/80 backdrop-blur-md">
        {t('demo.syntheticSequence')}
      </div>

      <div className="absolute inset-0 z-10 flex items-center justify-center gap-10 sm:gap-16">
        <button type="button" onClick={() => skip(-10)} className="va-player-jump flex h-12 w-12 items-center justify-center text-white sm:h-14 sm:w-14" title={t('demo.rewind')}>
          <RotateCcw className="h-5 w-5 sm:h-6 sm:w-6" />
        </button>
        <button type="button" onClick={() => setPlaying((value) => !value)} className="va-player-main flex h-16 w-16 items-center justify-center text-white sm:h-[72px] sm:w-[72px]" aria-label={playing ? t('demo.pause') : t('demo.play')}>
          {playing ? <Pause className="h-7 w-7 fill-current" /> : <Play className="ml-1 h-7 w-7 fill-current" />}
        </button>
        <button type="button" onClick={() => skip(10)} className="va-player-jump flex h-12 w-12 items-center justify-center text-white sm:h-14 sm:w-14" title={t('demo.forward')}>
          <RotateCw className="h-5 w-5 sm:h-6 sm:w-6" />
        </button>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-20 px-3 pb-2 pt-10 sm:px-4 sm:pb-3">
        <div className="relative mb-2 h-1.5 overflow-visible rounded-full bg-white/25">
          <div className="absolute inset-y-0 left-0 rounded-full bg-[#ff5a67]" style={{ width: `${progress}%` }} />
          <input
            type="range"
            min={0}
            max={duration}
            step={0.1}
            value={currentTime}
            onChange={(event) => setCurrentTime(Number(event.target.value))}
            className="absolute -inset-x-1 -inset-y-2 h-5 w-[calc(100%+8px)] cursor-pointer opacity-0"
            aria-label={t('demo.playhead')}
          />
        </div>

        <div className="flex items-center gap-2 text-[11px] sm:gap-3">
          <button type="button" onClick={() => setPlaying((value) => !value)} className="rounded-lg p-1.5 hover:bg-white/10" aria-label={playing ? t('demo.pause') : t('demo.play')}>
            {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
          </button>
          <button type="button" onClick={() => setMuted((value) => !value)} className="rounded-lg p-1.5 hover:bg-white/10" aria-label={muted ? t('demo.unmute') : t('demo.mute')}>
            {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            onChange={(event) => { setVolume(Number(event.target.value)); setMuted(false); }}
            className="hidden w-16 accent-[#ff5a67] sm:block"
            aria-label={t('demo.volume')}
          />
          <span className="font-medium tabular-nums text-white/80">{formatTime(currentTime)} / {formatTime(duration)}</span>

          <span className="ml-auto hidden text-[10px] font-semibold text-white/75 sm:inline">1080p</span>
          <div className="relative">
            <button type="button" onClick={() => setShowSpeeds((value) => !value)} className="rounded-lg px-2 py-1.5 font-bold hover:bg-white/10">{speed}x</button>
            {showSpeeds && (
              <div className="absolute bottom-9 right-0 w-24 rounded-xl border border-white/10 bg-[#0d131a]/96 p-1.5 shadow-2xl backdrop-blur-xl">
                {[0.75, 1, 1.25, 1.5, 2].map((value) => (
                  <button key={value} type="button" onClick={() => { setSpeed(value); setShowSpeeds(false); }} className={`block w-full rounded-lg px-2 py-1.5 text-left text-[11px] hover:bg-white/10 ${speed === value ? 'text-[#ff7180]' : 'text-white'}`}>
                    {value}x
                  </button>
                ))}
              </div>
            )}
          </div>
          {onToggleTheatre && (
            <button type="button" onClick={onToggleTheatre} className="hidden rounded-lg p-1.5 hover:bg-white/10 sm:block" title={t('demo.theatre')}>
              <Tv className="h-4 w-4" />
            </button>
          )}
          <button type="button" onClick={() => void toggleFullscreen()} className="rounded-lg p-1.5 hover:bg-white/10" title={t('demo.fullscreen')}>
            {fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};
