import React, { useState } from 'react';
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
import { useMyTube } from '../context/MyTubeContext';

export const Downloads: React.FC = () => {
  const { queue, goTo, systemStatus } = useMyTube();
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'error'>('all');

  const handleCancel = async (id: string) => {
    try {
      await fetch(`/api/downloads/${id}/cancel`, { method: 'POST' });
    } catch (_) {}
  };

  const handleRetry = async (id: string) => {
    try {
      await fetch(`/api/downloads/${id}/retry`, { method: 'POST' });
    } catch (_) {}
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/downloads/${id}`, { method: 'DELETE' });
    } catch (_) {}
  };

  const handleClearCompleted = async () => {
    try {
      await fetch('/api/downloads/clear', { method: 'POST' });
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

              return (
                <div
                  key={task.id}
                  className="bg-[#181818] rounded-2xl p-4 space-y-3 shadow-md"
                >
                  <div className="flex flex-col sm:flex-row gap-4 items-start justify-between">
                    {/* Left: Thumbnail & Details */}
                    <div className="flex gap-4 min-w-0 w-full sm:w-auto flex-1">
                      <div className="relative w-36 sm:w-44 aspect-video rounded-xl overflow-hidden bg-black flex-shrink-0">
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
                        <p className="text-xs text-[#aaa]">{task.channel_title}</p>
                        
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[#888] pt-1">
                          <span className="text-[#3ea6ff] font-bold">{percent}%</span>
                          {task.speed && <span>• {task.speed}</span>}
                          {task.eta && <span>• Restant : {task.eta}</span>}
                          {task.total_bytes ? (
                            <span>• {((task.downloaded_bytes || 0) / (1024 * 1024)).toFixed(1)} / {((task.total_bytes || 0) / (1024 * 1024)).toFixed(1)} Mo</span>
                          ) : null}
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
                      className="h-full bg-gradient-to-r from-[#ff0033] to-[#ff5e00] rounded-full transition-all duration-300 relative"
                      style={{ width: `${Math.max(3, percent)}%` }}
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
                    onClick={() => isSuccess && goTo('watch', { videoId: task.video_id })}
                    className="flex flex-col sm:flex-row gap-4 p-3 rounded-2xl hover:bg-[#181818] transition group cursor-pointer"
                  >
                    {/* Thumbnail */}
                    <div className="relative w-full sm:w-56 aspect-video rounded-xl overflow-hidden bg-[#222] flex-shrink-0 shadow-sm">
                      {task.thumbnail_url ? (
                        <img src={task.thumbnail_url} alt={task.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                      ) : (
                        <div className="w-full h-full bg-[#272727] flex items-center justify-center text-white/40">
                          <DownloadCloud className="w-6 h-6" />
                        </div>
                      )}
                      
                      {isSuccess && (
                        <span className="absolute top-1.5 left-1.5 bg-emerald-600/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 shadow">
                          <HardDrive className="w-2.5 h-2.5" />
                          <span>Stocké</span>
                        </span>
                      )}
                      {isError && (
                        <span className="absolute top-1.5 left-1.5 bg-rose-600/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 shadow">
                          <AlertCircle className="w-2.5 h-2.5" />
                          <span>Échec</span>
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                      <div>
                        <h3 className="font-semibold text-sm sm:text-base text-white group-hover:text-[#3ea6ff] line-clamp-2 leading-snug">
                          {task.title}
                        </h3>

                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-xs text-[#aaa] font-medium">{task.channel_title}</span>
                          {task.resolution && (
                            <>
                              <span className="text-xs text-[#666]">•</span>
                              <span className="text-[10px] bg-[#272727] text-white px-1.5 py-0.2 rounded font-mono font-bold">
                                {task.resolution}
                              </span>
                            </>
                          )}
                        </div>

                        {isError && task.error_message && (
                          <p className="text-xs text-rose-400 mt-2 bg-rose-950/30 p-2 rounded-xl border border-rose-900/30 line-clamp-2">
                            {task.error_message}
                          </p>
                        )}
                      </div>

                      {/* Status & Actions Row */}
                      <div className="flex flex-wrap items-center justify-between gap-3 mt-3 pt-1">
                        <div className="flex items-center gap-2 text-xs text-[#888]">
                          {isSuccess ? (
                            <span className="flex items-center gap-1 text-emerald-400 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Terminé {task.completed_at ? `le ${formatDate(task.completed_at)}` : ''}</span>
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-rose-400 font-medium">
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>Échoué</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          {isSuccess && (
                            <button
                              onClick={() => goTo('watch', { videoId: task.video_id })}
                              className="bg-white hover:bg-white/90 text-black text-xs font-bold px-3.5 py-1.5 rounded-full flex items-center gap-1.5 shadow transition cursor-pointer"
                            >
                              <Play className="w-3 h-3 fill-current" />
                              <span>Regarder</span>
                            </button>
                          )}

                          {isError && (
                            <button
                              onClick={() => handleRetry(task.id)}
                              className="bg-[#ff0033] hover:bg-[#cc0029] text-white text-xs font-semibold px-3.5 py-1.5 rounded-full flex items-center gap-1.5 shadow transition cursor-pointer"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Réessayer</span>
                            </button>
                          )}

                          <button
                            onClick={() => handleDelete(task.id)}
                            className="p-1.5 text-[#aaa] hover:text-rose-400 rounded-full hover:bg-[#272727] transition cursor-pointer"
                            title="Supprimer de la liste"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-16 text-center max-w-md mx-auto space-y-3">
              <div className="w-16 h-16 rounded-full bg-[#272727] flex items-center justify-center text-[#aaa] mx-auto">
                <DownloadCloud className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-base text-white">Aucun téléchargement dans cette catégorie</h3>
              <p className="text-xs text-[#aaa]">
                Les vidéos que vous téléchargez apparaîtront ici avec leur progression et leur statut.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
