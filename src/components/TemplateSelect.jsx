import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cx, uiTemplates } from '../uiTemplates';

const normalizeOptionGroups = (options) => {
  if (!Array.isArray(options) || options.length === 0) return [];

  if (options.every((item) => Array.isArray(item.options))) {
    return options.map((group) => ({
      label: group.label || '',
      options: group.options || [],
    }));
  }

  return [{ label: '', options }];
};

const optionMatchesQuery = (option, query) => {
  if (!query) return true;

  const haystack = [
    option.label,
    option.value,
    option.searchText,
  ].filter(Boolean).join(' ').toLowerCase();

  return haystack.includes(query.toLowerCase());
};

export function TemplateSelect({
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  ariaLabel,
  searchable = false,
  searchPlaceholder = 'Search',
  emptyMessage = 'No options found.',
  className = '',
  buttonClassName = '',
  menuClassName = '',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef(null);
  const listboxId = useId();

  const groups = useMemo(() => normalizeOptionGroups(options), [options]);
  const flatOptions = useMemo(() => groups.flatMap((group) => group.options), [groups]);
  const selectedOption = flatOptions.find((option) => option.value === value);

  const visibleGroups = useMemo(() => (
    groups
      .map((group) => ({
        ...group,
        options: group.options.filter((option) => optionMatchesQuery(option, query)),
      }))
      .filter((group) => group.options.length > 0)
  ), [groups, query]);
  const visibleOptions = useMemo(() => visibleGroups.flatMap((group) => group.options), [visibleGroups]);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const selectedIndex = visibleOptions.findIndex((option) => option.value === value);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [isOpen, value, visibleOptions]);

  const handleSelect = (option) => {
    if (option.disabled) return;

    onChange(option.value, option);
    setIsOpen(false);
  };

  const moveActiveOption = (direction) => {
    if (visibleOptions.length === 0) return;

    setActiveIndex((current) => {
      const nextIndex = current + direction;
      if (nextIndex < 0) return visibleOptions.length - 1;
      if (nextIndex >= visibleOptions.length) return 0;
      return nextIndex;
    });
  };

  const handleDropdownKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setIsOpen(true);
      moveActiveOption(1);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setIsOpen(true);
      moveActiveOption(-1);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (isOpen) {
        const activeOption = visibleOptions[activeIndex];
        if (activeOption) handleSelect(activeOption);
      } else {
        setIsOpen(true);
      }
      return;
    }

    if (event.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleTriggerKeyDown = (event) => {
    if (event.key === ' ') {
      event.preventDefault();
      if (isOpen) {
        const activeOption = visibleOptions[activeIndex];
        if (activeOption) handleSelect(activeOption);
      } else {
        setIsOpen(true);
      }
      return;
    }

    handleDropdownKeyDown(event);
  };

  let optionRenderIndex = -1;

  return (
    <div ref={rootRef} className={cx('relative', className)}>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        onKeyDown={handleTriggerKeyDown}
        className={cx(uiTemplates.inputs.selectButton, buttonClassName)}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-activedescendant={isOpen && visibleOptions.length > 0 ? `${listboxId}-${activeIndex}` : undefined}
      >
        <span className={cx('min-w-0 flex-1 truncate', selectedOption ? '' : 'text-neutral-400')}>
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown className={cx('w-4 h-4 text-neutral-400 shrink-0 transition-transform', isOpen ? 'rotate-180' : '')} />
      </button>

      {isOpen && (
        <div
          className={cx(uiTemplates.inputs.selectMenu, menuClassName)}
        >
          {searchable && (
            <div className="border-b border-neutral-100 p-2 dark:border-neutral-800">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={handleDropdownKeyDown}
                  placeholder={searchPlaceholder}
                  className={uiTemplates.inputs.search}
                />
              </div>
            </div>
          )}

          <div id={listboxId} role="listbox" aria-label={ariaLabel} className="max-h-[280px] overflow-y-auto custom-scrollbar p-1">
            {visibleGroups.length === 0 ? (
              <div className="px-3 py-8 text-center text-xs text-neutral-400">{emptyMessage}</div>
            ) : (
              visibleGroups.map((group, groupIndex) => (
                <div key={group.label || groupIndex} className="mb-1 last:mb-0">
                  {group.label && (
                    <div className="sticky top-0 z-10 bg-white/95 px-3 py-1.5 text-[11px] font-semibold uppercase text-neutral-500 backdrop-blur dark:bg-[#0a0a0a]/95 dark:text-neutral-400">
                      {group.label}
                    </div>
                  )}

                  {group.options.map((option) => {
                    optionRenderIndex += 1;
                    const isSelected = option.value === value;
                    const isActive = optionRenderIndex === activeIndex;

                    return (
                      <button
                        key={`${group.label}-${option.value}`}
                        id={`${listboxId}-${optionRenderIndex}`}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        disabled={option.disabled}
                        onClick={() => handleSelect(option)}
                        onMouseEnter={() => setActiveIndex(optionRenderIndex)}
                        className={cx(
                          'flex min-h-[44px] w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                          isSelected
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                            : isActive
                              ? 'bg-neutral-100 text-neutral-800 dark:bg-[#1a1a1a] dark:text-neutral-200'
                              : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-[#1a1a1a]'
                        )}
                      >
                        <span className="min-w-0 flex-1 truncate">{option.label}</span>
                        {isSelected && <Check className="h-4 w-4 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
