'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  PORT_COLORS,
  PORT_LABELS,
  type PortType,
  type PlacedNode,
} from '@/app/magic-se/data/nodeLibrary';
import { Icon } from '@/app/magic-se/data/icons';
import type { FoldDefinition, FoldPinDef } from './FoldLibraryPanel';

const GOLD = '#c8a96a';
const GOLD_SOFT = 'rgba(200,169,106,0.32)';
const MINT = '#6ba89a';

const ALL_PORT_TYPES: PortType[] = [
  'exec', 'bool', 'int', 'float', 'string', 'vector', 'rotator', 'object', 'class', 'actor',
];

export default function PinEditorPanel({
  def,
  onChange,
  onClose,
  zIndex = 356,
}: {
  def: FoldDefinition;
  onChange: (next: FoldDefinition) => void;
  onClose: () => void;
  zIndex?: number;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setShow(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const close = () => {
    setShow(false);
    setTimeout(onClose, 180);
  };

  const internalNodes: PlacedNode[] = def.nodes;

  /* ---------- 引脚操作 ---------- */

  const updatePin = (
    side: 'in' | 'out',
    pinId: string,
    patch: Partial<FoldPinDef>,
  ) => {
    const list = side === 'in' ? def.inputs : def.outputs;
    const next = list.map((p) => (p.id === pinId ? { ...p, ...patch } : p));
    onChange({
      ...def,
      inputs: side === 'in' ? next : def.inputs,
      outputs: side === 'out' ? next : def.outputs,
      updatedAt: Date.now(),
    });
  };

  const removePin = (side: 'in' | 'out', pinId: string) => {
    const list = side === 'in' ? def.inputs : def.outputs;
    const next = list.filter((p) => p.id !== pinId);
    onChange({
      ...def,
      inputs: side === 'in' ? next : def.inputs,
      outputs: side === 'out' ? next : def.outputs,
      updatedAt: Date.now(),
    });
  };

  const addPin = (side: 'in' | 'out') => {
    const list = side === 'in' ? def.inputs : def.outputs;
    const pin: FoldPinDef = {
      id: `pin_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: side === 'in' ? `In ${list.length}` : `Out ${list.length}`,
      type: 'exec',
    };
    onChange({
      ...def,
      inputs: side === 'in' ? [...def.inputs, pin] : def.inputs,
      outputs: side === 'out' ? [...def.outputs, pin] : def.outputs,
      updatedAt: Date.now(),
    });
  };

  /* ---------- 渲染单个引脚 ---------- */

  const renderPinList = (side: 'in' | 'out') => {
    const list = side === 'in' ? def.inputs : def.outputs;
    return (
      <div className="space-y-2">
        {list.map((pin) => {
          const node = internalNodes.find((n) => n.instanceId === pin.internalNodeId);
          const ports = node ? (side === 'in' ? node.inputs : node.outputs) : [];

          return (
            <div
              key={pin.id}
              className="border p-2"
              style={{
                borderRadius: 2,
                borderColor: 'rgba(232,230,226,0.08)',
                background: 'rgba(255,255,255,0.015)',
              }}
            >
              {/* 第一行：颜色点 + 名称 + 类型 + 删除 */}
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: PORT_COLORS[pin.type] }}
                />
                <input
                  type="text"
                  value={pin.name}
                  onChange={(e) => updatePin(side, pin.id, { name: e.target.value })}
                  placeholder={side === 'in' ? '输入名' : '输出名'}
                  className="flex-1 border bg-black/30 px-2 py-0.5 text-[11px] text-[#e8e6e2] focus:outline-none"
                  style={{ borderRadius: 2, borderColor: 'rgba(232,230,226,0.1)' }}
                />
                <select
                  value={pin.type}
                  onChange={(e) => updatePin(side, pin.id, { type: e.target.value as PortType })}
                  className="border bg-black/30 px-1 py-0.5 text-[10px] text-[#e8e6e2] focus:outline-none"
                  style={{ borderRadius: 2, borderColor: 'rgba(232,230,226,0.1)' }}
                >
                  {ALL_PORT_TYPES.map((t) => (
                    <option key={t} value={t}>{PORT_LABELS[t]}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removePin(side, pin.id)}
                  className="grid h-5 w-5 place-items-center text-[#5b5852] transition-colors hover:text-[#c85a4a]"
                  title="删除引脚"
                >
                  <span className="h-3 w-3">{Icon.trash}</span>
                </button>
              </div>

              {/* 第二行：说明 */}
              <div className="mt-1">
                <input
                  type="text"
                  value={pin.desc ?? ''}
                  onChange={(e) => updatePin(side, pin.id, { desc: e.target.value })}
                  placeholder="说明（可选）"
                  className="w-full border bg-black/30 px-2 py-0.5 text-[10px] text-[#c9c7c2] placeholder:text-[#5b5852] focus:outline-none"
                  style={{ borderRadius: 2, borderColor: 'rgba(232,230,226,0.08)' }}
                />
              </div>

              {/* 第三行：穿透映射 */}
              <div className="mt-1.5 flex items-center gap-1">
                <span className="shrink-0 text-[9px] text-[#5b5852]">穿透到内部：</span>
                <select
                  value={pin.internalNodeId ?? ''}
                  onChange={(e) => {
                    const nodeId = e.target.value || undefined;
                    const n = internalNodes.find((x) => x.instanceId === nodeId);
                    const ps = n ? (side === 'in' ? n.inputs : n.outputs) : [];
                    const compatiblePort = ps.findIndex((p) => p.type === pin.type);
                    updatePin(side, pin.id, {
                      internalNodeId: nodeId,
                      internalPortIndex: compatiblePort >= 0 ? compatiblePort : 0,
                      internalSide: side,
                    });
                  }}
                  className="flex-1 border bg-black/30 px-1 py-0.5 text-[10px] text-[#e8e6e2] focus:outline-none"
                  style={{ borderRadius: 2, borderColor: 'rgba(232,230,226,0.1)' }}
                >
                  <option value="">（无）</option>
                  {internalNodes.map((n) => (
                    <option key={n.instanceId} value={n.instanceId}>
                      {n.title} · {n.category}
                    </option>
                  ))}
                </select>
                {pin.internalNodeId && ports.length > 0 && (
                  <select
                    value={pin.internalPortIndex ?? 0}
                    onChange={(e) =>
                      updatePin(side, pin.id, { internalPortIndex: Number(e.target.value) })
                    }
                    className="w-24 border bg-black/30 px-1 py-0.5 text-[10px] text-[#e8e6e2] focus:outline-none"
                    style={{ borderRadius: 2, borderColor: 'rgba(232,230,226,0.1)' }}
                  >
                    {ports.map((p, i) => (
                      <option key={i} value={i}>
                        {p.name || `端口 ${i}`} ({p.type})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => addPin(side)}
          className="flex w-full items-center justify-center gap-1 border border-dashed px-2 py-1.5 text-[10px] transition-colors"
          style={{
            borderRadius: 2,
            borderColor: 'rgba(232,230,226,0.15)',
            color: '#9a9792',
          }}
        >
          <span className="h-3 w-3">{Icon.plus}</span>
          {side === 'in' ? '新增输入引脚' : '新增输出引脚'}
        </button>
      </div>
    );
  };

  /* ---------- 渲染 ---------- */

  return createPortal(
    <div
      className="fixed inset-0 flex items-stretch justify-end"
      style={{ zIndex }}
      onClick={close}
    >
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative flex h-full w-[380px] flex-col border-l shadow-2xl backdrop-blur-xl transition-transform duration-200"
        style={{
          transform: show ? 'translateX(0)' : 'translateX(100%)',
          borderColor: 'rgba(232,230,226,0.08)',
          background: '#1b1b1e',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ borderColor: 'rgba(232,230,226,0.06)' }}
        >
          <div className="min-w-0">
            <p className="text-xs font-normal tracking-[0.15em] text-[#e8e6e2]">
              引脚编辑
            </p>
            <p className="mt-0.5 truncate text-[10px] text-[#5b5852]">
              {def.kind === 'macro' ? '宏' : '函数'} · {def.name}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            className="grid h-4 w-4 place-items-center text-[#5b5852] transition-colors hover:text-[#e8e6e2]"
          >
            <span className="h-3 w-3">{Icon.close}</span>
          </button>
        </div>

        {/* 顶部说明 */}
        <div
          className="border-b px-4 py-2 text-[10px] leading-5 text-[#8b8885]"
          style={{ borderColor: 'rgba(232,230,226,0.06)' }}
        >
          编辑此{def.kind === 'macro' ? '宏' : '函数'}的输入 / 输出引脚。
          修改后，画布上所有实例节点会自动同步。
          「穿透到内部」可选：把外部连线映射到定义内部的某个节点端口。
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="mb-4">
            <p className="mb-2 font-mono text-[10px] tracking-[0.2em] text-[#5b5852]">
              输入 · {def.inputs.length}
            </p>
            {def.inputs.length === 0 && !def.isPure && def.kind === 'function' && (
              <p className="mb-2 text-[10px] text-[#5b5852]">
                （纯函数通常没有输入引脚）
              </p>
            )}
            {renderPinList('in')}
          </div>

          <div>
            <p className="mb-2 font-mono text-[10px] tracking-[0.2em] text-[#5b5852]">
              输出 · {def.outputs.length}
            </p>
            {renderPinList('out')}
          </div>
        </div>

        {/* 底部 */}
        <div
          className="border-t px-4 py-2 font-mono text-[10px] text-[#5b5852]"
          style={{ borderColor: 'rgba(232,230,226,0.06)' }}
        >
          提示：拖线到宏/函数节点的空白处也能快速生成新引脚。
        </div>
      </div>
    </div>,
    document.body,
  );
}