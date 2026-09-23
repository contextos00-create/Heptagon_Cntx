import React, { useRef, useEffect, useState, useCallback } from 'react';
import { SurfaceCard, Connection, CanvasTool, GhostCardData, EdgeRoutingMode } from '../types/surface';
import { CardNode } from './CardNode';
import { GhostCardNode } from './GhostCardNode';
import { UploadCloud, Layers, X, Info } from 'lucide-react';
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
import { routeOrthogonalEdgeWithObstacleAvoidance } from '../utils/orthogonalEdgeRouter';

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
  edgeRoutingMode?: EdgeRoutingMode;
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
  edgeRoutingMode = 'orthogonal-avoid',
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
  const [resizeDirection, setResizeDirection] = useState<'se' | 'e' | 's'>('se');
  const [resizeStart, setResizeStart] = useState({ mouseX: 0, mouseY: 0, initW: 0, initH: 0 });

  // Creating a Connection Line State
  const [connectingFromId, setConnectingFromId] = useState<string | null>(null);
  const [connectionCurrentPos, setConnectionCurrentPos] = useState<{ x: number; y: number } | null>(null);

  // Expandable Relationship Selection State
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [selectedConnPos, setSelectedConnPos] = useState<{ x: number; y: number } | null>(null);
  const [hoveredConnectionId, setHoveredConnectionId] = useState<string | null>(null);

  // File Drag-Over State for Ingesting
  const [isDragOverFile, setIsDragOverFile] = useState(false);

  // Mobile Touch Pan & Pinch-to-Zoom State
  const [touchState, setTouchState] = useState<{
    mode: 'none' | 'pan' | 'pinch';
    startX: number;
    startY: number;
    startPanX: number;
    startPanY: number;
    startDist: number;
    startZoom: number;
    pinchCenter: { x: number; y: number };
  }>({
    mode: 'none',
    startX: 0,
    startY: 0,
    startPanX: 0,
    startPanY: 0,
    startDist: 0,
    startZoom: 1,
    pinchCenter: { x: 0, y: 0 },
  });

  // Clamp pan coordinates so cards never completely drift off-screen leaving a white void
  const clampPan = useCallback(
    (targetPanX: number, targetPanY: number, targetZoom: number) => {
      if (!cards.length || !containerRef.current) return { x: targetPanX, y: targetPanY };
      const rect = containerRef.current.getBoundingClientRect();
      const winW = rect.width || window.innerWidth;
      const winH = rect.height || window.innerHeight;

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      cards.forEach((c) => {
        minX = Math.min(minX, c.x);
        minY = Math.min(minY, c.y);
        maxX = Math.max(maxX, c.x + c.width);
        maxY = Math.max(maxY, c.y + c.height);
      });

      // Maintain visible presence of cards inside viewport (at least 80px overlap)
      const minPanX = 80 - maxX * targetZoom;
      const maxPanX = winW - 80 - minX * targetZoom;
      const minPanY = 80 - maxY * targetZoom;
      const maxPanY = winH - 80 - minY * targetZoom;

      // If content bounds are smaller than screen, allow centered leeway
      return {
        x: Math.max(minPanX, Math.min(maxPanX, targetPanX)),
        y: Math.max(minPanY, Math.min(maxPanY, targetPanY)),
      };
    },
    [cards]
  );

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

  // Zooming with focal point tracking & safe mobile minimum zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;

    const isMobile = window.innerWidth < 768;
    const minAllowedZoom = isMobile ? 0.45 : 0.18;

    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.909;
    const newZoom = Math.min(2.5, Math.max(minAllowedZoom, zoom * zoomFactor));

    const rawPanX = mouseX - (mouseX - panX) * (newZoom / zoom);
    const rawPanY = mouseY - (mouseY - panY) * (newZoom / zoom);
    const clamped = clampPan(rawPanX, rawPanY, newZoom);

    onUpdateViewState({
      panX: clamped.x,
      panY: clamped.y,
      zoom: newZoom,
    });
  };

  // Touch handlers for mobile pan & pinch-to-zoom
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      setTouchState({
        mode: 'pan',
        startX: t.clientX,
        startY: t.clientY,
        startPanX: panX,
        startPanY: panY,
        startDist: 0,
        startZoom: zoom,
        pinchCenter: { x: t.clientX, y: t.clientY },
      });
      onSelectCard(undefined);
      setSelectedConnectionId(null);
      setSelectedConnPos(null);
    } else if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const center = {
        x: (t1.clientX + t2.clientX) / 2,
        y: (t1.clientY + t2.clientY) / 2,
      };
      setTouchState({
        mode: 'pinch',
        startX: 0,
        startY: 0,
        startPanX: panX,
        startPanY: panY,
        startDist: dist,
        startZoom: zoom,
        pinchCenter: center,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchState.mode === 'pan' && e.touches.length === 1) {
      const t = e.touches[0];
      const deltaX = t.clientX - touchState.startX;
      const deltaY = t.clientY - touchState.startY;
      const clamped = clampPan(touchState.startPanX + deltaX, touchState.startPanY + deltaY, zoom);
      onUpdateViewState({
        panX: clamped.x,
        panY: clamped.y,
        zoom,
      });
    } else if (touchState.mode === 'pinch' && e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      if (touchState.startDist > 0) {
        const scaleFactor = dist / touchState.startDist;
        const isMobile = window.innerWidth < 768;
        const minAllowedZoom = isMobile ? 0.45 : 0.18;
        const newZoom = Math.min(2.5, Math.max(minAllowedZoom, touchState.startZoom * scaleFactor));

        const rect = containerRef.current?.getBoundingClientRect();
        const mouseX = touchState.pinchCenter.x - (rect?.left || 0);
        const mouseY = touchState.pinchCenter.y - (rect?.top || 0);

        const rawPanX = mouseX - (mouseX - touchState.startPanX) * (newZoom / touchState.startZoom);
        const rawPanY = mouseY - (mouseY - touchState.startPanY) * (newZoom / touchState.startZoom);
        const clamped = clampPan(rawPanX, rawPanY, newZoom);

        onUpdateViewState({
          panX: clamped.x,
          panY: clamped.y,
          zoom: newZoom,
        });
      }
    }
  };

  const handleTouchEnd = () => {
    setTouchState((prev) => ({ ...prev, mode: 'none' }));
  };

  // Canvas Mouse Down
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || activeTool === 'pan' || isSpacePressedRef.current || e.target === containerRef.current) {
      setIsDraggingCanvas(true);
      setDragStart({ x: e.clientX - panX, y: e.clientY - panY });
      onSelectCard(undefined);
      setSelectedConnectionId(null);
      setSelectedConnPos(null);
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
  const handleCardStartResize = (e: React.MouseEvent, cardId: string, direction: 'se' | 'e' | 's' = 'se') => {
    e.stopPropagation();
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;

    setResizingCardId(cardId);
    setResizeDirection(direction);
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
      let newW = resizeStart.initW;
      let newH = resizeStart.initH;

      if (resizeDirection === 'se' || resizeDirection === 'e') {
        newW = Math.max(200, Math.round(resizeStart.initW + deltaX));
      }
      if (resizeDirection === 'se' || resizeDirection === 's') {
        newH = Math.max(100, Math.round(resizeStart.initH + deltaY));
      }

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

      let pathData = '';
      let dotX = 0;
      let dotY = 0;
      let labelX = 0;
      let labelY = 0;

      if (edgeRoutingMode === 'orthogonal-avoid') {
        const routed = routeOrthogonalEdgeWithObstacleAvoidance(fromCard, toCard, cards, 14);
        pathData = routed.pathData;
        dotX = routed.startPoint.x;
        dotY = routed.startPoint.y;
        labelX = routed.midPoint.x;
        labelY = routed.midPoint.y;
      } else if (edgeRoutingMode === 'direct-straight') {
        const startX = fromCard.x + fromCard.width;
        const startY = fromCard.y + fromCard.height / 2;
        const endX = toCard.x;
        const endY = toCard.y + toCard.height / 2;
        pathData = `M ${startX} ${startY} L ${endX} ${endY}`;
        dotX = startX;
        dotY = startY;
        labelX = (startX + endX) / 2;
        labelY = (startY + endY) / 2;
      } else {
        // Curved S-Spline
        const startX = fromCard.x + fromCard.width;
        const startY = fromCard.y + fromCard.height / 2;
        const endX = toCard.x;
        const endY = toCard.y + toCard.height / 2;
        const r = 8;
        const midX = (startX + endX) / 2;
        const midY = (startY + endY) / 2;
        dotX = startX;
        dotY = startY;
        labelX = midX;
        labelY = midY;

        if (Math.abs(startY - endY) < 4 || Math.abs(startX - endX) < 4) {
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
      }

      // Visual grammar: stroke weight & style communicate semantic relation & confidence
      const isContradiction = conn.semanticType === 'contradicts';
      const isDependency = conn.semanticType === 'depends_on';
      const isSelectedConn = selectedConnectionId === conn.id;
      const isHoveredConn = hoveredConnectionId === conn.id;

      const strokeWidth = isSelectedConn 
        ? 2.6 
        : isContradiction 
        ? 2.2 
        : conn.strength 
        ? 1 + conn.strength * 1.5 
        : 1.2;

      const strokeColor = isSelectedConn
        ? '#ea580c'
        : isContradiction 
        ? '#f43f5e' 
        : isDependency 
        ? '#8b5cf6' 
        : isLatentLayerActive 
        ? '#3b82f6' 
        : '#71717a';

      const shouldShowMicroLabel = isSelectedConn || isHoveredConn || isContradiction || (zoom >= 0.7 && Boolean(conn.label));

      return (
        <g 
          key={conn.id} 
          className="group/conn"
          onMouseEnter={() => setHoveredConnectionId(conn.id)}
          onMouseLeave={() => setHoveredConnectionId(prev => prev === conn.id ? null : prev)}
        >
          {/* Thick invisible hitbox for easy clicking */}
          <path
            d={pathData}
            fill="none"
            stroke="transparent"
            strokeWidth={20}
            className="cursor-pointer pointer-events-auto"
            onClick={(e) => {
              e.stopPropagation();
              if (selectedConnectionId === conn.id) {
                setSelectedConnectionId(null);
                setSelectedConnPos(null);
              } else {
                setSelectedConnectionId(conn.id);
                setSelectedConnPos({ x: labelX, y: labelY });
              }
            }}
          />
          {/* Visual stroke */}
          <path
            d={pathData}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={isContradiction ? '4,4' : conn.style === 'dashed' ? '3,3' : 'none'}
            markerEnd="url(#quiet-arrow)"
            className={`${
              isSelectedConn
                ? 'opacity-100 filter drop-shadow-[0_0_3px_rgba(234,88,12,0.4)]'
                : isContradiction
                ? 'opacity-90'
                : 'opacity-70 group-hover/conn:opacity-100 group-hover/conn:stroke-orange-500'
            } transition-all duration-150`}
          />
          {/* Endpoint origin dot */}
          <circle
            cx={dotX}
            cy={dotY}
            r={strokeWidth * 1.2}
            fill={strokeColor}
            className="transition-colors group-hover/conn:fill-orange-500"
          />

          {/* Micro-label: Tiny contextual label along relationship that appears only when useful */}
          {shouldShowMicroLabel && (
            <g 
              transform={`translate(${labelX}, ${labelY})`}
              className="pointer-events-none select-none animate-in fade-in zoom-in-95 duration-100"
            >
              <rect
                x="-32"
                y="-9"
                width="64"
                height="16"
                rx="3"
                className="fill-white/95 dark:fill-[#18191e]/95 stroke-zinc-400 dark:stroke-zinc-600 shadow-xs"
                strokeWidth="0.8"
              />
              <text
                x="0"
                y="0"
                textAnchor="middle"
                dominantBaseline="middle"
                className={`text-[8px] font-mono tracking-wider font-semibold uppercase ${
                  isSelectedConn
                    ? 'fill-orange-600 dark:fill-orange-400'
                    : isContradiction
                    ? 'fill-rose-600 dark:fill-rose-400'
                    : 'fill-zinc-700 dark:fill-zinc-300'
                }`}
              >
                {conn.label || (conn.semanticType ? conn.semanticType.replace('_', ' ') : 'REL')}
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
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative w-full h-full overflow-hidden select-none touch-none canvas-grid-dots ${
        activeTool === 'pan' || isDraggingCanvas || touchState.mode === 'pan' ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
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
              isResizingThisCard={resizingCardId === card.id}
            />
          </div>
        ))}
      </div>

      {/* EXPANDABLE RELATIONSHIP INSPECTOR */}
      {(() => {
        const selectedConn = connections.find((c) => c.id === selectedConnectionId);
        if (!selectedConn || !selectedConnPos) return null;
        const fromCard = cards.find((c) => c.id === selectedConn.fromId);
        const toCard = cards.find((c) => c.id === selectedConn.toId);
        if (!fromCard || !toCard) return null;

        return (
          <div
            style={{
              position: 'absolute',
              left: `${selectedConnPos.x * zoom + panX}px`,
              top: `${selectedConnPos.y * zoom + panY}px`,
              transform: 'translate(-50%, -100%) translateY(-14px)',
              zIndex: 60,
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-72 bg-white/98 dark:bg-[#16171b]/98 backdrop-blur-md border border-zinc-300 dark:border-zinc-700 rounded-lg shadow-2xl p-3 text-zinc-900 dark:text-zinc-100 animate-in fade-in zoom-in-95 duration-150 select-none text-xs pointer-events-auto"
          >
            {/* Header with from -> to and close button */}
            <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-500 truncate">
                <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate max-w-[90px]">
                  {fromCard.title}
                </span>
                <span>→</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate max-w-[90px]">
                  {toCard.title}
                </span>
              </div>
              <button
                onClick={() => {
                  setSelectedConnectionId(null);
                  setSelectedConnPos(null);
                }}
                className="p-0.5 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Relationship Details */}
            <div className="py-2 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">Semantic Type</span>
                <span className="px-1.5 py-0.2 rounded font-mono text-[9px] font-bold uppercase bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                  {(selectedConn.semanticType || 'relates_to').replace('_', ' ')}
                </span>
              </div>

              {/* Strength / Confidence meter */}
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-zinc-400">Strength / Confidence</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {selectedConn.confidence || 88}%
                </span>
              </div>
              <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${selectedConn.confidence || 88}%` }}
                />
              </div>

              {/* Evidence & Reasoning */}
              <div className="pt-1">
                <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-0.5">
                  Evidence & Context
                </div>
                <p className="text-[11px] text-zinc-700 dark:text-zinc-300 leading-snug font-sans bg-zinc-50 dark:bg-black/40 rounded p-1.5 border border-zinc-200 dark:border-zinc-800">
                  {selectedConn.evidenceSnippet ||
                    selectedConn.reasoning ||
                    'Direct architectural dependency established via shared consensus and telemetry replication.'}
                </p>
              </div>

              {/* History & Source */}
              <div className="text-[9px] font-mono text-zinc-400 flex items-center justify-between pt-0.5">
                <span>Origin</span>
                <span className="truncate max-w-[170px]">
                  {selectedConn.history || 'Inferred from graph topology'}
                </span>
              </div>
            </div>

            {/* Quick Action Footer */}
            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-[10px]">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    onDeleteConnection(selectedConn.id);
                    onAddConnection({
                      fromId: selectedConn.toId,
                      toId: selectedConn.fromId,
                      label: selectedConn.label,
                      style: selectedConn.style,
                      semanticType: selectedConn.semanticType,
                      confidence: selectedConn.confidence,
                      evidenceSnippet: selectedConn.evidenceSnippet,
                    });
                    setSelectedConnectionId(null);
                    setSelectedConnPos(null);
                  }}
                  className="px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 font-mono text-[9px] text-zinc-700 dark:text-zinc-300 transition-colors"
                  title="Reverse connection direction"
                >
                  ⇄ Reverse
                </button>

                <button
                  onClick={() => {
                    const newStyle = selectedConn.style === 'dashed' ? 'solid' : 'dashed';
                    onDeleteConnection(selectedConn.id);
                    onAddConnection({
                      ...selectedConn,
                      style: newStyle,
                    });
                    setSelectedConnectionId(null);
                    setSelectedConnPos(null);
                  }}
                  className="px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 font-mono text-[9px] text-zinc-700 dark:text-zinc-300 transition-colors"
                >
                  {selectedConn.style === 'dashed' ? 'Solid' : 'Dashed'}
                </button>
              </div>

              <button
                onClick={() => {
                  onDeleteConnection(selectedConn.id);
                  setSelectedConnectionId(null);
                  setSelectedConnPos(null);
                }}
                className="px-2 py-1 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 font-medium text-[10px] transition-colors"
              >
                Delete Link
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
