import React, { useEffect, useState } from 'react';
import { User } from 'lucide-react';
import { avatarSrc } from '../../utils/media';

interface ChannelAvatarProps {
  channelId?: string | null;
  url?: string | null;
  title?: string;
  className?: string;
  textClassName?: string;
}

export const ChannelAvatar: React.FC<ChannelAvatarProps> = ({
  channelId,
  url,
  title = '',
  className = 'w-9 h-9 rounded-full',
  textClassName: _textClassName = 'text-xs',
}) => {
  const src = avatarSrc(channelId, url);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  return (
    <div className={`${className} overflow-hidden bg-[#18212c] flex-shrink-0 flex items-center justify-center`}>
      {src && !failed ? (
        <img
          src={src}
          alt={title}
          loading="lazy"
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="w-full h-full bg-[#18212c] flex items-center justify-center text-[#aaa]">
          <User className="w-[52%] h-[52%]" />
        </div>
      )}
    </div>
  );
};
