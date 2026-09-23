import React, { useRef, useEffect, useState, useCallback } from 'react';
import { SurfaceCard, Connection, CanvasTool, GhostCardData } from '../types/surface';
import { CardNode } from './CardNode';
import { GhostCardNode } from './GhostCardNode';
import { UploadCloud, Layers } from 'lucide-react';
import { processFileToCard } from '../utils/fileHelpers';
import { 
  groupAndPositionUploadedCards, 
  generateContextualDrillDown,
  detectLocationInText,
  generateGhostCardsForCard
} from '../utils/cardIntelligence';
import { 
  SemanticConnection, 
  SemanticZoomLevel, 
  LatentTerritory 
} from '../types/latentIntelligence';
import { 
  getSemanticZoomLevel, 
  enrichConnectionSemantics 
} from '../utils/latentEngine';

interface SurfaceCanvasProps {
  cards: SurfaceCard[];
  connections: Connection[];
  activeTool: CanvasTool;
  spotlightCardId?: string;
  selectedCardId?: string;
  onSelectCard: (id?: string) => void;
  onUpdateCard: (id: string, updates: Partial<SurfaceCard>) => void;
  onDeleteCard: (id: string) => void;
  onDuplicateCard: (card: SurfaceCard) => void;
  onAddCard: (card: Partial<SurfaceCard>) => void;
  onAddMultipleCardsAndConnections: (newCards: SurfaceCard[], newConnections: Connection[]) => void;
  onAddConnection: (connection: Partial<Connection>) => void;
  onDeleteConnection: (connectionId: string) => void;
  onOpenDetail: (card: SurfaceCard) => void;
  isChatOpen: boolean;
  isSidebarOpen: boolean;
  viewState: { panX: number; panY: number; zoom: number };
  onUpdateViewState: (state: { panX: number; panY: number; zoom: number }) => void;
  isLatentLayerActive?: boolean;
  territories?: LatentTerritory[];
  onPredictiveAction?: (action: 'compare' | 'find_relations' | 'trace_evidence' | 'find_contradictions' | 'timeline', card: SurfaceCard) => void;
}

