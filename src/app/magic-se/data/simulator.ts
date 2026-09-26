import type { PlacedNode, Connection } from './nodeLibrary';

export interface SimStep {
  nodeId: string;
  title: string;
  outputs: { portIndex: number; portName: string; value: string }[];
}

export interface SimResult {
  steps: SimStep[];
  logs: string[];
  error?: string;
}

/* ==================== 简单求值 ==================== */
function evalValue(
  node: PlacedNode,
  portIndex: number,
  connections: Connection[],
  placed: PlacedNode[],
  visited: Set<string>,
): string {
  const port = node.outputs[portIndex];
  if (!port) return '';

  // 如果没有输入连接，返回默认值
  const incoming = connections.find(
    (c) => c.fromInstance === node.instanceId && c.fromPort === portIndex
  );
  if (!incoming) {
    return node.defaultValues?.[portIndex] ?? defaultForType(port.type);
  }

  // 简单模拟：只处理单层输入，避免无限递归
  const upstream = placed.find((n) => n.instanceId === incoming.fromInstance);
  if (!upstream || visited.has(upstream.instanceId)) return '?';

  visited.add(upstream.instanceId);
  switch (upstream.title) {
    case 'Add (Float)': {
      const a = upstream.defaultValues?.[0] ?? '0';
      const b = upstream.defaultValues?.[1] ?? '0';
      return String(Number(a) + Number(b));
    }
    case 'Subtract (Float)': {
      const a = upstream.defaultValues?.[0] ?? '0';
      const b = upstream.defaultValues?.[1] ?? '0';
      return String(Number(a) - Number(b));
    }
    case 'Multiply (Float)': {
      const a = upstream.defaultValues?.[0] ?? '0';
      const b = upstream.defaultValues?.[1] ?? '0';
      return String(Number(a) * Number(b));
    }
    case 'Greater (Float)': {
      const a = upstream.defaultValues?.[0] ?? '0';
      const b = upstream.defaultValues?.[1] ?? '0';
      return Number(a) > Number(b) ? 'true' : 'false';
    }
    case 'Lerp': {
      const a = Number(upstream.defaultValues?.[0] ?? '0');
      const b = Number(upstream.defaultValues?.[1] ?? '1');
      const t = Number(upstream.defaultValues?.[2] ?? '0.5');
      return String(a + (b - a) * t);
    }
    default:
      return `[${upstream.title}]`;
  }
}

function defaultForType(type: string): string {
  switch (type) {
    case 'bool': return 'false';
    case 'int': return '0';
    case 'float': return '0.0';
    case 'string': return '""';
    case 'vector': return '(0,0,0)';
    case 'rotator': return '(0,0,0)';
    default: return 'null';
  }
}

/* ==================== 从 Event 出发遍历执行流 ==================== */
export function simulate(
  placed: PlacedNode[],
  connections: Connection[],
  maxSteps = 50,
): SimResult {
  const steps: SimStep[] = [];
  const logs: string[] = [];

  // 找所有 Event 节点
  const events = placed.filter((n) => n.category === '事件');
  if (events.length === 0) {
    return { steps: [], logs: [], error: '找不到任何事件节点（如 Event BeginPlay）。请先从左侧拖一个事件节点到画布。' };
  }

  // 简单处理：只从第一个 Event 开始（通常是 BeginPlay）
  const startEvent = events.find((n) => n.id === 'beginplay') ?? events[0];
  const visited = new Set<string>();
  let current: PlacedNode | undefined = startEvent;
  let guard = 0;

  while (current && guard < maxSteps) {
    guard++;
    if (visited.has(current.instanceId)) break;
    visited.add(current.instanceId);

    const outputs: SimStep['outputs'] = [];
    current.outputs.forEach((p, i) => {
      if (p.type === 'exec') return;
      const v = evalValue(current!, i, connections, placed, new Set(visited));
      outputs.push({ portIndex: i, portName: p.name || `输出 ${i}`, value: v });
    });

    steps.push({ nodeId: current.instanceId, title: current.title, outputs });

    // Print String 输出到 logs
    if (current.id === 'print') {
      const str = current.defaultValues?.[1] ?? 'Hello UE';
      logs.push(str);
    }

    // 找下一个执行流节点
    const nextConn = connections.find(
      (c) => c.fromInstance === current!.instanceId && current!.outputs[c.fromPort]?.type === 'exec'
    );

    if (!nextConn) {
      // 检查是不是 Branch 走了 True 分支
      const branchTrue = connections.find(
        (c) => c.fromInstance === current!.instanceId && current!.outputs[c.fromPort]?.name === 'True'
      );
      const branchFalse = connections.find(
        (c) => c.fromInstance === current!.instanceId && current!.outputs[c.fromPort]?.name === 'False'
      );
      if (current.title === 'Branch' && branchTrue) {
        current = placed.find((n) => n.instanceId === branchTrue.toInstance);
        continue;
      }
      if (current.title === 'Branch' && branchFalse) {
        current = placed.find((n) => n.instanceId === branchFalse.toInstance);
        continue;
      }
      break;
    }

    current = placed.find((n) => n.instanceId === nextConn.toInstance);
  }

  return { steps, logs };
}