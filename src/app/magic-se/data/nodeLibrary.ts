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

export const PORT_COLORS: Record<PortType, string> = {
  exec:   '#f0f0f0',
  bool:   '#a01a1a',
  int:    '#1ad6b8',
  float:  '#9ce09c',
  string: '#ff69b4',
  vector: '#f5c518',
  rotator:'#a78bfa',
  object: '#4fb4ff',
  class:  '#7b68ee',
  actor:  '#33c9b6',
};
export const PORT_LABELS: Record<PortType, string> = {
  exec: '执行', bool: '布尔', int: '整数', float: '浮点', string: '字符串',
  vector: '向量', rotator: '旋转', object: '对象', class: '类', actor: 'Actor',
};

export const NODE_COLORS = {
  event:     '#7a1f1f',
  flow:      '#3d4650',
  pure:      '#2c6b4a',
  cast:      '#1a6b7a',
  spawn:     '#4a3a6e',
  debug:     '#6b5a2a',
  transform: '#3f3a63',
  timer:     '#2c3a4a',
  character: '#2a5a3f',
  math:      '#1a4a6b',
  ui:        '#7a5a1a',
  audio:     '#1a4a5a',
  save:      '#5a2a4a',
  variable:  '#1f7a5a',
} as const;

export const NODE_WIDTH = 240;
export const HEADER_H = 52;
export const PORT_ROW_H = 22;
export const PORT_AREA_PT = 8;
export const PORT_DOT_OFFSET = 6;
export const DRAG_MIME = 'application/x-magic-node';

export function isTypeCompatible(fromType: PortType, toType: PortType): boolean {
  if (fromType === toType) return true;
  if (fromType === 'int' && toType === 'float') return true;
  const refTypes: PortType[] = ['object', 'class', 'actor'];
  if (refTypes.includes(fromType) && refTypes.includes(toType)) return true;
  return false;
}

