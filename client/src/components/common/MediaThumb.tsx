import React, { useEffect, useState } from 'react';
import { buildThumbFallbacks, type ThumbLike } from '../../utils/media';

interface MediaThumbProps {
  video: ThumbLike;
  alt?: string;
  className?: string;
}

export const MediaThumb: React.FC<MediaThumbProps> = ({ video, alt, className }) => {
  const fallbacks = buildThumbFallbacks(video);
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setIndex(0);
    setFailed(false);
  }, [video.id, video.local_thumbnail_path, video.thumbnail_url, video.is_downloaded]);

  const src = fallbacks[index];
  if (!src || failed) {
    return <div className={className} aria-hidden />;
  }

  const goNext = () => {
    setIndex((prev) => {
      if (prev + 1 < fallbacks.length) return prev + 1;
      setFailed(true);
      return prev;
    });
  };

  return (
    <img
      src={src}
      alt={alt || ''}
      loading="lazy"
      className={className}
      onError={goNext}
      onLoad={(e) => {
        const img = e.currentTarget;
        if (img.naturalWidth <= 120 && img.naturalHeight <= 90) goNext();
      }}
    />
  );
};
