import { Sparkles, X } from 'lucide-react';

export function TemplateNoticeStack({ notices, onDismiss }) {
  return (
    <div
      className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-[500] flex w-[calc(100vw-2rem)] -translate-x-1/2 flex-col items-center gap-2 pointer-events-none sm:bottom-6 sm:w-max sm:max-w-[90vw]"
      aria-live="polite"
      aria-relevant="additions removals"
    >
      {notices.map((notice) => (
        <div
          key={notice.id}
          className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-neutral-900 py-2.5 pl-4 pr-2 text-sm font-medium text-white shadow-2xl transition-all pointer-events-auto animate-in fade-in slide-in-from-bottom-4 duration-300 dark:border-black/10 dark:bg-white dark:text-neutral-900"
          role="status"
        >
          <Sparkles className="h-5 w-5 shrink-0 text-blue-400 dark:text-blue-600" />
          <span className="flex-1 break-words pr-2">{notice.message}</span>
          <button
            type="button"
            onClick={() => onDismiss(notice.id)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-white/10 hover:text-white dark:text-neutral-500 dark:hover:bg-black/10 dark:hover:text-black"
            aria-label="Dismiss notification"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
