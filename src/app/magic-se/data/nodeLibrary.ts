/* ==================== 类型 ==================== */
export type PortType = 'exec' | 'bool' | 'int' | 'float' | 'string' | 'vector' | 'rotator' | 'object' | 'class' | 'actor';

export interface Port { name: string; type: PortType; desc: string; }
export interface NodeData {
  id: string; title: string; category: string; color: string;
  desc: string; commonScene?: string; source?: string;
  inputs: Port[]; outputs: Port[];
  defaultValues?: Record<number, string>;
}
export interface PlacedNode extends NodeData { instanceId: string; x: number; y: number; }
export interface Connection { id: string; fromInstance: string; fromPort: number; toInstance: string; toPort: number; type: PortType; }
export interface EditorState { placed: PlacedNode[]; connections: Connection[]; }

export interface TemplateNode { refId: string; nodeId: string; x: number; y: number; }
export interface TemplateConnection { fromRef: string; fromPort: number; toRef: string; toPort: number; }
export interface Template { id: string; name: string; desc: string; nodes: TemplateNode[]; connections: TemplateConnection[]; }

/* ==================== 端口颜色（贴近 UE5） ==================== */
export const PORT_COLORS: Record<PortType, string> = {
  exec:   '#f0f0f0',  // 白（执行线）
  bool:   '#a01a1a',  // 深红
  int:    '#1ad6b8',  // 青绿
  float:  '#9ce09c',  // 浅绿
  string: '#ff69b4',  // 粉
  vector: '#f5c518',  // 金
  rotator:'#a78bfa',  // 紫
  object: '#4fb4ff',  // 蓝
  class:  '#7b68ee',  // 靛
  actor:  '#33c9b6',  // 青
};
export const PORT_LABELS: Record<PortType, string> = {
  exec: '执行', bool: '布尔', int: '整数', float: '浮点', string: '字符串',
  vector: '向量', rotator: '旋转', object: '对象', class: '类', actor: 'Actor',
};

/* ==================== 节点配色（UE5 深蓝灰 + 首页青绿/橙） ==================== */
export const NODE_COLORS = {
  event:     '#7a1f1f', // 事件-暗红
  flow:      '#3d4650', // 流程-深灰蓝
  pure:      '#2c6b4a', // 纯函数-墨绿
  cast:      '#1a6b7a', // 类型转换-青蓝
  spawn:     '#4a3a6e', // 生成-深紫
  debug:     '#6b5a2a', // 调试-土黄
  transform: '#3f3a63', // 变换-暗紫
  timer:     '#2c3a4a', // 定时器-蓝灰
  character: '#2a5a3f', // 角色-绿
  math:      '#1a4a6b', // 数学-蓝
  ui:        '#7a5a1a', // UI-橙黄（靠首页橙）
  audio:     '#1a4a5a', // 音频-深青
  save:      '#5a2a4a', // 存档-紫红
  variable:  '#1f7a5a', // 变量-青绿（首页主色）
} as const;

export const NODE_WIDTH = 240;
export const HEADER_H = 52;
export const PORT_ROW_H = 22;
export const PORT_AREA_PT = 8;
export const PORT_DOT_OFFSET = 6;
export const DRAG_MIME = 'application/x-magic-node';

/* ==================== 类型兼容判断 ==================== */
export function isTypeCompatible(fromType: PortType, toType: PortType): boolean {
  if (fromType === toType) return true;
  if (fromType === 'int' && toType === 'float') return true;
  const refTypes: PortType[] = ['object', 'class', 'actor'];
  if (refTypes.includes(fromType) && refTypes.includes(toType)) return true;
  return false;
}

