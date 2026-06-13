"use client";

import { useEffect, useState, use, useMemo, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { Loader2, AlertCircle, Brain, ArrowLeft, Maximize2, Minimize2 } from "lucide-react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  type Node,
  type Edge,
  type NodeProps,
  Position,
  MarkerType,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";

// ---------- Types ----------

interface GraphNode {
  id: string;
  label: string;
  type: string;
  mastery: string;
  description: string;
}

interface GraphEdge {
  source: string;
  target: string;
  label: string;
}

interface GraphResult {
  centralTopic: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ---------- Stitch Design Tokens ----------

const stitchColors = {
  bg: "#f8f9ff",
  surface: "#ffffff",
  primary: "#004ac6",
  primaryLight: "#dbe1ff",
  secondary: "#b5005d",
  tertiary: "#006243",
  onSurface: "#121c2a",
  onSurfaceVariant: "#434655",
  outline: "#c3c6d7",
};

const branchPalette = [
  { bg: "#fef3c7", border: "#f59e0b", text: "#92400e", accent: "#fbbf24" },
  { bg: "#dbeafe", border: "#3b82f6", text: "#1e40af", accent: "#60a5fa" },
  { bg: "#dcfce7", border: "#22c55e", text: "#166534", accent: "#4ade80" },
  { bg: "#fce7f3", border: "#ec4899", text: "#9d174d", accent: "#f472b6" },
  { bg: "#ede9fe", border: "#8b5cf6", text: "#5b21b6", accent: "#a78bfa" },
  { bg: "#cffafe", border: "#06b6d4", text: "#155e75", accent: "#22d3ee" },
  { bg: "#fee2e2", border: "#ef4444", text: "#991b1b", accent: "#f87171" },
  { bg: "#ffedd5", border: "#f97316", text: "#9a3412", accent: "#fb923c" },
];

const masteryConfig: Record<string, { shadow: string; badge: string }> = {
  weak: { shadow: "0 0 0 3px #fca5a5", badge: "#ef4444" },
  learning: { shadow: "0 0 0 3px #93c5fd", badge: "#3b82f6" },
  mastered: { shadow: "", badge: "#22c55e" },
};

// ---------- Dagre Layout ----------

const NODE_DIMS: Record<string, { w: number; h: number }> = {
  central: { w: 180, h: 90 },
  concept: { w: 190, h: 60 },
  subtopic: { w: 170, h: 50 },
  detail: { w: 150, h: 44 },
};

function dagreLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  childrenMap: Record<string, string[]>,
  expandedIds: Set<string>
): Record<string, { x: number; y: number }> {
  // Only layout visible nodes
  const visible = new Set<string>();
  const queue = ["central"];
  while (queue.length > 0) {
    const id = queue.shift()!;
    visible.add(id);
    if (expandedIds.has(id)) {
      for (const child of childrenMap[id] || []) {
        if (!visible.has(child)) queue.push(child);
      }
    }
  }

  const visibleEdges = edges.filter((e) => visible.has(e.source) && visible.has(e.target));

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 30, ranksep: 60, marginx: 40, marginy: 40 });

  for (const n of nodes) {
    if (!visible.has(n.id)) continue;
    const dim = NODE_DIMS[n.type] || NODE_DIMS.detail;
    g.setNode(n.id, { width: dim.w, height: dim.h });
  }

  for (const e of visibleEdges) {
    g.setEdge(e.source, e.target);
  }

  dagre.layout(g);

  const positions: Record<string, { x: number; y: number }> = {};
  for (const n of nodes) {
    if (!visible.has(n.id)) continue;
    const node = g.node(n.id);
    if (!node) continue;
    const dim = NODE_DIMS[n.type] || NODE_DIMS.detail;
    positions[n.id] = { x: node.x - dim.w / 2, y: node.y - dim.h / 2 };
  }

  return positions;
}

// ---------- Helpers ----------

function buildChildrenMap(edges: GraphEdge[]): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const e of edges) {
    if (!map[e.source]) map[e.source] = [];
    map[e.source].push(e.target);
  }
  return map;
}

// ---------- Custom Node with Hover Tooltip (Portal) ----------

