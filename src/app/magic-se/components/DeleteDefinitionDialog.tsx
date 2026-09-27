'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/app/magic-se/data/icons';

const GOLD = '#c8a96a';
const GOLD_SOFT = 'rgba(200,169,106,0.32)';
const TOMATO = '#c85a4a';

export interface DefinitionReference {
  tabId: string;
  tabName: string;
  instanceId: string;
  nodeTitle: string;
}

export default function DeleteDefinitionDialog({
  defName,
  defKind,
  references,
  onJump,
  onConfirm,
  onCancel,
  zIndex = 400,
}: {
  defName: string;
  defKind: 'macro' | 'function';
  references: DefinitionReference[];
  onJump: (tabId: string, instanceId: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  zIndex?: number;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setShow(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const close = () => {
    setShow(false);
    setTimeout(onCancel, 180);
  };

  return createPortal(
    <div
      className="fixed inset-0 flex items-start justify-center pt-24 transition-opacity duration-200"
      style={{ opacity: show ? 1 : 0, zIndex }}
      onClick={close}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative flex max-h-[80vh] w-[560px] flex-col overflow-hidden border shadow-2xl backdrop-blur-xl transition-all duration-200"
        style={{
          transform: show ? 'scale(1)' : 'scale(0.97)',
          opacity: show ? 1 : 0,
          borderRadius: 2,
          borderColor: 'rgba(232,230,226,0.08)',
          background: '#1b1b1e',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{ background: `linear-gradient(to right, transparent, ${GOLD_SOFT}, transparent)` }}
        />

        {/* 头部 */}
        <div
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ borderColor: 'rgba(232,230,226,0.06)', background: 'rgba(255,255,255,0.015)' }}
        >
          <p className="flex items-center gap-3 text-xs font-normal tracking-[0.15em] text-[#e8e6e2]">
            删除确认
            <span className="font-mono text-[10px]" style={{ color: TOMATO }}>
              {references.length} 处引用
            </span>
          </p>
          <button
            type="button"
            onClick={close}
            className="grid h-4 w-4 place-items-center text-[#5b5852] transition-colors hover:text-[#e8e6e2]"
          >
            <span className="h-3 w-3">{Icon.close}</span>
          </button>
        </div>

        {/* 说明 */}
        <div
          className="border-b px-4 py-3 text-[11px] leading-5 text-[#c9c7c2]"
          style={{ borderColor: 'rgba(232,230,226,0.06)' }}
        >
          <p>
            <span style={{ color: GOLD }}>{defName}</span>
            {' '}是一个{defKind === 'macro' ? '宏' : '函数'}定义，
            当前有 <span style={{ color: TOMATO }}>{references.length}</span> 处引用。
          </p>
          <p className="mt-1.5 text-[10px] text-[#8b8885]">
            删除后，这些引用节点的所有连线会被断开，编辑标签页也会被关闭。
            点击下方列表中的「跳转」可以定位到对应位置。
          </p>
        </div>

        {/* 引用列表 */}
        <div className="flex-1 overflow-y-auto p-3">
          {references.length === 0 ? (
            <p className="py-8 text-center text-[11px] text-[#5b5852]">
              没有引用，可以安全删除。
            </p>
          ) : (
            <div className="space-y-2">
              {references.map((r, i) => (
                <div
                  key={`${r.tabId}-${r.instanceId}-${i}`}
                  className="flex items-center gap-3 border p-3"
                  style={{
                    borderRadius: 2,
                    borderColor: 'rgba(232,230,226,0.06)',
                    background: 'rgba(255,255,255,0.015)',
                  }}
                >
                  <span
                    className="grid h-6 w-6 shrink-0 place-items-center border font-mono text-[10px]"
                    style={{ borderRadius: 2, borderColor: GOLD_SOFT, color: GOLD }}
                  >
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-[12px] text-[#e8e6e2]">{r.nodeTitle}</p>
                    <p className="mt-0.5 truncate text-[10px] text-[#5b5852]">
                      所在图表：{r.tabName}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onJump(r.tabId, r.instanceId)}
                    className="border px-2.5 py-1 text-[10px] transition-colors"
                    style={{
                      borderRadius: 2,
                      borderColor: GOLD_SOFT,
                      color: GOLD,
                      background: 'rgba(200,169,106,0.08)',
                    }}
                    title="跳转到该位置并高亮"
                  >
                    跳转
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 底部 */}
        <div
          className="flex items-center justify-between border-t px-4 py-3"
          style={{ borderColor: 'rgba(232,230,226,0.06)' }}
        >
          <button
            type="button"
            onClick={close}
            className="border px-3 py-1 text-[11px] text-[#c9c7c2] transition-colors"
            style={{ borderRadius: 2, borderColor: 'rgba(232,230,226,0.1)' }}
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="border px-3 py-1 text-[11px] transition-colors"
            style={{
              borderRadius: 2,
              borderColor: TOMATO,
              color: TOMATO,
              background: 'rgba(200,90,74,0.08)',
            }}
          >
            仍要删除（{references.length} 处引用）
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}