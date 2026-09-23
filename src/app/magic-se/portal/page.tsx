'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/* ==================== 唯一 ID 生成器 ==================== */
let uidCounter = 0;
function uid(prefix = 'id') {
  uidCounter += 1;
  return `${prefix}-${Date.now()}-${uidCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

/* ==================== 类型 ==================== */
type PortType = 'exec' | 'bool' | 'int' | 'float' | 'string' | 'vector' | 'rotator' | 'object' | 'class' | 'actor';

interface Port { name: string; type: PortType; desc: string; }
interface NodeData { id: string; title: string; category: string; color: string; desc: string; inputs: Port[]; outputs: Port[]; }
interface PlacedNode extends NodeData { instanceId: string; x: number; y: number; }
interface Connection { id: string; fromInstance: string; fromPort: number; toInstance: string; toPort: number; type: PortType; }
interface EditorState { placed: PlacedNode[]; connections: Connection[]; }

interface TemplateNode { refId: string; nodeId: string; x: number; y: number; }
interface TemplateConnection { fromRef: string; fromPort: number; toRef: string; toPort: number; }
interface Template { id: string; name: string; desc: string; nodes: TemplateNode[]; connections: TemplateConnection[]; }

/* ==================== 端口颜色 ==================== */
const PORT_COLORS: Record<PortType, string> = {
  exec: '#ffffff',
  bool: '#8b0000',
  int: '#1ee3cf',
  float: '#90ee90',
  string: '#ff69b4',
  vector: '#ffd700',
  rotator: '#a78bfa',
  object: '#00bfff',
  class: '#7b68ee',
  actor: '#20b2aa',
};
const PORT_LABELS: Record<PortType, string> = {
  exec: '执行', bool: '布尔', int: '整数', float: '浮点', string: '字符串',
  vector: '向量', rotator: '旋转', object: '对象', class: '类', actor: 'Actor',
};

const NODE_COLORS = {
  event: '#A00000', flow: '#5A5A5A', pure: '#2E7D32', cast: '#0E7490',
  spawn: '#5A2E7D', debug: '#6B4E1E', transform: '#5A2E7D', timer: '#3A4A5A',
  character: '#2E5A2E', math: '#1E5A8A', ui: '#8A5A1E', audio: '#1E5A6B',
  save: '#5A1E4A', variable: '#2E7D5A',
} as const;

const NODE_WIDTH = 240;
const HEADER_H = 52;
const PORT_ROW_H = 22;
const PORT_AREA_PT = 8;
const PORT_DOT_OFFSET = 6;
const DRAG_MIME = 'application/x-magic-node';

/* ==================== 节点库 ==================== */
const NODE_LIBRARY: NodeData[] = [
  // —— 事件 ——
  { id: 'beginplay', title: 'Event BeginPlay', category: '事件', color: NODE_COLORS.event,
    desc: 'Actor 进入游戏世界时触发一次。用来做初始化。',
    inputs: [], outputs: [{ name: '', type: 'exec', desc: '执行输出。' }] },
  { id: 'tick', title: 'Event Tick', category: '事件', color: NODE_COLORS.event,
    desc: '每一帧触发一次。用来做持续逻辑。',
    inputs: [], outputs: [
      { name: '', type: 'exec', desc: '执行输出。' },
      { name: 'Delta Seconds', type: 'float', desc: '帧间隔时间。' },
    ] },
  { id: 'beginoverlap', title: 'Event ActorBeginOverlap', category: '事件', color: NODE_COLORS.event,
    desc: '有 Actor 进入碰撞范围时触发。',
    inputs: [], outputs: [
      { name: '', type: 'exec', desc: '执行输出。' },
      { name: 'Other Actor', type: 'actor', desc: '进入碰撞的 Actor。' },
    ] },
  { id: 'anydamage', title: 'Event AnyDamage', category: '事件', color: NODE_COLORS.event,
    desc: '受到伤害时触发。',
    inputs: [], outputs: [
      { name: '', type: 'exec', desc: '执行输出。' },
      { name: 'Damage', type: 'float', desc: '伤害值。' },
    ] },
  { id: 'destroyed', title: 'Event Destroyed', category: '事件', color: NODE_COLORS.event,
    desc: 'Actor 被销毁时触发。',
    inputs: [], outputs: [{ name: '', type: 'exec', desc: '执行输出。' }] },

  // —— 输入 ——
  { id: 'inputaction', title: 'Input Action', category: '输入', color: NODE_COLORS.event,
    desc: '按下指定按键时触发。',
    inputs: [], outputs: [
      { name: 'Pressed', type: 'exec', desc: '按下时执行。' },
      { name: 'Released', type: 'exec', desc: '松开时执行。' },
    ] },

  // —— 流程控制 ——
  { id: 'branch', title: 'Branch', category: '流程控制', color: NODE_COLORS.flow,
    desc: '条件判断。',
    inputs: [
      { name: '', type: 'exec', desc: '执行输入。' },
      { name: 'Condition', type: 'bool', desc: '判断条件。' },
    ], outputs: [
      { name: 'True', type: 'exec', desc: '真。' },
      { name: 'False', type: 'exec', desc: '假。' },
    ] },
  { id: 'sequence', title: 'Sequence', category: '流程控制', color: NODE_COLORS.flow,
    desc: '按顺序执行多条。',
    inputs: [{ name: '', type: 'exec', desc: '执行输入。' }],
    outputs: [
      { name: 'Then 0', type: 'exec', desc: '1。' },
      { name: 'Then 1', type: 'exec', desc: '2。' },
      { name: 'Then 2', type: 'exec', desc: '3。' },
    ] },
  { id: 'doonce', title: 'Do Once', category: '流程控制', color: NODE_COLORS.flow,
    desc: '只执行一次。',
    inputs: [
      { name: '', type: 'exec', desc: '执行输入。' },
      { name: 'Reset', type: 'exec', desc: '重置。' },
      { name: 'Start Closed', type: 'bool', desc: '初始是否关闭。' },
    ], outputs: [{ name: 'Completed', type: 'exec', desc: '执行输出。' }] },
  { id: 'flipflop', title: 'Flip Flop', category: '流程控制', color: NODE_COLORS.flow,
    desc: 'A/B 交替执行。',
    inputs: [{ name: '', type: 'exec', desc: '执行输入。' }],
    outputs: [
      { name: 'A', type: 'exec', desc: 'A 输出。' },
      { name: 'B', type: 'exec', desc: 'B 输出。' },
      { name: 'Is A', type: 'bool', desc: '当前是否是 A。' },
    ] },
  { id: 'gate', title: 'Gate', category: '流程控制', color: NODE_COLORS.flow,
    desc: '门控执行。',
    inputs: [
      { name: 'Enter', type: 'exec', desc: '进入。' },
      { name: 'Open', type: 'exec', desc: '打开。' },
      { name: 'Close', type: 'exec', desc: '关闭。' },
      { name: 'Start Closed', type: 'bool', desc: '初始是否关闭。' },
    ], outputs: [{ name: 'Exit', type: 'exec', desc: '输出。' }] },
  { id: 'foreachloop', title: 'For Each Loop', category: '流程控制', color: NODE_COLORS.flow,
    desc: '遍历数组。',
    inputs: [
      { name: '', type: 'exec', desc: '执行输入。' },
      { name: 'Array', type: 'object', desc: '要遍历的数组。' },
    ], outputs: [
      { name: 'Loop Body', type: 'exec', desc: '循环体。' },
      { name: 'Array Element', type: 'object', desc: '当前元素。' },
      { name: 'Array Index', type: 'int', desc: '当前索引。' },
      { name: 'Completed', type: 'exec', desc: '循环完成。' },
    ] },
  { id: 'delay', title: 'Delay', category: '流程控制', color: NODE_COLORS.flow,
    desc: '延迟执行。',
    inputs: [
      { name: '', type: 'exec', desc: '执行输入。' },
      { name: 'Duration', type: 'float', desc: '延迟时间（秒）。' },
    ], outputs: [{ name: 'Completed', type: 'exec', desc: '延迟完成。' }] },
  { id: 'openlevel', title: 'Open Level', category: '流程控制', color: NODE_COLORS.flow,
    desc: '加载指定关卡。',
    inputs: [
      { name: '', type: 'exec', desc: '执行输入。' },
      { name: 'Level Name', type: 'string', desc: '关卡名。' },
    ], outputs: [{ name: '', type: 'exec', desc: '执行输出。' }] },

  // —— 角色 ——
  { id: 'getplayer', title: 'Get Player Character', category: '角色', color: NODE_COLORS.character,
    desc: '拿到玩家 Character 引用。',
    inputs: [{ name: 'Player Index', type: 'int', desc: '玩家索引。' }],
    outputs: [{ name: 'Return Value', type: 'actor', desc: '玩家引用。' }] },
  { id: 'getallactors', title: 'Get All Actors of Class', category: '角色', color: NODE_COLORS.character,
    desc: '按类型查找所有 Actor。',
    inputs: [{ name: 'Actor Class', type: 'class', desc: '要查找的类。' }],
    outputs: [{ name: 'Out Actors', type: 'object', desc: 'Actor 数组。' }] },
  { id: 'addmovement', title: 'Add Movement Input', category: '角色', color: NODE_COLORS.character,
    desc: '给角色添加移动输入。',
    inputs: [
      { name: '', type: 'exec', desc: '执行输入。' },
      { name: 'World Direction', type: 'vector', desc: '移动方向。' },
      { name: 'Scale Value', type: 'float', desc: '速度倍率。' },
    ], outputs: [{ name: '', type: 'exec', desc: '执行输出。' }] },
  { id: 'getvelocity', title: 'Get Velocity', category: '角色', color: NODE_COLORS.character,
    desc: '获取 Actor 当前速度。',
    inputs: [{ name: 'Target', type: 'actor', desc: '目标 Actor。' }],
    outputs: [{ name: 'Return Value', type: 'vector', desc: '速度向量。' }] },
  { id: 'setvelocity', title: 'Set Velocity', category: '角色', color: NODE_COLORS.character,
    desc: '设置 Actor 的速度。',
    inputs: [
      { name: '', type: 'exec', desc: '执行输入。' },
      { name: 'New Velocity', type: 'vector', desc: '速度向量。' },
    ], outputs: [{ name: '', type: 'exec', desc: '执行输出。' }] },

  // —— 变换 ——
  { id: 'getactorlocation', title: 'Get Actor Location', category: '变换', color: NODE_COLORS.transform,
    desc: '获取 Actor 的世界坐标。',
    inputs: [{ name: 'Target', type: 'actor', desc: '目标 Actor。' }],
    outputs: [{ name: 'Return Value', type: 'vector', desc: '坐标。' }] },
  { id: 'getforward', title: 'Get Actor Forward Vector', category: '变换', color: NODE_COLORS.transform,
    desc: '获取 Actor 的朝前方向。',
    inputs: [{ name: 'Target', type: 'actor', desc: '目标 Actor。' }],
    outputs: [{ name: 'Return Value', type: 'vector', desc: '方向向量。' }] },
  { id: 'getdistance', title: 'Get Distance To', category: '变换', color: NODE_COLORS.transform,
    desc: '计算两个位置之间的距离。',
    inputs: [{ name: 'Other Actor', type: 'actor', desc: '另一个 Actor。' }],
    outputs: [{ name: 'Return Value', type: 'float', desc: '距离。' }] },
  { id: 'setactorlocation', title: 'Set Actor Location', category: '变换', color: NODE_COLORS.transform,
    desc: '设置 Actor 的世界坐标。',
    inputs: [
      { name: '', type: 'exec', desc: '执行输入。' },
      { name: 'New Location', type: 'vector', desc: '新坐标。' },
    ], outputs: [{ name: '', type: 'exec', desc: '执行输出。' }] },
  { id: 'setactorrotation', title: 'Set Actor Rotation', category: '变换', color: NODE_COLORS.transform,
    desc: '设置 Actor 的旋转。',
    inputs: [
      { name: '', type: 'exec', desc: '执行输入。' },
      { name: 'New Rotation', type: 'rotator', desc: '新旋转。' },
    ], outputs: [{ name: '', type: 'exec', desc: '执行输出。' }] },
  { id: 'setactorvisibility', title: 'Set Actor Visibility', category: '变换', color: NODE_COLORS.transform,
    desc: '设置 Actor 是否可见。',
    inputs: [
      { name: '', type: 'exec', desc: '执行输入。' },
      { name: 'New Hidden', type: 'bool', desc: '是否隐藏。' },
    ], outputs: [{ name: '', type: 'exec', desc: '执行输出。' }] },
  { id: 'addrotation', title: 'Add Actor Local Rotation', category: '变换', color: NODE_COLORS.transform,
    desc: '相对旋转。',
    inputs: [
      { name: '', type: 'exec', desc: '执行输入。' },
      { name: 'Delta Rotation', type: 'rotator', desc: '旋转增量。' },
    ], outputs: [{ name: '', type: 'exec', desc: '执行输出。' }] },
  { id: 'findlookat', title: 'Find Look at Rotation', category: '变换', color: NODE_COLORS.transform,
    desc: '计算从起点看向终点的旋转。',
    inputs: [
      { name: 'Start', type: 'vector', desc: '起点。' },
      { name: 'Target', type: 'vector', desc: '终点。' },
    ], outputs: [{ name: 'Return Value', type: 'rotator', desc: '旋转。' }] },
  { id: 'makevector', title: 'Make Vector', category: '变换', color: NODE_COLORS.transform,
    desc: '把 X/Y/Z 组合成 vector。',
    inputs: [
      { name: 'X', type: 'float', desc: 'X 分量。' },
      { name: 'Y', type: 'float', desc: 'Y 分量。' },
      { name: 'Z', type: 'float', desc: 'Z 分量。' },
    ], outputs: [{ name: 'Return Value', type: 'vector', desc: '向量。' }] },
  { id: 'breakvector', title: 'Break Vector', category: '变换', color: NODE_COLORS.transform,
    desc: '把 vector 拆为 X/Y/Z。',
    inputs: [{ name: 'In Vec', type: 'vector', desc: '输入向量。' }],
    outputs: [
      { name: 'X', type: 'float', desc: 'X 分量。' },
      { name: 'Y', type: 'float', desc: 'Y 分量。' },
      { name: 'Z', type: 'float', desc: 'Z 分量。' },
    ] },

  // —— 类型转换 ——
  { id: 'cast', title: 'Cast To BP_Player', category: '类型转换', color: NODE_COLORS.cast,
    desc: '类型转换。',
    inputs: [
      { name: '', type: 'exec', desc: '执行输入。' },
      { name: 'Object', type: 'object', desc: '要转换的对象。' },
    ], outputs: [
      { name: 'As Player', type: 'actor', desc: '转换结果。' },
      { name: 'Cast Failed', type: 'exec', desc: '失败。' },
      { name: '', type: 'exec', desc: '成功。' },
    ] },

  // —— 生成 ——
  { id: 'spawn', title: 'Spawn Actor from Class', category: '生成', color: NODE_COLORS.spawn,
    desc: '运行时生成 Actor。',
    inputs: [
      { name: '', type: 'exec', desc: '执行输入。' },
      { name: 'Class', type: 'class', desc: '要生成的类。' },
      { name: 'Spawn Transform', type: 'rotator', desc: '生成位置。' },
      { name: 'Collision Handling', type: 'string', desc: '碰撞处理。' },
    ], outputs: [
      { name: '', type: 'exec', desc: '执行输出。' },
      { name: 'Return Value', type: 'actor', desc: '生成的 Actor。' },
    ] },
  { id: 'destroy', title: 'Destroy Actor', category: '生成', color: NODE_COLORS.spawn,
    desc: '销毁 Actor。',
    inputs: [
      { name: '', type: 'exec', desc: '执行输入。' },
      { name: 'Target', type: 'actor', desc: '要销毁的 Actor。' },
    ], outputs: [{ name: '', type: 'exec', desc: '执行输出。' }] },

  // —— 定时器 ——
  { id: 'settimer', title: 'Set Timer by Event', category: '定时器', color: NODE_COLORS.timer,
    desc: '延迟或重复执行。',
    inputs: [
      { name: '', type: 'exec', desc: '执行输入。' },
      { name: 'Object', type: 'object', desc: '目标对象。' },
      { name: 'Event', type: 'bool', desc: '事件委托。' },
      { name: 'Time', type: 'float', desc: '时间。' },
      { name: 'Looping', type: 'bool', desc: '是否循环。' },
    ], outputs: [
      { name: '', type: 'exec', desc: '执行输出。' },
      { name: 'Return Value', type: 'object', desc: 'Timer Handle。' },
    ] },

  // —— 数学 ——
  { id: 'lerp', title: 'Lerp', category: '数学', color: NODE_COLORS.math,
    desc: '线性插值。',
    inputs: [
      { name: 'A', type: 'float', desc: '起点。' },
      { name: 'B', type: 'float', desc: '终点。' },
      { name: 'Alpha', type: 'float', desc: '插值比例 0~1。' },
    ], outputs: [{ name: 'Return Value', type: 'float', desc: '结果。' }] },
  { id: 'add_float', title: 'Add (Float)', category: '数学', color: NODE_COLORS.math,
    desc: '两个浮点数相加。',
    inputs: [
      { name: 'A', type: 'float', desc: '加数 A。' },
      { name: 'B', type: 'float', desc: '加数 B。' },
    ], outputs: [{ name: 'Return Value', type: 'float', desc: 'A + B。' }] },
  { id: 'subtract_float', title: 'Subtract (Float)', category: '数学', color: NODE_COLORS.math,
    desc: '两个浮点数相减。',
    inputs: [
      { name: 'A', type: 'float', desc: '被减数。' },
      { name: 'B', type: 'float', desc: '减数。' },
    ], outputs: [{ name: 'Return Value', type: 'float', desc: 'A - B。' }] },
  { id: 'multiply_float', title: 'Multiply (Float)', category: '数学', color: NODE_COLORS.math,
    desc: '两个浮点数相乘。',
    inputs: [
      { name: 'A', type: 'float', desc: '因数 A。' },
      { name: 'B', type: 'float', desc: '因数 B。' },
    ], outputs: [{ name: 'Return Value', type: 'float', desc: 'A × B。' }] },
  { id: 'greater_float', title: 'Greater (Float)', category: '数学', color: NODE_COLORS.math,
    desc: '判断 A 是否大于 B。',
    inputs: [
      { name: 'A', type: 'float', desc: '被比较数。' },
      { name: 'B', type: 'float', desc: '比较数。' },
    ], outputs: [{ name: 'Return Value', type: 'bool', desc: 'A > B。' }] },

  // —— UI ——
  { id: 'createwidget', title: 'Create Widget', category: 'UI', color: NODE_COLORS.ui,
    desc: '创建 UI 控件。',
    inputs: [{ name: 'Class', type: 'class', desc: 'Widget 类。' }],
    outputs: [{ name: 'Return Value', type: 'object', desc: '创建的控件。' }] },
  { id: 'addviewport', title: 'Add to Viewport', category: 'UI', color: NODE_COLORS.ui,
    desc: '把控件加到屏幕。',
    inputs: [
      { name: '', type: 'exec', desc: '执行输入。' },
      { name: 'Target', type: 'object', desc: '控件。' },
    ], outputs: [{ name: '', type: 'exec', desc: '执行输出。' }] },
  { id: 'setposviewport', title: 'Set Position in Viewport', category: 'UI', color: NODE_COLORS.ui,
    desc: '设置控件在屏幕中的位置。',
    inputs: [
      { name: '', type: 'exec', desc: '执行输入。' },
      { name: 'Target', type: 'object', desc: '控件。' },
      { name: 'Position', type: 'vector', desc: '屏幕坐标。' },
    ], outputs: [{ name: '', type: 'exec', desc: '执行输出。' }] },
  { id: 'worldtoscreen', title: 'Project World to Screen', category: 'UI', color: NODE_COLORS.ui,
    desc: '世界坐标转屏幕坐标。',
    inputs: [{ name: 'World Position', type: 'vector', desc: '世界坐标。' }],
    outputs: [{ name: 'Screen Position', type: 'vector', desc: '屏幕坐标。' }] },
  { id: 'settext', title: 'Set Text', category: 'UI', color: NODE_COLORS.ui,
    desc: '设置文本控件的文字。',
    inputs: [
      { name: '', type: 'exec', desc: '执行输入。' },
      { name: 'Target', type: 'object', desc: '文本控件。' },
      { name: 'In Text', type: 'string', desc: '新文字。' },
    ], outputs: [{ name: '', type: 'exec', desc: '执行输出。' }] },

  // —— 音频 ——
  { id: 'playsound', title: 'Play Sound at Location', category: '音频', color: NODE_COLORS.audio,
    desc: '在指定位置播放音效。',
    inputs: [
      { name: '', type: 'exec', desc: '执行输入。' },
      { name: 'Sound', type: 'object', desc: '音效资源。' },
      { name: 'Location', type: 'vector', desc: '播放位置。' },
    ], outputs: [{ name: '', type: 'exec', desc: '执行输出。' }] },
  { id: 'playsound2d', title: 'Play Sound 2D', category: '音频', color: NODE_COLORS.audio,
    desc: '播放 2D 音效（无位置）。',
    inputs: [
      { name: '', type: 'exec', desc: '执行输入。' },
      { name: 'Sound', type: 'object', desc: '音效资源。' },
    ], outputs: [{ name: '', type: 'exec', desc: '执行输出。' }] },

  // —— 存档 ——
  { id: 'savegame', title: 'Save Game to Slot', category: '存档', color: NODE_COLORS.save,
    desc: '保存游戏到指定槽位。',
    inputs: [
      { name: '', type: 'exec', desc: '执行输入。' },
      { name: 'Save Game Object', type: 'object', desc: '存档对象。' },
      { name: 'Slot Name', type: 'string', desc: '槽位名。' },
    ], outputs: [
      { name: '', type: 'exec', desc: '执行输出。' },
      { name: 'Return Value', type: 'bool', desc: '是否成功。' },
    ] },
  { id: 'loadgame', title: 'Load Game from Slot', category: '存档', color: NODE_COLORS.save,
    desc: '从槽位读取存档。',
    inputs: [{ name: 'Slot Name', type: 'string', desc: '槽位名。' }],
    outputs: [{ name: 'Return Value', type: 'object', desc: '存档对象。' }] },

  // —— 调试 ——
  { id: 'print', title: 'Print String', category: '调试', color: NODE_COLORS.debug,
    desc: '在屏幕上打印文字，调试神器。',
    inputs: [
      { name: '', type: 'exec', desc: '执行输入。' },
      { name: 'In String', type: 'string', desc: '要打印的文字。' },
      { name: 'Duration', type: 'float', desc: '显示时长。' },
    ], outputs: [{ name: '', type: 'exec', desc: '执行输出。' }] },

  // —— 工具 ——
  { id: 'isvalid', title: 'Is Valid', category: '工具', color: NODE_COLORS.pure,
    desc: '检查对象是否有效。',
    inputs: [{ name: 'Object', type: 'object', desc: '要检查的对象。' }],
    outputs: [{ name: 'Return Value', type: 'bool', desc: '是否有效。' }] },
  { id: 'getworlddelta', title: 'Get World Delta Seconds', category: '工具', color: NODE_COLORS.pure,
    desc: '获取当前帧时间间隔。',
    inputs: [],
    outputs: [{ name: 'Return Value', type: 'float', desc: '帧时间。' }] },

  // —— 变量 ——
  { id: 'varget_bool', title: 'Get Bool Variable', category: '变量', color: NODE_COLORS.variable,
    desc: '读取布尔变量。', inputs: [], outputs: [{ name: 'Value', type: 'bool', desc: '变量值。' }] },
  { id: 'varset_bool', title: 'Set Bool Variable', category: '变量', color: NODE_COLORS.variable,
    desc: '设置布尔变量。',
    inputs: [
      { name: '', type: 'exec', desc: '执行输入。' },
      { name: 'Value', type: 'bool', desc: '新值。' },
    ], outputs: [{ name: '', type: 'exec', desc: '执行输出。' }] },
  { id: 'varget_float', title: 'Get Float Variable', category: '变量', color: NODE_COLORS.variable,
    desc: '读取浮点变量。', inputs: [], outputs: [{ name: 'Value', type: 'float', desc: '变量值。' }] },
  { id: 'varset_float', title: 'Set Float Variable', category: '变量', color: NODE_COLORS.variable,
    desc: '设置浮点变量。',
    inputs: [
      { name: '', type: 'exec', desc: '执行输入。' },
      { name: 'Value', type: 'float', desc: '新值。' },
    ], outputs: [{ name: '', type: 'exec', desc: '执行输出。' }] },
  { id: 'varget_int', title: 'Get Int Variable', category: '变量', color: NODE_COLORS.variable,
    desc: '读取整数变量。', inputs: [], outputs: [{ name: 'Value', type: 'int', desc: '变量值。' }] },
  { id: 'varset_int', title: 'Set Int Variable', category: '变量', color: NODE_COLORS.variable,
    desc: '设置整数变量。',
    inputs: [
      { name: '', type: 'exec', desc: '执行输入。' },
      { name: 'Value', type: 'int', desc: '新值。' },
    ], outputs: [{ name: '', type: 'exec', desc: '执行输出。' }] },
];

/* ==================== 模板 ==================== */
const TEMPLATES: Template[] = [
  {
    id: 'tpl_door', name: '1. 开门交互', desc: '走近门按 E 开关门',
    nodes: [
      { refId: 'begin', nodeId: 'beginplay', x: 60, y: 60 },
      { refId: 'getplayer', nodeId: 'getplayer', x: 60, y: 240 },
      { refId: 'cast', nodeId: 'cast', x: 380, y: 60 },
      { refId: 'input', nodeId: 'inputaction', x: 60, y: 420 },
      { refId: 'varget', nodeId: 'varget_bool', x: 380, y: 300 },
      { refId: 'branch', nodeId: 'branch', x: 700, y: 300 },
      { refId: 'setopen_t', nodeId: 'varset_bool', x: 1020, y: 260 },
      { refId: 'rot1', nodeId: 'setactorrotation', x: 1340, y: 260 },
      { refId: 'setopen_f', nodeId: 'varset_bool', x: 1020, y: 440 },
      { refId: 'rot2', nodeId: 'setactorrotation', x: 1340, y: 440 },
    ],
    connections: [
      { fromRef: 'getplayer', fromPort: 0, toRef: 'cast', toPort: 1 },
      { fromRef: 'input', fromPort: 0, toRef: 'branch', toPort: 0 },
      { fromRef: 'varget', fromPort: 0, toRef: 'branch', toPort: 1 },
      { fromRef: 'branch', fromPort: 0, toRef: 'setopen_t', toPort: 0 },
      { fromRef: 'setopen_t', fromPort: 0, toRef: 'rot1', toPort: 0 },
      { fromRef: 'branch', fromPort: 1, toRef: 'setopen_f', toPort: 0 },
      { fromRef: 'setopen_f', fromPort: 0, toRef: 'rot2', toPort: 0 },
    ],
  },
  {
    id: 'tpl_healthbar', name: '2. 血条 UI 跟随', desc: '血条跟着角色头顶',
    nodes: [
      { refId: 'begin', nodeId: 'beginplay', x: 60, y: 60 },
      { refId: 'create', nodeId: 'createwidget', x: 60, y: 240 },
      { refId: 'add', nodeId: 'addviewport', x: 380, y: 60 },
      { refId: 'tick', nodeId: 'tick', x: 60, y: 480 },
      { refId: 'loc', nodeId: 'getactorlocation', x: 60, y: 660 },
      { refId: 'proj', nodeId: 'worldtoscreen', x: 380, y: 480 },
      { refId: 'setpos', nodeId: 'setposviewport', x: 700, y: 480 },
    ],
    connections: [
      { fromRef: 'begin', fromPort: 0, toRef: 'add', toPort: 0 },
      { fromRef: 'create', fromPort: 0, toRef: 'add', toPort: 1 },
      { fromRef: 'tick', fromPort: 0, toRef: 'setpos', toPort: 0 },
      { fromRef: 'loc', fromPort: 0, toRef: 'proj', toPort: 0 },
      { fromRef: 'proj', fromPort: 0, toRef: 'setpos', toPort: 2 },
    ],
  },
  {
    id: 'tpl_fire', name: '3. 子弹发射', desc: '鼠标左键发射子弹',
    nodes: [
      { refId: 'input', nodeId: 'inputaction', x: 60, y: 60 },
      { refId: 'spawn', nodeId: 'spawn', x: 380, y: 60 },
      { refId: 'fwd', nodeId: 'getforward', x: 60, y: 300 },
      { refId: 'setvel', nodeId: 'setvelocity', x: 700, y: 60 },
    ],
    connections: [
      { fromRef: 'input', fromPort: 0, toRef: 'spawn', toPort: 0 },
      { fromRef: 'spawn', fromPort: 0, toRef: 'setvel', toPort: 0 },
      { fromRef: 'fwd', fromPort: 0, toRef: 'setvel', toPort: 1 },
    ],
  },
  {
    id: 'tpl_pickup', name: '4. 拾取道具', desc: '走进道具自动拾取',
    nodes: [
      { refId: 'overlap', nodeId: 'beginoverlap', x: 60, y: 60 },
      { refId: 'cast', nodeId: 'cast', x: 380, y: 60 },
      { refId: 'sound', nodeId: 'playsound', x: 700, y: 60 },
      { refId: 'destroy', nodeId: 'destroy', x: 1020, y: 60 },
    ],
    connections: [
      { fromRef: 'overlap', fromPort: 0, toRef: 'cast', toPort: 0 },
      { fromRef: 'overlap', fromPort: 1, toRef: 'cast', toPort: 1 },
      { fromRef: 'cast', fromPort: 2, toRef: 'sound', toPort: 0 },
      { fromRef: 'sound', fromPort: 0, toRef: 'destroy', toPort: 0 },
    ],
  },
  {
    id: 'tpl_float', name: '5. 物体上下浮动', desc: '装饰物上下漂浮（简化版）',
    nodes: [
      { refId: 'begin', nodeId: 'beginplay', x: 60, y: 60 },
      { refId: 'timer', nodeId: 'settimer', x: 380, y: 60 },
      { refId: 'tick', nodeId: 'tick', x: 60, y: 300 },
      { refId: 'setloc', nodeId: 'setactorlocation', x: 380, y: 300 },
    ],
    connections: [
      { fromRef: 'begin', fromPort: 0, toRef: 'timer', toPort: 0 },
      { fromRef: 'tick', fromPort: 0, toRef: 'setloc', toPort: 0 },
    ],
  },
  {
    id: 'tpl_timer', name: '6. 倒计时', desc: '限时关卡倒计时',
    nodes: [
      { refId: 'begin', nodeId: 'beginplay', x: 60, y: 60 },
      { refId: 'timer', nodeId: 'settimer', x: 380, y: 60 },
      { refId: 'sub', nodeId: 'varget_float', x: 60, y: 300 },
      { refId: 'setf', nodeId: 'varset_float', x: 380, y: 300 },
      { refId: 'branch', nodeId: 'branch', x: 700, y: 300 },
      { refId: 'level', nodeId: 'openlevel', x: 1020, y: 260 },
      { refId: 'text', nodeId: 'settext', x: 1020, y: 440 },
    ],
    connections: [
      { fromRef: 'begin', fromPort: 0, toRef: 'timer', toPort: 0 },
      { fromRef: 'timer', fromPort: 0, toRef: 'setf', toPort: 0 },
      { fromRef: 'sub', fromPort: 0, toRef: 'setf', toPort: 1 },
      { fromRef: 'setf', fromPort: 0, toRef: 'branch', toPort: 0 },
      { fromRef: 'branch', fromPort: 0, toRef: 'level', toPort: 0 },
      { fromRef: 'branch', fromPort: 1, toRef: 'text', toPort: 0 },
    ],
  },
  {
    id: 'tpl_ai', name: '7. AI 追逐', desc: '敌人追玩家（简化版）',
    nodes: [
      { refId: 'tick', nodeId: 'tick', x: 60, y: 60 },
      { refId: 'getplayer', nodeId: 'getplayer', x: 60, y: 240 },
      { refId: 'find', nodeId: 'findlookat', x: 380, y: 60 },
      { refId: 'setrot', nodeId: 'setactorrotation', x: 700, y: 60 },
      { refId: 'dist', nodeId: 'getdistance', x: 380, y: 300 },
      { refId: 'branch', nodeId: 'branch', x: 700, y: 300 },
      { refId: 'move', nodeId: 'addmovement', x: 1020, y: 300 },
    ],
    connections: [
      { fromRef: 'tick', fromPort: 0, toRef: 'setrot', toPort: 0 },
      { fromRef: 'find', fromPort: 0, toRef: 'setrot', toPort: 1 },
      { fromRef: 'tick', fromPort: 0, toRef: 'branch', toPort: 0 },
      { fromRef: 'getplayer', fromPort: 0, toRef: 'dist', toPort: 0 },
      { fromRef: 'branch', fromPort: 0, toRef: 'move', toPort: 0 },
    ],
  },
  {
    id: 'tpl_keydoor', name: '8. 钥匙开门', desc: '有钥匙才能开门',
    nodes: [
      { refId: 'input', nodeId: 'inputaction', x: 60, y: 60 },
      { refId: 'cast', nodeId: 'cast', x: 380, y: 60 },
      { refId: 'getkey', nodeId: 'varget_bool', x: 60, y: 300 },
      { refId: 'branch', nodeId: 'branch', x: 700, y: 60 },
      { refId: 'sound', nodeId: 'playsound', x: 1020, y: 30 },
      { refId: 'rot', nodeId: 'setactorrotation', x: 1340, y: 30 },
      { refId: 'text', nodeId: 'settext', x: 1020, y: 240 },
    ],
    connections: [
      { fromRef: 'input', fromPort: 0, toRef: 'branch', toPort: 0 },
      { fromRef: 'getkey', fromPort: 0, toRef: 'branch', toPort: 1 },
      { fromRef: 'branch', fromPort: 0, toRef: 'sound', toPort: 0 },
      { fromRef: 'sound', fromPort: 0, toRef: 'rot', toPort: 0 },
      { fromRef: 'branch', fromPort: 1, toRef: 'text', toPort: 0 },
    ],
  },
  {
    id: 'tpl_rotate', name: '9. 掉落物旋转', desc: '宝箱/金币一直旋转',
    nodes: [
      { refId: 'tick', nodeId: 'tick', x: 60, y: 60 },
      { refId: 'addrot', nodeId: 'addrotation', x: 380, y: 60 },
    ],
    connections: [
      { fromRef: 'tick', fromPort: 0, toRef: 'addrot', toPort: 0 },
    ],
  },
  {
    id: 'tpl_save', name: '10. 存档/读档', desc: '按 F5 存、F9 读',
    nodes: [
      { refId: 'input_save', nodeId: 'inputaction', x: 60, y: 60 },
      { refId: 'save', nodeId: 'savegame', x: 380, y: 60 },
      { refId: 'input_load', nodeId: 'inputaction', x: 60, y: 300 },
      { refId: 'load', nodeId: 'loadgame', x: 60, y: 480 },
      { refId: 'setint', nodeId: 'varset_int', x: 380, y: 300 },
      { refId: 'valid', nodeId: 'isvalid', x: 380, y: 480 },
    ],
    connections: [
      { fromRef: 'input_save', fromPort: 0, toRef: 'save', toPort: 0 },
      { fromRef: 'input_load', fromPort: 0, toRef: 'setint', toPort: 0 },
      { fromRef: 'load', fromPort: 0, toRef: 'valid', toPort: 0 },
    ],
  },
];
/* ==================== 工具函数 ==================== */
function sortPorts(ports: Port[]): Port[] {
  return [...ports].sort((a, b) => {
    if (a.type === 'exec' && b.type !== 'exec') return -1;
    if (a.type !== 'exec' && b.type === 'exec') return 1;
    return 0;
  });
}

function getPortPosition(node: PlacedNode, side: 'in' | 'out', index: number): { x: number; y: number } {
  const y = node.y + HEADER_H + PORT_AREA_PT + index * PORT_ROW_H + PORT_DOT_OFFSET;
  const x = side === 'in' ? node.x : node.x + NODE_WIDTH;
  return { x, y };
}

function bezierPath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.max(40, Math.abs(x2 - x1) * 0.5);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

/* ==================== 端口 ==================== */
function PortView({
  port, side, onStartDrag, onEndDrag, connecting, highlight, onHoverChange, onPortEnter, onPortLeave,
}: {
  port: Port; side: 'in' | 'out';
  onStartDrag?: (side: 'in' | 'out', e: React.MouseEvent) => void;
  onEndDrag?: (side: 'in' | 'out', e: React.MouseEvent) => void;
  connecting: boolean; highlight: boolean;
  onHoverChange: (hovering: boolean) => void;
  onPortEnter?: () => void; onPortLeave?: () => void;
}) {
  const [hover, setHover] = useState(false);
  const color = PORT_COLORS[port.type];
  return (
    <div
      data-port
      className={`relative flex items-center gap-2 ${side === 'in' ? 'flex-row' : 'flex-row-reverse'}`}
      onMouseEnter={(e) => { e.stopPropagation(); setHover(true); onHoverChange(true); onPortEnter?.(); }}
      onMouseLeave={(e) => { e.stopPropagation(); setHover(false); onHoverChange(false); onPortLeave?.(); }}
    >
      <div
        className="h-3 w-3 shrink-0 cursor-crosshair rounded-full border border-black/40 transition-transform"
        style={{
          background: color,
          transform: hover || highlight ? 'scale(1.6)' : 'scale(1)',
          boxShadow: highlight ? `0 0 8px ${color}` : 'none',
        }}
        onMouseDown={(e) => { e.stopPropagation(); onStartDrag?.(side, e); }}
        onMouseUp={(e) => { e.stopPropagation(); onEndDrag?.(side, e); }}
      />
      <span className="text-[11px] font-light text-[#c9c9cd]">{port.name || ' '}</span>
      {hover && (
        <div className={`pointer-events-none absolute top-full z-[80] mt-1 w-64 border border-[#333] bg-[#1a1a1c] p-3 text-left shadow-xl ${side === 'in' ? 'left-0' : 'right-0'}`}>
          <p className="text-[11px] font-medium text-[#f0f0f0]">{port.name || (side === 'in' ? '执行输入' : '执行输出')}</p>
          <p className="mt-1 text-[10px] text-[#8b8b8f]">类型：<span style={{ color }}>{PORT_LABELS[port.type]}</span></p>
          <p className="mt-2 text-[10px] leading-5 text-[#a0a0a5]">{port.desc}</p>
        </div>
      )}
    </div>
  );
}

