import { Sparkles, X } from 'lucide-react';
import { uiTemplates } from '../uiTemplates';

export function TemplateNoticeStack({ notices, onDismiss }) {
  return (
    <div
      className={uiTemplates.notices.stack}
      aria-live="polite"
      aria-relevant="additions removals"
    >
      {notices.map((notice) => (
        <div
          key={notice.id}
          className={uiTemplates.notices.item}
          role="status"
        >
          <Sparkles className="h-5 w-5 shrink-0 text-blue-400 dark:text-blue-600" />
          <span className="flex-1 break-words pr-2">{notice.message}</span>
          <button
            type="button"
            onClick={() => onDismiss(notice.id)}
            className={uiTemplates.notices.dismiss}
            aria-label="Dismiss notification"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