function MindMapNode({ id, data }: NodeProps) {
  const [hovered, setHovered] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const nodeRef = useRef<HTMLDivElement>(null);

  const nodeData = data as {
    label: string;
    mastery: string;
    type: string;
    description?: string;
    canExpand?: boolean;
    childCount?: number;
    isCentral?: boolean;
    colors?: { bg: string; border: string; text: string; accent: string };
  };

  const tooltipW = 340; // maxWidth
  const tooltipH = 150; // approximate

  const updateTooltipPos = () => {
    if (!nodeRef.current) return;
    const rect = nodeRef.current.getBoundingClientRect();
    let x = rect.left + rect.width / 2;
    let y = rect.bottom + 8;

    // Keep within viewport
    if (x + tooltipW / 2 > window.innerWidth - 16) x = window.innerWidth - tooltipW / 2 - 16;
    if (x - tooltipW / 2 < 16) x = tooltipW / 2 + 16;
    // If tooltip would go below viewport, show above node instead
    if (y + tooltipH > window.innerHeight - 16) {
      y = rect.top - tooltipH - 8;
    }

    setTooltipPos({ x, y });
  };

  const handleMouseEnter = () => {
    updateTooltipPos();
    setHovered(true);
  };

  const handleMouseLeave = () => {
    setHovered(false);
  };

  const masteryBadge = nodeData.mastery === "weak" ? "#ef4444"
    : nodeData.mastery === "learning" ? "#3b82f6"
    : nodeData.mastery === "mastered" ? "#22c55e"
    : null;

  const tooltip = hovered && nodeData.description && createPortal(
    <div
      className="animate-fade-in"
      style={{
        position: "fixed",
        left: tooltipPos.x,
        top: tooltipPos.y,
        transform: "translateX(-50%)",
        zIndex: 99999,
        pointerEvents: "none",
      }}
    >
      <div
        className="rounded-xl shadow-2xl border border-gray-200 text-left"
        style={{
          background: "#fff",
          minWidth: 240,
          maxWidth: 340,
          padding: "14px 18px",
          fontSize: 13,
          lineHeight: 1.5,
          color: "#374151",
        }}
      >
        {/* Arrow */}
        <div
          style={{
            position: "absolute",
            top: -6,
            left: "50%",
            transform: "translateX(-50%) rotate(45deg)",
            width: 12,
            height: 12,
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRight: "none",
            borderBottom: "none",
          }}
        />
        <p className="font-semibold text-gray-900 mb-1">{nodeData.label}</p>
        <p className="text-gray-600 text-xs leading-relaxed">{nodeData.description}</p>
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100">
          {masteryBadge && (
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: `${masteryBadge}15`, color: masteryBadge }}
            >
              {nodeData.mastery === "weak" ? "Cần ôn tập" : nodeData.mastery === "learning" ? "Đang học" : "Thành thạo"}
            </span>
          )}
          <span className="text-xs text-gray-400">
            {nodeData.type === "concept" ? "Nhánh chính" : nodeData.type === "subtopic" ? "Ý phụ" : "Chi tiết"}
          </span>
        </div>
      </div>
    </div>,
    document.body
  );

  return (
    <div
      ref={nodeRef}
      className="mindmap-node"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Handle type="target" position={Position.Left} style={{ visibility: "hidden" }} />
      <div className="node-content">{nodeData.label}</div>
      {nodeData.canExpand && (
        <span className="text-[10px] opacity-60 mt-0.5 block">+{nodeData.childCount}</span>
      )}
      <Handle type="source" position={Position.Right} style={{ visibility: "hidden" }} />
      {tooltip}
    </div>
  );
}

const nodeTypes = { mindmap: MindMapNode };

// ---------- Page Component ----------

