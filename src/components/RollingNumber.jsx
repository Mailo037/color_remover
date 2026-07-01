import { useEffect, useState } from 'react';
import { cx } from '../uiTemplates';

export const RollingNumber = ({ value }) => {
  const [displayValue, setDisplayValue] = useState(value);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (value !== displayValue) {
      setAnimating(true);
      const timer = setTimeout(() => {
        setDisplayValue(value);
        setAnimating(false);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [value, displayValue]);

  return (
    <span className="relative inline-flex flex-col overflow-hidden h-[1.2em] leading-[1.2em] align-bottom text-center min-w-[2.5ch]">
      <span className={cx('block transition-all ease-out duration-150', animating ? '-translate-y-full opacity-0 scale-95' : 'translate-y-0 opacity-100 scale-100')}>
        {displayValue}
      </span>
      <span className={cx('absolute top-full left-0 w-full block transition-all ease-out duration-150', animating ? '-translate-y-full opacity-100 scale-100' : 'translate-y-0 opacity-0 scale-95')}>
        {value}
      </span>
    </span>
  );
};
