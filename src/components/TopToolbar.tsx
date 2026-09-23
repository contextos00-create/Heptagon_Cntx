import React from 'react';
import { 
  MousePointer, 
  Hand, 
  Plus, 
  Upload, 
  ZoomIn, 
  ZoomOut, 
  Maximize, 
  Sparkles, 
  Sun, 
  Moon, 
  FolderPlus, 
  LayoutGrid, 
  PanelLeftClose, 
  PanelLeftOpen,
  Search,
  Layers
} from 'lucide-react';
import { Tooltip, Badge, ActionIcon, Group } from '@mantine/core';
import { CanvasTool, ThemeMode } from '../types/surface';

interface TopToolbarProps {
  boardName: string;
  activeTool: CanvasTool;
  onSelectTool: (tool: CanvasTool) => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onFitView: () => void;
  isChatOpen: boolean;
  onToggleChat: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onAddNewNote: () => void;
  onAddNewSection: () => void;
  onTriggerFileUpload: () => void;
  onAutoArrange: () => void;
  onOpenGraphSearch?: () => void;
}

export const TopToolbar: React.FC<TopToolbarProps> = ({
  boardName,
  activeTool,
  onSelectTool,
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFitView,
  isChatOpen,
  onToggleChat,
  theme,
  onToggleTheme,
  isSidebarOpen,
  onToggleSidebar,
  onAddNewNote,
  onAddNewSection,
  onTriggerFileUpload,
  onAutoArrange,
  onOpenGraphSearch,
}) => {
  return (
    <header className="h-9 px-3 flex items-center justify-between z-30 select-none bg-white/80 dark:bg-[#0d0e11]/80 backdrop-blur-xs border-b border-black/[0.04] dark:border-white/[0.04] text-zinc-600 dark:text-zinc-400">
      {/* Left: Breadcrumb, framework stack indicator, and sidebar toggle */}
      <div className="flex items-center gap-2">
        <Tooltip label={isSidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'}>
          <ActionIcon
            onClick={onToggleSidebar}
            variant="subtle"
            color="gray"
            size="sm"
            aria-label="Toggle sidebar"
          >
            {isSidebarOpen ? <PanelLeftClose className="w-3.5 h-3.5" /> : <PanelLeftOpen className="w-3.5 h-3.5" />}
          </ActionIcon>
        </Tooltip>

        <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate max-w-[180px]">
          {boardName}
        </span>

        <Badge variant="outline" color="orange" size="xs" className="hidden lg:inline-flex font-mono text-[9px] uppercase tracking-wider">
          TanStack Start
        </Badge>
      </div>

      {/* Center: Floating canvas tools */}
      <div className="flex items-center gap-1 text-xs">
        <Tooltip label="Select Tool (V)">
          <button
            onClick={() => onSelectTool('select')}
            className={`px-2 py-0.5 rounded transition-colors flex items-center gap-1 ${
              activeTool === 'select'
                ? 'text-zinc-900 dark:text-zinc-100 font-medium bg-black/[0.04] dark:bg-white/[0.06]'
                : 'hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            <MousePointer className="w-3 h-3" />
            <span className="hidden sm:inline">Select</span>
          </button>
        </Tooltip>

        <Tooltip label="Pan Tool (Hold Space)">
          <button
            onClick={() => onSelectTool('pan')}
            className={`px-2 py-0.5 rounded transition-colors flex items-center gap-1 ${
              activeTool === 'pan'
                ? 'text-zinc-900 dark:text-zinc-100 font-medium bg-black/[0.04] dark:bg-white/[0.06]'
                : 'hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            <Hand className="w-3 h-3" />
            <span className="hidden sm:inline">Pan</span>
          </button>
        </Tooltip>

        <span className="w-[1px] h-3 bg-zinc-300 dark:bg-zinc-700 mx-1" />

        <Tooltip label="Create Note Card (C)">
          <button
            onClick={onAddNewNote}
            className="px-2 py-0.5 rounded hover:text-zinc-900 dark:hover:text-zinc-200 flex items-center gap-1 transition-colors"
          >
            <Plus className="w-3 h-3" />
            <span className="hidden sm:inline">Card</span>
          </button>
        </Tooltip>

        <Tooltip label="Create Section Cluster (S)">
          <button
            onClick={onAddNewSection}
            className="px-2 py-0.5 rounded hover:text-zinc-900 dark:hover:text-zinc-200 flex items-center gap-1 transition-colors"
          >
            <FolderPlus className="w-3 h-3" />
            <span className="hidden sm:inline">Section</span>
          </button>
        </Tooltip>

        <Tooltip label="Upload Files">
          <button
            onClick={onTriggerFileUpload}
            className="px-2 py-0.5 rounded hover:text-zinc-900 dark:hover:text-zinc-200 flex items-center gap-1 transition-colors"
          >
            <Upload className="w-3 h-3" />
            <span className="hidden sm:inline">Upload</span>
          </button>
        </Tooltip>

        <Tooltip label="Auto-Align Nodes">
          <button
            onClick={onAutoArrange}
            className="px-2 py-0.5 rounded hover:text-zinc-900 dark:hover:text-zinc-200 flex items-center gap-1 transition-colors"
          >
            <LayoutGrid className="w-3 h-3" />
            <span className="hidden md:inline">Align</span>
          </button>
        </Tooltip>

        {onOpenGraphSearch && (
          <Tooltip label="Graph Query (Structural search)">
            <button
              onClick={onOpenGraphSearch}
              className="px-2 py-0.5 rounded hover:text-orange-600 dark:hover:text-orange-400 flex items-center gap-1 transition-colors font-mono text-[11px]"
            >
              <Search className="w-3 h-3 text-orange-500" />
              <span className="hidden md:inline">Graph Query</span>
            </button>
          </Tooltip>
        )}
      </div>

      {/* Right: Camera zoom, Theme toggle, and TanStack AI Copilot */}
      <div className="flex items-center gap-2">
        <Group gap={2}>
          <Tooltip label="Zoom Out">
            <ActionIcon onClick={onZoomOut} variant="subtle" color="gray" size="sm">
              <ZoomOut className="w-3 h-3" />
            </ActionIcon>
          </Tooltip>
          
          <button
            onClick={onResetZoom}
            className="px-1 text-[11px] font-mono text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
            title="Reset Zoom"
          >
            {Math.round(zoom * 100)}%
          </button>

          <Tooltip label="Zoom In">
            <ActionIcon onClick={onZoomIn} variant="subtle" color="gray" size="sm">
              <ZoomIn className="w-3 h-3" />
            </ActionIcon>
          </Tooltip>

          <Tooltip label="Fit Surface to View">
            <ActionIcon onClick={onFitView} variant="subtle" color="gray" size="sm">
              <Maximize className="w-3 h-3" />
            </ActionIcon>
          </Tooltip>
        </Group>

        <Tooltip label={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}>
          <ActionIcon onClick={onToggleTheme} variant="subtle" color="gray" size="sm">
            {theme === 'dark' ? <Moon className="w-3 h-3" /> : <Sun className="w-3 h-3" />}
          </ActionIcon>
        </Tooltip>

        <Tooltip label="Toggle TanStack AI Visual Copilot">
          <button
            onClick={onToggleChat}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
              isChatOpen
                ? 'bg-orange-500 text-white shadow-xs'
                : 'bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            <span className="hidden sm:inline">TanStack AI</span>
          </button>
        </Tooltip>
      </div>
    </header>
  );
};
