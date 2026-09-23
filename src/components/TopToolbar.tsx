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
  Layers,
  Table,
  Gauge,
  Focus,
  Workflow,
  Zap,
  Boxes,
  Network,
  Shield,
  Check,
  ChevronDown,
  Smartphone
} from 'lucide-react';
import { Tooltip, Badge, ActionIcon, Group, Menu } from '@mantine/core';
import { 
  CanvasTool, 
  ThemeMode, 
  GraphLayoutAlgorithm, 
  LayoutTightness, 
  EdgeRoutingMode 
} from '../types/surface';

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
  onAddNewDataGrid?: () => void;
  onOpenDataGridMatrix?: () => void;
  onPopulateScaleTest?: (count: number) => void;
  totalCardsCount?: number;
  onTriggerFileUpload: () => void;
  onAutoArrange: () => void;
  onApplyLayout?: (algo: GraphLayoutAlgorithm) => void;
  layoutTightness?: LayoutTightness;
  onChangeTightness?: (tightness: LayoutTightness) => void;
  edgeRoutingMode?: EdgeRoutingMode;
  onChangeEdgeRouting?: (mode: EdgeRoutingMode) => void;
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
  onAddNewDataGrid,
  onOpenDataGridMatrix,
  onPopulateScaleTest,
  totalCardsCount = 0,
  onTriggerFileUpload,
  onAutoArrange,
  onApplyLayout,
  layoutTightness = 'tight',
  onChangeTightness,
  edgeRoutingMode = 'orthogonal-avoid',
  onChangeEdgeRouting,
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

        <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate max-w-[170px]">
          {boardName}
        </span>

        <Badge variant="outline" color="orange" size="xs" className="hidden lg:inline-flex font-mono text-[9px] uppercase tracking-wider">
          TanStack Start
        </Badge>
      </div>

      {/* Center: Floating canvas tools & layout intelligence */}
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

        <span className="w-[1px] h-3.5 bg-zinc-300 dark:bg-zinc-700 mx-1" />

        {/* Auto Focus - In the middle of header to zoom out and show whole layout */}
        <Tooltip label="Auto Focus: Zoom out to show whole layout (Shortcut: F)">
          <button
            onClick={onFitView}
            className="px-2.5 py-0.5 rounded bg-orange-500/10 hover:bg-orange-500/20 active:bg-orange-500/30 text-orange-600 dark:text-orange-400 border border-orange-500/30 flex items-center gap-1.5 transition-all shadow-xs active:scale-95 font-semibold text-xs group"
            title="Auto focus: Zoom out to show whole layout"
          >
            <Focus className="w-3.5 h-3.5 text-orange-500 shrink-0 group-hover:scale-110 transition-transform" />
            <span>Auto Focus</span>
          </button>
        </Tooltip>

        <span className="w-[1px] h-3.5 bg-zinc-300 dark:bg-zinc-700 mx-1" />

        {/* GRAPH LAYOUT ENGINE DROPDOWN */}
        {onApplyLayout && (
          <Menu shadow="md" width={260}>
            <Menu.Target>
              <button
                className="px-2.5 py-0.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center gap-1.5 transition-all font-semibold text-xs"
                title="Graph Layout Algorithms (Force-Directed, Stress, ELK Layered, Orthogonal)"
              >
                <Workflow className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span>Layout</span>
                <ChevronDown className="w-2.5 h-2.5 opacity-60" />
              </button>
            </Menu.Target>
            <Menu.Dropdown className="text-xs">
              <Menu.Label className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                Graph Layout Algorithms
              </Menu.Label>
              
              <Menu.Item 
                leftSection={<Zap className="w-3.5 h-3.5 text-amber-500" />}
                onClick={() => onApplyLayout('force-directed')}
              >
                <div>
                  <div className="font-medium text-xs">Force-Directed</div>
                  <div className="text-[10px] text-zinc-400">Physics springs & box annealing</div>
                </div>
              </Menu.Item>

              <Menu.Item 
                leftSection={<Network className="w-3.5 h-3.5 text-cyan-500" />}
                onClick={() => onApplyLayout('stress-majorization')}
              >
                <div>
                  <div className="font-medium text-xs">Stress Majorization</div>
                  <div className="text-[10px] text-zinc-400">Shortest-path distance minimization</div>
                </div>
              </Menu.Item>

              <Menu.Item 
                leftSection={<Workflow className="w-3.5 h-3.5 text-emerald-500" />}
                onClick={() => onApplyLayout('elk-layered')}
              >
                <div>
                  <div className="font-medium text-xs">ELK Layered (Sugiyama)</div>
                  <div className="text-[10px] text-zinc-400">Hierarchical DAG flow & crossing reduction</div>
                </div>
              </Menu.Item>

              <Menu.Item 
                leftSection={<Boxes className="w-3.5 h-3.5 text-indigo-500" />}
                onClick={() => onApplyLayout('orthogonal')}
              >
                <div>
                  <div className="font-medium text-xs">Orthogonal Graph</div>
                  <div className="text-[10px] text-zinc-400">Manhattan rectilinear grid channels</div>
                </div>
              </Menu.Item>

              <Menu.Item 
                leftSection={<LayoutGrid className="w-3.5 h-3.5 text-zinc-400" />}
                onClick={() => onApplyLayout('grid-compact')}
              >
                <div>
                  <div className="font-medium text-xs">Compact Grid</div>
                  <div className="text-[10px] text-zinc-400">Aspect-ratio optimal tidy matrix</div>
                </div>
              </Menu.Item>

              <Menu.Item 
                leftSection={<Smartphone className="w-3.5 h-3.5 text-orange-500" />}
                onClick={() => onApplyLayout('mobile-stack')}
              >
                <div>
                  <div className="font-medium text-xs text-orange-600 dark:text-orange-400 font-semibold">Mobile Vertical Stack</div>
                  <div className="text-[10px] text-zinc-400">Phone-optimized column (zero white space)</div>
                </div>
              </Menu.Item>

              {onChangeTightness && (
                <>
                  <Menu.Divider />
                  <Menu.Label className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                    Spacing Tightness
                  </Menu.Label>
                  <Menu.Item 
                    rightSection={layoutTightness === 'tight' ? <Check className="w-3 h-3 text-orange-500" /> : null}
                    onClick={() => onChangeTightness('tight')}
                  >
                    Ultra-Tight (18px margin)
                  </Menu.Item>
                  <Menu.Item 
                    rightSection={layoutTightness === 'compact' ? <Check className="w-3 h-3 text-orange-500" /> : null}
                    onClick={() => onChangeTightness('compact')}
                  >
                    Compact (28px margin)
                  </Menu.Item>
                  <Menu.Item 
                    rightSection={layoutTightness === 'balanced' ? <Check className="w-3 h-3 text-orange-500" /> : null}
                    onClick={() => onChangeTightness('balanced')}
                  >
                    Balanced (44px margin)
                  </Menu.Item>
                </>
              )}

              {onChangeEdgeRouting && (
                <>
                  <Menu.Divider />
                  <Menu.Label className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                    Edge Routing & Obstacles
                  </Menu.Label>
                  <Menu.Item 
                    leftSection={<Shield className="w-3.5 h-3.5 text-emerald-500" />}
                    rightSection={edgeRoutingMode === 'orthogonal-avoid' ? <Check className="w-3 h-3 text-orange-500" /> : null}
                    onClick={() => onChangeEdgeRouting('orthogonal-avoid')}
                  >
                    <div>
                      <div className="font-medium text-xs">Avoid Obstacles (Orthogonal)</div>
                      <div className="text-[10px] text-zinc-400">Routes around cards with filleted corners</div>
                    </div>
                  </Menu.Item>
                  <Menu.Item 
                    rightSection={edgeRoutingMode === 'curved-smart' ? <Check className="w-3 h-3 text-orange-500" /> : null}
                    onClick={() => onChangeEdgeRouting('curved-smart')}
                  >
                    Curved S-Spline
                  </Menu.Item>
                  <Menu.Item 
                    rightSection={edgeRoutingMode === 'direct-straight' ? <Check className="w-3 h-3 text-orange-500" /> : null}
                    onClick={() => onChangeEdgeRouting('direct-straight')}
                  >
                    Straight Direct
                  </Menu.Item>
                </>
              )}
            </Menu.Dropdown>
          </Menu>
        )}

        <Tooltip label="Create Note Card (C)">
          <button
            onClick={onAddNewNote}
            className="px-2 py-0.5 rounded hover:text-zinc-900 dark:hover:text-zinc-200 flex items-center gap-1 transition-colors"
          >
            <Plus className="w-3 h-3" />
            <span className="hidden sm:inline">Card</span>
          </button>
        </Tooltip>

        {onAddNewDataGrid && (
          <Tooltip label="Create Compact Data Grid (Sortable & Editable)">
            <button
              onClick={onAddNewDataGrid}
              className="px-2 py-0.5 rounded text-orange-600 dark:text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 flex items-center gap-1 transition-colors font-medium"
            >
              <Table className="w-3 h-3 text-orange-500" />
              <span className="hidden sm:inline">Data Grid</span>
            </button>
          </Tooltip>
        )}

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

        {onOpenDataGridMatrix && (
          <Tooltip label="Workspace Data Grid & Entity Matrix">
            <button
              onClick={onOpenDataGridMatrix}
              className="px-2 py-0.5 rounded hover:text-zinc-900 dark:hover:text-zinc-200 flex items-center gap-1 transition-colors font-mono text-[11px]"
            >
              <Layers className="w-3 h-3 text-zinc-500" />
              <span className="hidden md:inline">Matrix ({totalCardsCount})</span>
            </button>
          </Tooltip>
        )}

        {onPopulateScaleTest && (
          <Menu shadow="md" width={180}>
            <Menu.Target>
              <button
                className="px-2 py-0.5 rounded hover:text-orange-600 dark:hover:text-orange-400 flex items-center gap-1 transition-colors text-zinc-600 dark:text-zinc-400 font-mono text-[11px]"
                title="Scale Stress-Test: Populates canvas with realistic nodes"
              >
                <Gauge className="w-3 h-3 text-orange-500" />
                <span className="hidden md:inline">Scale Test</span>
              </button>
            </Menu.Target>
            <Menu.Dropdown className="text-xs">
              <Menu.Label className="font-mono text-[10px]">Populate Scale Test</Menu.Label>
              <Menu.Item onClick={() => onPopulateScaleTest(25)}>
                +25 Scaled Nodes
              </Menu.Item>
              <Menu.Item onClick={() => onPopulateScaleTest(50)}>
                +50 Scaled Nodes
              </Menu.Item>
              <Menu.Item onClick={() => onPopulateScaleTest(100)}>
                +100 Scaled Nodes
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        )}

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
