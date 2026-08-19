import React from 'react';
import { Globe, HardDrive } from 'lucide-react';
import { useMyTube } from '../../context/MyTubeContext';
import { useI18n } from '../../i18n/I18nProvider';

export const ModeSwitch: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { localOnly, setLocalOnly } = useMyTube();
  const { t } = useI18n();
  const hint = localOnly ? t('nav.modeSwitchToOnline') : t('nav.modeSwitchToLocal');
  const Icon = localOnly ? HardDrive : Globe;

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => setLocalOnly(!localOnly)}
        title={hint}
        aria-label={hint}
        className="mt-auto w-10 h-10 rounded-xl text-[#aaa] hover:bg-[#272727] hover:text-white flex items-center justify-center cursor-pointer transition-colors duration-200"
      >
        <Icon className="w-5 h-5" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setLocalOnly(!localOnly)}
      title={hint}
      aria-label={hint}
      className="w-full flex items-center gap-5 px-3 py-2.5 rounded-xl text-[#aaa] hover:bg-[#272727]/60 hover:text-white transition-colors duration-200 cursor-pointer text-left"
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      <span className="flex-1 truncate text-sm">
        {localOnly ? t('nav.modeLocal') : t('nav.modeOnline')}
      </span>
      <span className="relative w-8 h-[18px] rounded-full flex-shrink-0 bg-[#3f3f3f]">
        <span
          className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform duration-200 ${
            localOnly ? 'translate-x-0' : 'translate-x-[14px]'
          }`}
        />
      </span>
    </button>
  );
};
