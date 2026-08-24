import React from 'react';
import { Cloud, HardDrive } from 'lucide-react';
import { useMyTube } from '../../context/MyTubeContext';
import { useI18n } from '../../i18n/I18nProvider';

export const ModeSwitch: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { localOnly, setLocalOnly } = useMyTube();
  const { t } = useI18n();
  const hint = localOnly ? t('nav.modeSwitchToOnline') : t('nav.modeSwitchToLocal');
  const Icon = localOnly ? HardDrive : Cloud;

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => setLocalOnly(!localOnly)}
        title={hint}
        aria-label={hint}
        className={`va-mode-switch mt-auto w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer transition-colors duration-200 ${
          localOnly ? 'text-[#ff7180]' : 'text-[#73c7e8]'
        }`}
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
      className="va-mode-switch w-full flex items-center gap-4 px-3 py-2.5 rounded-xl text-[#9ba9b8] hover:text-white transition-colors duration-200 cursor-pointer text-left"
    >
      <span className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
        localOnly ? 'bg-[#ff5a67]/12 text-[#ff7180]' : 'bg-[#73c7e8]/10 text-[#73c7e8]'
      }`}>
        <Icon className="w-4 h-4" />
      </span>
      <span className="flex-1 truncate text-sm">
        {localOnly ? t('nav.modeLocal') : t('nav.modeOnline')}
      </span>
      <span className={`relative w-8 h-[18px] rounded-full flex-shrink-0 ${
        localOnly ? 'bg-[#ff5a67]/55' : 'bg-[#73c7e8]/35'
      }`}>
        <span
          className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform duration-200 ${
            localOnly ? 'translate-x-0' : 'translate-x-[14px]'
          }`}
        />
      </span>
    </button>
  );
};