/* ==================== 画布节点 ==================== */
function PlacedNodeView({
  node, selected, onDrag, onStartConnect, onEndConnect, connecting, highlightedPorts,
  onContextMenu, onPortEnter, onPortLeave, onMouseDownSelect,
}: {
  node: PlacedNode; selected: boolean;
  onDrag: (id: string, dx: number, dy: number) => void;
  onStartConnect: (instanceId: string, side: 'in' | 'out', portIndex: number, e: React.MouseEvent) => void;
  onEndConnect: (instanceId: string, side: 'in' | 'out', portIndex: number, e: React.MouseEvent) => void;
  connecting: boolean; highlightedPorts: Set<string>;
  onContextMenu: (e: React.MouseEvent, instanceId: string) => void;
  onPortEnter: (instanceId: string, side: 'in' | 'out', portIndex: number) => void;
  onPortLeave: () => void;
  onMouseDownSelect: (e: React.MouseEvent, instanceId: string) => void;
}) {
  const [hoverTarget, setHoverTarget] = useState<'node' | 'port' | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const onMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    onMouseDownSelect(e, node.instanceId);
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    dragStart.current = { x: e.clientX, y: e.clientY };
    onDrag(node.instanceId, dx, dy);
  };
  const onMouseUp = () => setDragging(false);

  return (
    <div
      className="absolute select-none"
      data-node
      style={{ left: node.x, top: node.y, width: NODE_WIDTH }}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onContextMenu={(e) => onContextMenu(e, node.instanceId)}
    >
      <div
        className="border bg-[#151517] shadow-lg"
        style={{ borderColor: selected ? '#ffd700' : hoverTarget === 'node' ? '#e8704a' : '#2a2a2e' }}
        onMouseEnter={() => setHoverTarget('node')}
        onMouseLeave={(e) => {
          const related = e.relatedTarget as HTMLElement | null;
          if (related?.closest('[data-port]')) return;
          setHoverTarget(null);
        }}
      >
        <div
          onMouseDown={onMouseDown}
          className="cursor-grab border-b border-black/40 px-3 py-2 active:cursor-grabbing"
          style={{
            background: `linear-gradient(180deg, ${node.color}, ${node.color}cc)`,
            height: HEADER_H,
          }}
        >
          <p className="text-xs font-light tracking-wider text-white">{node.title}</p>
          <p className="mt-0.5 text-[10px] text-white/70">{node.category}</p>
        </div>

        <div className="flex justify-between gap-3 px-3 py-2" style={{ minHeight: 40 }}>
          <div className="flex flex-col gap-1.5">
            {node.inputs.map((p, i) => (
              <PortView key={i} port={p} side="in" connecting={connecting}
                highlight={highlightedPorts.has(`${node.instanceId}:in:${i}`)}
                onStartDrag={(s, e) => onStartConnect(node.instanceId, s, i, e)}
                onEndDrag={(s, e) => onEndConnect(node.instanceId, s, i, e)}
                onHoverChange={(h) => setHoverTarget(h ? 'port' : 'node')}
                onPortEnter={() => onPortEnter(node.instanceId, 'in', i)}
                onPortLeave={onPortLeave}
              />
            ))}
          </div>
          <div className="flex flex-col items-end gap-1.5">
            {node.outputs.map((p, i) => (
              <PortView key={i} port={p} side="out" connecting={connecting}
                highlight={highlightedPorts.has(`${node.instanceId}:out:${i}`)}
                onStartDrag={(s, e) => onStartConnect(node.instanceId, s, i, e)}
                onEndDrag={(s, e) => onEndConnect(node.instanceId, s, i, e)}
                onHoverChange={(h) => setHoverTarget(h ? 'port' : 'node')}
                onPortEnter={() => onPortEnter(node.instanceId, 'out', i)}
                onPortLeave={onPortLeave}
              />
            ))}
          </div>
        </div>
      </div>

      {hoverTarget === 'node' && (
        <div className="pointer-events-none absolute left-0 top-full z-50 mt-2 w-72 border border-[#333] bg-[#1a1a1c] p-3 text-left shadow-xl">
          <p className="text-xs font-medium text-[#f0f0f0]">{node.title}</p>
          <p className="mt-1 text-[10px] text-[#8b8b8f]">{node.category}</p>
          <p className="mt-2 text-[10px] leading-5 text-[#a0a0a5]">{node.desc}</p>
        </div>
      )}
    </div>
  );
}