export default function MindMapDetailPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = use(params);
  const [result, setResult] = useState<GraphResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(["central"]));

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<Node>([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);

  const childrenMap = useMemo(() => (result ? buildChildrenMap(result.edges) : {}), [result]);

  // Compute visible nodes
  const visibleNodeIds = useMemo(() => {
    const visible = new Set<string>();
    const q = ["central"];
    while (q.length > 0) {
      const id = q.shift()!;
      visible.add(id);
      if (expandedIds.has(id)) {
        for (const child of childrenMap[id] || []) {
          if (!visible.has(child)) q.push(child);
        }
      }
    }
    return visible;
  }, [expandedIds, childrenMap]);

  // Branch color assignment
  const branchColorMap = useMemo(() => {
    if (!result) return {};
    const map: Record<string, number> = {};
    const mainBranches = (childrenMap["central"] || []).filter((id) => result.nodes.some((n) => n.id === id));
    mainBranches.forEach((id, i) => {
      map[id] = i;
      const q = [...(childrenMap[id] || [])];
      while (q.length > 0) {
        const child = q.shift()!;
        map[child] = i;
        q.push(...(childrenMap[child] || []));
      }
    });
    return map;
  }, [result, childrenMap]);

  // Dagre layout (recomputed on expand/collapse)
  const nodePositions = useMemo(
    () => (result ? dagreLayout(result.nodes, result.edges, childrenMap, expandedIds) : {}),
    [result, childrenMap, expandedIds]
  );

  // Toggle expand/collapse
  const toggleNode = useCallback(
    (nodeId: string) => {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        if (next.has(nodeId)) {
          const toRemove = new Set<string>();
          const q = [...(childrenMap[nodeId] || [])];
          while (q.length > 0) {
            const id = q.shift()!;
            toRemove.add(id);
            q.push(...(childrenMap[id] || []));
          }
          next.delete(nodeId);
          for (const id of toRemove) next.delete(id);
        } else {
          next.add(nodeId);
        }
        return next;
      });
    },
    [childrenMap]
  );

  // Fetch data
  const fetchMindMap = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<GraphResult>("/api/ai/mindmap", {
        method: "POST",
        body: JSON.stringify({ lessonId, refresh }),
        timeout: 120000,
      });
      setResult(data);
      setExpandedIds(new Set(["central"]));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Không thể tạo sơ đồ tư duy");
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

  useEffect(() => {
    fetchMindMap();
  }, [fetchMindMap]);

  // Build React Flow nodes/edges
  useEffect(() => {
    if (!result) return;

    const visibleNodes = result.nodes.filter((n) => visibleNodeIds.has(n.id));
    const visibleEdges = result.edges.filter((e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target));

    const nodes: Node[] = visibleNodes.map((n) => {
      const pos = nodePositions[n.id] || { x: 0, y: 0 };
      const isCentral = n.id === "central";
      const branchIdx = branchColorMap[n.id] ?? 0;
      const colors = branchPalette[branchIdx % branchPalette.length];
      const hasChildren = (childrenMap[n.id] || []).length > 0;
      const isExpanded = expandedIds.has(n.id);
      const canExpand = hasChildren && !isExpanded;
      const dim = NODE_DIMS[n.type] || NODE_DIMS.detail;

      return {
        id: n.id,
        position: pos,
        data: {
          label: n.label,
          mastery: n.mastery,
          type: n.type,
          description: n.description,
          canExpand,
          childCount: hasChildren ? childrenMap[n.id].length : 0,
          isCentral,
          colors,
          dim,
        },
        type: "mindmap",
        style: {
          width: dim.w,
          background: isCentral
            ? `linear-gradient(135deg, ${stitchColors.primary}, #3b82f6)`
            : colors.bg,
          border: `2px solid ${isCentral ? stitchColors.primary : canExpand ? colors.accent : stitchColors.outline}`,
          borderStyle: canExpand ? "dashed" : "solid",
          borderRadius: isCentral ? 24 : 16,
          padding: isCentral ? "16px 20px" : "10px 16px",
          fontSize: isCentral ? 15 : n.type === "concept" ? 13 : 12,
          fontWeight: isCentral ? 700 : n.type === "concept" ? 600 : 500,
          color: isCentral ? "#fff" : colors.text,
          textAlign: "center" as const,
          boxShadow: isCentral
            ? "0 4px 12px rgba(37,99,235,0.3)"
            : masteryConfig[n.mastery]?.shadow || "",
          lineHeight: 1.35,
          cursor: "pointer",
          transition: "all 0.2s ease",
          wordBreak: "break-word" as const,
          overflowWrap: "break-word" as const,
          whiteSpace: "normal" as const,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      };
    });

    const edges: Edge[] = visibleEdges.map((e, i) => ({
      id: `e${i}`,
      source: e.source,
      target: e.target,
      label: e.label || undefined,
      type: "smoothstep",
      animated: false,
      style: { stroke: stitchColors.outline, strokeWidth: 2 },
      labelStyle: { fontSize: 10, fill: "#94a3b8", fontWeight: 500 },
      labelBgStyle: { fill: stitchColors.surface, fillOpacity: 0.95 },
      markerEnd: { type: MarkerType.ArrowClosed, color: stitchColors.outline, width: 16, height: 16 },
      pathOptions: { borderRadius: 16 },
    }));

    setRfNodes(nodes);
    setRfEdges(edges);

    const timer = setTimeout(() => {
      rfInstance?.fitView({ padding: 0.25, duration: 400, maxZoom: 1.5 });
    }, 200);
    return () => clearTimeout(timer);
  }, [result, visibleNodeIds, expandedIds, nodePositions, branchColorMap, childrenMap, setRfNodes, setRfEdges, rfInstance]);

  const handleNodeClick = useCallback(
    (_: unknown, node: Node) => {
      const hasKids = (childrenMap[node.id] || []).length > 0;
      if (hasKids) toggleNode(node.id);
    },
    [childrenMap, toggleNode]
  );

  const expandAll = useCallback(() => {
    if (!result) return;
    setExpandedIds(new Set(result.nodes.map((n) => n.id)));
  }, [result]);

  const collapseAll = useCallback(() => {
    setExpandedIds(new Set(["central"]));
  }, []);

  const allExpanded = result && expandedIds.size >= result.nodes.length;
  const visibleCount = visibleNodeIds.size;

  // ---- Loading ----
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <Loader2 className="size-8 text-blue-500 animate-spin mb-4" />
        <p className="text-gray-500">Đang tạo sơ đồ tư duy...</p>
        <p className="text-sm text-gray-400 mt-1">AI đang phân tích nội dung bài học</p>
      </div>
    );
  }

  // ---- Error ----
  if (error) {
    return (
      <div className="flex flex-col items-center py-20">
        <AlertCircle className="size-16 text-red-200 mb-5" />
        <p className="text-lg font-semibold text-gray-500">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          Thử lại
        </button>
      </div>
    );
  }

  // ---- Empty ----
  if (!result || result.nodes.length === 0) {
    return (
      <div className="text-center py-20">
        <Brain className="size-16 text-gray-200 mx-auto mb-5" />
        <p className="text-lg font-semibold text-gray-500">Không thể tạo sơ đồ tư duy cho bài học này</p>
        <p className="text-sm text-gray-400 mt-1">Hãy thử bài học khác có nội dung chi tiết hơn</p>
      </div>
    );
  }

  // ---- Main UI ----
  return (
    <div className="space-y-3 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="min-w-0">
          <Link href="/mindmap" className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-1">
            <ArrowLeft className="size-3" />
            Quay lại
          </Link>
          <h1 className="text-xl font-bold text-gray-900 truncate">{result.centralTopic}</h1>
          <p className="text-sm text-gray-500">
            {visibleCount}/{result.nodes.length} khái niệm · {result.edges.length} liên kết · AI tạo
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {/* Legend */}
          <div className="hidden sm:flex items-center gap-3 text-xs text-gray-400">
            {[
              { label: "Yếu", color: "bg-red-500" },
              { label: "Đang học", color: "bg-blue-500" },
              { label: "Thành thạo", color: "bg-green-500" },
            ].map((l) => (
              <span key={l.label} className="flex items-center gap-1">
                <span className={`size-2.5 rounded-full ${l.color}`} /> {l.label}
              </span>
            ))}
          </div>
          {/* Expand/Collapse */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => fetchMindMap(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
              disabled={loading}
            >
              {loading ? <Loader2 className="size-3 animate-spin" /> : null}
              Làm mới
            </button>
            {allExpanded ? (
              <button onClick={collapseAll} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-500 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
                <Minimize2 className="size-3" /> Thu gọn
              </button>
            ) : (
              <button onClick={expandAll} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-500 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
                <Maximize2 className="size-3" /> Mở rộng hết
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Graph Container */}
      <div className="h-[650px] rounded-2xl border border-gray-200 bg-gradient-to-br from-slate-50 to-blue-50/20 overflow-hidden relative">
        {visibleCount <= 1 && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none text-center">
            <p className="text-sm text-gray-400">Nhấn vào nút trung tâm để khám phá</p>
          </div>
        )}
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          onInit={setRfInstance}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.25, maxZoom: 1.5 }}
          minZoom={0.15}
          maxZoom={2.5}
          attributionPosition="bottom-right"
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#e2e8f0" gap={24} size={0.8} />
          <Controls showInteractive={false} className="!rounded-xl !border !border-gray-200 !shadow-sm" />
          <MiniMap
            nodeColor={(n) => {
              const m = n.data?.mastery as string;
              return m === "weak" ? "#ef4444" : m === "learning" ? "#3b82f6" : "#22c55e";
            }}
            maskColor="rgba(248,249,255,0.7)"
            style={{ background: stitchColors.surface, borderRadius: 12, border: "1px solid #e5e7eb" }}
          />
        </ReactFlow>
      </div>

    </div>
  );
}
