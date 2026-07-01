export const DOCKED_PANELS_STORAGE_KEY = 'bpr_docked_panels';
export const DOCKABLE_PANEL_IDS = ['basic', 'advanced', 'effects', 'ai'];
export const PANEL_LABELS = {
  basic: 'Basic Settings',
  advanced: 'Advanced Settings',
  effects: 'Effects & Styling',
  ai: 'Smart Assist',
};

export const SNAP_TARGETS = [
  { id: 'left', label: 'Left', previewClass: 'left-1 top-1 bottom-1 w-[42%]' },
  { id: 'right', label: 'Right', previewClass: 'right-1 top-1 bottom-1 w-[42%]' },
  { id: 'top', label: 'Top', previewClass: 'left-1 right-1 top-1 h-[42%]' },
  { id: 'bottom', label: 'Bottom', previewClass: 'left-1 right-1 bottom-1 h-[42%]' },
];

export const readDockedPanels = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(DOCKED_PANELS_STORAGE_KEY) || '{}');
    return Object.fromEntries(
      Object.entries(saved).filter(([panelId, position]) => (
        DOCKABLE_PANEL_IDS.includes(panelId) && SNAP_TARGETS.some((target) => target.id === position)
      ))
    );
  } catch {
    return {};
  }
};