/* ==================== 左侧库项 ==================== */
function LibraryItem({ node, onAdd, onDragStart, onContextMenu }: {
  node: NodeData; onAdd: () => void;
  onDragStart: (e: React.DragEvent, node: NodeData) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      role="button" tabIndex={0} draggable
      onClick={onAdd}
      onKeyDown={(e) => { if (e.key === 'Enter') onAdd(); }}
      onDragStart={(e) => onDragStart(e, node)}
      onContextMenu={onContextMenu}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="relative w-full cursor-grab border border-[#2a2a2e] bg-[#151517] p-3 pl-4 text-left transition-colors hover:border-[#e8704a] active:cursor-grabbing"
    >
      <span className="absolute left-0 top-0 h-full w-1" style={{ background: node.color }} />
      <p className="text-xs font-light text-[#f0f0f0]">{node.title}</p>
      <p className="mt-0.5 text-[10px] text-[#6b6b70]">{node.category}</p>
      <p className="mt-1.5 line-clamp-2 text-[10px] leading-4 text-[#8b8b8f]">{node.desc}</p>
      {hover && (
        <div className="pointer-events-none absolute left-full top-0 z-50 ml-2 w-64 border border-[#333] bg-[#1a1a1c] p-3 text-left shadow-xl">
          <p className="text-xs font-medium text-[#f0f0f0]">{node.title}</p>
          <p className="mt-1 text-[10px] text-[#8b8b8f]">{node.category}</p>
          <p className="mt-2 text-[10px] leading-5 text-[#a0a0a5]">{node.desc}</p>
        </div>
      )}
    </div>
  );
}

