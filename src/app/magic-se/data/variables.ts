/* ==================== 类型导入 ==================== */
import type { PortType, NodeData } from './nodeLibrary';
import { NODE_COLORS } from './nodeLibrary';

/* ==================== 基础变量类型（UE 真实存在的 9 种） ==================== */
export const BASE_VARIABLES: {
  key: string; label: string; type: PortType;
  desc: string; commonScene: string; source: string;
}[] = [
  {
    key: 'Bool', label: '布尔', type: 'bool',
    desc: '只有 True / False 两个值。',
    commonScene:
      '【做什么】二选一的逻辑开关，只有"真"和"假"两种状态。\n' +
      '【什么时候用】门的开关状态、是否持有钥匙、任务是否完成、技能是否冷却。\n' +
      '【新手注意】不要把整数 0 / 1 直接当作布尔用——UE 的类型系统是严格的。\n' +
      '【常见错误】把整数或浮点数直接连到 Bool 引脚——编译会失败，需要先做比较（如 Greater）。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/blueprint-variables-in-unreal-engine',
  },
  {
    key: 'Int', label: '整数', type: 'int',
    desc: '不带小数的整数，范围约 -21 亿 ~ 21 亿。',
    commonScene:
      '【做什么】存储整数，用于计数、索引、数量等场景。\n' +
      '【什么时候用】分数、剩余生命数、数组索引、关卡编号。\n' +
      '【新手注意】Int 会自动转换为 Float（隐式），但 Float 不能隐式转回 Int。\n' +
      '【常见错误】拿 Int 做除法得到小数——会截断小数部分，想要小数结果要先转成 Float。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/blueprint-variables-in-unreal-engine',
  },
  {
    key: 'Float', label: '浮点', type: 'float',
    desc: '带小数的数值，精度约 7 位有效数字。',
    commonScene:
      '【做什么】存储小数，用于需要精度的数值。\n' +
      '【什么时候用】血量、速度、倒计时、冷却时间、位置坐标。\n' +
      '【新手注意】浮点运算有精度误差，不要用 == 直接比较两个浮点数是否相等。\n' +
      '【常见错误】忘记和 Delta Seconds 相乘——导致移动速度随帧率变化。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/blueprint-variables-in-unreal-engine',
  },
  {
    key: 'String', label: '字符串', type: 'string',
    desc: '一串文本，可以拼接、查找、比较。',
    commonScene:
      '【做什么】存储文本内容。\n' +
      '【什么时候用】玩家名字、存档槽位名、UI 提示文本、日志输出。\n' +
      '【新手注意】String 是可变长文本，性能开销比 Name / Text 大；纯显示建议用 Text。\n' +
      '【常见错误】拼字符串时忘了加分隔符（空格/逗号），导致输出难读。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/blueprint-variables-in-unreal-engine',
  },
  {
    key: 'Vector', label: '向量', type: 'vector',
    desc: '由 X / Y / Z 三个浮点数组成，表示位置或方向。',
    commonScene:
      '【做什么】表示三维空间中的位置或方向。\n' +
      '【什么时候用】坐标、位置、移动方向、速度向量、射线起点/终点。\n' +
      '【新手注意】UE 里 X 是前后、Y 是左右、Z 是上下（左手坐标系）。\n' +
      '【常见错误】把方向向量和位置向量混淆——方向向量应该用 Normalize 归一化。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/blueprint-variables-in-unreal-engine',
  },
  {
    key: 'Rotator', label: '旋转体', type: 'rotator',
    desc: '由 Pitch / Yaw / Roll 三个角度组成，表示朝向。',
    commonScene:
      '【做什么】表示三维空间中的旋转角度。\n' +
      '【什么时候用】角色朝向、镜头旋转、门旋转、炮塔瞄准。\n' +
      '【新手注意】Rotator 的单位是度（0~360），不是弧度。\n' +
      '【常见错误】过度旋转导致数值累积到几千度——建议用 Normalize 或者每帧只加少量。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/blueprint-variables-in-unreal-engine',
  },
  {
    key: 'Actor', label: 'Actor 引用', type: 'actor',
    desc: '指向场景中某个 Actor 实例的引用。',
    commonScene:
      '【做什么】指向场景中的某个具体 Actor（不是类，是实例）。\n' +
      '【什么时候用】锁定攻击目标、记录玩家引用、记录交互对象。\n' +
      '【新手注意】访问它的自定义属性前需要 Cast 到具体类型。\n' +
      '【常见错误】Actor 被销毁后引用变成"无效"（null）——用前要用 Is Valid 检查。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/blueprint-variables-in-unreal-engine',
  },
  {
    key: 'Class', label: '类引用', type: 'class',
    desc: '指向某个蓝图类（而非实例）的引用。',
    commonScene:
      '【做什么】指向一个蓝图类本身，而不是它的某个实例。\n' +
      '【什么时候用】Spawn 敌人、按类型查找所有 Actor、动态创建对象。\n' +
      '【新手注意】Class 引用可以在蓝图里选择具体类型，也可以在运行时动态赋值。\n' +
      '【常见错误】把 Class 当作实例直接调用函数——Class 只描述"是什么"，不代表"哪一份"。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/blueprint-variables-in-unreal-engine',
  },
  {
    key: 'Widget', label: '控件', type: 'object',
    desc: '指向一个 UMG 控件实例。',
    commonScene:
      '【做什么】指向创建好的 UMG 控件（UserWidget 实例）。\n' +
      '【什么时候用】保存血条、菜单、提示框的引用，方便后续更新。\n' +
      '【新手注意】创建控件后要保存引用，否则无法更新它显示的内容。\n' +
      '【常见错误】创建了控件但没保存——只能通过 Find Widget 之类的方式重新获取，效率低。',
    source: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/umg-ui-designer-for-unreal-engine',
  },
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