export const SurfaceCanvas: React.FC<SurfaceCanvasProps> = ({
  cards,
  connections,
  activeTool,
  spotlightCardId,
  selectedCardId,
  onSelectCard,
  onUpdateCard,
  onDeleteCard,
  onDuplicateCard,
  onAddCard,
  onAddMultipleCardsAndConnections,
  onAddConnection,
  onDeleteConnection,
  onOpenDetail,
  isChatOpen,
  isSidebarOpen,
  viewState,
  onUpdateViewState,
  isLatentLayerActive = false,
  territories = [],
  onPredictiveAction,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { panX, panY, zoom } = viewState;

  const semanticZoom: SemanticZoomLevel = getSemanticZoomLevel(zoom);

  // Interaction State
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Hovered card for revealing ghost cards
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);

  // Dragging a Card State
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [cardDragOffset, setCardDragOffset] = useState({ x: 0, y: 0 });

  // Resizing a Card State
  const [resizingCardId, setResizingCardId] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState({ mouseX: 0, mouseY: 0, initW: 0, initH: 0 });

  // Creating a Connection Line State
  const [connectingFromId, setConnectingFromId] = useState<string | null>(null);
  const [connectionCurrentPos, setConnectionCurrentPos] = useState<{ x: number; y: number } | null>(null);

  // File Drag-Over State for Ingesting
  const [isDragOverFile, setIsDragOverFile] = useState(false);

  // Spacebar hold for smooth panning
  const isSpacePressedRef = useRef(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
        isSpacePressedRef.current = true;
        if (containerRef.current) containerRef.current.style.cursor = 'grab';
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpacePressedRef.current = false;
        if (containerRef.current) containerRef.current.style.cursor = '';
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Zooming with focal point tracking
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.909;
    const newZoom = Math.min(2.5, Math.max(0.15, zoom * zoomFactor));

    const newPanX = mouseX - (mouseX - panX) * (newZoom / zoom);
    const newPanY = mouseY - (mouseY - panY) * (newZoom / zoom);

    onUpdateViewState({
      panX: newPanX,
      panY: newPanY,
      zoom: newZoom,
    });
  };

  // Canvas Mouse Down
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || activeTool === 'pan' || isSpacePressedRef.current || e.target === containerRef.current) {
      setIsDraggingCanvas(true);
      setDragStart({ x: e.clientX - panX, y: e.clientY - panY });
      onSelectCard(undefined);
    }
  };

  // Start dragging a card
  const handleCardStartDrag = (e: React.MouseEvent, cardId: string) => {
    e.stopPropagation();
    onSelectCard(cardId);

    const card = cards.find((c) => c.id === cardId);
    if (!card) return;

    setDraggingCardId(cardId);
    const canvasMouseX = (e.clientX - panX) / zoom;
    const canvasMouseY = (e.clientY - panY) / zoom;
    setCardDragOffset({
      x: canvasMouseX - card.x,
      y: canvasMouseY - card.y,
    });
  };

  // Start resizing a card
  const handleCardStartResize = (e: React.MouseEvent, cardId: string) => {
    e.stopPropagation();
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;

    setResizingCardId(cardId);
    setResizeStart({
      mouseX: e.clientX,
      mouseY: e.clientY,
      initW: card.width,
      initH: card.height,
    });
  };

  // Start connecting line from card right edge
  const handleStartConnect = (e: React.MouseEvent, fromCardId: string) => {
    e.stopPropagation();
    setConnectingFromId(fromCardId);
    const canvasX = (e.clientX - panX) / zoom;
    const canvasY = (e.clientY - panY) / zoom;
    setConnectionCurrentPos({ x: canvasX, y: canvasY });
  };

  // End connecting line on destination card
  const handleEndConnect = (toCardId: string) => {
    if (connectingFromId && connectingFromId !== toCardId) {
      onAddConnection({
        fromId: connectingFromId,
        toId: toCardId,
        style: 'solid',
      });
    }
    setConnectingFromId(null);
    setConnectionCurrentPos(null);
  };

  // Canvas Mouse Move
  const handleMouseMove = (e: React.MouseEvent) => {
    // 1. Pan Canvas
    if (isDraggingCanvas) {
      onUpdateViewState({
        panX: e.clientX - dragStart.x,
        panY: e.clientY - dragStart.y,
        zoom,
      });
      return;
    }

    // 2. Drag Card
    if (draggingCardId) {
      const canvasMouseX = (e.clientX - panX) / zoom;
      const canvasMouseY = (e.clientY - panY) / zoom;
      const newX = Math.round(canvasMouseX - cardDragOffset.x);
      const newY = Math.round(canvasMouseY - cardDragOffset.y);

      onUpdateCard(draggingCardId, {
        x: newX,
        y: newY,
        updatedAt: Date.now(),
      });
      return;
    }

    // 3. Resize Card
    if (resizingCardId) {
      const deltaX = (e.clientX - resizeStart.mouseX) / zoom;
      const deltaY = (e.clientY - resizeStart.mouseY) / zoom;
      const newW = Math.max(180, Math.round(resizeStart.initW + deltaX));
      const newH = Math.max(120, Math.round(resizeStart.initH + deltaY));

      onUpdateCard(resizingCardId, {
        width: newW,
        height: newH,
        updatedAt: Date.now(),
      });
      return;
    }

    // 4. Update temporary connection position
    if (connectingFromId) {
      const canvasX = (e.clientX - panX) / zoom;
      const canvasY = (e.clientY - panY) / zoom;
      setConnectionCurrentPos({ x: canvasX, y: canvasY });
    }
  };

  // Canvas Mouse Up
  const handleMouseUp = () => {
    setIsDraggingCanvas(false);
    setDraggingCardId(null);
    setResizingCardId(null);
    setConnectingFromId(null);
    setConnectionCurrentPos(null);
  };

  // DRAG AND DROP FILE INGESTION
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverFile(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverFile(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverFile(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const dropCanvasX = (e.clientX - panX) / zoom;
    const dropCanvasY = (e.clientY - panY) / zoom;

    const cardPromises = files.map((file, idx) => 
      processFileToCard(file, dropCanvasX + idx * 40, dropCanvasY + idx * 40)
    );
    const processedCards = await Promise.all(cardPromises);

    const { newCards, newConnections } = groupAndPositionUploadedCards(
      processedCards,
      dropCanvasX,
      dropCanvasY
    );

    onAddMultipleCardsAndConnections(newCards, newConnections);
  };

  // TEXT SELECTION AUTOMATIC DRILL-DOWN CARD
  const handleTextDrillDown = (selectedText: string, sourceCard: SurfaceCard) => {
    const { newCard, newConnection } = generateContextualDrillDown(selectedText, sourceCard);
    onAddMultipleCardsAndConnections([newCard], [newConnection]);
  };

  // LOCATION TAP AUTOMATIC MAP CARD
  const handleLocationClick = (locationName: string, sourceCard: SurfaceCard) => {
    const loc = detectLocationInText(locationName);
    if (!loc) return;

    const cardId = `card-map-${Date.now()}`;
    const newCard: SurfaceCard = {
      id: cardId,
      type: 'map',
      title: `${loc.name} Map`,
      content: `Network latency point and geographic site for ${loc.name}.\n${loc.mapData.placeDetails || ''}`,
      x: sourceCard.x + sourceCard.width + 30,
      y: sourceCard.y,
      width: 280,
      height: 200,
      color: 'orange',
      tags: ['LOCATION', 'MAP', 'GEO-MESH'],
      mapData: loc.mapData,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const newConnection: Connection = {
      id: `conn-map-${Date.now()}`,
      fromId: sourceCard.id,
      toId: cardId,
      label: 'geo:site',
      style: 'solid',
    };

    onAddMultipleCardsAndConnections([newCard], [newConnection]);
  };

  // MATERIALIZE GHOST CARD
  const handleMaterializeGhost = (ghost: GhostCardData, sourceCardId: string) => {
    const newCardId = `card-${Date.now()}`;
    const newCard: SurfaceCard = {
      id: newCardId,
      type: ghost.type,
      title: ghost.title,
      content: ghost.content.replace(/\*Double-click to materialize[^\n]*\*/, '').trim(),
      x: ghost.x,
      y: ghost.y,
      width: ghost.width,
      height: ghost.height,
      color: ghost.color || 'default',
      tags: ['EXPANSION', ghost.type.toUpperCase()],
      mapData: ghost.mapData,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const newConnection: Connection = {
      id: `conn-ghost-${Date.now()}`,
      fromId: sourceCardId,
      toId: newCardId,
      label: ghost.relationLabel,
      style: 'solid',
    };

    onUpdateCard(sourceCardId, {
      ghostCards: (cards.find(c => c.id === sourceCardId)?.ghostCards || []).filter(g => g.id !== ghost.id)
    });

    onAddMultipleCardsAndConnections([newCard], [newConnection]);
  };

  // Semantic relationships line rendering with weight, tension, opacity, and semantics
  const renderConnections = () => {
    const enrichedConns = connections.map(enrichConnectionSemantics);

    return enrichedConns.map((conn) => {
      const fromCard = cards.find((c) => c.id === conn.fromId);
      const toCard = cards.find((c) => c.id === conn.toId);
      if (!fromCard || !toCard) return null;

      const startX = fromCard.x + fromCard.width;
      const startY = fromCard.y + fromCard.height / 2;
      const endX = toCard.x;
      const endY = toCard.y + toCard.height / 2;

      const r = 8;
      const midX = (startX + endX) / 2;
      const midY = (startY + endY) / 2;

      let pathData = '';
      if (Math.abs(startY - endY) < 4) {
        pathData = `M ${startX} ${startY} L ${endX} ${endY}`;
      } else if (Math.abs(startX - endX) < 4) {
        pathData = `M ${startX} ${startY} L ${endX} ${endY}`;
      } else {
        const dirY = endY > startY ? 1 : -1;
        const dirX = endX > startX ? 1 : -1;
        
        pathData = `
          M ${startX} ${startY}
          L ${midX - dirX * r} ${startY}
          Q ${midX} ${startY} ${midX} ${startY + dirY * r}
          L ${midX} ${endY - dirY * r}
          Q ${midX} ${endY} ${midX + dirX * r} ${endY}
          L ${endX} ${endY}
        `;
      }

      // Visual grammar: stroke weight & style communicate semantic relation & confidence
      const isContradiction = conn.semanticType === 'contradicts';
      const isDependency = conn.semanticType === 'depends_on';
      const strokeWidth = isContradiction ? 2.5 : conn.strength ? 1 + conn.strength * 1.5 : 1.2;
      const strokeColor = isContradiction 
        ? '#f43f5e' 
        : isDependency 
        ? '#8b5cf6' 
        : isLatentLayerActive 
        ? '#3b82f6' 
        : 'currentColor';

      return (
        <g key={conn.id} className="group/conn">
          <path
            d={pathData}
            fill="none"
            stroke="transparent"
            strokeWidth={16}
            className="cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteConnection(conn.id);
            }}
          />
          <path
            d={pathData}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={isContradiction ? '4,4' : conn.style === 'dashed' ? '3,3' : 'none'}
            markerEnd="url(#quiet-arrow)"
            className={`${
              isContradiction
                ? 'opacity-90'
                : 'text-zinc-600 dark:text-zinc-400 opacity-80 group-hover/conn:text-rose-500'
            } transition-colors`}
          />
          <circle
            cx={startX}
            cy={startY}
            r={strokeWidth * 1.2}
            fill={strokeColor}
            className="transition-colors group-hover/conn:fill-rose-500"
          />
          {conn.label && (
            <g transform={`translate(${midX}, ${midY})`}>
              <rect
                x="-30"
                y="-11"
                width="60"
                height="12"
                rx="3"
                className="fill-white/90 dark:fill-black/90 stroke-black/10 dark:stroke-white/10"
                strokeWidth="0.5"
              />
              <text
                x="0"
                y="-2"
                textAnchor="middle"
                className={`text-[8px] font-mono tracking-tight font-bold pointer-events-none select-none ${
                  isContradiction ? 'fill-rose-600 dark:fill-rose-400' : 'fill-zinc-600 dark:fill-zinc-300'
                }`}
              >
                {conn.label}
              </text>
            </g>
          )}
        </g>
      );
    });
  };

  // Connecting line in progress
  const renderActiveConnectingLine = () => {
    if (!connectingFromId || !connectionCurrentPos) return null;
    const fromCard = cards.find((c) => c.id === connectingFromId);
    if (!fromCard) return null;

    const startX = fromCard.x + fromCard.width;
    const startY = fromCard.y + fromCard.height / 2;
    const { x: endX, y: endY } = connectionCurrentPos;
    const midX = (startX + endX) / 2;

    const pathData = `M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`;

    return (
      <g>
        <path
          d={pathData}
          fill="none"
          stroke="#f97316"
          strokeWidth={1.5}
          strokeDasharray="3,3"
        />
        <circle cx={startX} cy={startY} r={2.5} fill="#f97316" />
        <circle cx={endX} cy={endY} r={2.5} fill="#f97316" />
      </g>
    );
  };

  // Find active card with ghost cards to show
  const activeGhostCard = cards.find(
    (c) => (c.id === hoveredCardId || c.id === selectedCardId) && c.type !== 'section'
  );
  const activeGhosts = activeGhostCard
    ? activeGhostCard.ghostCards || generateGhostCardsForCard(activeGhostCard)
    : [];

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative w-full h-full overflow-hidden select-none canvas-grid-dots ${
        activeTool === 'pan' || isDraggingCanvas ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
      }`}
      style={{
        backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
        backgroundPosition: `${panX}px ${panY}px`,
      }}
    >
      {/* File Drop Indicator Overlay */}
      {isDragOverFile && (
        <div className="absolute inset-0 z-50 pointer-events-none bg-orange-500/10 border-2 border-dashed border-orange-500 flex flex-col items-center justify-center backdrop-blur-xs">
          <UploadCloud className="w-10 h-10 text-orange-500 mb-2" />
          <p className="text-sm font-semibold tracking-wide text-orange-600 dark:text-orange-400">
            Drop files to automatically cluster & form relationships
          </p>
        </div>
      )}

      {/* Latent Computational Territory Overlays ("Space is Data") */}
      {isLatentLayerActive && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
          style={{
            transform: `translate3d(${panX}px, ${panY}px, 0) scale(${zoom})`,
            transformOrigin: '0 0',
            zIndex: 2,
          }}
        >
          {territories.map((territory) => (
            <g key={territory.id}>
              <circle
                cx={territory.centroidX}
                cy={territory.centroidY}
                r={territory.radius}
                fill="none"
                stroke="#f97316"
                strokeWidth={1.5}
                strokeDasharray="6,6"
                className="opacity-40 animate-pulse"
              />
              <circle
                cx={territory.centroidX}
                cy={territory.centroidY}
                r={territory.radius}
                className="fill-orange-500/[0.03]"
              />
              <text
                x={territory.centroidX}
                y={territory.centroidY - territory.radius - 8}
                textAnchor="middle"
                className="text-[11px] font-mono font-bold fill-orange-500 tracking-wider uppercase select-none"
              >
                Territory: {territory.title} ({territory.density} items)
              </text>
            </g>
          ))}
        </svg>
      )}

      {/* SVG Connections Layer */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
        style={{
          transform: `translate3d(${panX}px, ${panY}px, 0) scale(${zoom})`,
          transformOrigin: '0 0',
          zIndex: 5,
        }}
      >
        <defs>
          <marker
            id="quiet-arrow"
            markerWidth="6"
            markerHeight="6"
            refX="5"
            refY="3"
            orient="auto"
          >
            <path
              d="M 1 1 L 5 3 L 1 5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </marker>
        </defs>
        <g className="pointer-events-auto">
          {renderConnections()}
          {renderActiveConnectingLine()}

          {/* Dotted relation lines to active Ghost Cards */}
          {activeGhostCard && activeGhosts.map((ghost) => {
            const startX = activeGhostCard.x + activeGhostCard.width;
            const startY = activeGhostCard.y + activeGhostCard.height / 2;
            const endX = ghost.x;
            const endY = ghost.y + ghost.height / 2;
            const midX = (startX + endX) / 2;
            const pathData = `M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`;
            return (
              <g key={`ghost-line-${ghost.id}`}>
                <path
                  d={pathData}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={0.8}
                  strokeDasharray="2,3"
                  className="text-zinc-400 dark:text-zinc-600"
                />
              </g>
            );
          })}
        </g>
      </svg>

      {/* Cards Canvas Objects Layer */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          transform: `translate3d(${panX}px, ${panY}px, 0) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {/* Render Ghost Cards */}
        {activeGhostCard && activeGhosts.map((ghost) => (
          <div key={ghost.id} className="pointer-events-auto">
            <GhostCardNode
              ghost={ghost}
              sourceCardId={activeGhostCard.id}
              sourceCardWidth={activeGhostCard.width}
              sourceCardHeight={activeGhostCard.height}
              onMaterialize={handleMaterializeGhost}
            />
          </div>
        ))}

        {/* Regular Canvas Cards */}
        {cards.map((card) => (
          <div 
            key={card.id} 
            className="pointer-events-auto"
            onMouseEnter={() => setHoveredCardId(card.id)}
            onMouseLeave={() => setHoveredCardId(prev => prev === card.id ? null : prev)}
          >
            <CardNode
              card={card}
              zoom={zoom}
              isSelected={selectedCardId === card.id}
              isSpotlight={spotlightCardId === card.id}
              isConnecting={Boolean(connectingFromId)}
              onSelect={(e) => {
                e.stopPropagation();
                onSelectCard(card.id);
              }}
              onStartDrag={handleCardStartDrag}
              onStartResize={handleCardStartResize}
              onStartConnect={handleStartConnect}
              onEndConnect={handleEndConnect}
              onOpenDetail={onOpenDetail}
              onUpdateCard={onUpdateCard}
              onDeleteCard={onDeleteCard}
              onDuplicateCard={onDuplicateCard}
              onTextDrillDown={handleTextDrillDown}
              onLocationClick={handleLocationClick}
              onPredictiveAction={onPredictiveAction}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
