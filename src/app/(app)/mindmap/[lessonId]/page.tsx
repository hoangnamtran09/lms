"use client";

import { useEffect, useState, use, useMemo, useCallback } from "react";
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
  type Node,
  type Edge,
  Position,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

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

const branchPalette = [
  { bg: "#fef3c7", border: "#f59e0b", text: "#92400e" },
  { bg: "#dbeafe", border: "#3b82f6", text: "#1e40af" },
  { bg: "#dcfce7", border: "#22c55e", text: "#166534" },
  { bg: "#fce7f3", border: "#ec4899", text: "#9d174d" },
  { bg: "#ede9fe", border: "#8b5cf6", text: "#5b21b6" },
  { bg: "#cffafe", border: "#06b6d4", text: "#155e75" },
  { bg: "#fee2e2", border: "#ef4444", text: "#991b1b" },
  { bg: "#ffedd5", border: "#f97316", text: "#9a3412" },
];

const masteryShadow: Record<string, string> = {
  weak: "0 0 0 3px #ef4444",
  learning: "0 0 0 3px #3b82f6",
  mastered: "",
};

// Pre-compute positions for ALL nodes once
function precomputePositions(result: GraphResult): Record<string, { x: number; y: number }> {
  const central = { x: 500, y: 350 };
  const positions: Record<string, { x: number; y: number }> = { central };

  // Build adjacency
  const parentMap: Record<string, string> = {};
  const childrenMap: Record<string, string[]> = {};
  for (const e of result.edges) {
    parentMap[e.target] = e.source;
    if (!childrenMap[e.source]) childrenMap[e.source] = [];
    childrenMap[e.source].push(e.target);
  }

  const mainBranches = (childrenMap["central"] || []).filter((id) =>
    result.nodes.some((n) => n.id === id)
  );
  const numBranches = mainBranches.length || 1;

  // Position main branches around center
  const mainRadius = 220;
  mainBranches.forEach((id, i) => {
    const angle = (i / numBranches) * 2 * Math.PI - Math.PI / 2;
    positions[id] = {
      x: central.x + Math.cos(angle) * mainRadius,
      y: central.y + Math.sin(angle) * mainRadius,
    };
  });

  // Recursively fan out children
  function layoutDescendants(parentId: string) {
    const kids = childrenMap[parentId];
    if (!kids || kids.length === 0) return;
    const parentPos = positions[parentId];
    if (!parentPos) return;

    const dx = parentPos.x - central.x;
    const dy = parentPos.y - central.y;
    const distToCenter = Math.sqrt(dx * dx + dy * dy);
    const parentAngle = Math.atan2(dy, dx);

    kids.forEach((childId, i) => {
      if (positions[childId]) return; // already positioned
      const fanAngle = parentAngle + (i - (kids.length - 1) / 2) * 0.35;
      const childDist = distToCenter + 130;
      positions[childId] = {
        x: central.x + Math.cos(fanAngle) * childDist,
        y: central.y + Math.sin(fanAngle) * childDist,
      };
      layoutDescendants(childId);
    });
  }

  mainBranches.forEach((id) => layoutDescendants(id));

  // Fill any remaining unpositioned nodes
  for (const n of result.nodes) {
    if (!positions[n.id]) {
      positions[n.id] = { x: central.x + 300, y: central.y };
    }
  }

  return positions;
}

// Build children map from edges
function buildChildrenMap(edges: GraphEdge[]): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const e of edges) {
    if (!map[e.source]) map[e.source] = [];
    map[e.source].push(e.target);
  }
  return map;
}