/* ==================== 基础变量类型（9 种真实 UE 类型） ==================== */
export const BASE_VARIABLES: {
  key: string; label: string; type: PortType;
  desc: string; commonScene: string; source: string;
}[] = [
  { key: 'Bool',    label: '布尔',       type: 'bool',    desc: '只有 True / False 两个值。',       commonScene: '开关状态、是否持有物品。',        source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/blueprint-variables-in-unreal-engine' },
  { key: 'Int',     label: '整数',       type: 'int',     desc: '不带小数的整数。',                 commonScene: '分数、数量、索引。',              source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/blueprint-variables-in-unreal-engine' },
  { key: 'Float',   label: '浮点',       type: 'float',   desc: '带小数的数值。',                   commonScene: '血量、速度、倒计时。',            source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/blueprint-variables-in-unreal-engine' },
  { key: 'String',  label: '字符串',     type: 'string',  desc: '一串文本。',                       commonScene: '玩家名字、提示文本。',            source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/blueprint-variables-in-unreal-engine' },
  { key: 'Vector',  label: '向量',       type: 'vector',  desc: 'X / Y / Z 三分量。',               commonScene: '坐标、位置、移动方向、速度。',    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/blueprint-variables-in-unreal-engine' },
  { key: 'Rotator', label: '旋转体',     type: 'rotator', desc: 'Pitch / Yaw / Roll。',             commonScene: '角色朝向、镜头旋转。',            source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/blueprint-variables-in-unreal-engine' },
  { key: 'Actor',   label: 'Actor 引用', type: 'actor',   desc: '指向场景中某个 Actor 实例。',       commonScene: '锁定目标、记录玩家。',            source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/blueprint-variables-in-unreal-engine' },
  { key: 'Class',   label: '类引用',     type: 'class',   desc: '指向某个蓝图类。',                 commonScene: 'Spawn 敌人。',                    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/blueprint-variables-in-unreal-engine' },
  { key: 'Widget',  label: '控件',       type: 'object',  desc: '指向一个 UMG 控件实例。',           commonScene: '显示血条、菜单、弹窗。',            source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/umg-ui-designer-for-unreal-engine' },
];

/* ==================== 变量节点工厂 ==================== */
export function makeGetNode(v: typeof BASE_VARIABLES[0]): NodeData {
  return {
    id: `var_get_${v.key.toLowerCase()}`,
    title: `Get ${v.label}`,
    category: '变量',
    color: NODE_COLORS.variable,
    desc: v.desc,
    commonScene: v.commonScene,
    source: v.source,
    inputs: [],
    outputs: [{ name: 'Value', type: v.type, desc: `${v.label}值。` }],
  };
}

export function makeSetNode(v: typeof BASE_VARIABLES[0]): NodeData {
  return {
    id: `var_set_${v.key.toLowerCase()}`,
    title: `Set ${v.label}`,
    category: '变量',
    color: NODE_COLORS.variable,
    desc: v.desc,
    commonScene: v.commonScene,
    source: v.source,
    inputs: [
      { name: '', type: 'exec', desc: '执行输入。' },
      { name: 'Value', type: v.type, desc: `要写入的${v.label}值。` },
    ],
    outputs: [{ name: '', type: 'exec', desc: '执行输出。' }],
  };
}

/* ==================== 节点库 ==================== */
export const NODE_LIBRARY: NodeData[] = [
  // —— 事件 ——
  { id: 'beginplay', title: 'Event BeginPlay', category: '事件', color: NODE_COLORS.event,
    desc: 'Actor 进入游戏世界时触发一次。', commonScene: '游戏开始时初始化。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/basic-scripting-with-blueprints-in-unreal-engine',
    inputs: [], outputs: [{ name: '', type: 'exec', desc: '执行输出。' }] },
  { id: 'tick', title: 'Event Tick', category: '事件', color: NODE_COLORS.event,
    desc: '每一帧触发一次。', commonScene: '每帧更新。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/basic-scripting-with-blueprints-in-unreal-engine',
    inputs: [], outputs: [{ name: '', type: 'exec', desc: '执行输出。' }, { name: 'Delta Seconds', type: 'float', desc: '帧间隔。' }] },
  { id: 'beginoverlap', title: 'Event ActorBeginOverlap', category: '事件', color: NODE_COLORS.event,
    desc: '有 Actor 进入碰撞范围时触发。', commonScene: '触发区域、拾取物。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/flow-control-in-unreal-engine',
    inputs: [], outputs: [{ name: '', type: 'exec', desc: '执行输出。' }, { name: 'Other Actor', type: 'actor', desc: '进入的 Actor。' }] },
  { id: 'anydamage', title: 'Event AnyDamage', category: '事件', color: NODE_COLORS.event,
    desc: '受到伤害时触发。', commonScene: '扣血、死亡判定。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/Game/Damage',
    inputs: [], outputs: [{ name: '', type: 'exec', desc: '执行输出。' }, { name: 'Damage', type: 'float', desc: '伤害值。' }] },
  { id: 'destroyed', title: 'Event Destroyed', category: '事件', color: NODE_COLORS.event,
    desc: 'Actor 被销毁时触发。', commonScene: '清理资源。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/Game/Actor',
    inputs: [], outputs: [{ name: '', type: 'exec', desc: '执行输出。' }] },
  // —— 输入 ——
  { id: 'inputaction', title: 'Input Action', category: '输入', color: NODE_COLORS.event,
    desc: '按下指定按键时触发。', commonScene: '按键交互。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/designer-09-sprint-input-action-in-unreal-engine',
    inputs: [], outputs: [{ name: 'Pressed', type: 'exec', desc: '按下。' }, { name: 'Released', type: 'exec', desc: '松开。' }] },
  // —— 流程控制 ——
  { id: 'branch', title: 'Branch', category: '流程控制', color: NODE_COLORS.flow,
    desc: '条件判断。', commonScene: '控制游戏逻辑走向。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/flow-control-in-unreal-engine',
    inputs: [{ name: '', type: 'exec', desc: '执行输入。' }, { name: 'Condition', type: 'bool', desc: '判断条件。' }],
    outputs: [{ name: 'True', type: 'exec', desc: '真。' }, { name: 'False', type: 'exec', desc: '假。' }],
    defaultValues: { 1: 'false' } },
  { id: 'sequence', title: 'Sequence', category: '流程控制', color: NODE_COLORS.flow,
    desc: '按顺序执行多条。', commonScene: '顺序执行多个逻辑。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/flow-control-in-unreal-engine',
    inputs: [{ name: '', type: 'exec', desc: '执行输入。' }],
    outputs: [{ name: 'Then 0', type: 'exec', desc: '1。' }, { name: 'Then 1', type: 'exec', desc: '2。' }, { name: 'Then 2', type: 'exec', desc: '3。' }] },
  { id: 'doonce', title: 'Do Once', category: '流程控制', color: NODE_COLORS.flow,
    desc: '只执行一次。', commonScene: '防止重复触发。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/flow-control-in-unreal-engine',
    inputs: [{ name: '', type: 'exec', desc: '执行输入。' }, { name: 'Reset', type: 'exec', desc: '重置。' }, { name: 'Start Closed', type: 'bool', desc: '初始关闭。' }],
    outputs: [{ name: 'Completed', type: 'exec', desc: '执行输出。' }] },
  { id: 'delay', title: 'Delay', category: '流程控制', color: NODE_COLORS.flow,
    desc: '延迟执行。', commonScene: '延迟一段时间后执行。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/Utilities/Time',
    inputs: [{ name: '', type: 'exec', desc: '执行输入。' }, { name: 'Duration', type: 'float', desc: '延迟时间（秒）。' }],
    outputs: [{ name: 'Completed', type: 'exec', desc: '延迟完成。' }],
    defaultValues: { 1: '0.2' } },
  { id: 'openlevel', title: 'Open Level', category: '流程控制', color: NODE_COLORS.flow,
    desc: '加载指定关卡。', commonScene: '切换关卡。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/Game/OpenLevel',
    inputs: [{ name: '', type: 'exec', desc: '执行输入。' }, { name: 'Level Name', type: 'string', desc: '关卡名。' }],
    outputs: [{ name: '', type: 'exec', desc: '执行输出。' }],
    defaultValues: { 1: 'Level_02' } },
  // —— 角色 ——
  { id: 'getplayer', title: 'Get Player Character', category: '角色', color: NODE_COLORS.character,
    desc: '拿到玩家 Character 引用。', commonScene: '获取玩家引用。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/basic-scripting-with-blueprints-in-unreal-engine',
    inputs: [{ name: 'Player Index', type: 'int', desc: '玩家索引。' }],
    outputs: [{ name: 'Return Value', type: 'actor', desc: '玩家引用。' }],
    defaultValues: { 0: '0' } },
  { id: 'addmovement', title: 'Add Movement Input', category: '角色', color: NODE_COLORS.character,
    desc: '给角色添加移动输入。', commonScene: '角色移动。',
    source: 'https://dev.epicgames.com/documentation/unreal-engine/BlueprintAPI/Pawn/Input/AddMovementInput',
    inputs: [{ name: '', type: 'exec', desc: '执行输入。' }, { name: 'World Direction', type: 'vector', desc: '移动方向。' }, { name: 'Scale Value', type: 'float', desc: '速度倍率。' }],
    outputs: [{ name: '', type: 'exec', desc: '执行输出。' }],
    defaultValues: { 1: '0,0,0', 2: '1.0' } },
  { id: 'setvelocity', title: 'Set Velocity', category: '角色', color: NODE_COLORS.character,
    desc: '设置 Actor 的速度。', commonScene: '发射子弹。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/Game/Actor',
    inputs: [{ name: '', type: 'exec', desc: '执行输入。' }, { name: 'New Velocity', type: 'vector', desc: '速度向量。' }],
    outputs: [{ name: '', type: 'exec', desc: '执行输出。' }],
    defaultValues: { 1: '0,0,0' } },
  // —— 变换 ——
  { id: 'getactorlocation', title: 'Get Actor Location', category: '变换', color: NODE_COLORS.transform,
    desc: '获取 Actor 的世界坐标。', commonScene: '计算距离。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/Game/Actor',
    inputs: [{ name: 'Target', type: 'actor', desc: '目标 Actor。' }],
    outputs: [{ name: 'Return Value', type: 'vector', desc: '坐标。' }] },
  { id: 'getforward', title: 'Get Actor Forward Vector', category: '变换', color: NODE_COLORS.transform,
    desc: '获取 Actor 的朝前方向。', commonScene: '发射子弹。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/Game/Actor',
    inputs: [{ name: 'Target', type: 'actor', desc: '目标 Actor。' }],
    outputs: [{ name: 'Return Value', type: 'vector', desc: '方向。' }] },
  { id: 'getdistance', title: 'Get Distance To', category: '变换', color: NODE_COLORS.transform,
    desc: '计算两个位置之间的距离。', commonScene: '攻击范围判断。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/Game/Actor',
    inputs: [{ name: 'Other Actor', type: 'actor', desc: '另一个 Actor。' }],
    outputs: [{ name: 'Return Value', type: 'float', desc: '距离。' }] },
  { id: 'setactorlocation', title: 'Set Actor Location', category: '变换', color: NODE_COLORS.transform,
    desc: '设置 Actor 的世界坐标。', commonScene: '移动物体。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/pawn-in-unreal-engine',
    inputs: [{ name: '', type: 'exec', desc: '执行输入。' }, { name: 'New Location', type: 'vector', desc: '新坐标。' }],
    outputs: [{ name: '', type: 'exec', desc: '执行输出。' }],
    defaultValues: { 1: '0,0,0' } },
  { id: 'setactorrotation', title: 'Set Actor Rotation', category: '变换', color: NODE_COLORS.transform,
    desc: '设置 Actor 的旋转。', commonScene: '开门、朝向玩家。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/Game/Actor',
    inputs: [{ name: '', type: 'exec', desc: '执行输入。' }, { name: 'New Rotation', type: 'rotator', desc: '新旋转。' }],
    outputs: [{ name: '', type: 'exec', desc: '执行输出。' }],
    defaultValues: { 1: '0,0,0' } },
  { id: 'setactorvisibility', title: 'Set Actor Visibility', category: '变换', color: NODE_COLORS.transform,
    desc: '设置 Actor 是否可见。', commonScene: '隐藏/显示物体。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/Game/Actor',
    inputs: [{ name: '', type: 'exec', desc: '执行输入。' }, { name: 'New Hidden', type: 'bool', desc: '是否隐藏。' }],
    outputs: [{ name: '', type: 'exec', desc: '执行输出。' }],
    defaultValues: { 1: 'false' } },
  { id: 'addrotation', title: 'Add Actor Local Rotation', category: '变换', color: NODE_COLORS.transform,
    desc: '相对旋转。', commonScene: '持续旋转。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/Game/Actor',
    inputs: [{ name: '', type: 'exec', desc: '执行输入。' }, { name: 'Delta Rotation', type: 'rotator', desc: '旋转增量。' }],
    outputs: [{ name: '', type: 'exec', desc: '执行输出。' }],
    defaultValues: { 1: '0,90,0' } },
  { id: 'findlookat', title: 'Find Look at Rotation', category: '变换', color: NODE_COLORS.transform,
    desc: '计算从起点看向终点的旋转。', commonScene: '敌人朝向玩家。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/Math/Rotator/FindLookatRotation',
    inputs: [{ name: 'Start', type: 'vector', desc: '起点。' }, { name: 'Target', type: 'vector', desc: '终点。' }],
    outputs: [{ name: 'Return Value', type: 'rotator', desc: '旋转。' }],
    defaultValues: { 0: '0,0,0', 1: '100,0,0' } },
  { id: 'makevector', title: 'Make Vector', category: '变换', color: NODE_COLORS.transform,
    desc: '把 X/Y/Z 组合成 vector。', commonScene: '构造方向。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/Math/Vector',
    inputs: [{ name: 'X', type: 'float', desc: 'X。' }, { name: 'Y', type: 'float', desc: 'Y。' }, { name: 'Z', type: 'float', desc: 'Z。' }],
    outputs: [{ name: 'Return Value', type: 'vector', desc: '向量。' }],
    defaultValues: { 0: '0', 1: '0', 2: '0' } },
  { id: 'breakvector', title: 'Break Vector', category: '变换', color: NODE_COLORS.transform,
    desc: '把 vector 拆为 X/Y/Z。', commonScene: '提取分量。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/Math/Vector',
    inputs: [{ name: 'In Vec', type: 'vector', desc: '输入向量。' }],
    outputs: [{ name: 'X', type: 'float', desc: 'X。' }, { name: 'Y', type: 'float', desc: 'Y。' }, { name: 'Z', type: 'float', desc: 'Z。' }],
    defaultValues: { 0: '0,0,0' } },
  // —— 类型转换 ——
  { id: 'cast', title: 'Cast To BP_Player', category: '类型转换', color: NODE_COLORS.cast,
    desc: '类型转换。', commonScene: '确认交互对象类型。',
    source: 'https://dev.epicgames.com/community/learning/tutorials/23av/unreal-engine-entendiendo-los-blueprint-interface',
    inputs: [{ name: '', type: 'exec', desc: '执行输入。' }, { name: 'Object', type: 'object', desc: '要转换的对象。' }],
    outputs: [{ name: 'As Player', type: 'actor', desc: '转换结果。' }, { name: 'Cast Failed', type: 'exec', desc: '失败。' }, { name: '', type: 'exec', desc: '成功。' }] },
  // —— 生成 ——
  { id: 'spawn', title: 'Spawn Actor from Class', category: '生成', color: NODE_COLORS.spawn,
    desc: '运行时生成 Actor。', commonScene: '生成子弹、敌人。',
    source: 'https://dev.epicgames.com/documentation/unreal-engine/BlueprintAPI/EditorScripting/LevelUtility/SpawnActorfromClass',
    inputs: [{ name: '', type: 'exec', desc: '执行输入。' }, { name: 'Class', type: 'class', desc: '要生成的类。' }, { name: 'Spawn Transform', type: 'rotator', desc: '生成位置。' }, { name: 'Collision Handling', type: 'string', desc: '碰撞处理。' }],
    outputs: [{ name: '', type: 'exec', desc: '执行输出。' }, { name: 'Return Value', type: 'actor', desc: '生成的 Actor。' }],
    defaultValues: { 2: '0,0,0', 3: 'Always Spawn' } },
  { id: 'destroy', title: 'Destroy Actor', category: '生成', color: NODE_COLORS.spawn,
    desc: '销毁 Actor。', commonScene: '拾取后销毁道具。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/Game/Actor',
    inputs: [{ name: '', type: 'exec', desc: '执行输入。' }, { name: 'Target', type: 'actor', desc: '要销毁的 Actor。' }],
    outputs: [{ name: '', type: 'exec', desc: '执行输出。' }] },
  // —— 定时器 ——
  { id: 'settimer', title: 'Set Timer by Event', category: '定时器', color: NODE_COLORS.timer,
    desc: '延迟或重复执行。', commonScene: '循环触发。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/Utilities/Time',
    inputs: [{ name: '', type: 'exec', desc: '执行输入。' }, { name: 'Object', type: 'object', desc: '目标对象。' }, { name: 'Event', type: 'bool', desc: '事件委托。' }, { name: 'Time', type: 'float', desc: '时间。' }, { name: 'Looping', type: 'bool', desc: '是否循环。' }],
    outputs: [{ name: '', type: 'exec', desc: '执行输出。' }, { name: 'Return Value', type: 'object', desc: 'Timer Handle。' }],
    defaultValues: { 3: '1.0', 4: 'true' } },
  // —— 数学 ——
  { id: 'lerp', title: 'Lerp', category: '数学', color: NODE_COLORS.math,
    desc: '线性插值。', commonScene: '平滑过渡。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/Math/Interpolation',
    inputs: [{ name: 'A', type: 'float', desc: '起点。' }, { name: 'B', type: 'float', desc: '终点。' }, { name: 'Alpha', type: 'float', desc: '插值比例。' }],
    outputs: [{ name: 'Return Value', type: 'float', desc: '结果。' }],
    defaultValues: { 0: '0.0', 1: '1.0', 2: '0.5' } },
  { id: 'add_float', title: 'Add (Float)', category: '数学', color: NODE_COLORS.math,
    desc: '两个浮点数相加。', commonScene: '累加数值。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/Math/Float',
    inputs: [{ name: 'A', type: 'float', desc: 'A。' }, { name: 'B', type: 'float', desc: 'B。' }],
    outputs: [{ name: 'Return Value', type: 'float', desc: 'A + B。' }],
    defaultValues: { 0: '0.0', 1: '0.0' } },
  { id: 'subtract_float', title: 'Subtract (Float)', category: '数学', color: NODE_COLORS.math,
    desc: '两个浮点数相减。', commonScene: '扣血。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/Math/Float',
    inputs: [{ name: 'A', type: 'float', desc: 'A。' }, { name: 'B', type: 'float', desc: 'B。' }],
    outputs: [{ name: 'Return Value', type: 'float', desc: 'A - B。' }],
    defaultValues: { 0: '1.0', 1: '1.0' } },
  { id: 'multiply_float', title: 'Multiply (Float)', category: '数学', color: NODE_COLORS.math,
    desc: '两个浮点数相乘。', commonScene: '速度倍率。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/Math/Float',
    inputs: [{ name: 'A', type: 'float', desc: 'A。' }, { name: 'B', type: 'float', desc: 'B。' }],
    outputs: [{ name: 'Return Value', type: 'float', desc: 'A × B。' }],
    defaultValues: { 0: '1.0', 1: '1.0' } },
  { id: 'greater_float', title: 'Greater (Float)', category: '数学', color: NODE_COLORS.math,
    desc: '判断 A 是否大于 B。', commonScene: '数值比较。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/Math/Float',
    inputs: [{ name: 'A', type: 'float', desc: 'A。' }, { name: 'B', type: 'float', desc: 'B。' }],
    outputs: [{ name: 'Return Value', type: 'bool', desc: 'A > B。' }],
    defaultValues: { 0: '0.0', 1: '0.0' } },
  // —— UI ——
  { id: 'createwidget', title: 'Create Widget', category: 'UI', color: NODE_COLORS.ui,
    desc: '创建 UI 控件。', commonScene: '创建血条、菜单。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/UMG',
    inputs: [{ name: 'Class', type: 'class', desc: 'Widget 类。' }],
    outputs: [{ name: 'Return Value', type: 'object', desc: '控件。' }] },
  { id: 'addviewport', title: 'Add to Viewport', category: 'UI', color: NODE_COLORS.ui,
    desc: '把控件加到屏幕。', commonScene: '显示 UI。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/UMG',
    inputs: [{ name: '', type: 'exec', desc: '执行输入。' }, { name: 'Target', type: 'object', desc: '控件。' }],
    outputs: [{ name: '', type: 'exec', desc: '执行输出。' }] },
  { id: 'setposviewport', title: 'Set Position in Viewport', category: 'UI', color: NODE_COLORS.ui,
    desc: '设置控件在屏幕中的位置。', commonScene: '血条跟随。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/UMG',
    inputs: [{ name: '', type: 'exec', desc: '执行输入。' }, { name: 'Target', type: 'object', desc: '控件。' }, { name: 'Position', type: 'vector', desc: '屏幕坐标。' }],
    outputs: [{ name: '', type: 'exec', desc: '执行输出。' }],
    defaultValues: { 2: '0,0' } },
  { id: 'worldtoscreen', title: 'Project World to Screen', category: 'UI', color: NODE_COLORS.ui,
    desc: '世界坐标转屏幕坐标。', commonScene: 'UI 定位。',
    source: 'https://dev.epicgames.com/documentation/unreal-engine/API/Runtime/UMG/UWidgetLayoutLibrary/ProjectWorldLoca-',
    inputs: [{ name: 'World Position', type: 'vector', desc: '世界坐标。' }],
    outputs: [{ name: 'Screen Position', type: 'vector', desc: '屏幕坐标。' }],
    defaultValues: { 0: '0,0,0' } },
  { id: 'settext', title: 'Set Text', category: 'UI', color: NODE_COLORS.ui,
    desc: '设置文本控件的文字。', commonScene: '更新分数。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/UMG',
    inputs: [{ name: '', type: 'exec', desc: '执行输入。' }, { name: 'Target', type: 'object', desc: '文本控件。' }, { name: 'In Text', type: 'string', desc: '新文字。' }],
    outputs: [{ name: '', type: 'exec', desc: '执行输出。' }],
    defaultValues: { 2: 'Hello' } },
  // —— 音频 ——
  { id: 'playsound', title: 'Play Sound at Location', category: '音频', color: NODE_COLORS.audio,
    desc: '在指定位置播放音效。', commonScene: '环境音效。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/Audio',
    inputs: [{ name: '', type: 'exec', desc: '执行输入。' }, { name: 'Sound', type: 'object', desc: '音效资源。' }, { name: 'Location', type: 'vector', desc: '播放位置。' }],
    outputs: [{ name: '', type: 'exec', desc: '执行输出。' }],
    defaultValues: { 2: '0,0,0' } },
  { id: 'playsound2d', title: 'Play Sound 2D', category: '音频', color: NODE_COLORS.audio,
    desc: '播放 2D 音效。', commonScene: 'UI 音效。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/Audio',
    inputs: [{ name: '', type: 'exec', desc: '执行输入。' }, { name: 'Sound', type: 'object', desc: '音效资源。' }],
    outputs: [{ name: '', type: 'exec', desc: '执行输出。' }] },
  // —— 存档 ——
  { id: 'savegame', title: 'Save Game to Slot', category: '存档', color: NODE_COLORS.save,
    desc: '保存游戏到指定槽位。', commonScene: '存档系统。',
    source: 'https://dev.epicgames.com/documentation/unreal-engine/BlueprintAPI/SaveGame',
    inputs: [{ name: '', type: 'exec', desc: '执行输入。' }, { name: 'Save Game Object', type: 'object', desc: '存档对象。' }, { name: 'Slot Name', type: 'string', desc: '槽位名。' }],
    outputs: [{ name: '', type: 'exec', desc: '执行输出。' }, { name: 'Return Value', type: 'bool', desc: '是否成功。' }],
    defaultValues: { 2: 'SaveSlot1' } },
  { id: 'loadgame', title: 'Load Game from Slot', category: '存档', color: NODE_COLORS.save,
    desc: '从槽位读取存档。', commonScene: '读档系统。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/SaveGame',
    inputs: [{ name: 'Slot Name', type: 'string', desc: '槽位名。' }],
    outputs: [{ name: 'Return Value', type: 'object', desc: '存档对象。' }],
    defaultValues: { 0: 'SaveSlot1' } },
  // —— 调试 ——
  { id: 'print', title: 'Print String', category: '调试', color: NODE_COLORS.debug,
    desc: '在屏幕上打印文字。', commonScene: '调试输出。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/Utilities/String',
    inputs: [{ name: '', type: 'exec', desc: '执行输入。' }, { name: 'In String', type: 'string', desc: '要打印的文字。' }, { name: 'Duration', type: 'float', desc: '显示时长。' }],
    outputs: [{ name: '', type: 'exec', desc: '执行输出。' }],
    defaultValues: { 1: 'Hello UE', 2: '2.0' } },
  // —— 工具 ——
  { id: 'isvalid', title: 'Is Valid', category: '工具', color: NODE_COLORS.pure,
    desc: '检查对象是否有效。', commonScene: '检查引用。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/Utilities/Validation',
    inputs: [{ name: 'Object', type: 'object', desc: '要检查的对象。' }],
    outputs: [{ name: 'Return Value', type: 'bool', desc: '是否有效。' }] },
  { id: 'getworlddelta', title: 'Get World Delta Seconds', category: '工具', color: NODE_COLORS.pure,
    desc: '获取当前帧时间间隔。', commonScene: '帧率无关移动。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/Utilities/Time',
    inputs: [], outputs: [{ name: 'Return Value', type: 'float', desc: '帧时间。' }] },
];

/* ==================== 工具函数 ==================== */
export function sortPorts(ports: Port[]): Port[] {
  return [...ports].sort((a, b) => {
    if (a.type === 'exec' && b.type !== 'exec') return -1;
    if (a.type !== 'exec' && b.type === 'exec') return 1;
    return 0;
  });
}

export function getPortPosition(node: PlacedNode, side: 'in' | 'out', index: number): { x: number; y: number } {
  const y = node.y + HEADER_H + PORT_AREA_PT + index * PORT_ROW_H + PORT_DOT_OFFSET;
  const x = side === 'in' ? node.x : node.x + NODE_WIDTH;
  return { x, y };
}

export function bezierPath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.max(40, Math.abs(x2 - x1) * 0.5);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

export function uid(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/* ==================== 教程章节 ==================== */
export interface TutorialChapter {
  id: string;
  group: '基础' | '蓝图' | '数学运算' | '蓝图进阶' | '综合实战';
  title: string;
  lessonNo: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  duration: string;
  goal: string;
  concepts: string[];
  steps: string[];
  checks: string[];
  commonErrors?: string[];
  templateId?: string;
}

export const TUTORIAL_CHAPTERS: TutorialChapter[] = [
  { id: 'ch-01', group: '基础', title: '初识蓝图编程', lessonNo: '第 08 课', difficulty: 1, duration: '10 分钟',
    goal: '理解事件、执行线、数据线的区别。',
    concepts: ['Event', 'Exec 执行线', 'Pure 纯函数'],
    steps: ['从左侧拖「Event BeginPlay」到画布', '再拖一个「Print String」到它右边', '把 BeginPlay 的白色执行引脚拖到 Print String 的白色输入引脚', '黄色数据线上填一段文字'],
    checks: ['BeginPlay 已连到 Print String', '打印文字已填写'],
    commonErrors: ['白色执行线只能连白色执行端口', '数据线是单向的'] },
  { id: 'ch-02', group: '蓝图', title: '常用流程控制节点', lessonNo: '第 12 课', difficulty: 1, duration: '15 分钟',
    goal: '学会用 Branch 和 Sequence 控制执行流。',
    concepts: ['Branch 分支', 'Sequence 序列'],
    steps: ['拖「Event BeginPlay」→「Branch」', '拖「Get 布尔」连到 Branch 的 Condition', 'Branch 的 True 和 False 分别连到两个 Print String'],
    checks: ['Branch 的两个分支都已连接', 'Condition 端口已连'],
    commonErrors: ['条件端口是布尔', '分支的两个出口可以都空着'] },
  { id: 'ch-03', group: '蓝图', title: '实现自动门功能', lessonNo: '第 11 课', difficulty: 2, duration: '20 分钟',
    goal: '按 E 键，让门旋转 90 度打开。',
    concepts: ['Input Action', 'Branch', 'Set / Get 变量', 'Set Actor Rotation'],
    steps: ['拖「Input Action」', '「Pressed」→ 「Branch」', '「Get 布尔」→ Branch 的 Condition', 'True →「Set 布尔」+「Set Actor Rotation」'],
    checks: ['Input Action 输出已连到 Branch', '两个分支都连到了旋转节点'],
    commonErrors: ['确认连的是 Set Actor Rotation'],
    templateId: 'tpl_door' },
  { id: 'ch-04', group: '蓝图', title: '实现玩家移动功能', lessonNo: '第 09 课', difficulty: 2, duration: '15 分钟',
    goal: '用事件和方向向量让 Actor 移动。',
    concepts: ['Event Tick', 'Get Actor Forward Vector', 'Add Movement Input'],
    steps: ['拖「Event Tick」', '拖「Get Actor Forward Vector」', '把方向向量连到「Add Movement Input」的 World Direction', '把 Tick 的执行输出连到 Add Movement Input 的执行输入'],
    checks: ['Tick 已连到 Add Movement Input', '方向向量已连到 World Direction'],
    commonErrors: ['Add Movement Input 有两个输入'],
    templateId: 'tpl_move' },
  { id: 'ch-05', group: '蓝图', title: '制作场景机关（拾取道具）', lessonNo: '第 19 课', difficulty: 3, duration: '20 分钟',
    goal: '走进金币范围自动拾取。',
    concepts: ['Overlap 重叠事件', 'Cast 类型转换', 'Destroy'],
    steps: ['「Event ActorBeginOverlap」→「Cast To BP_Player」', 'Cast 的「成功」→「Play Sound at Location」', '→「Destroy Actor」'],
    checks: ['Overlap 已连到 Cast', 'Cast 成功分支已连到音效'],
    commonErrors: ['Cast 有两个执行出口'],
    templateId: 'tpl_pickup' },
  { id: 'ch-06', group: '蓝图', title: '制作倒计时', lessonNo: '第 22 课', difficulty: 3, duration: '20 分钟',
    goal: '限时关卡，每秒扣 1 秒。',
    concepts: ['Set Timer by Event', 'Subtract', 'Branch 判断', 'Open Level'],
    steps: ['「Event BeginPlay」→「Set Timer by Event」', '→「Get 浮点」→「Subtract」→「Set 浮点」', '→「Branch」', 'True →「Open Level」；False →「Set Text」'],
    checks: ['倒计时逻辑完整', '分支两路都有连'],
    commonErrors: ['Branch 条件是布尔'],
    templateId: 'tpl_timer' },
  { id: 'ch-07', group: '蓝图', title: '角色朝向玩家', lessonNo: '第 17 课', difficulty: 3, duration: '15 分钟',
    goal: '让敌人一直朝向玩家。',
    concepts: ['Find Look at Rotation', 'Set Actor Rotation', 'Get Player Character'],
    steps: ['「Event Tick」→「Get Player Character」', '→「Find Look at Rotation」', '→「Set Actor Rotation」'],
    checks: ['Tick 已连到 Set Rotation', 'Find Look at Rotation 的两个输入都连了'],
    commonErrors: ['Find Look at Rotation 需要起点和终点'],
    templateId: 'tpl_ai' },
  { id: 'ch-08', group: '蓝图', title: '钥匙开门', lessonNo: '第 19 课', difficulty: 4, duration: '25 分钟',
    goal: '只有捡到钥匙后，按 E 才能开门。',
    concepts: ['Input Action', 'Branch', 'Set Text'],
    steps: ['「Input Action」→「Branch」', '「Get 布尔」→ Branch 的 Condition', 'True →「Play Sound」+「Set Actor Rotation」', 'False →「Set Text」'],
    checks: ['分支条件已连', '两路都有输出'],
    commonErrors: ['把钥匙状态存成一个布尔变量'],
    templateId: 'tpl_keydoor' },
  { id: 'ch-09', group: '数学运算', title: '四则运算', lessonNo: '第 27 课', difficulty: 2, duration: '10 分钟',
    goal: '用 Add / Subtract / Multiply 做基础数学运算。',
    concepts: ['Add', 'Subtract', 'Multiply'],
    steps: ['拖「Add (Float)」', '把两个输入的数值填上', '再试试 Multiply 和 Subtract', '结果输出可以连到 Print String'],
    checks: ['输入端已填值', '输出已连到 Print'],
    commonErrors: ['Float 和 Int 是两种类型'] },
  { id: 'ch-10', group: '数学运算', title: '向量初步', lessonNo: '第 29 课', difficulty: 3, duration: '15 分钟',
    goal: '理解向量的三个分量。',
    concepts: ['Make Vector', 'Break Vector'],
    steps: ['拖「Make Vector」', '把三个数值分别填上', '拖「Break Vector」', '把 Make 的输出连到 Break 的输入'],
    checks: ['Make 输出已连到 Break 输入', '三个分量都能对上'],
    commonErrors: ['X 是前后，Y 是左右，Z 是上下'] },
  { id: 'ch-11', group: '蓝图进阶', title: '函数与宏的应用', lessonNo: '第 34 课', difficulty: 4, duration: '20 分钟',
    goal: '理解函数和宏的区别。',
    concepts: ['Function 函数', 'Macro 宏'],
    steps: ['把一段常用逻辑打包成函数', '在别处调用它', '宏可以有多个执行出口'],
    checks: ['理解函数和宏的差异'],
    commonErrors: ['函数必须有返回值'] },
  { id: 'ch-12', group: '综合实战', title: '存档读档', lessonNo: '第 25 课', difficulty: 4, duration: '20 分钟',
    goal: '按 F5 存档，按 F9 读档。',
    concepts: ['Save Game to Slot', 'Load Game from Slot', 'Is Valid'],
    steps: ['「Input Action (F5)」→「Save Game to Slot」', '「Input Action (F9)」→「Load Game from Slot」', '→「Is Valid」'],
    checks: ['存档节点已连', '读档节点已连'],
    commonErrors: ['存档对象需要先创建'],
    templateId: 'tpl_save' },
];

/* ==================== 模板 ==================== */
export const TEMPLATES: Template[] = [
  { id: 'tpl_door', name: '1. 开门交互', desc: '走近门按 E 开关门',
    nodes: [
      { refId: 'begin', nodeId: 'beginplay', x: 60, y: 60 },
      { refId: 'getplayer', nodeId: 'getplayer', x: 60, y: 240 },
      { refId: 'cast', nodeId: 'cast', x: 380, y: 60 },
      { refId: 'input', nodeId: 'inputaction', x: 60, y: 420 },
      { refId: 'varget', nodeId: 'var_get_bool', x: 380, y: 300 },
      { refId: 'branch', nodeId: 'branch', x: 700, y: 300 },
      { refId: 'setopen_t', nodeId: 'var_set_bool', x: 1020, y: 260 },
      { refId: 'rot1', nodeId: 'setactorrotation', x: 1340, y: 260 },
      { refId: 'setopen_f', nodeId: 'var_set_bool', x: 1020, y: 440 },
      { refId: 'rot2', nodeId: 'setactorrotation', x: 1340, y: 440 },
    ],
    connections: [
      { fromRef: 'begin', fromPort: 0, toRef: 'cast', toPort: 0 },
      { fromRef: 'getplayer', fromPort: 0, toRef: 'cast', toPort: 1 },
      { fromRef: 'input', fromPort: 0, toRef: 'branch', toPort: 0 },
      { fromRef: 'varget', fromPort: 0, toRef: 'branch', toPort: 1 },
      { fromRef: 'branch', fromPort: 0, toRef: 'setopen_t', toPort: 0 },
      { fromRef: 'setopen_t', fromPort: 0, toRef: 'rot1', toPort: 0 },
      { fromRef: 'branch', fromPort: 1, toRef: 'setopen_f', toPort: 0 },
      { fromRef: 'setopen_f', fromPort: 0, toRef: 'rot2', toPort: 0 },
    ] },
  { id: 'tpl_move', name: '2. 玩家移动', desc: '用 Tick + Forward Vector 移动角色',
    nodes: [
      { refId: 'tick', nodeId: 'tick', x: 60, y: 60 },
      { refId: 'fwd', nodeId: 'getforward', x: 60, y: 240 },
      { refId: 'move', nodeId: 'addmovement', x: 380, y: 60 },
    ],
    connections: [
      { fromRef: 'tick', fromPort: 0, toRef: 'move', toPort: 0 },
      { fromRef: 'fwd', fromPort: 0, toRef: 'move', toPort: 1 },
    ] },
  { id: 'tpl_healthbar', name: '3. 血条 UI 跟随', desc: '血条跟着角色头顶',
    nodes: [
      { refId: 'begin', nodeId: 'beginplay', x: 60, y: 60 },
      { refId: 'create', nodeId: 'createwidget', x: 60, y: 240 },
      { refId: 'add', nodeId: 'addviewport', x: 380, y: 60 },
      { refId: 'tick', nodeId: 'tick', x: 60, y: 480 },
      { refId: 'vecVar', nodeId: 'var_get_vector', x: 60, y: 660 },
      { refId: 'proj', nodeId: 'worldtoscreen', x: 380, y: 480 },
      { refId: 'setpos', nodeId: 'setposviewport', x: 700, y: 480 },
    ],
    connections: [
      { fromRef: 'begin', fromPort: 0, toRef: 'add', toPort: 0 },
      { fromRef: 'create', fromPort: 0, toRef: 'add', toPort: 1 },
      { fromRef: 'tick', fromPort: 0, toRef: 'setpos', toPort: 0 },
      { fromRef: 'vecVar', fromPort: 0, toRef: 'proj', toPort: 0 },
      { fromRef: 'proj', fromPort: 0, toRef: 'setpos', toPort: 2 },
    ] },
  { id: 'tpl_fire', name: '4. 子弹发射', desc: '鼠标左键发射子弹',
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
    ] },
  { id: 'tpl_pickup', name: '5. 拾取道具', desc: '走进道具自动拾取',
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
    ] },
  { id: 'tpl_timer', name: '6. 倒计时', desc: '限时关卡倒计时',
    nodes: [
      { refId: 'begin', nodeId: 'beginplay', x: 60, y: 60 },
      { refId: 'timer', nodeId: 'settimer', x: 380, y: 60 },
      { refId: 'getf', nodeId: 'var_get_float', x: 60, y: 300 },
      { refId: 'subOp', nodeId: 'subtract_float', x: 380, y: 300 },
      { refId: 'setf', nodeId: 'var_set_float', x: 700, y: 300 },
      { refId: 'branch', nodeId: 'branch', x: 1020, y: 300 },
      { refId: 'level', nodeId: 'openlevel', x: 1340, y: 260 },
      { refId: 'text', nodeId: 'settext', x: 1340, y: 440 },
    ],
    connections: [
      { fromRef: 'begin', fromPort: 0, toRef: 'timer', toPort: 0 },
      { fromRef: 'timer', fromPort: 0, toRef: 'setf', toPort: 0 },
      { fromRef: 'getf', fromPort: 0, toRef: 'subOp', toPort: 0 },
      { fromRef: 'subOp', fromPort: 0, toRef: 'setf', toPort: 1 },
      { fromRef: 'setf', fromPort: 0, toRef: 'branch', toPort: 0 },
      { fromRef: 'branch', fromPort: 0, toRef: 'level', toPort: 0 },
      { fromRef: 'branch', fromPort: 1, toRef: 'text', toPort: 0 },
    ] },
  { id: 'tpl_ai', name: '7. AI 追逐', desc: '敌人追玩家',
    nodes: [
      { refId: 'tick', nodeId: 'tick', x: 60, y: 60 },
      { refId: 'getplayer', nodeId: 'getplayer', x: 60, y: 240 },
      { refId: 'vecVar', nodeId: 'var_get_vector', x: 60, y: 420 },
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
      { fromRef: 'vecVar', fromPort: 0, toRef: 'find', toPort: 1 },
    ] },
  { id: 'tpl_keydoor', name: '8. 钥匙开门', desc: '有钥匙才能开门',
    nodes: [
      { refId: 'input', nodeId: 'inputaction', x: 60, y: 60 },
      { refId: 'cast', nodeId: 'cast', x: 380, y: 60 },
      { refId: 'getkey', nodeId: 'var_get_bool', x: 60, y: 300 },
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
    ] },
  { id: 'tpl_rotate', name: '9. 掉落物旋转', desc: '宝箱/金币一直旋转',
    nodes: [
      { refId: 'tick', nodeId: 'tick', x: 60, y: 60 },
      { refId: 'addrot', nodeId: 'addrotation', x: 380, y: 60 },
    ],
    connections: [
      { fromRef: 'tick', fromPort: 0, toRef: 'addrot', toPort: 0 },
    ] },
  { id: 'tpl_save', name: '10. 存档/读档', desc: '按 F5 存、F9 读',
    nodes: [
      { refId: 'input_save', nodeId: 'inputaction', x: 60, y: 60 },
      { refId: 'save', nodeId: 'savegame', x: 380, y: 60 },
      { refId: 'input_load', nodeId: 'inputaction', x: 60, y: 300 },
      { refId: 'load', nodeId: 'loadgame', x: 60, y: 480 },
      { refId: 'setint', nodeId: 'var_set_int', x: 380, y: 300 },
      { refId: 'valid', nodeId: 'isvalid', x: 380, y: 480 },
    ],
    connections: [
      { fromRef: 'input_save', fromPort: 0, toRef: 'save', toPort: 0 },
      { fromRef: 'input_load', fromPort: 0, toRef: 'setint', toPort: 0 },
      { fromRef: 'load', fromPort: 0, toRef: 'valid', toPort: 0 },
    ] },
];