/* ==================== 主页面 ==================== */
export default function MagicSEPortalPage() {
  const [placed, setPlaced] = useState<PlacedNode[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const [pendingFrom, setPendingFrom] = useState<{ instanceId: string; side: 'in' | 'out'; portIndex: number; type: PortType } | null>(null);
  const [pendingValid, setPendingValid] = useState(true);
  const [hoverPort, setHoverPort] = useState<{ instanceId: string; side: 'in' | 'out'; portIndex: number } | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [hoverConnectionId, setHoverConnectionId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; kind: 'canvas' | 'node'; instanceId?: string } | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [librarySearch, setLibrarySearch] = useState('');

  const [history, setHistory] = useState<EditorState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const historyRef = useRef<{ history: EditorState[]; index: number }>({ history: [], index: -1 });

  const clipboard = useRef<PlacedNode[]>([]);
  const panningRef = useRef<{ active: boolean; startX: number; startY: number; panX: number; panY: number } | null>(null);
  const rightDragRef = useRef<{ active: boolean; startX: number; startY: number; panX: number; panY: number; moved: boolean } | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const nextX = useRef(60);
  const nextY = useRef(60);

  const pushHistory = useCallback((state: EditorState) => {
    const ref = historyRef.current;
    const trimmed = ref.history.slice(0, ref.index + 1);
    const next = [...trimmed, { placed: state.placed, connections: state.connections }];
    const MAX = 50;
    const final = next.length > MAX ? next.slice(next.length - MAX) : next;
    historyRef.current = { history: final, index: final.length - 1 };
    setHistory(final);
    setHistoryIndex(final.length - 1);
  }, []);

  const undo = useCallback(() => {
    const ref = historyRef.current;
    if (ref.index <= 0) return;
    const idx = ref.index - 1;
    const s = ref.history[idx];
    historyRef.current = { ...ref, index: idx };
    setHistoryIndex(idx);
    setPlaced(s.placed);
    setConnections(s.connections);
  }, []);

  const redo = useCallback(() => {
    const ref = historyRef.current;
    if (ref.index >= ref.history.length - 1) return;
    const idx = ref.index + 1;
    const s = ref.history[idx];
    historyRef.current = { ...ref, index: idx };
    setHistoryIndex(idx);
    setPlaced(s.placed);
    setConnections(s.connections);
  }, []);

  useEffect(() => {
    pushHistory({ placed: [], connections: [] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addNode = useCallback((node: NodeData, worldX?: number, worldY?: number) => {
    const instanceId = uid(node.id);
    const x = worldX ?? nextX.current;
    const y = worldY ?? nextY.current;
    setPlaced((prev) => {
      const next = [...prev, { ...node, instanceId, x, y, inputs: sortPorts(node.inputs), outputs: sortPorts(node.outputs) }];
      pushHistory({ placed: next, connections });
      return next;
    });
    if (worldX === undefined) {
      nextX.current += 40;
      nextY.current += 40;
      if (nextY.current > 500) { nextY.current = 60; nextX.current += 220; }
      if (nextX.current > 800) nextX.current = 60;
    }
  }, [connections, pushHistory]);

  const loadTemplate = useCallback((tpl: Template) => {
    const refMap: Record<string, PlacedNode> = {};
    const newNodes: PlacedNode[] = [];
    tpl.nodes.forEach((tn) => {
      const base = NODE_LIBRARY.find((n) => n.id === tn.nodeId);
      if (!base) return;
      const instanceId = uid(base.id);
      const placedNode: PlacedNode = {
        ...base,
        instanceId,
        x: tn.x,
        y: tn.y,
        inputs: sortPorts(base.inputs),
        outputs: sortPorts(base.outputs),
      };
      refMap[tn.refId] = placedNode;
      newNodes.push(placedNode);
    });
    const newConns: Connection[] = [];
    tpl.connections.forEach((tc) => {
      const from = refMap[tc.fromRef];
      const to = refMap[tc.toRef];
      if (!from || !to) return;
      const fromPort = from.outputs[tc.fromPort];
      const toPort = to.inputs[tc.toPort];
      if (!fromPort || !toPort || fromPort.type !== toPort.type) return;
      newConns.push({
        id: uid(`${from.instanceId}:${tc.fromPort}->${to.instanceId}:${tc.toPort}`),
        fromInstance: from.instanceId,
        fromPort: tc.fromPort,
        toInstance: to.instanceId,
        toPort: tc.toPort,
        type: fromPort.type,
      });
    });
    setPlaced((prev) => {
      const next = [...prev, ...newNodes];
      setConnections((prevConns) => {
        const nextConns = [...prevConns, ...newConns];
        pushHistory({ placed: next, connections: nextConns });
        return nextConns;
      });
      return next;
    });
    setTemplateOpen(false);
  }, [pushHistory]);

  const deleteSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    setPlaced((prev) => {
      const next = prev.filter((n) => !selectedIds.has(n.instanceId));
      const nextConns = connections.filter((c) => !selectedIds.has(c.fromInstance) && !selectedIds.has(c.toInstance));
      setConnections(nextConns);
      pushHistory({ placed: next, connections: nextConns });
      return next;
    });
    setSelectedIds(new Set());
  }, [selectedIds, connections, pushHistory]);

  const deleteConnection = (id: string) => {
    setConnections((prev) => {
      const next = prev.filter((c) => c.id !== id);
      pushHistory({ placed, connections: next });
      return next;
    });
  };

  const handleDrag = (instanceId: string, dx: number, dy: number) => {
    setPlaced((prev) =>
      prev.map((n) => (n.instanceId === instanceId ? { ...n, x: n.x + dx, y: n.y + dy } : n))
    );
  };

  const commitDragEnd = () => {
    pushHistory({ placed, connections });
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    setScale((s) => Math.min(2.5, Math.max(0.35, s + delta)));
  };

  const onPortEnter = (instanceId: string, side: 'in' | 'out', portIndex: number) => {
    setHoverPort({ instanceId, side, portIndex });
  };
  const onPortLeave = () => setHoverPort(null);

  const startConnect = (instanceId: string, side: 'in' | 'out', portIndex: number) => {
    const node = placed.find((n) => n.instanceId === instanceId);
    if (!node) return;
    const ports = side === 'in' ? node.inputs : node.outputs;
    const port = ports[portIndex];
    if (!port) return;
    setPendingFrom({ instanceId, side, portIndex, type: port.type });
    setPendingValid(true);
  };

  const endConnect = (instanceId: string, side: 'in' | 'out', portIndex: number) => {
    if (!pendingFrom) return;
    if (pendingFrom.side === side) { setPendingFrom(null); setHoverPort(null); return; }
    const targetNode = placed.find((n) => n.instanceId === instanceId);
    if (!targetNode) { setPendingFrom(null); setHoverPort(null); return; }
    const targetPorts = side === 'in' ? targetNode.inputs : targetNode.outputs;
    const targetPort = targetPorts[portIndex];
    if (!targetPort) { setPendingFrom(null); setHoverPort(null); return; }
    if (targetPort.type !== pendingFrom.type) { setPendingFrom(null); setHoverPort(null); return; }

    const fromIsOut = pendingFrom.side === 'out';
    const fromInstance = fromIsOut ? pendingFrom.instanceId : instanceId;
    const fromPort = fromIsOut ? pendingFrom.portIndex : portIndex;
    const toInstance = fromIsOut ? instanceId : pendingFrom.instanceId;
    const toPort = fromIsOut ? portIndex : pendingFrom.portIndex;

    setConnections((prev) => {
      const filtered = prev.filter((c) =>
        !(c.fromInstance === fromInstance && c.fromPort === fromPort)
      );
      const next = [...filtered, {
        id: uid(`${fromInstance}:${fromPort}->${toInstance}:${toPort}`),
        fromInstance, fromPort, toInstance, toPort,
        type: pendingFrom.type,
      }];
      pushHistory({ placed, connections: next });
      return next;
    });
    setPendingFrom(null);
    setHoverPort(null);
  };

  useEffect(() => {
    if (!pendingFrom || !hoverPort) { setPendingValid(true); return; }
    if (pendingFrom.side === hoverPort.side) { setPendingValid(false); return; }
    const targetNode = placed.find((n) => n.instanceId === hoverPort.instanceId);
    if (!targetNode) { setPendingValid(true); return; }
    const targetPorts = hoverPort.side === 'in' ? targetNode.inputs : targetNode.outputs;
    const targetPort = targetPorts[hoverPort.portIndex];
    if (!targetPort) { setPendingValid(true); return; }
    setPendingValid(targetPort.type === pendingFrom.type);
  }, [pendingFrom, hoverPort, placed]);

  useEffect(() => {
    if (!pendingFrom) return;
    const onMove = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [pendingFrom]);

  useEffect(() => {
    const close = () => setMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  const getNodeById = (id: string) => placed.find((n) => n.instanceId === id);

  const highlighted = useMemo(() => {
    if (!hoverConnectionId) return { conns: new Set<string>(), ports: new Set<string>() };
    const conns = new Set<string>([hoverConnectionId]);
    const ports = new Set<string>();
    const chainFrom = (startId: string) => {
      let current = startId;
      const visited = new Set<string>();
      while (current && !visited.has(current)) {
        visited.add(current);
        const next = connections.find((c) => c.type === 'exec' && c.fromInstance === current);
        if (!next) break;
        conns.add(next.id);
        ports.add(`${next.fromInstance}:out:${next.fromPort}`);
        ports.add(`${next.toInstance}:in:${next.toPort}`);
        current = next.toInstance;
      }
    };
    const hovered = connections.find((c) => c.id === hoverConnectionId);
    if (hovered) {
      ports.add(`${hovered.fromInstance}:out:${hovered.fromPort}`);
      ports.add(`${hovered.toInstance}:in:${hovered.toPort}`);
      chainFrom(hovered.fromInstance);
    }
    return { conns, ports };
  }, [hoverConnectionId, connections]);

  const handleLibraryDragStart = (e: React.DragEvent, node: NodeData) => {
    e.dataTransfer.setData(DRAG_MIME, node.id);
    e.dataTransfer.setData('text/plain', node.id);
    e.dataTransfer.effectAllowed = 'copy';
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (!dropActive) setDropActive(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget === e.target) setDropActive(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDropActive(false);
    const nodeId = e.dataTransfer.getData(DRAG_MIME) || e.dataTransfer.getData('text/plain');
    if (!nodeId) return;
    const node = NODE_LIBRARY.find((n) => n.id === nodeId);
    if (!node) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const worldX = (e.clientX - rect.left - pan.x) / scale - NODE_WIDTH / 2;
    const worldY = (e.clientY - rect.top - pan.y) / scale - 20;
    addNode(node, worldX, worldY);
  };

  const onNodeContextMenu = (e: React.MouseEvent, instanceId: string) => {
    e.preventDefault(); e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY, kind: 'node', instanceId });
  };

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => e.preventDefault();
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault();
    document.addEventListener('gesturestart', prevent);
    document.addEventListener('gesturechange', prevent);
    document.addEventListener('gestureend', prevent);
    return () => {
      document.removeEventListener('gesturestart', prevent);
      document.removeEventListener('gesturechange', prevent);
      document.removeEventListener('gestureend', prevent);
    };
  }, []);

  useEffect(() => {
    const preventZoom = (e: WheelEvent) => {
      if (e.ctrlKey) e.preventDefault();
    };
    window.addEventListener('wheel', preventZoom, { passive: false });
    return () => window.removeEventListener('wheel', preventZoom);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if ((e.key === 'Delete' || e.key === 'Backspace') && !isInput) {
        if (selectedIds.size > 0) { e.preventDefault(); deleteSelected(); }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && !isInput) {
        if (e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
        if ((e.key.toLowerCase() === 'z' && e.shiftKey) || e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }

        if (e.key.toLowerCase() === 'c') {
          e.preventDefault();
          clipboard.current = placed.filter((n) => selectedIds.has(n.instanceId));
          return;
        }

        if (e.key.toLowerCase() === 'v') {
          e.preventDefault();
          const pasted = clipboard.current.map((n) => ({
            ...n,
            instanceId: uid(n.id),
            x: n.x + 30, y: n.y + 30,
          }));
          if (pasted.length === 0) return;
          setPlaced((prev) => {
            const next = [...prev, ...pasted];
            pushHistory({ placed: next, connections });
            return next;
          });
          setSelectedIds(new Set(pasted.map((p) => p.instanceId)));
          return;
        }

        if (e.key.toLowerCase() === 'd') {
          e.preventDefault();
          const duplicated = placed
            .filter((n) => selectedIds.has(n.instanceId))
            .map((n) => ({
              ...n,
              instanceId: uid(n.id),
              x: n.x + 30, y: n.y + 30,
            }));
          if (duplicated.length === 0) return;
          setPlaced((prev) => {
            const next = [...prev, ...duplicated];
            pushHistory({ placed: next, connections });
            return next;
          });
          setSelectedIds(new Set(duplicated.map((d) => d.instanceId)));
          return;
        }

        if (e.key.toLowerCase() === 'a') {
          e.preventDefault();
          setSelectedIds(new Set(placed.map((n) => n.instanceId)));
          return;
        }
      }

      if (e.key === 'Escape') {
        setSelectedIds(new Set());
        setPendingFrom(null);
        setHoverPort(null);
        setMenu(null);
        setTemplateOpen(false);
        return;
      }

      if (e.key.toLowerCase() === 'f' && !isInput && selectedIds.size > 0) {
        e.preventDefault();
        const selected = placed.filter((n) => selectedIds.has(n.instanceId));
        if (selected.length === 0) return;
        const minX = Math.min(...selected.map((n) => n.x));
        const minY = Math.min(...selected.map((n) => n.y));
        const maxX = Math.max(...selected.map((n) => n.x + NODE_WIDTH));
        const maxY = Math.max(...selected.map((n) => n.y + 200));
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const newScale = Math.min(2, Math.max(0.5, Math.min(rect.width / (maxX - minX + 200), rect.height / (maxY - minY + 200))));
        setScale(newScale);
        setPan({
          x: rect.width / 2 - cx * newScale,
          y: rect.height / 2 - cy * newScale,
        });
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedIds, placed, connections, pushHistory, undo, redo, deleteSelected]);

  const onCanvasPointerDown = (e: React.PointerEvent) => {
    if (e.button === 2) {
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      rightDragRef.current = {
        active: true,
        startX: e.clientX,
        startY: e.clientY,
        panX: pan.x,
        panY: pan.y,
        moved: false,
      };
      return;
    }
    if (e.button === 1) {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      panningRef.current = {
        active: true, startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y,
      };
      return;
    }
    if (e.button === 0) {
      const el = e.target as HTMLElement;
      const isNode = el.closest('[data-node]');
      const isPort = el.closest('[data-port]');
      const isConn = el.closest('[data-connection]');
      if (!isNode && !isPort && !isConn) {
        setSelectedIds(new Set());
      }
    }
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const rd = rightDragRef.current;
      if (rd?.active) {
        const dx = e.clientX - rd.startX;
        const dy = e.clientY - rd.startY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) rd.moved = true;
        setPan({ x: rd.panX + dx, y: rd.panY + dy });
        return;
      }
      const p = panningRef.current;
      if (p?.active) {
        setPan({
          x: p.panX + (e.clientX - p.startX),
          y: p.panY + (e.clientY - p.startY),
        });
      }
    };
    const onUp = () => {
      const rd = rightDragRef.current;
      if (rd?.active) {
        rd.active = false;
        if (!rd.moved) {
          const rect = canvasRef.current?.getBoundingClientRect();
          const world = rect
            ? { x: (rd.startX - rect.left - pan.x) / scale, y: (rd.startY - rect.top - pan.y) / scale }
            : { x: 100, y: 100 };
          (window as any).__contextWorld = world;
          setMenu({ x: rd.startX, y: rd.startY, kind: 'canvas' });
        }
        rightDragRef.current = null;
      }
      if (panningRef.current) panningRef.current.active = false;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [pan, scale]);

  const onNodeMouseDownSelect = (e: React.MouseEvent, instanceId: string) => {
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(instanceId)) next.delete(instanceId);
        else next.add(instanceId);
        return next;
      });
    } else {
      setSelectedIds(new Set([instanceId]));
    }
  };

  const connectionPaths = useMemo(() => {
    return connections.map((c) => {
      const fromNode = getNodeById(c.fromInstance);
      const toNode = getNodeById(c.toInstance);
      if (!fromNode || !toNode) return null;
      const p1 = getPortPosition(fromNode, 'out', c.fromPort);
      const p2 = getPortPosition(toNode, 'in', c.toPort);
      return { c, d: bezierPath(p1.x, p1.y, p2.x, p2.y), p1, p2 };
    }).filter(Boolean) as { c: Connection; d: string; p1: { x: number; y: number }; p2: { x: number; y: number } }[];
  }, [connections, placed]);

  const previewPath = useMemo(() => {
    if (!pendingFrom) return null;
    const node = getNodeById(pendingFrom.instanceId);
    if (!node) return null;
    const p = getPortPosition(node, pendingFrom.side, pendingFrom.portIndex);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const mouseWorld = {
      x: (mousePos.x - rect.left - pan.x) / scale,
      y: (mousePos.y - rect.top - pan.y) / scale,
    };
    if (pendingFrom.side === 'out') return bezierPath(p.x, p.y, mouseWorld.x, mouseWorld.y);
    return bezierPath(mouseWorld.x, mouseWorld.y, p.x, p.y);
  }, [pendingFrom, mousePos, scale, placed, pan]);

  const filteredLibrary = useMemo(() => {
    const kw = librarySearch.trim().toLowerCase();
    if (!kw) return NODE_LIBRARY;
    return NODE_LIBRARY.filter((n) =>
      n.title.toLowerCase().includes(kw) ||
      n.category.toLowerCase().includes(kw) ||
      n.desc.toLowerCase().includes(kw)
    );
  }, [librarySearch]);

  return (
    <div className="min-h-screen bg-[#0d0d0f] font-sans text-[#e0e0e0] antialiased">
      <header className="flex h-12 items-center justify-between border-b border-[#1f1f22] bg-[#141416] px-5">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[#e8704a]" />
          <span className="text-xs font-light tracking-[0.35em] text-[#e0e0e0]">MAGIC SE · 蓝图节点编辑器</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[10px] text-[#6b6b70]">
            Del 删除 · Ctrl+Z 撤销 · Ctrl+Shift+Z 重做 · Ctrl+C/V 复制/粘贴 · Ctrl+D 复制 · Ctrl+A 全选 · F 聚焦 · Esc 取消 · 右键拖拽平移 · 右键单击菜单 · Alt+左键断线
          </span>

          <button
            type="button"
            onClick={() => setTemplateOpen((v) => !v)}
            className="flex h-6 items-center gap-1 border border-[#e8704a] bg-[#1e1e21] px-2 text-[10px] text-[#e8704a] transition-colors hover:bg-[#26262a]"
          >
            模板
          </button>

          <div className="flex items-center gap-1">
            {historyIndex > 0 && (
              <button type="button" onClick={undo} title="撤销 (Ctrl+Z)"
                className="flex h-6 items-center gap-1 border border-[#2a2a2e] bg-[#151517] px-2 text-[10px] text-[#c9c9cd] transition-colors hover:border-[#e8704a] hover:text-[#e8704a]">
                撤销
              </button>
            )}
            {historyIndex < history.length - 1 && (
              <button type="button" onClick={redo} title="重做 (Ctrl+Shift+Z)"
                className="flex h-6 items-center gap-1 border border-[#2a2a2e] bg-[#151517] px-2 text-[10px] text-[#c9c9cd] transition-colors hover:border-[#e8704a] hover:text-[#e8704a]">
                重做
              </button>
            )}
          </div>

          <span className="text-[10px] font-mono text-[#6b6b70]">{Math.round(scale * 100)}%</span>
        </div>
      </header>

      <div className="flex h-[calc(100vh-48px)]">
        <aside className="flex w-72 shrink-0 flex-col border-r border-[#1f1f22] bg-[#0f0f11]">
          <div className="border-b border-[#1f1f22] p-3">
            <div className="relative">
              <input
                type="text"
                value={librarySearch}
                onChange={(e) => setLibrarySearch(e.target.value)}
                placeholder="搜索节点（名称 / 类别 / 说明）"
                className="w-full rounded-none border border-[#2a2a2e] bg-[#151517] px-3 py-2 pr-8 text-[11px] font-light text-[#e0e0e0] placeholder:text-[#6b6b70] focus:border-[#e8704a] focus:outline-none"
              />
              {librarySearch && (
                <button
                  type="button"
                  onClick={() => setLibrarySearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-[#6b6b70] hover:text-white"
                  title="清空"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            <p className="mb-3 text-[10px] font-light tracking-[0.25em] text-[#6b6b70]">
              节点库（点击或拖拽到画布）
            </p>
            {filteredLibrary.length === 0 ? (
              <p className="py-6 text-center text-[11px] text-[#4a4a4f]">没有匹配的节点</p>
            ) : (
              <div className="space-y-2">
                {filteredLibrary.map((node) => (
                  <LibraryItem
                    key={node.id}
                    node={node}
                    onAdd={() => addNode(node)}
                    onDragStart={handleLibraryDragStart}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setMenu({ x: e.clientX, y: e.clientY, kind: 'canvas' });
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-[#1f1f22] px-3 py-2">
            <p className="text-[10px] font-light tracking-wider text-[#6b6b70]">
              共 {NODE_LIBRARY.length} 个节点
              {librarySearch && (
                <span className="ml-2 text-[#e8704a]">已筛选 {filteredLibrary.length} 个</span>
              )}
            </p>
          </div>
        </aside>

        <div
          ref={canvasRef}
          className={`relative flex-1 overflow-hidden transition-colors ${dropActive ? 'bg-[#111114]' : ''}`}
          onWheel={onWheel}
          onContextMenu={(e) => e.preventDefault()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onPointerDown={onCanvasPointerDown}
          onPointerUp={commitDragEnd}
          style={{
            backgroundImage:
              'linear-gradient(#1a1a1d 1px, transparent 1px), linear-gradient(90deg, #1a1a1d 1px, transparent 1px)',
            backgroundSize: `${24 * scale}px ${24 * scale}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`,
            cursor: rightDragRef.current?.active ? 'grabbing' : panningRef.current?.active ? 'grabbing' : 'default',
            touchAction: 'none',
            userSelect: 'none',
            overscrollBehavior: 'contain',
          }}
        >
          {dropActive && (
            <div className="pointer-events-none absolute inset-0 z-30 border-2 border-dashed border-[#e8704a]/60" />
          )}

          <div
            className="relative"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              transformOrigin: '0 0',
              width: 3000, height: 2000,
            }}
          >
            <svg className="pointer-events-none absolute inset-0" width={3000} height={2000}>
              {connectionPaths.map(({ c, d, p1, p2 }, idx) => {
                const isHighlight = highlighted.conns.has(c.id) || hoverConnectionId === c.id;
                const color = PORT_COLORS[c.type];
                return (
                  <g key={`${c.id}-${idx}`}>
                    <path d={d} fill="none" stroke="transparent" strokeWidth={14}
                      data-connection
                      style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                      onMouseEnter={() => setHoverConnectionId(c.id)}
                      onMouseLeave={() => setHoverConnectionId(null)}
                      onClick={(e) => { if (e.altKey) { e.stopPropagation(); deleteConnection(c.id); } }}
                    />
                    <path d={d} fill="none" stroke={color} strokeWidth={isHighlight ? 3 : 2}
                      strokeOpacity={isHighlight ? 1 : 0.7}
                      style={{
                        filter: isHighlight && c.type === 'exec' ? `drop-shadow(0 0 6px ${color})` : undefined,
                        pointerEvents: 'none',
                      }}
                    />
                    <circle cx={p1.x} cy={p1.y} r={3} fill={color} opacity={isHighlight ? 1 : 0.8} />
                    <circle cx={p2.x} cy={p2.y} r={3} fill={color} opacity={isHighlight ? 1 : 0.8} />
                  </g>
                );
              })}

              {previewPath && pendingFrom && (
                <path d={previewPath} fill="none"
                  stroke={pendingValid ? PORT_COLORS[pendingFrom.type] : '#ff3b3b'}
                  strokeWidth={2} strokeDasharray="6 4" opacity={0.95}
                  style={!pendingValid ? { filter: 'drop-shadow(0 0 6px #ff3b3b)' } : undefined}
                />
              )}
            </svg>

            {placed.map((n) => (
              <PlacedNodeView
                key={n.instanceId}
                node={n}
                selected={selectedIds.has(n.instanceId)}
                onDrag={handleDrag}
                onStartConnect={startConnect}
                onEndConnect={endConnect}
                connecting={!!pendingFrom}
                highlightedPorts={highlighted.ports}
                onContextMenu={onNodeContextMenu}
                onPortEnter={onPortEnter}
                onPortLeave={onPortLeave}
                onMouseDownSelect={onNodeMouseDownSelect}
              />
            ))}
          </div>
        </div>
      </div>

      {templateOpen && (
        <div className="fixed right-4 top-16 z-[120] w-80 border border-[#333] bg-[#1a1a1c] shadow-2xl">
          <div className="flex items-center justify-between border-b border-[#2a2a2e] px-3 py-2">
            <p className="text-xs font-light tracking-wider text-[#f0f0f0]">蓝图模板</p>
            <button type="button" onClick={() => setTemplateOpen(false)}
              className="text-[11px] text-[#6b6b70] hover:text-white">✕</button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-2">
            {TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => loadTemplate(tpl)}
                className="mb-2 block w-full border border-[#2a2a2e] bg-[#151517] p-3 text-left transition-colors hover:border-[#e8704a]"
              >
                <p className="text-xs font-light text-[#f0f0f0]">{tpl.name}</p>
                <p className="mt-0.5 text-[10px] text-[#8b8b8f]">{tpl.desc}</p>
                <p className="mt-1 text-[10px] text-[#6b6b70]">
                  {tpl.nodes.length} 个节点 · {tpl.connections.length} 条连线
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {menu && (
        <div className="fixed z-[100] w-48 border border-[#333] bg-[#1a1a1c] py-1 shadow-2xl"
          style={{ left: menu.x, top: menu.y }}
          onClick={(e) => e.stopPropagation()}>
          {menu.kind === 'canvas' && (
            <>
              <p className="px-3 py-1.5 text-[10px] tracking-wider text-[#6b6b70]">添加节点</p>
              <div className="max-h-80 overflow-y-auto">
                {NODE_LIBRARY.map((n) => (
                  <button key={n.id} type="button"
                    className="block w-full px-3 py-1.5 text-left text-[11px] text-[#c9c9cd] hover:bg-[#26262a]"
                    onClick={() => {
                      const world = (window as any).__contextWorld ?? { x: 100, y: 100 };
                      addNode(n, world.x, world.y);
                      setMenu(null);
                    }}>
                    <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: n.color }} />
                    {n.title}
                  </button>
                ))}
              </div>
            </>
          )}
          {menu.kind === 'node' && menu.instanceId && (
            <button type="button"
              className="block w-full px-3 py-1.5 text-left text-[11px] text-[#ff6b6b] hover:bg-[#26262a]"
              onClick={() => {
                setPlaced((prev) => {
                  const next = prev.filter((n) => n.instanceId !== menu.instanceId);
                  const nextConns = connections.filter((c) => c.fromInstance !== menu.instanceId && c.toInstance !== menu.instanceId);
                  setConnections(nextConns);
                  pushHistory({ placed: next, connections: nextConns });
                  return next;
                });
                setMenu(null);
              }}>
              删除节点
            </button>
          )}
        </div>
      )}

      <div className="pointer-events-none fixed bottom-3 right-4 z-40 text-[10px] text-[#4a4a4f]">
        节点 {placed.length} · 连线 {connections.length} · 选中 {selectedIds.size} · 历史 {historyIndex + 1}/{history.length}
      </div>
    </div>
  );
}