export default function MindMapDetailPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = use(params);
  const [result, setResult] = useState<GraphResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(["central"]));

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<Node>([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Build children map from result
  const childrenMap = useMemo(
    () => (result ? buildChildrenMap(result.edges) : {}),
    [result]
  );

  // Pre-compute all node positions
  const nodePositions = useMemo(
    () => (result ? precomputePositions(result) : {}),
    [result]
  );

  // Build branch color map
  const branchColorMap = useMemo(() => {
    if (!result) return {};
    const map: Record<string, number> = {};
    const mainBranches = (childrenMap["central"] || []).filter((id) =>
      result.nodes.some((n) => n.id === id)
    );
    mainBranches.forEach((id, i) => {
      map[id] = i;
      // Propagate to descendants
      const queue = [...(childrenMap[id] || [])];
      while (queue.length > 0) {
        const child = queue.shift()!;
        map[child] = i;
        queue.push(...(childrenMap[child] || []));
      }
    });
    return map;
  }, [result, childrenMap]);

  // Compute which nodes are visible based on expandedIds
  const visibleNodeIds = useMemo(() => {
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
    return visible;
  }, [expandedIds, childrenMap]);

  // Toggle node expansion
  const toggleNode = useCallback(
    (nodeId: string) => {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        if (next.has(nodeId)) {
          // Collapse: remove this node and all descendants
          const toRemove = new Set<string>();
          const queue = [...(childrenMap[nodeId] || [])];
          while (queue.length > 0) {
            const id = queue.shift()!;
            toRemove.add(id);
            queue.push(...(childrenMap[id] || []));
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
  useEffect(() => {
    let cancelled = false;
    async function fetchMindMap() {
      try {
        const data = await api<GraphResult>("/api/ai/mindmap", {
          method: "POST",
          body: JSON.stringify({ lessonId }),
        });
        if (!cancelled) {
          setResult(data);
          setExpandedIds(new Set(["central"]));
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Không thể tạo sơ đồ tư duy");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchMindMap();
    return () => { cancelled = true; };
  }, [lessonId]);

  // Rebuild React Flow nodes/edges when visibility changes
  useEffect(() => {
    if (!result) return;

    const visibleNodes = result.nodes.filter((n) => visibleNodeIds.has(n.id));
    const visibleEdges = result.edges.filter(
      (e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)
    );

    const nodes: Node[] = visibleNodes.map((n) => {
      const pos = nodePositions[n.id] || { x: 500, y: 350 };
      const isCentral = n.id === "central";
      const branchIdx = branchColorMap[n.id] ?? 0;
      const colors = branchPalette[branchIdx % branchPalette.length];
      const hasChildren = (childrenMap[n.id] || []).length > 0;
      const isExpanded = expandedIds.has(n.id);
      const canExpand = hasChildren && !isExpanded;

      return {
        id: n.id,
        position: pos,
        data: {
          label: n.label,
          mastery: n.mastery,
          type: n.type,
          canExpand,
          childCount: hasChildren ? (childrenMap[n.id] || []).length : 0,
        },
        type: "default",
        style: {
          background: isCentral
            ? "linear-gradient(135deg, #1e40af, #3b82f6)"
            : colors.bg,
          border: `2px solid ${isCentral ? "#1e40af" : canExpand ? colors.border : "#d1d5db"}`,
          borderStyle: canExpand ? "dashed" : "solid",
          borderRadius: isCentral
            ? "50%"
            : n.type === "concept"
            ? "16px"
            : n.type === "subtopic"
            ? "12px"
            : "10px",
          padding: isCentral
            ? "28px"
            : n.type === "concept"
            ? "14px 20px"
            : n.type === "subtopic"
            ? "10px 16px"
            : "8px 14px",
          fontSize: isCentral
            ? "16px"
            : n.type === "concept"
            ? "14px"
            : n.type === "subtopic"
            ? "12px"
            : "11px",
          fontWeight: isCentral ? 800 : n.type === "concept" ? 700 : 500,
          color: isCentral ? "#fff" : colors.text,
          maxWidth: isCentral ? 180 : n.type === "concept" ? 170 : n.type === "subtopic" ? 150 : 130,
          textAlign: "center" as const,
          boxShadow: masteryShadow[n.mastery],
          lineHeight: 1.3,
          cursor: "pointer",
          transition: "all 0.3s ease",
        },
        sourcePosition: isCentral ? undefined : Position.Right,
        targetPosition: isCentral ? undefined : Position.Left,
      };
    });

    const edges: Edge[] = visibleEdges.map((e, i) => ({
      id: `e${i}`,
      source: e.source,
      target: e.target,
      label: e.label || undefined,
      type: "smoothstep",
      style: { stroke: "#cbd5e1", strokeWidth: 2 },
      labelStyle: { fontSize: 10, fill: "#94a3b8" },
      labelBgStyle: { fill: "#fff", fillOpacity: 0.9 },
      markerEnd: { type: MarkerType.ArrowClosed, color: "#cbd5e1" },
      pathOptions: { borderRadius: 20 },
    }));

    setRfNodes(nodes);
    setRfEdges(edges);
  }, [result, visibleNodeIds, expandedIds, nodePositions, branchColorMap, childrenMap, setRfNodes, setRfEdges]);

  const handleNodeClick = useCallback(
    (_: unknown, node: Node) => {
      const graphNode = result?.nodes.find((n) => n.id === node.id);
      if (graphNode) {
        setSelectedNode(graphNode);
        // Auto-expand if this node has hidden children
        const hasKids = (childrenMap[node.id] || []).length > 0;
        if (hasKids && !expandedIds.has(node.id)) {
          toggleNode(node.id);
        }
      }
    },
    [result, childrenMap, expandedIds, toggleNode]
  );

  const expandAll = useCallback(() => {
    if (!result) return;
    const all = new Set(result.nodes.map((n) => n.id));
    setExpandedIds(all);
  }, [result]);

  const collapseAll = useCallback(() => {
    setExpandedIds(new Set(["central"]));
  }, []);

  const allExpanded = result && expandedIds.size >= result.nodes.length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <Loader2 className="size-8 text-blue-500 animate-spin mb-4" />
        <p className="text-gray-500">Đang tạo sơ đồ tư duy...</p>
        <p className="text-sm text-gray-400 mt-1">AI đang phân tích nội dung bài học</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center py-20">
        <AlertCircle className="size-16 text-red-200 mb-5" />
        <p className="text-lg font-semibold text-gray-500">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          Thử lại
        </button>
      </div>
    );
  }

  if (!result || result.nodes.length === 0) {
    return (
      <div className="text-center py-20">
        <Brain className="size-16 text-gray-200 mx-auto mb-5" />
        <p className="text-lg font-semibold text-gray-500">Không thể tạo sơ đồ tư duy cho bài học này</p>
        <p className="text-sm text-gray-400 mt-1">Hãy thử bài học khác có nội dung chi tiết hơn</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/mindmap" className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-1">
            <ArrowLeft className="size-3" />
            Quay lại
          </Link>
          <h1 className="text-xl font-bold text-gray-900">{result.centralTopic}</h1>
          <p className="text-sm text-gray-500">
            {visibleNodeIds.size}/{result.nodes.length} khái niệm · {result.edges.length} liên kết · AI tạo
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <span className="size-2.5 rounded-full bg-red-500" /> Yếu
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2.5 rounded-full bg-blue-500" /> Đang học
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2.5 rounded-full bg-green-500" /> Thành thạo
            </span>
          </div>
          <div className="flex items-center gap-1 ml-3">
            {allExpanded ? (
              <button
                onClick={collapseAll}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-500 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <Minimize2 className="size-3" />
                Thu gọn
              </button>
            ) : (
              <button
                onClick={expandAll}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-500 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <Maximize2 className="size-3" />
                Mở rộng hết
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="h-[650px] rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50 to-blue-50/30 overflow-hidden">
        {visibleNodeIds.size <= 1 && (
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
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.3}
          maxZoom={2}
          attributionPosition="bottom-right"
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
        >
          <Background color="#e2e8f0" gap={30} size={1} />
          <Controls />
          <MiniMap
            nodeColor={(n) => {
              const m = n.data?.mastery as string;
              return m === "weak" ? "#ef4444" : m === "learning" ? "#3b82f6" : "#22c55e";
            }}
            style={{ background: "#f8fafc", borderRadius: "8px" }}
          />
        </ReactFlow>
      </div>

      {selectedNode && (
        <div className="p-5 rounded-xl border border-gray-200 bg-white space-y-3">
          {/* Header */}
          <div className="flex items-center gap-2">
            <span
              className={`size-3 rounded-full shrink-0 ${
                selectedNode.mastery === "weak"
                  ? "bg-red-500"
                  : selectedNode.mastery === "learning"
                  ? "bg-blue-500"
                  : "bg-green-500"
              }`}
            />
            <h3 className="font-semibold text-gray-900">{selectedNode.label}</h3>
            <span className="text-xs text-gray-400 px-2 py-0.5 rounded-full bg-gray-100">
              {selectedNode.type === "concept" ? "Nhánh chính" : selectedNode.type === "subtopic" ? "Ý phụ" : "Chi tiết"}
            </span>
            {(childrenMap[selectedNode.id] || []).length > 0 && !expandedIds.has(selectedNode.id) && (
              <button
                onClick={() => toggleNode(selectedNode.id)}
                className="text-xs text-primary hover:underline font-medium"
              >
                +{(childrenMap[selectedNode.id] || []).length} ý — nhấn để mở
              </button>
            )}
          </div>

          {/* Description */}
          <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100">
            <p className="text-sm text-gray-700 leading-relaxed">
              {selectedNode.description ||
                (selectedNode.mastery === "weak"
                  ? "Bạn đang gặp khó khăn với khái niệm này. Hãy ôn tập thêm."
                  : selectedNode.mastery === "learning"
                  ? "Bạn đang trong quá trình học khái niệm này."
                  : "Bạn đã nắm vững khái niệm này.")}
            </p>
          </div>

          {/* Children preview */}
          {(childrenMap[selectedNode.id] || []).length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                Các ý liên quan
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(childrenMap[selectedNode.id] || []).map((childId) => {
                  const child = result?.nodes.find((n) => n.id === childId);
                  if (!child) return null;
                  return (
                    <span
                      key={childId}
                      className={`text-xs px-2 py-1 rounded-full border ${
                        child.mastery === "weak"
                          ? "bg-red-50 border-red-200 text-red-700"
                          : child.mastery === "learning"
                          ? "bg-blue-50 border-blue-200 text-blue-700"
                          : "bg-green-50 border-green-200 text-green-700"
                      }`}
                    >
                      {child.label.length > 30 ? child.label.slice(0, 30) + "..." : child.label}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Mastery status */}
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>Trạng thái:</span>
            <span
              className={`font-semibold ${
                selectedNode.mastery === "weak"
                  ? "text-red-600"
                  : selectedNode.mastery === "learning"
                  ? "text-blue-600"
                  : "text-green-600"
              }`}
            >
              {selectedNode.mastery === "weak"
                ? "Cần ôn tập"
                : selectedNode.mastery === "learning"
                ? "Đang học"
                : "Đã thành thạo"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