/* ==================== 节点库 ==================== */
export const NODE_LIBRARY: NodeData[] = [
  // —— 事件 ——
  {
    id: 'beginplay', title: 'Event BeginPlay', category: '事件', color: NODE_COLORS.event,
    desc: 'Actor 进入游戏世界时触发一次。相当于"开机按钮"。',
    commonScene: '【做什么】游戏开始时（或 Actor 被生成到世界时）自动触发一次，且仅触发一次。\n【什么时候用】初始化变量、创建 UI、设置初始状态、绑定事件、生成初始物体。\n【新手注意】每个 Actor 都会独立触发自己的 BeginPlay，不是全局只触发一次。\n【常见错误】把需要每帧运行的逻辑放在这里——它只跑一次，不会持续更新。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/basic-scripting-with-blueprints-in-unreal-engine',
    inputs: [],
    outputs: [{ name: '', type: 'exec', desc: '执行输出。' }],
  },
  {
    id: 'tick', title: 'Event Tick', category: '事件', color: NODE_COLORS.event,
    desc: '每一帧触发一次，频率取决于帧率（60 FPS 约每秒 60 次）。相当于"心跳"。',
    commonScene: '【做什么】游戏运行期间每一帧都会触发，用于需要持续更新的逻辑。\n【什么时候用】持续移动/旋转、检查距离、更新 HUD、平滑插值。\n【新手注意】务必把 Delta Seconds 乘以移动速度，否则帧率越高角色跑得越快。这是新手最常踩的坑。\n【性能警告】Tick 每帧都跑，能不用就不用；能用 Timer 或 Timeline 替代的，优先用它们。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/basic-scripting-with-blueprints-in-unreal-engine',
    inputs: [],
    outputs: [
      { name: '', type: 'exec', desc: '执行输出。' },
      { name: 'Delta Seconds', type: 'float', desc: '帧间隔时间（秒）。' },
    ],
  },
  {
    id: 'beginoverlap', title: 'Event ActorBeginOverlap', category: '事件', color: NODE_COLORS.event,
    desc: '有 Actor 进入当前 Actor 的碰撞范围时触发。相当于"门铃"。',
    commonScene: '【做什么】当另一个 Actor 进入当前 Actor 的碰撞体（且开启了 Overlap 事件）时触发，参数里带着"进来的那个 Actor"。\n【什么时候用】拾取物品、触发区域、进入危险区、与 NPC 对话。\n【新手注意】需要双方都开启 "Generate Overlap Events"，且碰撞类型设置为 Overlap 而不是 Block。\n【常见错误】输出参数 Other Actor 是通用的 Actor 引用，想访问它的具体属性，需要先 Cast。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/flow-control-in-unreal-engine',
    inputs: [],
    outputs: [
      { name: '', type: 'exec', desc: '执行输出。' },
      { name: 'Other Actor', type: 'actor', desc: '进入碰撞的 Actor。' },
    ],
  },
  {
    id: 'anydamage', title: 'Event AnyDamage', category: '事件', color: NODE_COLORS.event,
    desc: '当前 Actor 受到伤害时触发。相当于"受伤通知"。',
    commonScene: '【做什么】当有其他 Actor 通过 Apply Damage 节点对当前 Actor 造成伤害时触发。\n【什么时候用】扣血、播放受击动画、死亡判定、生成掉落物。\n【新手注意】必须使用 Apply Damage 节点才能触发它，直接修改 Health 变量不会触发。\n【常见错误】以为受伤了就会自动触发——它需要对方主动调用 Apply Damage。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/Game/Damage',
    inputs: [],
    outputs: [
      { name: '', type: 'exec', desc: '执行输出。' },
      { name: 'Damage', type: 'float', desc: '伤害值。' },
    ],
  },
  {
    id: 'destroyed', title: 'Event Destroyed', category: '事件', color: NODE_COLORS.event,
    desc: '当前 Actor 被销毁时触发。相当于"关机程序"。',
    commonScene: '【做什么】当 Actor 被 Destroy Actor 节点销毁时触发，用于做最后的清理工作。\n【什么时候用】清理资源、播放死亡特效、生成掉落物、通知其他 Actor。\n【新手注意】触发这个事件时，Actor 已经"死了"，不要再尝试修改它的 Transform 或让它移动。\n【常见错误】以为销毁后还能访问这个 Actor——它会变成无效引用。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/Game/Actor',
    inputs: [],
    outputs: [{ name: '', type: 'exec', desc: '执行输出。' }],
  },
  // —— 输入 ——
  {
    id: 'inputaction', title: 'Input Action', category: '输入', color: NODE_COLORS.event,
    desc: '玩家按下或松开指定按键时触发。相当于"遥控器按钮"。',
    commonScene: '【做什么】当玩家按下/松开某个按键时，触发对应的逻辑。UE5 使用增强输入系统（Enhanced Input）。\n【什么时候用】开门、射击、交互、角色移动、跳跃。\n【新手注意】需要先在项目设置里创建 Input Action 资产，再在 Input Mapping Context 里绑定按键，最后在蓝图里用这个节点接收。\n【常见错误】忘记把 IMC 添加到 Player Controller——这样按键完全没反应。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/designer-09-sprint-input-action-in-unreal-engine',
    inputs: [],
    outputs: [
      { name: 'Pressed', type: 'exec', desc: '按下时执行。' },
      { name: 'Released', type: 'exec', desc: '松开时执行。' },
    ],
  },
  // —— 流程控制 ——
  {
    id: 'branch', title: 'Branch', category: '流程控制', color: NODE_COLORS.flow,
    desc: '布尔条件判断，等价于 if / else。True 走一条路，False 走另一条。',
    commonScene: '【做什么】接收一个布尔值（True/False），根据结果决定执行哪一条输出线。\n【什么时候用】判断血量是否大于 0、判断是否持有钥匙、根据状态走不同逻辑。\n【新手注意】Condition 必须输入布尔类型（红心色引脚）。\n【常见错误】把整数或浮点数直接连到 Condition——需要先用 Greater、Less 等比较节点转换成布尔值。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/flow-control-in-unreal-engine',
    inputs: [
      { name: '', type: 'exec', desc: '执行输入。' },
      { name: 'Condition', type: 'bool', desc: '判断条件。' },
    ],
    outputs: [
      { name: 'True', type: 'exec', desc: '条件为真时执行。' },
      { name: 'False', type: 'exec', desc: '条件为假时执行。' },
    ],
    defaultValues: { 1: 'false' },
  },
  {
    id: 'sequence', title: 'Sequence', category: '流程控制', color: NODE_COLORS.flow,
    desc: '按顺序执行多个后续逻辑，输出引脚可添加。',
    commonScene: '【做什么】把一条执行流拆成多条，并按顺序一条一条执行。\n【什么时候用】一次触发多个独立操作，例如：开门 + 播放音效 + 扣钥匙。\n【新手注意】它不是"同时执行"——第一条分支完全跑完后，才跑第二条。\n【常见错误】以为多条分支会并行执行——如果其中有 Delay 节点，后面的分支会等它跑完。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/flow-control-in-unreal-engine',
    inputs: [{ name: '', type: 'exec', desc: '执行输入。' }],
    outputs: [
      { name: 'Then 0', type: 'exec', desc: '第一个输出。' },
      { name: 'Then 1', type: 'exec', desc: '第二个输出。' },
      { name: 'Then 2', type: 'exec', desc: '第三个输出。' },
    ],
  },
  {
    id: 'doonce', title: 'Do Once', category: '流程控制', color: NODE_COLORS.flow,
    desc: '只执行一次，相当于"一次性开关"。',
    commonScene: '【做什么】第一次执行时放行，之后一直挡住，直到收到 Reset 信号。\n【什么时候用】防止重复触发，例如拾取道具只生效一次、首次进入触发一次对话。\n【新手注意】可以配合 Delay 节点实现"每 N 秒才能触发一次"的限流效果。\n【常见错误】忘记在需要重置的时候连 Reset——这样它永远只能触发一次。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/flow-control-in-unreal-engine',
    inputs: [
      { name: '', type: 'exec', desc: '执行输入。' },
      { name: 'Reset', type: 'exec', desc: '重置开关，重新允许执行。' },
      { name: 'Start Closed', type: 'bool', desc: '初始是否关闭。' },
    ],
    outputs: [{ name: 'Completed', type: 'exec', desc: '执行输出。' }],
  },
  {
    id: 'delay', title: 'Delay', category: '流程控制', color: NODE_COLORS.flow,
    desc: '延迟指定秒数后继续执行，属于"潜在函数"。',
    commonScene: '【做什么】暂停当前这条执行线，等待指定秒数后继续。等待期间游戏不会卡住，其他逻辑照常运行。\n【什么时候用】开门延迟、死亡后延迟重生、定时切换灯光。\n【新手注意】如果在等待期间再次触发同一个 Delay，新的触发会被忽略，原来的计时继续。\n【常见错误】在复杂系统里用 Delay 会导致逻辑难管理——优先用 Set Timer by Event，它可以被取消和重启。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/Utilities/Time',
    inputs: [
      { name: '', type: 'exec', desc: '执行输入。' },
      { name: 'Duration', type: 'float', desc: '延迟时间（秒）。' },
    ],
    outputs: [{ name: 'Completed', type: 'exec', desc: '延迟结束输出。' }],
    defaultValues: { 1: '0.2' },
  },
  {
    id: 'openlevel', title: 'Open Level', category: '流程控制', color: NODE_COLORS.flow,
    desc: '加载指定关卡，常用于切换场景。',
    commonScene: '【做什么】卸载当前关卡，加载另一个关卡。\n【什么时候用】关卡切换、重新开始、进入下一关。\n【新手注意】关卡名必须是已存在的关卡资产名（不带 .umap 后缀）。\n【常见错误】以为它会立刻切换——加载需要时间，之后的代码可能在旧关卡里执行。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/Game/OpenLevel',
    inputs: [
      { name: '', type: 'exec', desc: '执行输入。' },
      { name: 'Level Name', type: 'string', desc: '关卡名。' },
    ],
    outputs: [{ name: '', type: 'exec', desc: '执行输出。' }],
    defaultValues: { 1: 'Level_02' },
  },
  // —— 角色 ——
  {
    id: 'getplayer', title: 'Get Player Character', category: '角色', color: NODE_COLORS.character,
    desc: '获取玩家角色的引用（返回 Actor 类型）。',
    commonScene: '【做什么】通过玩家索引（单人游戏是 0）找到该玩家当前控制的角色（Character）。\n【什么时候用】需要获取玩家位置、朝向、距离时。\n【新手注意】返回的是通用的 Actor 引用，要访问玩家蓝图里的自定义变量，需要先 Cast。\n【常见错误】以为它返回的就是你的自定义角色蓝图——它返回的是基类 Character，必须 Cast 到具体类型才能用。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/basic-scripting-with-blueprints-in-unreal-engine',
    inputs: [{ name: 'Player Index', type: 'int', desc: '玩家索引，单人游戏填 0。' }],
    outputs: [{ name: 'Return Value', type: 'actor', desc: '玩家引用。' }],
    defaultValues: { 0: '0' },
  },
  {
    id: 'addmovement', title: 'Add Movement Input', category: '角色', color: NODE_COLORS.character,
    desc: '给角色添加移动输入，需要方向向量和倍率。',
    commonScene: '【做什么】给 Pawn 添加一个"移动意图"，方向用世界空间的向量表示。\n【什么时候用】角色移动（配合 Tick 和 Forward Vector）。\n【新手注意】Base Pawn 不会自动应用这个移动，需要配合 Consume Movement Input 或 Character 自带的移动组件。\n【常见错误】直接连了方向但没连 Tick——这样只会移动一帧，看起来像没动。',
    source: 'https://dev.epicgames.com/documentation/unreal-engine/BlueprintAPI/Pawn/Input/AddMovementInput',
    inputs: [
      { name: '', type: 'exec', desc: '执行输入。' },
      { name: 'World Direction', type: 'vector', desc: '移动方向（世界空间）。' },
      { name: 'Scale Value', type: 'float', desc: '速度倍率。' },
    ],
    outputs: [{ name: '', type: 'exec', desc: '执行输出。' }],
    defaultValues: { 1: '0,0,0', 2: '1.0' },
  },
  {
    id: 'setvelocity', title: 'Set Velocity', category: '角色', color: NODE_COLORS.character,
    desc: '直接设置 Actor 的速度向量（单位：厘米/秒）。',
    commonScene: '【做什么】直接给 Actor 一个速度值，它会按这个速度运动。\n【什么时候用】发射子弹、抛射物体、给物体一个初始速度。\n【新手注意】它会覆盖物理系统的速度计算——如果 Actor 用了物理模拟，慎用。\n【常见错误】以为设置速度就会自动移动——对于没有物理模拟的 Actor，速度不会自动转化为位移。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/Game/Actor',
    inputs: [
      { name: '', type: 'exec', desc: '执行输入。' },
      { name: 'New Velocity', type: 'vector', desc: '速度向量。' },
    ],
    outputs: [{ name: '', type: 'exec', desc: '执行输出。' }],
    defaultValues: { 1: '0,0,0' },
  },
  // —— 变换 ——
  {
    id: 'getactorlocation', title: 'Get Actor Location', category: '变换', color: NODE_COLORS.transform,
    desc: '获取 Actor 的世界坐标（Vector）。',
    commonScene: '【做什么】返回 Actor 在世界空间中的位置坐标。\n【什么时候用】计算距离、获取当前位置、作为投射物的起点。\n【新手注意】UE 的坐标单位是厘米，X 是前后、Y 是左右、Z 是上下。\n【常见错误】忘了它是"世界坐标"，不是"相对坐标"。如果需要相对某个父 Actor 的坐标，要用 Get Relative Location。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/Game/Actor',
    inputs: [{ name: 'Target', type: 'actor', desc: '目标 Actor。' }],
    outputs: [{ name: 'Return Value', type: 'vector', desc: '世界坐标。' }],
  },
  {
    id: 'getforward', title: 'Get Actor Forward Vector', category: '变换', color: NODE_COLORS.transform,
    desc: '获取 Actor 的朝前方向（Vector），单位向量。',
    commonScene: '【做什么】返回 Actor 正面朝向的单位向量（长度为 1），表示"它在往哪看"。\n【什么时候用】发射子弹时获取枪口朝向、角色移动方向、射线检测方向。\n【新手注意】UE 中 X 轴是"前方"，所以 Forward Vector 通常是 (1,0,0) 旋转后的结果。\n【常见错误】把它和 Right Vector、Up Vector 搞混——它们分别是 X、Y、Z 轴方向。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/Game/Actor',
    inputs: [{ name: 'Target', type: 'actor', desc: '目标 Actor。' }],
    outputs: [{ name: 'Return Value', type: 'vector', desc: '朝前方向。' }],
  },
  {
    id: 'getdistance', title: 'Get Distance To', category: '变换', color: NODE_COLORS.transform,
    desc: '计算两个 Actor 之间的直线距离（Float，单位厘米）。',
    commonScene: '【做什么】返回当前 Actor 到另一个 Actor 的直线距离。\n【什么时候用】判断玩家是否在攻击范围内、触发远处事件。\n【新手注意】它算的是"两个 Actor 原点之间的距离"，不是碰撞体边缘的距离。\n【常见错误】想用碰撞体边缘做距离判断——需要额外计算或换用其他方式。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/Game/Actor',
    inputs: [{ name: 'Other Actor', type: 'actor', desc: '另一个 Actor。' }],
    outputs: [{ name: 'Return Value', type: 'float', desc: '距离。' }],
  },
  {
    id: 'setactorlocation', title: 'Set Actor Location', category: '变换', color: NODE_COLORS.transform,
    desc: '设置 Actor 的世界坐标。',
    commonScene: '【做什么】把 Actor 瞬间移动到指定坐标。\n【什么时候用】瞬移、移动物体、把 Actor 放到指定位置。\n【新手注意】它是"瞬移"不是"平滑移动"，想要平滑移动要用 Tick + Lerp。\n【常见错误】在物理模拟的 Actor 上用它会和物理系统冲突——需要用 Set Actor Location (Sweep) 避免穿墙。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/pawn-in-unreal-engine',
    inputs: [
      { name: '', type: 'exec', desc: '执行输入。' },
      { name: 'New Location', type: 'vector', desc: '新坐标。' },
    ],
    outputs: [{ name: '', type: 'exec', desc: '执行输出。' }],
    defaultValues: { 1: '0,0,0' },
  },
  {
    id: 'setactorrotation', title: 'Set Actor Rotation', category: '变换', color: NODE_COLORS.transform,
    desc: '设置 Actor 的旋转（Rotator）。',
    commonScene: '【做什么】把 Actor 的朝向设置为指定的旋转值。\n【什么时候用】开门、朝向玩家、摄像机转向。\n【新手注意】Rotator 的三个值是 Pitch（俯仰）、Yaw（偏航）、Roll（翻滚），单位是度。\n【常见错误】给角色设置旋转时可能会和 Camera 冲突导致抖动——需要确保 Camera 的旋转不受角色影响。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/Game/Actor',
    inputs: [
      { name: '', type: 'exec', desc: '执行输入。' },
      { name: 'New Rotation', type: 'rotator', desc: '新旋转。' },
    ],
    outputs: [{ name: '', type: 'exec', desc: '执行输出。' }],
    defaultValues: { 1: '0,0,0' },
  },
  {
    id: 'setactorvisibility', title: 'Set Actor Visibility', category: '变换', color: NODE_COLORS.transform,
    desc: '设置 Actor 是否可见。',
    commonScene: '【做什么】控制 Actor 是否在画面中渲染，隐藏后碰撞体仍然存在。\n【什么时候用】隐藏/显示物体（如拾取后隐藏道具、敌人死亡后隐藏）。\n【新手注意】隐藏的是"显示"，不是"销毁"——Actor 仍然存在，逻辑仍然可以运行。\n【常见错误】想要"消失且不再存在"，应该用 Destroy Actor 而不是隐藏。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/Game/Actor',
    inputs: [
      { name: '', type: 'exec', desc: '执行输入。' },
      { name: 'New Hidden', type: 'bool', desc: '是否隐藏。' },
    ],
    outputs: [{ name: '', type: 'exec', desc: '执行输出。' }],
    defaultValues: { 1: 'false' },
  },
  {
    id: 'addrotation', title: 'Add Actor Local Rotation', category: '变换', color: NODE_COLORS.transform,
    desc: '相对当前旋转进行增量旋转。',
    commonScene: '【做什么】在当前旋转的基础上，额外增加一个旋转量。\n【什么时候用】让物体持续旋转（金币、宝箱、收集品），配合 Tick 使用。\n【新手注意】它是"加法"——每帧加一点，就会持续旋转。\n【常见错误】直接每帧 Set Actor Rotation 会让旋转"跳变"，用 Add 才是平滑的。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/Game/Actor',
    inputs: [
      { name: '', type: 'exec', desc: '执行输入。' },
      { name: 'Delta Rotation', type: 'rotator', desc: '旋转增量。' },
    ],
    outputs: [{ name: '', type: 'exec', desc: '执行输出。' }],
    defaultValues: { 1: '0,90,0' },
  },
  {
    id: 'findlookat', title: 'Find Look at Rotation', category: '变换', color: NODE_COLORS.transform,
    desc: '计算从起点看向终点的旋转（Rotator）。',
    commonScene: '【做什么】给定起点和终点，算出"从起点看向终点"应该用什么样的旋转值。\n【什么时候用】敌人朝向玩家、摄像机看向目标。\n【新手注意】返回的是 Rotator，通常要配合 Set Actor Rotation 才能看到效果。\n【常见错误】只连了它但没连 Set Actor Rotation——只会算不会转。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/Math/Rotator/FindLookatRotation',
    inputs: [
      { name: 'Start', type: 'vector', desc: '起点。' },
      { name: 'Target', type: 'vector', desc: '终点。' },
    ],
    outputs: [{ name: 'Return Value', type: 'rotator', desc: '旋转。' }],
    defaultValues: { 0: '0,0,0', 1: '100,0,0' },
  },
  {
    id: 'makevector', title: 'Make Vector', category: '变换', color: NODE_COLORS.transform,
    desc: '把 X/Y/Z 三个浮点数组合成 Vector。',
    commonScene: '【做什么】把三个单独的浮点数拼成一个三维向量。\n【什么时候用】手动构造方向或位置向量，例如给 Set Actor Location 提供一个自定义坐标。\n【新手注意】X 是前后、Y 是左右、Z 是上下。\n【常见错误】搞混轴的方向——UE 里 X 向前、Y 向右、Z 向上。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/Math/Vector',
    inputs: [
      { name: 'X', type: 'float', desc: 'X 分量。' },
      { name: 'Y', type: 'float', desc: 'Y 分量。' },
      { name: 'Z', type: 'float', desc: 'Z 分量。' },
    ],
    outputs: [{ name: 'Return Value', type: 'vector', desc: '组合后的向量。' }],
    defaultValues: { 0: '0', 1: '0', 2: '0' },
  },
  {
    id: 'breakvector', title: 'Break Vector', category: '变换', color: NODE_COLORS.transform,
    desc: '把 Vector 拆分为 X/Y/Z 三个浮点数。',
    commonScene: '【做什么】把一个三维向量拆成三个单独的浮点数。\n【什么时候用】从向量中提取单个坐标分量，例如判断物体的高度（Z）。\n【新手注意】它是 Make Vector 的反向操作。\n【常见错误】如果你只是想单独看某个分量，可以直接在引脚上点 Split 展开，不一定要用 Break Vector。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/Math/Vector',
    inputs: [{ name: 'In Vec', type: 'vector', desc: '输入向量。' }],
    outputs: [
      { name: 'X', type: 'float', desc: 'X 分量。' },
      { name: 'Y', type: 'float', desc: 'Y 分量。' },
      { name: 'Z', type: 'float', desc: 'Z 分量。' },
    ],
    defaultValues: { 0: '0,0,0' },
  },
  // —— 类型转换 ——
  {
    id: 'cast', title: 'Cast To BP_Player', category: '类型转换', color: NODE_COLORS.cast,
    desc: '把通用对象引用转换为特定类，成功/失败走不同执行引脚。',
    commonScene: '【做什么】把一个通用的 Actor/Object 引用，尝试转换成你自定义的蓝图类型。\n【什么时候用】确认交互对象是否为玩家或特定类型，然后访问其特有函数。\n【新手注意】Cast 成功后才能访问目标类型的自定义变量和函数。\n【常见错误】Cast 失败分支不处理——如果转换失败，后续逻辑不会执行，可能静默出错。',
    source: 'https://dev.epicgames.com/community/learning/tutorials/23av/unreal-engine-entendiendo-los-blueprint-interface',
    inputs: [
      { name: '', type: 'exec', desc: '执行输入。' },
      { name: 'Object', type: 'object', desc: '要转换的对象。' },
    ],
    outputs: [
      { name: 'As Player', type: 'actor', desc: '转换成功后的结果。' },
      { name: 'Cast Failed', type: 'exec', desc: '转换失败时执行。' },
      { name: '', type: 'exec', desc: '转换成功时执行。' },
    ],
  },
  // —— 生成 ——
  {
    id: 'spawn', title: 'Spawn Actor from Class', category: '生成', color: NODE_COLORS.spawn,
    desc: '运行时生成一个 Actor 实例。',
    commonScene: '【做什么】在游戏运行时动态创建一个新的 Actor 实例。\n【什么时候用】生成子弹、敌人、道具。\n【新手注意】需要指定要生成的类（Class）和生成时的位置/旋转（Transform）。\n【常见错误】忘了把 Class 引脚连上——不连的话不会生成任何东西。',
    source: 'https://dev.epicgames.com/documentation/unreal-engine/BlueprintAPI/EditorScripting/LevelUtility/SpawnActorfromClass',
    inputs: [
      { name: '', type: 'exec', desc: '执行输入。' },
      { name: 'Class', type: 'class', desc: '要生成的类。' },
      { name: 'Spawn Transform', type: 'rotator', desc: '生成位置和朝向。' },
      { name: 'Collision Handling', type: 'string', desc: '碰撞处理策略。' },
    ],
    outputs: [
      { name: '', type: 'exec', desc: '执行输出。' },
      { name: 'Return Value', type: 'actor', desc: '生成的 Actor。' },
    ],
    defaultValues: { 2: '0,0,0', 3: 'Always Spawn' },
  },
  {
    id: 'destroy', title: 'Destroy Actor', category: '生成', color: NODE_COLORS.spawn,
    desc: '销毁指定 Actor。',
    commonScene: '【做什么】把指定的 Actor 从游戏世界中彻底移除。\n【什么时候用】拾取后销毁道具、敌人死亡后销毁。\n【新手注意】销毁会触发对方的 Event Destroyed 事件。\n【常见错误】以为销毁后还能访问它——它已经变成无效引用了。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/Game/Actor',
    inputs: [
      { name: '', type: 'exec', desc: '执行输入。' },
      { name: 'Target', type: 'actor', desc: '要销毁的 Actor。' },
    ],
    outputs: [{ name: '', type: 'exec', desc: '执行输出。' }],
  },
  // —— 定时器 ——
  {
    id: 'settimer', title: 'Set Timer by Event', category: '定时器', color: NODE_COLORS.timer,
    desc: '延迟或循环触发一个事件。',
    commonScene: '【做什么】设置一个定时器，在指定秒数后触发一个事件，或者每隔一段时间重复触发。\n【什么时候用】循环触发（倒计时、定期生成敌人）。\n【新手注意】Looping = true 时循环，Time 决定间隔秒数。会返回 Timer Handle 用于取消。\n【常见错误】在复杂系统里用 Delay 而不是 Timer——Timer 可以被取消和重启，Delay 不能。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/Utilities/Time',
    inputs: [
      { name: '', type: 'exec', desc: '执行输入。' },
      { name: 'Object', type: 'object', desc: '事件的所有者。' },
      { name: 'Event', type: 'bool', desc: '要触发的事件委托。' },
      { name: 'Time', type: 'float', desc: '间隔时间（秒）。' },
      { name: 'Looping', type: 'bool', desc: '是否循环。' },
    ],
    outputs: [
      { name: '', type: 'exec', desc: '执行输出。' },
      { name: 'Return Value', type: 'object', desc: 'Timer Handle，用于清除定时器。' },
    ],
    defaultValues: { 3: '1.0', 4: 'true' },
  },
  // —— 数学 ——
  {
    id: 'lerp', title: 'Lerp', category: '数学', color: NODE_COLORS.math,
    desc: '线性插值，Alpha 从 0 到 1，结果从 A 平滑过渡到 B。',
    commonScene: '【做什么】根据 Alpha（0~1）在 A 和 B 之间取一个插值结果。Alpha=0 返回 A，Alpha=1 返回 B，0.5 返回中间值。\n【什么时候用】平滑过渡（颜色、位置、旋转）。\n【新手注意】Alpha 通常用 Delta Seconds × 速度来控制，实现平滑移动。\n【常见错误】Alpha 给固定值——这样结果就是固定的，不会"动"。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/Math/Interpolation',
    inputs: [
      { name: 'A', type: 'float', desc: '起点。' },
      { name: 'B', type: 'float', desc: '终点。' },
      { name: 'Alpha', type: 'float', desc: '插值比例 0~1。' },
    ],
    outputs: [{ name: 'Return Value', type: 'float', desc: '插值结果。' }],
    defaultValues: { 0: '0.0', 1: '1.0', 2: '0.5' },
  },
  {
    id: 'add_float', title: 'Add (Float)', category: '数学', color: NODE_COLORS.math,
    desc: '两个浮点数相加。',
    commonScene: '【做什么】把两个浮点数加在一起，返回结果。\n【什么时候用】累加数值（分数、血量恢复、位置偏移）。\n【新手注意】这是纯函数，没有执行引脚。\n【常见错误】想用它来"执行"逻辑——它只返回数值，不触发执行。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/Math/Float',
    inputs: [
      { name: 'A', type: 'float', desc: '加数 A。' },
      { name: 'B', type: 'float', desc: '加数 B。' },
    ],
    outputs: [{ name: 'Return Value', type: 'float', desc: 'A + B。' }],
    defaultValues: { 0: '0.0', 1: '0.0' },
  },
  {
    id: 'subtract_float', title: 'Subtract (Float)', category: '数学', color: NODE_COLORS.math,
    desc: '两个浮点数相减。',
    commonScene: '【做什么】用 A 减去 B，返回结果。\n【什么时候用】扣血、倒计时减少、位置回退。\n【新手注意】A 是被减数，B 是减数。\n【常见错误】搞反 A 和 B 的顺序——结果会相反。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/Math/Float',
    inputs: [
      { name: 'A', type: 'float', desc: '被减数。' },
      { name: 'B', type: 'float', desc: '减数。' },
    ],
    outputs: [{ name: 'Return Value', type: 'float', desc: 'A - B。' }],
    defaultValues: { 0: '1.0', 1: '1.0' },
  },
  {
    id: 'multiply_float', title: 'Multiply (Float)', category: '数学', color: NODE_COLORS.math,
    desc: '两个浮点数相乘。',
    commonScene: '【做什么】把两个浮点数相乘，返回结果。\n【什么时候用】缩放数值（速度倍率、伤害倍率、插值系数）。\n【新手注意】和 Delta Seconds 相乘是让移动"帧率无关"的关键。\n【常见错误】用整数去乘浮点数——UE 会自动转换，但显式用浮点更安全。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/Math/Float',
    inputs: [
      { name: 'A', type: 'float', desc: '因数 A。' },
      { name: 'B', type: 'float', desc: '因数 B。' },
    ],
    outputs: [{ name: 'Return Value', type: 'float', desc: 'A × B。' }],
    defaultValues: { 0: '1.0', 1: '1.0' },
  },
  {
    id: 'greater_float', title: 'Greater (Float)', category: '数学', color: NODE_COLORS.math,
    desc: '判断 A 是否大于 B（返回 Bool）。',
    commonScene: '【做什么】比较两个浮点数，如果 A 大于 B 返回 True，否则返回 False。\n【什么时候用】判断分数是否达标、血量是否大于 0、距离是否超过阈值。\n【新手注意】返回的是布尔值，可以直接连到 Branch 的 Condition。\n【常见错误】把它当 Branch 用——它只返回 True/False，不做分支。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/Math/Float',
    inputs: [
      { name: 'A', type: 'float', desc: '被比较数。' },
      { name: 'B', type: 'float', desc: '比较数。' },
    ],
    outputs: [{ name: 'Return Value', type: 'bool', desc: 'A > B。' }],
    defaultValues: { 0: '0.0', 1: '0.0' },
  },
  // —— UI ——
  {
    id: 'createwidget', title: 'Create Widget', category: 'UI', color: NODE_COLORS.ui,
    desc: '创建 UMG 控件实例。',
    commonScene: '【做什么】根据指定的 Widget 类，创建一个 UI 控件的实例。\n【什么时候用】创建血条、菜单、提示框。\n【新手注意】创建后还要用 Add to Viewport 才显示在屏幕上。\n【常见错误】创建了但忘了 Add to Viewport——UI 不会出现。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/UMG',
    inputs: [{ name: 'Class', type: 'class', desc: 'Widget 类。' }],
    outputs: [{ name: 'Return Value', type: 'object', desc: '创建的控件实例。' }],
  },
  {
    id: 'addviewport', title: 'Add to Viewport', category: 'UI', color: NODE_COLORS.ui,
    desc: '把控件添加到屏幕上。',
    commonScene: '【做什么】把创建好的 UI 控件显示到屏幕上。\n【什么时候用】显示 UI。\n【新手注意】每个控件只能添加一次，重复添加会报错或显示多个。\n【常见错误】忘记保存 UI 引用——后续想更新它的时候找不到。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/UMG',
    inputs: [
      { name: '', type: 'exec', desc: '执行输入。' },
      { name: 'Target', type: 'object', desc: '要添加的控件。' },
    ],
    outputs: [{ name: '', type: 'exec', desc: '执行输出。' }],
  },
  {
    id: 'setposviewport', title: 'Set Position in Viewport', category: 'UI', color: NODE_COLORS.ui,
    desc: '设置控件在屏幕上的位置。',
    commonScene: '【做什么】控制 UI 控件在屏幕上的位置。\n【什么时候用】血条跟随角色头顶。\n【新手注意】通常配合 Project World to Screen 使用，把 3D 坐标转成屏幕坐标再设置。\n【常见错误】只设置了位置但没设置控件尺寸，导致显示异常。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/UMG',
    inputs: [
      { name: '', type: 'exec', desc: '执行输入。' },
      { name: 'Target', type: 'object', desc: '控件。' },
      { name: 'Position', type: 'vector', desc: '屏幕坐标。' },
    ],
    outputs: [{ name: '', type: 'exec', desc: '执行输出。' }],
    defaultValues: { 2: '0,0' },
  },
  {
    id: 'worldtoscreen', title: 'Project World to Screen', category: 'UI', color: NODE_COLORS.ui,
    desc: '把世界坐标转换为屏幕坐标。',
    commonScene: '【做什么】把一个 3D 世界空间中的点，转换成 2D 屏幕上的像素坐标。\n【什么时候用】UI 定位、血条跟随、伤害数字弹出。\n【新手注意】结果依赖当前摄像机的位置和朝向。\n【常见错误】摄像机旋转后位置算错——因为它是基于当前摄像机计算的。',
    source: 'https://dev.epicgames.com/documentation/unreal-engine/API/Runtime/UMG/UWidgetLayoutLibrary/ProjectWorldLoca-',
    inputs: [{ name: 'World Position', type: 'vector', desc: '世界坐标。' }],
    outputs: [{ name: 'Screen Position', type: 'vector', desc: '屏幕坐标。' }],
    defaultValues: { 0: '0,0,0' },
  },
  {
    id: 'settext', title: 'Set Text', category: 'UI', color: NODE_COLORS.ui,
    desc: '设置文本控件的文字。',
    commonScene: '【做什么】修改文本控件（Text Block）显示的内容。\n【什么时候用】更新分数、显示提示信息、动态更新 HP 显示。\n【新手注意】Target 是具体的文本控件引用，不是整个 UI。\n【常见错误】把 Target 连到了错误的控件——文字会显示到别的地方。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/UMG',
    inputs: [
      { name: '', type: 'exec', desc: '执行输入。' },
      { name: 'Target', type: 'object', desc: '文本控件。' },
      { name: 'In Text', type: 'string', desc: '新文字。' },
    ],
    outputs: [{ name: '', type: 'exec', desc: '执行输出。' }],
    defaultValues: { 2: 'Hello' },
  },
  // —— 音频 ——
  {
    id: 'playsound', title: 'Play Sound at Location', category: '音频', color: NODE_COLORS.audio,
    desc: '在指定世界位置播放音效。',
    commonScene: '【做什么】在指定的 3D 位置播放一个音效，会根据距离衰减。\n【什么时候用】爆炸、脚步、开门等空间音效。\n【新手注意】音效会根据距离和方向衰减，适合 3D 空间音效。\n【常见错误】用 3D 音效来播 UI 音效——UI 音效应该用 Play Sound 2D。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/Audio',
    inputs: [
      { name: '', type: 'exec', desc: '执行输入。' },
      { name: 'Sound', type: 'object', desc: '音效资源。' },
      { name: 'Location', type: 'vector', desc: '播放位置。' },
    ],
    outputs: [{ name: '', type: 'exec', desc: '执行输出。' }],
    defaultValues: { 2: '0,0,0' },
  },
  {
    id: 'playsound2d', title: 'Play Sound 2D', category: '音频', color: NODE_COLORS.audio,
    desc: '播放 2D 音效（无位置衰减）。',
    commonScene: '【做什么】播放一个不随距离衰减的音效。\n【什么时候用】UI 音效、背景音乐、提示音。\n【新手注意】它不依赖位置，无论玩家在哪都听到一样响。\n【常见错误】用 2D 音效做世界音效——会失去空间感。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/Audio',
    inputs: [
      { name: '', type: 'exec', desc: '执行输入。' },
      { name: 'Sound', type: 'object', desc: '音效资源。' },
    ],
    outputs: [{ name: '', type: 'exec', desc: '执行输出。' }],
  },
  // —— 存档 ——
  {
    id: 'savegame', title: 'Save Game to Slot', category: '存档', color: NODE_COLORS.save,
    desc: '把游戏状态保存到指定槽位。',
    commonScene: '【做什么】把游戏数据保存到磁盘文件里。\n【什么时候用】存档系统。\n【新手注意】Save Game Object 需要先创建（SaveGame 类），Slot Name 是存档文件名。\n【常见错误】忘了把要保存的数据先写进 SaveGame 对象里——这样存的是空的。',
    source: 'https://dev.epicgames.com/documentation/unreal-engine/BlueprintAPI/SaveGame',
    inputs: [
      { name: '', type: 'exec', desc: '执行输入。' },
      { name: 'Save Game Object', type: 'object', desc: '存档对象。' },
      { name: 'Slot Name', type: 'string', desc: '槽位名。' },
    ],
    outputs: [
      { name: '', type: 'exec', desc: '执行输出。' },
      { name: 'Return Value', type: 'bool', desc: '是否保存成功。' },
    ],
    defaultValues: { 2: 'SaveSlot1' },
  },
  {
    id: 'loadgame', title: 'Load Game from Slot', category: '存档', color: NODE_COLORS.save,
    desc: '从槽位读取存档。',
    commonScene: '【做什么】从磁盘文件里读取之前保存的游戏数据。\n【什么时候用】读档系统。\n【新手注意】返回值为 Object，需 Cast 到具体的 SaveGame 类才能访问其中的数据。\n【常见错误】直接访问返回值的属性——它只是 Object，必须先 Cast。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/SaveGame',
    inputs: [{ name: 'Slot Name', type: 'string', desc: '槽位名。' }],
    outputs: [{ name: 'Return Value', type: 'object', desc: '存档对象。' }],
    defaultValues: { 0: 'SaveSlot1' },
  },
  // —— 调试 ——
  {
    id: 'print', title: 'Print String', category: '调试', color: NODE_COLORS.debug,
    desc: '在屏幕上打印文字，调试神器。',
    commonScene: '【做什么】把一段文字显示在屏幕上，用于调试。\n【什么时候用】调试输出、观察变量值、验证执行顺序。\n【新手注意】只在屏幕上显示，正式发布时应移除或改用日志。\n【常见错误】忘了删掉调试用的 Print——发布后屏幕上全是文字。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/Utilities/String',
    inputs: [
      { name: '', type: 'exec', desc: '执行输入。' },
      { name: 'In String', type: 'string', desc: '要打印的文字。' },
      { name: 'Duration', type: 'float', desc: '显示时长（秒）。' },
    ],
    outputs: [{ name: '', type: 'exec', desc: '执行输出。' }],
    defaultValues: { 1: 'Hello UE', 2: '2.0' },
  },
  // —— 工具 ——
  {
    id: 'isvalid', title: 'Is Valid', category: '工具', color: NODE_COLORS.pure,
    desc: '检查对象引用是否有效（非 null）。',
    commonScene: '【做什么】判断一个对象引用是否为空（null）。有效返回 True，无效返回 False。\n【什么时候用】读档前检查存档是否存在、检查引用是否为空。\n【新手注意】防止访问空对象导致崩溃。\n【常见错误】忘了检查 Cast 结果就使用——Cast 失败时返回 null，直接访问会崩溃。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/Utilities/Validation',
    inputs: [{ name: 'Object', type: 'object', desc: '要检查的对象。' }],
    outputs: [{ name: 'Return Value', type: 'bool', desc: '是否有效。' }],
  },
  {
    id: 'getworlddelta', title: 'Get World Delta Seconds', category: '工具', color: NODE_COLORS.pure,
    desc: '获取当前帧的时间间隔（Float）。',
    commonScene: '【做什么】返回上一帧到当前帧经过了多少秒。\n【什么时候用】与速度相乘，实现与帧率无关的移动。\n【新手注意】它是让移动"帧率无关"的关键——60FPS 和 120FPS 下移动距离相同。\n【常见错误】忘了乘以它——高帧率机器上物体移动会更快。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/Utilities/Time',
    inputs: [],
    outputs: [{ name: 'Return Value', type: 'float', desc: '帧时间间隔。' }],
  },
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

/* ==================== 优化的贝塞尔曲线 ==================== */
export function bezierPath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = x2 - x1;
  const dy = y2 - y1;

  // 终点在起点右侧（正常情况）：横向拉伸
  if (dx > 40) {
    const cx = Math.max(40, dx * 0.5);
    return `M ${x1} ${y1} C ${x1 + cx} ${y1}, ${x2 - cx} ${y2}, ${x2} ${y2}`;
  }

  // 终点在起点左侧（回绕）：绕上/下走一个大弧
  if (dx < -40) {
    const arc = Math.max(120, Math.abs(dx) * 0.6);
    const side = dy >= 0 ? 1 : -1;
    const offY = side * arc;
    return `M ${x1} ${y1} C ${x1 + 60} ${y1 + offY}, ${x2 - 60} ${y2 + offY}, ${x2} ${y2}`;
  }

  // 起终点几乎竖直对齐：竖直弯曲
  const cy = Math.max(40, Math.abs(dy) * 0.5);
  const side = dy >= 0 ? 1 : -1;
  return `M ${x1} ${y1} C ${x1} ${y1 + cy * side}, ${x2} ${y2 - cy * side}, ${x2} ${y2}`;
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
];/* ==================== 模板 ==================== */
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

  // ==================== 官方文档常见示例 ====================
  { id: 'tpl_door_trigger', name: '11. 触发器自动门', desc: '走进触发区 → 门自动旋转打开（Epic 官方教程示例）',
    nodes: [
      { refId: 'overlap', nodeId: 'beginoverlap', x: 60, y: 60 },
      { refId: 'cast', nodeId: 'cast', x: 380, y: 60 },
      { refId: 'rot', nodeId: 'setactorrotation', x: 700, y: 60 },
    ],
    connections: [
      { fromRef: 'overlap', fromPort: 0, toRef: 'cast', toPort: 0 },
      { fromRef: 'overlap', fromPort: 1, toRef: 'cast', toPort: 1 },
      { fromRef: 'cast', fromPort: 2, toRef: 'rot', toPort: 0 },
    ] },
  { id: 'tpl_orbit', name: '12. 摄像机环绕', desc: '每帧围绕目标旋转（Time + Sin/Cos + Set Rotation）',
    nodes: [
      { refId: 'tick', nodeId: 'tick', x: 60, y: 60 },
      { refId: 'addrot', nodeId: 'addrotation', x: 380, y: 60 },
    ],
    connections: [
      { fromRef: 'tick', fromPort: 0, toRef: 'addrot', toPort: 0 },
    ] },
  { id: 'tpl_teleport', name: '13. 传送门', desc: '按 E 键 → 传送自己到目标点',
    nodes: [
      { refId: 'input', nodeId: 'inputaction', x: 60, y: 60 },
      { refId: 'setloc', nodeId: 'setactorlocation', x: 380, y: 60 },
    ],
    connections: [
      { fromRef: 'input', fromPort: 0, toRef: 'setloc', toPort: 0 },
    ] },
  { id: 'tpl_respawn', name: '14. 死亡重生', desc: '受到伤害 → 播放特效 → 延迟后回出生点',
    nodes: [
      { refId: 'dmg', nodeId: 'anydamage', x: 60, y: 60 },
      { refId: 'branch', nodeId: 'branch', x: 380, y: 60 },
      { refId: 'setloc', nodeId: 'setactorlocation', x: 700, y: 30 },
      { refId: 'delay', nodeId: 'delay', x: 700, y: 200 },
    ],
    connections: [
      { fromRef: 'dmg', fromPort: 0, toRef: 'branch', toPort: 0 },
      { fromRef: 'branch', fromPort: 0, toRef: 'setloc', toPort: 0 },
      { fromRef: 'setloc', fromPort: 0, toRef: 'delay', toPort: 0 },
    ] },
  { id: 'tpl_health', name: '15. HP 系统', desc: '受伤 → 扣血 → 判断是否死亡',
    nodes: [
      { refId: 'dmg', nodeId: 'anydamage', x: 60, y: 60 },
      { refId: 'getf', nodeId: 'var_get_float', x: 60, y: 240 },
      { refId: 'sub', nodeId: 'subtract_float', x: 380, y: 240 },
      { refId: 'setf', nodeId: 'var_set_float', x: 700, y: 240 },
      { refId: 'branch', nodeId: 'branch', x: 1020, y: 240 },
      { refId: 'destroy', nodeId: 'destroy', x: 1340, y: 200 },
    ],
    connections: [
      { fromRef: 'dmg', fromPort: 0, toRef: 'setf', toPort: 0 },
      { fromRef: 'getf', fromPort: 0, toRef: 'sub', toPort: 0 },
      { fromRef: 'sub', fromPort: 0, toRef: 'setf', toPort: 1 },
      { fromRef: 'setf', fromPort: 0, toRef: 'branch', toPort: 0 },
      { fromRef: 'branch', fromPort: 0, toRef: 'destroy', toPort: 0 },
    ] },
  { id: 'tpl_patrol', name: '16. 巡逻 AI', desc: '每帧移动 + 到达后转向（简化版）',
    nodes: [
      { refId: 'tick', nodeId: 'tick', x: 60, y: 60 },
      { refId: 'fwd', nodeId: 'getforward', x: 60, y: 240 },
      { refId: 'move', nodeId: 'addmovement', x: 380, y: 60 },
    ],
    connections: [
      { fromRef: 'tick', fromPort: 0, toRef: 'move', toPort: 0 },
      { fromRef: 'fwd', fromPort: 0, toRef: 'move', toPort: 1 },
    ] },
  { id: 'tpl_rotate_tick', name: '17. 物体自转', desc: '每帧旋转一点（饰品、光圈）',
    nodes: [
      { refId: 'tick', nodeId: 'tick', x: 60, y: 60 },
      { refId: 'addrot', nodeId: 'addrotation', x: 380, y: 60 },
    ],
    connections: [
      { fromRef: 'tick', fromPort: 0, toRef: 'addrot', toPort: 0 },
    ] },
  { id: 'tpl_pickup_score', name: '18. 拾取加分', desc: '拾取 → 加分 → 更新 UI',
    nodes: [
      { refId: 'overlap', nodeId: 'beginoverlap', x: 60, y: 60 },
      { refId: 'cast', nodeId: 'cast', x: 380, y: 60 },
      { refId: 'getscore', nodeId: 'var_get_int', x: 60, y: 300 },
      { refId: 'add', nodeId: 'add_float', x: 700, y: 300 },
      { refId: 'setscore', nodeId: 'var_set_int', x: 1020, y: 300 },
      { refId: 'destroy', nodeId: 'destroy', x: 1020, y: 60 },
    ],
    connections: [
      { fromRef: 'overlap', fromPort: 0, toRef: 'cast', toPort: 0 },
      { fromRef: 'overlap', fromPort: 1, toRef: 'cast', toPort: 1 },
      { fromRef: 'cast', fromPort: 2, toRef: 'destroy', toPort: 0 },
      { fromRef: 'getscore', fromPort: 0, toRef: 'add', toPort: 0 },
      { fromRef: 'add', fromPort: 0, toRef: 'setscore', toPort: 1 },
    ] },
  { id: 'tpl_ui_toggle', name: '19. UI 开关', desc: '按键 → 显示/隐藏 UI',
    nodes: [
      { refId: 'input', nodeId: 'inputaction', x: 60, y: 60 },
      { refId: 'add', nodeId: 'addviewport', x: 380, y: 60 },
    ],
    connections: [
      { fromRef: 'input', fromPort: 0, toRef: 'add', toPort: 0 },
    ] },
  { id: 'tpl_door_key', name: '20. 钥匙 + 自动门', desc: '走近自动开门（无按键版）',
    nodes: [
      { refId: 'overlap', nodeId: 'beginoverlap', x: 60, y: 60 },
      { refId: 'rot', nodeId: 'setactorrotation', x: 380, y: 60 },
    ],
    connections: [
      { fromRef: 'overlap', fromPort: 0, toRef: 'rot', toPort: 0 },
    ] },
];