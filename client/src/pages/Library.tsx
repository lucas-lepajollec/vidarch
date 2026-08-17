import React, { useState, useEffect } from 'react';
import { 
  FolderHeart, 
  HardDrive, 
  LayoutGrid, 
  Folder, 
  FolderOpen,
  ChevronDown, 
  ArrowLeft,
  Film, 
  Search,
  Play
} from 'lucide-react';
import type { Video } from '../types';
import { VideoCard } from '../components/video/VideoCard';
import { useMyTube } from '../context/MyTubeContext';

interface DiskFile {
  name: string;
  size: number;
  mtime: string;
  type: 'video' | 'thumbnail' | 'metadata' | 'other';
}

interface DiskFolder {
  folderName: string;
  folderPath: string;
  folderSize: number;
  fileCount: number;
  videoCount: number;
  channelAvatar: string;
  videos: Video[];
  files: DiskFile[];
}

interface DiskFoldersResponse {
  rootPath: string;
  totalDiskSize: number;
  folderCount: number;
  videoCount: number;
  folders: DiskFolder[];
}

export const Library: React.FC = () => {
  const { subscriptions, dataVersion } = useMyTube();
  const [viewMode, setViewMode] = useState<'grid' | 'folders'>('grid');
  const [videos, setVideos] = useState<Video[]>([]);
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'size' | 'duration' | 'title'>('date');
  const [isLoading, setIsLoading] = useState(true);

  // Folder Explorer State
  const [diskData, setDiskData] = useState<DiskFoldersResponse | null>(null);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [folderSearchQuery, setFolderSearchQuery] = useState('');

  const loadLibraryVideos = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/videos?tab=downloaded');
      if (res.ok) {
        const data = await res.json();
        setVideos(data);
      }
    } catch (err) {
      console.error('Error loading library:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadDiskFolders = async () => {
    setIsLoadingFolders(true);
    try {
      const res = await fetch('/api/videos/disk-folders');
      if (res.ok) {
        const data: DiskFoldersResponse = await res.json();
        setDiskData(data);
      }
    } catch (err) {
      console.error('Error loading disk folders:', err);
    } finally {
      setIsLoadingFolders(false);
    }
  };

  useEffect(() => {
    loadLibraryVideos();
    if (viewMode === 'folders') {
      loadDiskFolders();
    }
  }, [dataVersion, viewMode]);

  const formatBytes = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 Mo';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(2)} Go`;
    }
    return `${mb.toFixed(1)} Mo`;
  };

  // Filter & Sort for Standard Grid View
  const filteredVideos = videos
    .filter(v => channelFilter === 'all' || v.channel_id === channelFilter)
    .sort((a, b) => {
      if (sortBy === 'date') {
        return (b.upload_date || '').localeCompare(a.upload_date || '');
      } else if (sortBy === 'size') {
        return (b.file_size || 0) - (a.file_size || 0);
      } else if (sortBy === 'duration') {
        return (b.duration || 0) - (a.duration || 0);
      } else {
        return a.title.localeCompare(b.title);
      }
    });

  const totalSize = videos.reduce((acc, v) => acc + (v.file_size || 0), 0);

  // Active folder data
  const currentFolderData = diskData?.folders.find(f => f.folderName === selectedFolder);

  // Filtered folders list
  const filteredFolders = (diskData?.folders || []).filter(f => {
    if (!folderSearchQuery.trim()) return true;
    const q = folderSearchQuery.toLowerCase();
    return f.folderName.toLowerCase().includes(q) || f.videos.some(v => v.title.toLowerCase().includes(q));
  });

  return (
    <div className="flex-1 w-full px-4 sm:px-6 pt-3 pb-8 space-y-5 select-none">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-white/5">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <span>Bibliothèque locale</span>
          </h1>
          <p className="text-xs text-[#aaa] mt-0.5">
            {videos.length} vidéo{videos.length > 1 ? 's' : ''} archivée{videos.length > 1 ? 's' : ''} • {formatBytes(totalSize)} occupés sur le disque
          </p>
        </div>

        {/* View Switcher & Controls */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          
          {/* Mode Pill Bar */}
          <div className="flex items-center p-1 bg-[#181818] border border-[#303030] rounded-2xl gap-1">
            <button
              onClick={() => {
                setViewMode('grid');
                setSelectedFolder(null);
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-[#2a2a2a] text-white shadow font-bold'
                  : 'text-[#aaa] hover:text-white'
              }`}
              title="Affichage en grille de vidéos"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Grille</span>
            </button>

            <button
              onClick={() => setViewMode('folders')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                viewMode === 'folders'
                  ? 'bg-[#2a2a2a] text-white shadow font-bold'
                  : 'text-[#aaa] hover:text-white'
              }`}
              title="Affichage par dossiers disque"
            >
              <Folder className="w-3.5 h-3.5" />
              <span>Dossiers</span>
            </button>
          </div>

          {/* Controls for Grid View */}
          {viewMode === 'grid' && (
            <div className="flex flex-wrap items-center gap-2">
              {/* Channel filter with fixed spacious dropdown styling */}
              <div className="relative">
                <select
                  value={channelFilter}
                  onChange={(e) => setChannelFilter(e.target.value)}
                  className="appearance-none bg-[#181818] hover:bg-[#202020] text-xs font-medium text-[#f1f1f1] border border-[#303030] hover:border-[#444] rounded-xl pl-3.5 pr-9 py-2 focus:outline-none focus:border-white transition cursor-pointer shadow-sm"
                >
                  <option value="all">Toutes les chaînes</option>
                  {subscriptions.map(s => (
                    <option key={s.id} value={s.id}>{s.title}</option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-[#aaa] pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
              </div>

              {/* Sort selector with fixed spacious dropdown styling */}
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="appearance-none bg-[#181818] hover:bg-[#202020] text-xs font-medium text-[#f1f1f1] border border-[#303030] hover:border-[#444] rounded-xl pl-3.5 pr-9 py-2 focus:outline-none focus:border-white transition cursor-pointer shadow-sm"
                >
                  <option value="date">Date d'ajout</option>
                  <option value="size">Taille de fichier</option>
                  <option value="duration">Durée</option>
                  <option value="title">Titre (A-Z)</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-[#aaa] pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>
          )}

          {/* Search within Folders View (when viewing all folders) */}
          {viewMode === 'folders' && !selectedFolder && (
            <div className="relative">
              <input
                type="text"
                value={folderSearchQuery}
                onChange={(e) => setFolderSearchQuery(e.target.value)}
                placeholder="Rechercher un dossier..."
                className="bg-[#181818] border border-[#303030] hover:border-[#444] focus:border-white text-xs text-white rounded-xl pl-8 pr-3.5 py-2 outline-none transition w-44 sm:w-56"
              />
              <Search className="w-3.5 h-3.5 text-[#aaa] absolute left-2.5 top-1/2 -translate-y-1/2" />
            </div>
          )}

        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. STANDARD GRID VIEW                                                    */}
      {/* ========================================================================= */}
      {viewMode === 'grid' && (
        <>
          {filteredVideos.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-6 sm:gap-y-8">
              {filteredVideos.map((video) => (
                <VideoCard key={video.id} video={video} onDelete={loadLibraryVideos} />
              ))}
            </div>
          )}

          {filteredVideos.length === 0 && !isLoading && (
            <div className="py-20 text-center max-w-md mx-auto space-y-3">
              <div className="w-16 h-16 rounded-full bg-[#272727] flex items-center justify-center text-[#aaa] mx-auto">
                <HardDrive className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-base text-white">Aucun fichier dans votre bibliothèque</h3>
              <p className="text-xs text-[#aaa]">
                Recherchez une vidéo pour la télécharger et l'archiver hors-ligne.
              </p>
            </div>
          )}
        </>
      )}

      {/* ========================================================================= */}
      {/* 2. REAL DISK FOLDER EXPLORER VIEW (YouTube Collection / Playlist Style)   */}
      {/* ========================================================================= */}
      {viewMode === 'folders' && (
        <div className="space-y-6">

          {/* LEVEL 1: ALL FOLDERS GRID */}
          {!selectedFolder ? (
            <div className="space-y-4">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-6">
                {filteredFolders.map((folder) => {
                  const latestVideo = folder.videos[0];
                  const coverThumbnail = latestVideo?.thumbnail_url || (latestVideo?.id ? `/api/videos/${latestVideo.id}/thumbnail` : '');

                  return (
                    <div
                      key={folder.folderName}
                      onClick={() => setSelectedFolder(folder.folderName)}
                      className="group cursor-pointer flex flex-col select-none"
                    >
                      {/* Top: 16:9 Cover Thumbnail with YouTube Playlist Style Overlay */}
                      <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-[#181818] border border-[#272727] group-hover:border-[#444] transition-all duration-200 group-hover:scale-[1.02] shadow-md">
                        {coverThumbnail ? (
                          <img
                            src={coverThumbnail}
                            alt={folder.folderName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-tr from-[#1f1f1f] to-[#141414] flex flex-col items-center justify-center text-[#717171] gap-2">
                            <Folder className="w-10 h-10 text-[#444] group-hover:text-[#ff0033] transition-colors" />
                            <span className="text-[11px] font-medium">Dossier vide</span>
                          </div>
                        )}

                        {/* Right-Side / Bottom Badge Overlay (YouTube Playlist Style) */}
                        <div className="absolute inset-y-0 right-0 w-2/5 bg-gradient-to-l from-black/85 via-black/60 to-transparent flex flex-col items-center justify-center text-white px-2 gap-1 pointer-events-none">
                          <Folder className="w-5 h-5 text-white drop-shadow" />
                          <span className="text-xs font-black tracking-tight">
                            {folder.videoCount}
                          </span>
                          <span className="text-[9px] uppercase tracking-wider text-white/80 font-bold">
                            vidéo{folder.videoCount > 1 ? 's' : ''}
                          </span>
                        </div>

                        {/* Top Left Weight Pill */}
                        <div className="absolute top-2 left-2 bg-black/75 backdrop-blur-xs text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border border-white/10 pointer-events-none">
                          {formatBytes(folder.folderSize)}
                        </div>
                      </div>

                      {/* Bottom Info Row (Channel Avatar + Title + Path) */}
                      <div className="flex items-start gap-3 mt-3 px-0.5">
                        <div className="w-9 h-9 rounded-full bg-[#272727] flex items-center justify-center flex-shrink-0 overflow-hidden border border-white/10 mt-0.5">
                          {folder.channelAvatar ? (
                            <img src={folder.channelAvatar} alt={folder.folderName} className="w-full h-full object-cover" />
                          ) : (
                            <Folder className="w-4 h-4 text-[#ff0033]" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-sm text-white group-hover:text-[#3ea6ff] transition truncate">
                            {folder.folderName}
                          </h3>
                          <div className="text-[11px] text-[#aaa] flex items-center gap-1.5 mt-0.5">
                            <span>{folder.videoCount} vidéo{folder.videoCount > 1 ? 's' : ''}</span>
                            <span>•</span>
                            <span className="font-mono text-emerald-400 font-medium">{formatBytes(folder.folderSize)}</span>
                          </div>
                          <span className="text-[10px] text-[#717171] font-mono block truncate mt-0.5">
                            downloads/{folder.folderName}/
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {filteredFolders.length === 0 && !isLoadingFolders && (
                <div className="py-20 text-center max-w-md mx-auto space-y-3">
                  <div className="w-16 h-16 rounded-full bg-[#272727] flex items-center justify-center text-[#aaa] mx-auto">
                    <Folder className="w-8 h-8" />
                  </div>
                  <h3 className="font-bold text-base text-white">Aucun dossier trouvé</h3>
                  <p className="text-xs text-[#aaa]">
                    Aucun dossier ne correspond à votre recherche.
                  </p>
                </div>
              )}

            </div>
          ) : (

            /* LEVEL 2: INSIDE A SPECIFIC FOLDER */
            <div className="space-y-6 animate-in fade-in duration-150">
              
              {/* Folder Navigation Breadcrumb Header */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-[#181818] border border-[#272727] rounded-3xl">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => setSelectedFolder(null)}
                    className="p-2.5 rounded-full bg-[#272727] hover:bg-[#383838] text-white transition cursor-pointer flex-shrink-0 flex items-center justify-center"
                    title="Retourner à la liste des dossiers"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>

                  {/* Channel avatar or folder badge */}
                  <div className="w-10 h-10 rounded-2xl bg-[#222] border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {currentFolderData?.channelAvatar ? (
                      <img src={currentFolderData.channelAvatar} alt={currentFolderData.folderName} className="w-full h-full object-cover" />
                    ) : (
                      <FolderOpen className="w-5 h-5 text-[#ff0033]" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-white truncate">
                        {currentFolderData?.folderName}
                      </h2>
                      <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-white/10 text-white font-semibold">
                        {currentFolderData?.videoCount || 0} vidéo{(currentFolderData?.videoCount || 0) > 1 ? 's' : ''}
                      </span>
                    </div>
                    <span className="text-xs text-[#aaa] font-mono block truncate mt-0.5">
                      downloads/{currentFolderData?.folderName}/ • {formatBytes(currentFolderData?.folderSize || 0)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedFolder(null)}
                    className="text-xs font-semibold text-[#aaa] hover:text-white px-4 py-2 rounded-xl hover:bg-white/5 transition cursor-pointer"
                  >
                    Tous les dossiers
                  </button>
                </div>
              </div>

              {/* Videos Grid inside this Folder (Standard Responsive 4-Column Layout) */}
              {currentFolderData && currentFolderData.videos.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-6 sm:gap-y-8">
                  {currentFolderData.videos.map((video) => (
                    <VideoCard 
                      key={video.id} 
                      video={video} 
                      onDelete={() => {
                        loadDiskFolders();
                        loadLibraryVideos();
                      }} 
                    />
                  ))}
                </div>
              ) : (
                <div className="py-20 text-center max-w-md mx-auto space-y-3">
                  <div className="w-16 h-16 rounded-full bg-[#272727] flex items-center justify-center text-[#aaa] mx-auto">
                    <Film className="w-8 h-8" />
                  </div>
                  <h3 className="font-bold text-base text-white">Ce dossier ne contient aucune vidéo</h3>
                  <p className="text-xs text-[#aaa]">
                    Téléchargez des vidéos ou déplacez des fichiers dans ce dossier.
                  </p>
                </div>
              )}

            </div>
          )}

        </div>
      )}

    </div>
  );
};
