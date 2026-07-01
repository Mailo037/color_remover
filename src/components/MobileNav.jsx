import { Bot, Download, Layers, Settings, Wrench } from 'lucide-react';
import { templateClasses, uiTemplates } from '../uiTemplates';

export const MobileNav = ({
  aiEnabled,
  isMobileSettingsOpen,
  isMobileExportOpen,
  activeMobilePanel,
  openMobilePanel,
  openMobileExport,
  processedImage,
}) => (
  <nav className={uiTemplates.surfaces.mobileNav}>
    <div className={`mx-auto grid max-w-md gap-1.5 ${aiEnabled ? 'grid-cols-5' : 'grid-cols-4'}`}>
      <button
        type="button"
        onClick={() => openMobilePanel('basic')}
        className={templateClasses.mobileNav(isMobileSettingsOpen && activeMobilePanel === 'basic')}
      >
        <Settings className="h-5 w-5" />
        Basic
      </button>
      <button
        type="button"
        onClick={() => openMobilePanel('advanced')}
        className={templateClasses.mobileNav(isMobileSettingsOpen && activeMobilePanel === 'advanced')}
      >
        <Wrench className="h-5 w-5" />
        Advanced
      </button>
      <button
        type="button"
        onClick={() => openMobilePanel('effects')}
        className={templateClasses.mobileNav(isMobileSettingsOpen && activeMobilePanel === 'effects')}
      >
        <Layers className="h-5 w-5" />
        Effects
      </button>
      {aiEnabled && (
        <button
          type="button"
          onClick={() => openMobilePanel('ai')}
          className={templateClasses.mobileNav(isMobileSettingsOpen && activeMobilePanel === 'ai')}
        >
          <Bot className="h-5 w-5" />
          Assist
        </button>
      )}
      <button
        type="button"
        onClick={openMobileExport}
        disabled={!processedImage}
        className={templateClasses.mobileNav(isMobileExportOpen, { success: Boolean(processedImage || isMobileExportOpen), disabled: !processedImage })}
      >
        <Download className="h-5 w-5" />
        Save
      </button>
    </div>
  </nav>
);
