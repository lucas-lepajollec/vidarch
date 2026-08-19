import React, { useRef, useState } from 'react';
import { Upload, Link, X, Image as ImageIcon, Trash2 } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';

interface ImageUploadFieldProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  type: 'avatar' | 'banner';
  placeholderUrl?: string;
}

export const ImageUploadField: React.FC<ImageUploadFieldProps> = ({
  label,
  value,
  onChange,
  type,
  placeholderUrl = 'https://.../image.png'
}) => {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onChange(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-1.5">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFile}
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
      />
      
      <div className="flex items-center justify-between">
        <label className="block text-[11px] font-semibold text-[#aaa]">
          {label}
        </label>
        <button
          type="button"
          onClick={() => setShowUrlInput(!showUrlInput)}
          className="text-[10px] text-[#3ea6ff] hover:underline cursor-pointer flex items-center gap-1"
        >
          <Link className="w-3 h-3" />
          <span>{showUrlInput ? t('img.browseFile') : t('img.pasteUrl')}</span>
        </button>
      </div>

      {showUrlInput ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholderUrl}
            className="w-full bg-[#121212] border border-[#383838] focus:border-white text-white text-xs rounded-xl px-3.5 py-2.5 outline-none transition"
          />
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="p-2 text-[#aaa] hover:text-white rounded-lg hover:bg-white/5 cursor-pointer"
              title={t('img.clear')}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2.5 bg-[#121212] border border-[#383838] rounded-2xl p-2.5">
          {/* Preview thumbnail */}
          <div 
            className={`overflow-hidden bg-[#222] flex-shrink-0 flex items-center justify-center border border-white/10 ${
              type === 'avatar' ? 'w-11 h-11 rounded-full' : 'w-16 h-11 rounded-xl'
            }`}
          >
            {value ? (
              <img src={value} alt={t('img.preview')} className="w-full h-full object-cover" />
            ) : (
              <ImageIcon className="w-4 h-4 text-[#666]" />
            )}
          </div>

          {/* Full-width action button */}
          <div className="flex-1 flex items-center gap-1.5 min-w-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 w-full bg-[#272727] hover:bg-[#383838] text-white text-xs font-semibold py-2.5 px-3 rounded-xl transition cursor-pointer flex items-center justify-center gap-2 border border-white/5 shadow-sm active:scale-98"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{value ? t('common.change') : t('common.browse')}</span>
            </button>

            {value && (
              <button
                type="button"
                onClick={() => onChange('')}
                className="p-2 text-[#aaa] hover:text-red-400 hover:bg-white/5 rounded-xl transition cursor-pointer"
                title={t('img.remove')}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
