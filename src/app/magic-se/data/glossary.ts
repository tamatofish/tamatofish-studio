/* ==================== 术语速查表 ==================== */
export interface GlossaryItem {
  term: string;        // 英文术语
  cn: string;          // 中文
  category: '基础' | '事件' | '流程' | '类型' | '变换' | 'UI' | '音频' | '存档';
  desc: string;        // 详细介绍
}

export const GLOSSARY: GlossaryItem[] = [
  {
    term: 'Event', cn: '事件', category: '事件',
    desc: '蓝图的入口节点，游戏运行时某个时机触发它，比如 BeginPlay（游戏开始）、Tick（每帧）、ActorBeginOverlap（进入碰撞）。事件节点只有执行输出引脚，没有执行输入。',
  },
  {
    term: 'Exec', cn: '执行线', category: '基础',
    desc: '白色连线，表示"控制流"。只有执行引脚（白色圆点）之间才能连，比如 BeginPlay → Print String。数据线（彩色）不能连到执行引脚。',
  },
  {
    term: 'Pure', cn: '纯函数', category: '基础',
    desc: '没有执行引脚的节点，纯计算。比如 Add、Multiply、Get Actor Location。它们会在需要时自动运行，不参与执行流顺序。',
  },
  {
    term: 'Branch', cn: '分支', category: '流程',
    desc: '等价于 if / else。Condition 引脚输入布尔值，True 和 False 分别连到两条不同的执行线。',
  },
  {
    term: 'Cast', cn: '类型转换', category: '类型',
    desc: '把一个通用的 Actor / Object 引用，转换成你自定义的蓝图类型。成功和失败走不同执行引脚。失败分支不要空着——容易静默出错。',
  },
  {
    term: 'Overlap', cn: '重叠', category: '事件',
    desc: '两个碰撞体互相穿过时触发的事件。需要双方都开启 Generate Overlap Events，且碰撞类型不是 Block。',
  },
  {
    term: 'Tick', cn: '每帧事件', category: '事件',
    desc: '游戏运行期间每一帧都触发，频率取决于帧率（60 FPS 约每秒 60 次）。性能开销大，能不用就不用。',
  },
  {
    term: 'Delta Seconds', cn: '帧间隔', category: '基础',
    desc: '上一帧到当前帧经过了多少秒。和速度相乘可以让移动与帧率无关——60FPS 和 120FPS 下移动距离相同。',
  },
  {
    term: 'Vector', cn: '向量', category: '变换',
    desc: '由 X / Y / Z 三个浮点数组成，表示位置或方向。UE 里 X 是前后、Y 是左右、Z 是上下（左手坐标系）。',
  },
  {
    term: 'Rotator', cn: '旋转体', category: '变换',
    desc: '由 Pitch（俯仰）/ Yaw（偏航）/ Roll（翻滚）三个角度组成，单位是度（0~360）。',
  },
  {
    term: 'Actor', cn: 'Actor', category: '基础',
    desc: '可以放到场景里的对象。Character（角色）、Pawn（控制器）、Light（灯光）都是 Actor 的子类。',
  },
  {
    term: 'Pawn', cn: 'Pawn', category: '基础',
    desc: '可以被 Controller（玩家或 AI）控制的 Actor。Character 是 Pawn 的子类，自带移动组件和碰撞胶囊。',
  },
  {
    term: 'Controller', cn: '控制器', category: '基础',
    desc: '负责"决策"的组件。PlayerController 处理玩家输入，AIController 处理 AI 行为。',
  },
  {
    term: 'Function', cn: '函数', category: '流程',
    desc: '把一段逻辑打包成可复用的节点，只有一个执行出口。适合把复杂逻辑拆分。',
  },
  {
    term: 'Macro', cn: '宏', category: '流程',
    desc: '类似函数，但可以有多个执行出口和入口。常用于 Sequence、Gate 这类需要多路执行的结构。',
  },
  {
    term: 'Timer', cn: '定时器', category: '流程',
    desc: '延迟或循环触发一个事件。可以被取消和重启，比 Delay 更灵活。',
  },
  {
    term: 'UMG', cn: 'UI 系统', category: 'UI',
    desc: 'Unreal Motion Graphics，UE 的 UI 编辑器。用 Widget Blueprint 设计界面，用 Create Widget + Add to Viewport 显示。',
  },
  {
    term: 'Widget', cn: '控件', category: 'UI',
    desc: 'UMG 里的一个 UI 元素或一整块 UI（UserWidget）。可以显示文本、按钮、血条等。',
  },
  {
    term: 'SaveGame', cn: '存档对象', category: '存档',
    desc: '专门用于存档的类。把要保存的数据写入它的成员变量，然后 Save Game to Slot 到磁盘。',
  },
  {
    term: 'Slot', cn: '存档槽位', category: '存档',
    desc: '存档文件的"名字"。同一游戏可以有多个槽位（SaveSlot1、SaveSlot2），用于多存档。',
  },
  {
    term: 'Input Action', cn: '输入动作', category: '事件',
    desc: 'UE5 增强输入系统里，一个"玩家操作"的抽象。可以在蓝图里绑定按键，并接收它的 Pressed / Released 事件。',
  },
  {
    term: 'IMC', cn: '输入映射上下文', category: '事件',
    desc: 'Input Mapping Context。把 Input Action 绑定到具体按键的资产。需要在 PlayerController 里 Add Mapping Context 才能生效。',
  },
];