import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  DownloadCloud, 
  Check, 
  Loader2, 
  Film
} from 'lucide-react';
import { useMyTube } from '../../context/MyTubeContext';

export const DownloadModal: React.FC = () => {
  const { downloadModal, closeDownloadModal, enqueueDownload } = useMyTube();
  
  const [resolution, setResolution] = useState('1080p');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (downloadModal.isOpen) {
      setResolution('1080p');
      setStatusMessage(null);
    }
  }, [downloadModal.isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && downloadModal.isOpen) {
        closeDownloadModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [downloadModal.isOpen, closeDownloadModal]);

  if (!downloadModal.isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!downloadModal.videoId && !downloadModal.url) return;

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      await enqueueDownload({
        videoId: downloadModal.videoId || downloadModal.url || '',
        url: downloadModal.url,
        title: downloadModal.title,
        channelTitle: downloadModal.channelTitle,
        channelId: downloadModal.channelId,
        thumbnailUrl: downloadModal.thumbnailUrl,
        resolution,
      });

      setStatusMessage({ text: 'Ajouté à la file de téléchargement !', type: 'success' });
      setTimeout(() => {
        closeDownloadModal();
      }, 700);
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Une erreur est survenue', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const qualityOptions = [
    { id: '1080p', label: '1080p (Full HD)', desc: 'Recommandé • Qualité optimale', badge: 'Populaire' },
    { id: '2160p', label: '2160p (4K Ultra HD)', desc: 'Qualité maximale • Gros fichier', badge: '4K UHD' },
    { id: '1440p', label: '1440p (2K QHD)', desc: 'Très haute résolution', badge: '2K' },
    { id: '720p', label: '720p (HD)', desc: 'Fichier léger et rapide', badge: 'Éco' },
  ];

  const modalContent = (
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeDownloadModal();
      }}
    >
      <div 
        className="relative w-full max-w-lg bg-[#181818] border border-white/15 rounded-3xl p-6 shadow-2xl text-[#f1f1f1] overflow-hidden transform transition-all"
        style={{
          backgroundColor: '#181818',
          maxWidth: '32rem',
          width: '100%',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glowing subtle accent */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-[#ff0033]/15 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#ff0033]/20 border border-[#ff0033]/30 flex items-center justify-center text-[#ff0033] shadow-lg shadow-red-600/20">
              <DownloadCloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Télécharger la vidéo</h3>
              <p className="text-xs text-[#aaa]">Enregistrement direct dans votre bibliothèque locale</p>
            </div>
          </div>
          <button
            onClick={closeDownloadModal}
            className="p-2 text-[#aaa] hover:text-white rounded-full hover:bg-white/10 transition cursor-pointer"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Preview Card */}
        <div className="mt-4 p-3 bg-black/40 border border-white/10 rounded-2xl flex gap-3.5 items-center relative z-10">
          <div className="relative w-28 aspect-video rounded-xl overflow-hidden bg-[#222] flex-shrink-0 shadow-md">
            {downloadModal.thumbnailUrl ? (
              <img 
                src={downloadModal.thumbnailUrl} 
                alt={downloadModal.title || 'Vignette'} 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/40">
                <Film className="w-6 h-6" />
              </div>
            )}
            {downloadModal.durationString && (
              <span className="absolute bottom-1 right-1 bg-black/85 text-white text-[9px] font-bold px-1 rounded">
                {downloadModal.durationString}
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h4 className="font-semibold text-xs text-white line-clamp-2 leading-snug">
              {downloadModal.title || 'Vidéo YouTube'}
            </h4>
            <p className="text-[11px] text-[#aaa] mt-1 truncate">
              {downloadModal.channelTitle || 'Chaîne YouTube'}
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4 relative z-10">
          <div>
            <label className="block text-xs font-semibold text-[#ddd] mb-2">
              Choisir la qualité vidéo :
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {qualityOptions.map((opt) => {
                const isSelected = resolution === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setResolution(opt.id)}
                    className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-[#ff0033]/15 border-[#ff0033] shadow-lg shadow-red-600/15'
                        : 'bg-[#121212] border-white/5 hover:border-white/20 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-[#ddd]'}`}>
                        {opt.label}
                      </span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                        isSelected ? 'bg-[#ff0033] text-white' : 'bg-white/10 text-[#aaa]'
                      }`}>
                        {opt.badge}
                      </span>
                    </div>
                    <span className="text-[10px] text-[#888]">{opt.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Status Message */}
          {statusMessage && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              }`}
            >
              {statusMessage.type === 'success' ? <Check className="w-4 h-4 text-emerald-400" /> : <X className="w-4 h-4" />}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={closeDownloadModal}
              className="px-4 py-2.5 text-xs font-medium text-[#aaa] hover:text-white rounded-xl hover:bg-white/5 transition cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-[#ff0033] hover:bg-[#cc0029] text-white text-xs font-bold px-6 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-red-600/30 transition disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Ajout en cours...</span>
                </>
              ) : (
                <>
                  <DownloadCloud className="w-4 h-4" />
                  <span>Démarrer le téléchargement</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
