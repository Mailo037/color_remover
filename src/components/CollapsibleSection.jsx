import { useCallback, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, Maximize2, MoveDown } from 'lucide-react';
import { cx, uiTemplates } from '../uiTemplates';

export const CollapsibleSection = ({
  title,
  icon: Icon,
  isOpen,
  onToggle,
  children,
  contentOnlyOnMobile = false,
  panelId,
  dockPosition,
  onRequestDock,
  onRestoreDock,
}) => {
  const longPressTimerRef = useRef(null);
  const longPressStartRef = useRef(null);
  const longPressTriggeredRef = useRef(false);
  const isDocked = Boolean(dockPosition);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressStartRef.current = null;
  }, []);

  useEffect(() => clearLongPressTimer, [clearLongPressTimer]);

  const requestDockMenu = useCallback((target) => {
    if (!onRequestDock || !panelId || !target?.getBoundingClientRect) return;
    onRequestDock(panelId, target.getBoundingClientRect());
  }, [onRequestDock, panelId]);

  const handleLongPressStart = (event) => {
    if (!onRequestDock || !panelId || (event.pointerType === 'mouse' && event.button !== 0)) return;

    clearLongPressTimer();
    longPressTriggeredRef.current = false;
    longPressStartRef.current = { x: event.clientX, y: event.clientY, target: event.currentTarget };
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      requestDockMenu(longPressStartRef.current?.target);
    }, 540);
  };

  const handleLongPressMove = (event) => {
    if (!longPressStartRef.current) return;

    const dx = Math.abs(event.clientX - longPressStartRef.current.x);
    const dy = Math.abs(event.clientY - longPressStartRef.current.y);
    if (dx > 10 || dy > 10) clearLongPressTimer();
  };

  const handleToggleClick = (event) => {
    if (longPressTriggeredRef.current) {
      event.preventDefault();
      event.stopPropagation();
      longPressTriggeredRef.current = false;
      clearLongPressTimer();
      return;
    }

    onToggle();
  };

  const dockedClass = {
    left: 'lg:fixed lg:left-3 lg:top-[5.25rem] lg:bottom-4 lg:z-[170] lg:w-[350px] xl:w-[400px] lg:max-h-[calc(100dvh-6.25rem)] lg:overflow-y-auto lg:shadow-2xl custom-scrollbar',
    right: 'lg:fixed lg:right-3 lg:top-[5.25rem] lg:bottom-4 lg:z-[170] lg:w-[350px] xl:w-[400px] lg:max-h-[calc(100dvh-6.25rem)] lg:overflow-y-auto lg:shadow-2xl custom-scrollbar',
    top: 'lg:fixed lg:left-1/2 lg:top-[5.25rem] lg:z-[170] lg:w-[min(920px,calc(100vw-2rem))] lg:max-h-[17rem] lg:-translate-x-1/2 lg:overflow-y-auto lg:shadow-2xl custom-scrollbar',
    bottom: 'lg:fixed lg:left-1/2 lg:bottom-4 lg:z-[170] lg:w-[min(920px,calc(100vw-2rem))] lg:max-h-[17rem] lg:-translate-x-1/2 lg:overflow-y-auto lg:shadow-2xl custom-scrollbar',
  }[dockPosition] || '';

  return (
    <div className={cx(contentOnlyOnMobile ? uiTemplates.surfaces.sectionMobileContentOnly : uiTemplates.surfaces.section, isDocked ? 'lg:ring-1 lg:ring-blue-400/40' : '', dockedClass)}>
      <div className={cx(contentOnlyOnMobile ? 'hidden lg:flex' : 'flex', 'w-full items-stretch bg-neutral-50/50 dark:bg-[#111]/50 hover:bg-neutral-100 dark:hover:bg-[#1a1a1a] transition-colors')}>
        <button
          type="button"
          onClick={handleToggleClick}
          onPointerDown={handleLongPressStart}
          onPointerMove={handleLongPressMove}
          onPointerUp={clearLongPressTimer}
          onPointerCancel={clearLongPressTimer}
          onPointerLeave={clearLongPressTimer}
          className="flex min-h-[60px] flex-1 select-none items-center justify-between gap-3 p-4 text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 sm:p-5"
          aria-expanded={isOpen}
        >
          <div className="flex items-center gap-3 font-semibold text-neutral-800 dark:text-neutral-200 min-w-0">
            <Icon className="w-5 h-5 text-neutral-500" />
            <span className="truncate">{title}</span>
          </div>
          {isOpen ? <ChevronUp className="w-5 h-5 shrink-0 text-neutral-400 transition-transform" /> : <ChevronDown className="w-5 h-5 shrink-0 text-neutral-400 transition-transform" />}
        </button>

        {onRequestDock && panelId && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              requestDockMenu(event.currentTarget);
            }}
            className="flex min-h-[60px] w-12 shrink-0 items-center justify-center border-l border-neutral-200/70 text-neutral-500 transition-colors hover:bg-white/70 hover:text-neutral-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 dark:border-neutral-800/70 dark:hover:bg-[#222] dark:hover:text-white"
            aria-label={`Dock ${title}`}
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        )}

        {isDocked && onRestoreDock && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onRestoreDock(panelId);
            }}
            className="flex min-h-[60px] w-12 shrink-0 items-center justify-center border-l border-neutral-200/70 text-neutral-500 transition-colors hover:bg-white/70 hover:text-neutral-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 dark:border-neutral-800/70 dark:hover:bg-[#222] dark:hover:text-white"
            aria-label={`Return ${title} to list`}
          >
            <MoveDown className="h-4 w-4" />
          </button>
        )}
        </div>
      <div className={`transition-all duration-300 ease-in-out origin-top grid ${contentOnlyOnMobile ? 'grid-rows-[1fr] opacity-100 lg:grid-rows-[0fr] lg:opacity-0' : ''} ${isOpen ? 'lg:grid-rows-[1fr] lg:opacity-100 grid-rows-[1fr] opacity-100' : 'lg:grid-rows-[0fr] lg:opacity-0 grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
          <div className={contentOnlyOnMobile ? uiTemplates.surfaces.sectionMobileBody : uiTemplates.surfaces.sectionBody}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
