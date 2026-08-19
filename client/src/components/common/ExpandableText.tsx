import React, { useLayoutEffect, useRef, useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider';

interface ExpandableTextProps {
  text: string;
  className?: string;
}

export const ExpandableText: React.FC<ExpandableTextProps> = ({
  text,
  className = 'text-xs text-[#aaa]',
}) => {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    setExpanded(false);
  }, [text]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || expanded) return;
    const measure = () => setOverflows(el.scrollHeight > el.clientHeight + 2);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, expanded]);

  if (!text.trim()) return null;

  return (
    <div className="max-w-2xl mt-1">
      <p
        ref={ref}
        className={`leading-relaxed whitespace-pre-line ${expanded ? '' : 'line-clamp-2'} ${className}`}
      >
        {text}
      </p>
      {overflows && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((open) => !open);
          }}
          className="mt-0.5 text-[11px] font-semibold text-[#aaa] hover:text-white transition cursor-pointer"
        >
          {expanded ? t('common.seeLess') : t('common.seeMore')}
        </button>
      )}
    </div>
  );
};
