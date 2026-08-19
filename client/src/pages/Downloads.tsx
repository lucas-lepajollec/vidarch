import React, { useState, useEffect } from 'react';
import { 
  Trash2, 
  RotateCcw, 
  XCircle, 
  CheckCircle2, 
  AlertCircle, 
  HardDrive,
  Play,
  DownloadCloud,
  Loader2,
  ExternalLink,
  Clock,
  Sparkles
} from 'lucide-react';
import { useVidArch } from '../context/VidArchContext';

export const Downloads: React.FC = () => {
  const { queue, refreshQueue, goTo, systemStatus } = useVidArch();
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'error'>('all');

  // Immediately refresh queue when entering the downloads page
  useEffect(() => {
    refreshQueue();
    const interval = setInterval(refreshQueue, 2000);
    return () => clearInterval(interval);
  }, [refreshQueue]);

  const handleCancel = async (id: string) => {
    try {
      await fetch(`/api/downloads/${id}/cancel`, { method: 'POST' });
      await refreshQueue();
    } catch (_) {}
  };

  const handleRetry = async (id: string) => {
    try {
      await fetch(`/api/downloads/${id}/retry`, { method: 'POST' });
      await refreshQueue();
    } catch (_) {}
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/downloads/${id}`, { method: 'DELETE' });
      await refreshQueue();
    } catch (_) {}
  };

  const handleClearCompleted = async () => {
    try {
      await fetch('/api/downloads/clear', { method: 'POST' });
      await refreshQueue();
    } catch (_) {}
  };

  const activeTasks = queue.filter(t => t.status === 'downloading' || t.status === 'processing' || t.status === 'queued');
  const pastTasks = queue.filter(t => t.status === 'completed' || t.status === 'error' || t.status === 'canceled');

  const filteredPastTasks = pastTasks.filter(t => {
    if (filter === 'completed') return t.status === 'completed';
    if (filter === 'error') return t.status === 'error' || t.status === 'canceled';
    return true;
  });

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('fr-FR', { 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex-1 w-full px-3 sm:px-6 pt-3 pb-8 space-y-6 text-[#f1f1f1]">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white tracking-tight">
              Gestionnaire des téléchargements
            </h1>
            {systemStatus && (
              <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full flex items-center gap-1.5 font-medium">
                <HardDrive className="w-3.5 h-3.5" />
                <span>{systemStatus.storageFormatted} stockés</span>
              </span>
            )}
          </div>
          <p className="text-xs text-[#aaa] mt-1">
            Suivez les téléchargements actifs et gérez votre bibliothèque hors-ligne
          </p>
        </div>

        {/* Clear Completed History Button */}
        {pastTasks.length > 0 && (
          <button
            onClick={handleClearCompleted}
            className="self-start sm:self-auto flex items-center gap-1.5 text-xs text-[#aaa] hover:text-white bg-[#272727] hover:bg-[#383838] px-4 py-2 rounded-full transition cursor-pointer font-medium"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Effacer l'historique terminé</span>
          </button>
        )}
      </div>

      {/* Filter Category Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar select-none">
        {[
          { id: 'all', label: `Tout (${queue.length})` },
          { id: 'active', label: `En cours (${activeTasks.length})` },
          { id: 'completed', label: `Terminés (${pastTasks.filter(t => t.status === 'completed').length})` },
          { id: 'error', label: `Échecs (${pastTasks.filter(t => t.status === 'error').length})` },
        ].map((chip) => (
          <button
            key={chip.id}
            onClick={() => setFilter(chip.id as any)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              filter === chip.id
                ? 'bg-white text-black font-bold shadow-sm'
                : 'bg-[#272727] hover:bg-[#383838] text-[#f1f1f1]'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* ========================================================================= */}
      {/* 1. ACTIVE DOWNLOADS SECTION (Animated Progress Cards)                     */}
      {/* ========================================================================= */}
      {(filter === 'all' || filter === 'active') && activeTasks.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 px-1">
            <Loader2 className="w-3.5 h-3.5 text-[#ff0033] animate-spin" />
            <span>En cours de téléchargement ({activeTasks.length})</span>
          </h2>

          <div className="space-y-3">
            {activeTasks.map((task) => {
              const percent = Math.round(task.progress || 0);
              const isQueued = task.status === 'queued';
              const isProcessing = task.status === 'processing';

              return (
                <div
                  key={task.id}
                  className="bg-[#181818] border border-[#272727] hover:border-[#383838] rounded-2xl p-4 space-y-3 shadow-md transition"
                >
                  <div className="flex flex-col sm:flex-row gap-4 items-start justify-between">
                    {/* Left: Thumbnail & Details */}
                    <div className="flex gap-4 min-w-0 w-full sm:w-auto flex-1">
                      <div className="relative w-36 sm:w-44 aspect-video rounded-xl overflow-hidden bg-black flex-shrink-0 border border-white/5">
                        {task.thumbnail_url ? (
                          <img src={task.thumbnail_url} alt={task.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-[#272727] flex items-center justify-center text-white/40">
                            <DownloadCloud className="w-6 h-6" />
                          </div>
                        )}
                        <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.2 rounded">
                          {task.resolution || '1080p'}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0 space-y-1">
                        <h3 className="font-semibold text-sm sm:text-base text-white truncate">
                          {task.title}
                        </h3>
                        <p className="text-xs text-[#aaa] truncate">{task.channel_title}</p>
                        
                        <div className="flex flex-wrap items-center gap-2 text-xs pt-1">
                          {isQueued ? (
                            <span className="text-amber-400 font-semibold flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 animate-pulse" />
                              <span>En file d'attente (démarrage imminent...)</span>
                            </span>
                          ) : isProcessing ? (
                            <span className="text-purple-400 font-semibold flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 animate-spin" />
                              <span>Traitement audio/vidéo & métadonnées...</span>
                            </span>
                          ) : (
                            <>
                              <span className="text-[#3ea6ff] font-bold">{percent}%</span>
                              {task.speed && <span className="text-[#888]">• {task.speed}</span>}
                              {task.eta && <span className="text-[#888]">• Restant : {task.eta}</span>}
                              {task.total_bytes ? (
                                <span className="text-[#888]">• {((task.downloaded_bytes || 0) / (1024 * 1024)).toFixed(1)} / {((task.total_bytes || 0) / (1024 * 1024)).toFixed(1)} Mo</span>
                              ) : null}
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Cancel button */}
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        onClick={() => handleCancel(task.id)}
                        className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 transition cursor-pointer flex items-center gap-1.5"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Annuler</span>
                      </button>
                    </div>
                  </div>

                  {/* Animated Progress Bar */}
                  <div className="w-full h-2 bg-[#272727] rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-300 relative ${
                        isQueued 
                          ? 'bg-amber-400/50 w-full animate-pulse' 
                          : isProcessing 
                            ? 'bg-gradient-to-r from-purple-500 to-indigo-500 w-full animate-pulse' 
                            : 'bg-gradient-to-r from-[#ff0033] to-[#ff5e00]'
                      }`}
                      style={{ width: isQueued || isProcessing ? '100%' : `${Math.max(3, percent)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. COMPLETED & PAST DOWNLOADS LIST (Rich YouTube Cards)                   */}
      {/* ========================================================================= */}
      {(filter === 'all' || filter === 'completed' || filter === 'error') && (
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-white uppercase tracking-wider px-1">
            {filter === 'completed' ? 'Téléchargements terminés' : filter === 'error' ? 'Échecs & Annulations' : 'Historique des téléchargements'} ({filteredPastTasks.length})
          </h2>

          {filteredPastTasks.length > 0 ? (
            <div className="space-y-3">
              {filteredPastTasks.map((task) => {
                const isSuccess = task.status === 'completed';
                const isError = task.status === 'error';

                return (
                  <div
                    key={task.id}
                    className="bg-[#181818] border border-[#272727] hover:border-[#383838] rounded-2xl p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between shadow-sm transition"
                  >
                    <div className="flex gap-4 min-w-0 flex-1 items-center">
                      <div className="relative w-28 sm:w-36 aspect-video rounded-xl overflow-hidden bg-black flex-shrink-0 border border-white/5">
                        {task.thumbnail_url ? (
                          <img src={task.thumbnail_url} alt={task.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-[#272727] flex items-center justify-center text-white/40">
                            <DownloadCloud className="w-5 h-5" />
                          </div>
                        )}
                        <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[9px] font-bold px-1 rounded">
                          {task.resolution || '1080p'}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <h3 className="font-semibold text-xs sm:text-sm text-white truncate">
                          {task.title}
                        </h3>
                        <p className="text-[11px] text-[#aaa] truncate">{task.channel_title}</p>
                        
                        <div className="flex flex-wrap items-center gap-2 text-[11px]">
                          {isSuccess && (
                            <span className="text-emerald-400 flex items-center gap-1 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Téléchargé avec succès</span>
                            </span>
                          )}
                          {isError && (
                            <span className="text-rose-400 flex items-center gap-1 font-medium">
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>{task.error_message || 'Échec du téléchargement'}</span>
                            </span>
                          )}
                          {task.status === 'canceled' && (
                            <span className="text-[#888] flex items-center gap-1 font-medium">
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Annulé</span>
                            </span>
                          )}
                          <span className="text-[#666]">• {formatDate(task.completed_at || task.created_at)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                      {isSuccess && task.video_id && (
                        <button
                          onClick={() => goTo('watch', { videoId: task.video_id })}
                          className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-white bg-[#272727] hover:bg-[#ff0033] transition cursor-pointer flex items-center gap-1.5"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Regarder</span>
                        </button>
                      )}

                      {isError && (
                        <button
                          onClick={() => handleRetry(task.id)}
                          className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-white bg-[#272727] hover:bg-[#333] transition cursor-pointer flex items-center gap-1.5"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Réessayer</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleDelete(task.id)}
                        className="p-2 text-[#aaa] hover:text-white rounded-full hover:bg-white/10 transition cursor-pointer"
                        title="Supprimer de l'historique"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-[#888]">
              Aucun téléchargement dans cette catégorie.
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {queue.length === 0 && (
        <div className="py-20 flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4">
          <div className="w-20 h-20 rounded-full bg-[#272727] flex items-center justify-center text-[#aaa]">
            <DownloadCloud className="w-10 h-10" />
          </div>
          <div>
            <h2 className="font-bold text-lg text-white">Aucun téléchargement</h2>
            <p className="text-xs text-[#aaa] mt-1">
              Recherchez une vidéo ou collez un lien pour lancer votre premier téléchargement hors-ligne.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
