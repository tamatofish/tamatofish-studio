import type { PlacedNode, Connection } from './nodeLibrary';

export interface CheckResult {
  id: string;
  level: 'error' | 'warning' | 'info';
  message: string;
  relatedNodeIds?: string[];
}

/* ==================== 静态检查 ==================== */
export function runStaticChecks(
  placed: PlacedNode[],
  connections: Connection[],
): CheckResult[] {
  const results: CheckResult[] = [];

  if (placed.length === 0) {
    results.push({ id: 'empty', level: 'info', message: '画布是空的，试试从左栏拖一个节点进来。' });
    return results;
  }

  // 1. Event 节点是否有输出
  for (const node of placed) {
    if (node.category === '事件') {
      const hasOut = connections.some((c) => c.fromInstance === node.instanceId);
      if (!hasOut) {
        results.push({
          id: `event-no-out-${node.instanceId}`,
          level: 'warning',
          message: `事件节点「${node.title}」没有连任何执行输出。`,
          relatedNodeIds: [node.instanceId],
        });
      }
    }
  }

  // 2. 非 Event、非 Pure 节点的 exec 输入是否为空
  for (const node of placed) {
    if (node.category === '事件' || node.category === '变量') continue;
    const hasExecIn = node.inputs.some((p) => p.type === 'exec');
    if (!hasExecIn) continue;
    const hasIn = connections.some((c) => c.toInstance === node.instanceId && node.inputs[c.toPort]?.type === 'exec');
    if (!hasIn) {
      results.push({
        id: `exec-in-empty-${node.instanceId}`,
        level: 'warning',
        message: `节点「${node.title}」的执行输入没有连线，这个节点永远不会被执行。`,
        relatedNodeIds: [node.instanceId],
      });
    }
  }

  // 3. 非 Event、非 Pure 节点的 exec 输出是否为空（除多出口）
  for (const node of placed) {
    if (node.category === '事件' || node.category === '变量') continue;
    const execOuts = node.outputs.filter((p) => p.type === 'exec');
    if (execOuts.length === 0) continue;
    const hasOut = connections.some((c) => c.fromInstance === node.instanceId && node.outputs[c.fromPort]?.type === 'exec');
    if (!hasOut && execOuts.length === 1) {
      results.push({
        id: `exec-out-empty-${node.instanceId}`,
        level: 'warning',
        message: `节点「${node.title}」的执行输出没有连任何节点，后续逻辑不会执行。`,
        relatedNodeIds: [node.instanceId],
      });
    }
  }

  // 4. 孤立节点（既无输入也无输出连接）
  for (const node of placed) {
    const hasAnyIn = connections.some((c) => c.toInstance === node.instanceId);
    const hasAnyOut = connections.some((c) => c.fromInstance === node.instanceId);
    if (!hasAnyIn && !hasAnyOut && node.category !== '事件') {
      results.push({
        id: `isolated-${node.instanceId}`,
        level: 'info',
        message: `节点「${node.title}」孤立在画布上，没有和任何节点相连。`,
        relatedNodeIds: [node.instanceId],
      });
    }
  }

  // 5. 重复连接同一输入端口
  const inputPortMap = new Map<string, number>();
  for (const c of connections) {
    const key = `${c.toInstance}:${c.toPort}`;
    inputPortMap.set(key, (inputPortMap.get(key) ?? 0) + 1);
  }
  for (const [key, count] of inputPortMap) {
    if (count > 1) {
      const [instanceId, portIndex] = key.split(':');
      const node = placed.find((n) => n.instanceId === instanceId);
      if (node) {
        results.push({
          id: `dup-input-${key}`,
          level: 'error',
          message: `节点「${node.title}」的端口「${node.inputs[Number(portIndex)]?.name || '输入'}」被连了 ${count} 条线（只能连 1 条）。`,
          relatedNodeIds: [instanceId],
        });
      }
    }
  }

  // 6. 数据端口未连接（非 exec、非可内联类型）
  for (const node of placed) {
    node.inputs.forEach((port, idx) => {
      if (port.type === 'exec') return;
      const canInline = port.type === 'bool' || port.type === 'float' || port.type === 'int'
        || port.type === 'string' || port.type === 'vector' || port.type === 'rotator';
      if (canInline) return;
      const hasIn = connections.some((c) => c.toInstance === node.instanceId && c.toPort === idx);
      if (!hasIn) {
        results.push({
          id: `data-in-empty-${node.instanceId}-${idx}`,
          level: 'warning',
          message: `节点「${node.title}」的端口「${port.name || '输入'}」需要数据连接，但未连接。`,
          relatedNodeIds: [node.instanceId],
        });
      }
    });
  }

  if (results.length === 0) {
    results.push({ id: 'all-good', level: 'info', message: '✓ 一切正常，没有发现问题。' });
  }

  return results;
}