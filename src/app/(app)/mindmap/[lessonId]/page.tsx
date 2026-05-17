"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { Loader2, AlertCircle, Brain, ArrowLeft } from "lucide-react";
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

// Vibrant branch color palette
const branchPalette = [
  { bg: "#fef3c7", border: "#f59e0b", text: "#92400e" },  // amber
  { bg: "#dbeafe", border: "#3b82f6", text: "#1e40af" },  // blue
  { bg: "#dcfce7", border: "#22c55e", text: "#166534" },  // green
  { bg: "#fce7f3", border: "#ec4899", text: "#9d174d" },  // pink
  { bg: "#ede9fe", border: "#8b5cf6", text: "#5b21b6" },  // violet
  { bg: "#cffafe", border: "#06b6d4", text: "#155e75" },  // cyan
  { bg: "#fee2e2", border: "#ef4444", text: "#991b1b" },  // red
  { bg: "#ffedd5", border: "#f97316", text: "#9a3412" },  // orange
];

const masteryOverlay: Record<string, { shadow?: string }> = {
  weak: { shadow: "0 0 0 3px #ef4444" },
  learning: { shadow: "0 0 0 3px #3b82f6" },
  mastered: {},
};

function computeMindMapLayout(result: GraphResult) {
  const central = { x: 500, y: 350 };
  const mainBranches = result.nodes.filter((n) => n.type === "concept" && n.id !== "central");
  const numBranches = mainBranches.length || 1;

  const nodePositions: Record<string, { x: number; y: number }> = {};
  // Central node
  nodePositions["central"] = central;

  // Position main branch nodes around the center
  const mainRadius = 220;
  mainBranches.forEach((branch, i) => {
    const angle = (i / numBranches) * 2 * Math.PI - Math.PI / 2;
    nodePositions[branch.id] = {
      x: central.x + Math.cos(angle) * mainRadius,
      y: central.y + Math.sin(angle) * mainRadius,
    };
  });

  // Build adjacency: child -> parent
  const parentMap: Record<string, string> = {};
  for (const e of result.edges) {
    parentMap[e.target] = e.source;
  }

  // Group children by their parent
  const childrenMap: Record<string, string[]> = {};
  for (const n of result.nodes) {
    const parent = parentMap[n.id];
    if (parent) {
      if (!childrenMap[parent]) childrenMap[parent] = [];
      childrenMap[parent].push(n.id);
    }
  }

  // Recursively position children in a fan-out from their parent
  function layoutChildren(parentId: string, parentPos: { x: number; y: number }, angleRange: [number, number], radius: number, depth: number) {
    const children = childrenMap[parentId] || [];
    if (children.length === 0) return;

    // Sort children to ensure consistent layout
    children.sort();
    const [angleStart, angleEnd] = angleRange;
    const angleSpan = angleEnd - angleStart;

    children.forEach((childId, i) => {
      const t = children.length === 1 ? 0.5 : i / (children.length - 1);
      const angle = angleStart + t * angleSpan;
      const r = radius + depth * 110;
      const pos = {
        x: parentPos.x + Math.cos(angle) * r,
        y: parentPos.y + Math.sin(angle) * r,
      };
      // Actually, for a mind map look, children should be farther from center than parent
      // Angle from center to parent
      const dx = parentPos.x - central.x;
      const dy = parentPos.y - central.y;
      const distToCenter = Math.sqrt(dx * dx + dy * dy);
      const parentAngle = Math.atan2(dy, dx);

      // Fan out children starting from parent angle
      const fanAngle = parentAngle + (i - (children.length - 1) / 2) * 0.35;
      const childDist = distToCenter + 130 + depth * 90;
      nodePositions[childId] = {
        x: central.x + Math.cos(fanAngle) * childDist,
        y: central.y + Math.sin(fanAngle) * childDist,
      };
      // Recurse
      layoutChildren(childId, nodePositions[childId], [(fanAngle - 0.3), (fanAngle + 0.3)], childDist, depth + 1);
    });
  }

  // Layout each main branch's children
  mainBranches.forEach((branch, i) => {
    const angle = (i / numBranches) * 2 * Math.PI - Math.PI / 2;
    const pos = nodePositions[branch.id];
    layoutChildren(branch.id, pos, [angle - 0.5, angle + 0.5], 150, 1);
  });

  // Assign branch colors
  const branchColorMap: Record<string, number> = {};
  mainBranches.forEach((b, i) => { branchColorMap[b.id] = i; });
  // Propagate branch color to descendants
  function assignBranchColor(nodeId: string, branchIdx: number) {
    for (const childId of (childrenMap[nodeId] || [])) {
      branchColorMap[childId] = branchIdx;
      assignBranchColor(childId, branchIdx);
    }
  }
  mainBranches.forEach((b, i) => assignBranchColor(b.id, i));

  // Build React Flow nodes
  const rfNodes: Node[] = result.nodes.map((n) => {
    const pos = nodePositions[n.id] || { x: 500, y: 350 };
    const isCentral = n.id === "central";
    const branchIdx = branchColorMap[n.id] ?? 0;
    const colors = branchPalette[branchIdx % branchPalette.length];
    const masteryShadow = masteryOverlay[n.mastery]?.shadow;

    return {
      id: n.id,
      position: pos,
      data: { label: n.label, mastery: n.mastery, type: n.type, branchIdx },
      type: "default",
      style: {
        background: isCentral ? "linear-gradient(135deg, #1e40af, #3b82f6)" : colors.bg,
        border: `2px solid ${isCentral ? "#1e40af" : colors.border}`,
        borderRadius: isCentral ? "50%" : n.type === "concept" ? "16px" : n.type === "subtopic" ? "12px" : "10px",
        padding: isCentral ? "28px" : n.type === "concept" ? "14px 20px" : n.type === "subtopic" ? "10px 16px" : "8px 14px",
        fontSize: isCentral ? "16px" : n.type === "concept" ? "14px" : n.type === "subtopic" ? "12px" : "11px",
        fontWeight: isCentral ? 800 : n.type === "concept" ? 700 : 500,
        color: isCentral ? "#fff" : colors.text,
        maxWidth: isCentral ? 180 : n.type === "concept" ? 170 : n.type === "subtopic" ? 150 : 130,
        textAlign: "center" as const,
        boxShadow: masteryShadow,
        lineHeight: 1.3,
        cursor: "pointer",
      },
      sourcePosition: isCentral ? undefined : Position.Right,
      targetPosition: isCentral ? undefined : Position.Left,
    };
  });

  // Build edges with smooth curves
  const rfEdges: Edge[] = result.edges.map((e, i) => ({
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

  return { nodes: rfNodes, edges: rfEdges };
}

export default function MindMapDetailPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = use(params);
  const [result, setResult] = useState<GraphResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    async function fetchMindMap() {
      try {
        const data = await api<GraphResult>("/api/ai/mindmap", {
          method: "POST",
          body: JSON.stringify({ lessonId }),
        });
        setResult(data);
        const { nodes: rfNodes, edges: rfEdges } = computeMindMapLayout(data);
        setNodes(rfNodes);
        setEdges(rfEdges);
      } catch (err: any) {
        setError(err.message || "Không thể tạo sơ đồ tư duy");
      } finally {
        setLoading(false);
      }
    }
    fetchMindMap();
  }, [lessonId]);

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
            {result.nodes.length} khái niệm · {result.edges.length} liên kết · AI tạo
          </p>
        </div>
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
      </div>

      <div className="h-[650px] rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50 to-blue-50/30 overflow-hidden">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={(_, node) => setSelectedNode(result.nodes.find((n) => n.id === node.id) || null)}
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
        <div className="p-4 rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`size-2.5 rounded-full ${
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
          </div>
          <p className="text-sm text-gray-500">
            {selectedNode.mastery === "weak"
              ? "Bạn đang gặp khó khăn với khái niệm này. Hãy ôn tập thêm."
              : selectedNode.mastery === "learning"
              ? "Bạn đang trong quá trình học khái niệm này."
              : "Bạn đã nắm vững khái niệm này."}
          </p>
        </div>
      )}
    </div>
  );
}
