/* ==================== 网站编辑器快捷键 ==================== */
export interface EditorShortcut {
  keys: string;
  desc: string;
}

export const SHORTCUTS: EditorShortcut[] = [
  { keys: 'Del / Backspace', desc: '删除选中的节点' },
  { keys: 'Ctrl + Z', desc: '撤销上一步' },
  { keys: 'Ctrl + Shift + Z', desc: '重做（或 Ctrl + Y）' },
  { keys: 'Ctrl + C', desc: '复制选中的节点' },
  { keys: 'Ctrl + V', desc: '粘贴节点' },
  { keys: 'Ctrl + D', desc: '原地复制节点' },
  { keys: 'Ctrl + A', desc: '全选所有节点' },
  { keys: 'F', desc: '聚焦到选中的节点' },
  { keys: 'Esc', desc: '取消选中 / 关闭菜单' },
  { keys: 'Alt + 左键 (端口)', desc: '切断该端口上的所有连线' },
  { keys: 'Alt + 左键 (连线)', desc: '切断该条连线' },
  { keys: '右键点击连线', desc: '弹出菜单 → 删除此连线' },
  { keys: '左键拖拽空白', desc: '框选多个节点' },
  { keys: '右键拖拽画布', desc: '平移画布' },
  { keys: '右键单击画布', desc: '打开节点添加菜单' },
  { keys: '滚轮', desc: '缩放画布' },
  { keys: 'Ctrl + 拖动变量', desc: '快速添加 Get 节点' },
  { keys: 'Alt + 拖动变量', desc: '快速添加 Set 节点' },
  { keys: 'Ctrl + M', desc: '把选中节点折叠为宏节点' },
  { keys: '双击节点', desc: '宏 / 函数节点：展开；普通节点：打开文档' },
];

/* ==================== UE5 快捷键 ==================== */
export interface Ue5Shortcut {
  keys: string;
  desc: string;
}

export interface Ue5Category {
  title: string;
  subtitle: string;
  shortcuts: Ue5Shortcut[];
}

export const UE5_DATA: Ue5Category[] = [
  {
    title: '图表操作', subtitle: 'GRAPH ACTIONS',
    shortcuts: [{ keys: '右键点击图表', desc: '打开图表操作菜单' }],
  },
  {
    title: '选择', subtitle: 'SELECTION',
    shortcuts: [
      { keys: '单击节点', desc: '选择节点' },
      { keys: 'Shift + 单击节点', desc: '添加到选中项' },
      { keys: 'Ctrl + 单击节点', desc: '切换选中状态' },
      { keys: '左键拖拽', desc: '区域选择（替换）' },
      { keys: 'Shift + 左键拖拽', desc: '区域选择（添加）' },
      { keys: 'Ctrl + 左键拖拽', desc: '区域选择（删除）' },
    ],
  },
  {
    title: '导航', subtitle: 'NAVIGATION',
    shortcuts: [
      { keys: '右键拖拽', desc: '平移图表' },
      { keys: 'Home', desc: '缩放适应到选中项' },
      { keys: '滚轮上/下', desc: '放大 / 缩小' },
      { keys: '左键 + 右键拖拽', desc: '放大 / 缩小' },
      { keys: 'Ctrl + 滚轮', desc: '以超过 1:1 比例缩放' },
      { keys: 'PageDn', desc: '进入子图表' },
      { keys: 'PageUp', desc: '进入父项图表' },
    ],
  },
  {
    title: '通用命令', subtitle: 'GENERIC COMMANDS',
    shortcuts: [
      { keys: 'Ctrl + B', desc: '在内容浏览器中查找' },
      { keys: 'Ctrl + S', desc: '保存蓝图' },
      { keys: 'Ctrl + Y', desc: '重做' },
      { keys: 'Ctrl + Z', desc: '撤销' },
      { keys: 'Ctrl + F', desc: '在该蓝图中查找' },
      { keys: 'Ctrl + Shift + F', desc: '在任何蓝图中查找' },
      { keys: 'F7', desc: '编译蓝图' },
    ],
  },
  {
    title: '变量操作（我的蓝图）', subtitle: 'VARIABLE ACTIONS',
    shortcuts: [
      { keys: '左键拖拽到兼容引脚', desc: '视情况获得 / 设置变量' },
      { keys: '左键拖拽到图表中', desc: '获得 / 设置变量（通过菜单）' },
      { keys: 'Ctrl + 左键拖拽到图表中', desc: '获得变量' },
      { keys: 'Alt + 左键拖拽到图表中', desc: '设置变量' },
      { keys: '左键拖拽到 Get/Set 边缘', desc: '修改现有节点' },
      { keys: '在“我的蓝图”中左键拖拽', desc: '修改类目或重新排序' },
    ],
  },
  {
    title: '节点操作', subtitle: 'NODE ACTIONS',
    shortcuts: [
      { keys: '右键点击节点', desc: '节点相关的关联菜单' },
      { keys: '双击左键节点', desc: '跳转到相关的节点 / 图表' },
      { keys: '左键拖拽节点', desc: '移动节点' },
      { keys: '方向键', desc: '移动选中的节点' },
      { keys: 'Delete', desc: '删除选中的节点' },
      { keys: '左击标题', desc: '重命名节点 / 编辑注释' },
      { keys: 'F2', desc: '重命名节点 / 编辑注释' },
      { keys: 'F9', desc: '切换断点' },
      { keys: 'Ctrl + Shift + F9', desc: '清除所有断点' },
      { keys: 'Ctrl + X', desc: '剪切选中项' },
      { keys: 'Ctrl + C', desc: '复制选中项' },
      { keys: 'Ctrl + V', desc: '粘贴节点' },
      { keys: 'Ctrl + W', desc: '克隆选中项' },
      { keys: 'C', desc: '围绕选中项添加注释' },
    ],
  },
  {
    title: '引脚操作', subtitle: 'PIN ACTIONS',
    shortcuts: [
      { keys: '右键点击引脚', desc: '引脚相关的关联菜单' },
      { keys: '鼠标悬停到引脚上', desc: '着重显示连接线' },
      { keys: '左击 + 拖拽到引脚', desc: '连接到另一个引脚' },
      { keys: '左击 + 拖拽到图表', desc: '引脚的过滤后的操作菜单' },
      { keys: 'Alt + 左击引脚', desc: '断开所有连接' },
      { keys: 'Ctrl + 左键拖拽到引脚', desc: '移动所有连接' },
    ],
  },
  {
    title: '节点创建快捷方式', subtitle: 'CREATION SHORTCUTS',
    shortcuts: [
      { keys: 'A + 左击', desc: 'Array Get 节点' },
      { keys: 'B + 左击', desc: 'Branch 分支节点' },
      { keys: 'C', desc: 'Comment Box 注释框节点' },
      { keys: 'D + 左击', desc: 'Delay 延迟节点' },
      { keys: 'S + 左击', desc: 'Sequence 序列节点' },
      { keys: 'G + 左击', desc: 'Gate 门节点' },
      { keys: 'F + 左击', desc: 'For-Each Loop 循环节点' },
      { keys: 'M + 左击', desc: 'Multi-gate 多门节点' },
      { keys: 'N + 左击', desc: 'Do N Times 执行 N 次节点' },
      { keys: 'O + 左击', desc: 'Do Once 执行一次节点' },
      { keys: 'P + 左击', desc: 'BeginPlay 事件' },
    ],
  },
  {
    title: '关卡视口 · 摄像机与移动', subtitle: 'LEVEL VIEWPORT — CAMERA',
    shortcuts: [
      { keys: '右键拖拽', desc: '环顾四周' },
      { keys: '右键 + WASD', desc: '前后左右移动' },
      { keys: '右键 + E / Q', desc: '向上 / 向下移动' },
      { keys: '右键 + 滚轮', desc: '调节摄像机移动速度' },
      { keys: '右键 + C / Z', desc: '缩放（FOV 视野）' },
      { keys: 'F', desc: '聚焦到选中的对象' },
      { keys: 'Alt + 左键拖拽', desc: '围绕物体旋转视角' },
      { keys: 'Alt + 右键拖拽', desc: '推拉变焦' },
    ],
  },
  {
    title: '关卡视口 · 变换与选择', subtitle: 'LEVEL VIEWPORT — TRANSFORM',
    shortcuts: [
      { keys: 'Q', desc: '选择模式' },
      { keys: 'W', desc: '移动模式' },
      { keys: 'E', desc: '旋转模式' },
      { keys: 'R', desc: '缩放模式' },
      { keys: '空格键', desc: '切换 移动 / 旋转 / 缩放 模式' },
      { keys: 'G', desc: '切换游戏视图（隐藏编辑器元素）' },
      { keys: 'F11', desc: '沉浸模式（全屏视口）' },
      { keys: 'Esc', desc: '取消所有选择' },
      { keys: 'H', desc: '隐藏选中对象' },
      { keys: 'Ctrl + H', desc: '取消隐藏所有' },
      { keys: 'Ctrl + G', desc: '打组 / 解组' },
    ],
  },
  {
    title: '关卡视口 · 吸附', subtitle: 'LEVEL VIEWPORT — SNAPPING',
    shortcuts: [
      { keys: 'End', desc: '吸附到地面' },
      { keys: 'Alt + End', desc: '吸附轴心到地面' },
      { keys: 'Shift + End', desc: '吸附边界到地面' },
      { keys: 'Ctrl + End', desc: '吸附到世界网格' },
      { keys: '[ / ]', desc: '减小 / 增大位置网格尺寸' },
      { keys: 'Shift + [ / ]', desc: '减小 / 增大旋转网格尺寸' },
    ],
  },
  {
    title: '关卡视口 · 视图与书签', subtitle: 'LEVEL VIEWPORT — VIEWS',
    shortcuts: [
      { keys: 'Alt + G', desc: '透视视图' },
      { keys: 'Alt + H', desc: '前视图' },
      { keys: 'Alt + J', desc: '顶视图' },
      { keys: 'Alt + K', desc: '侧视图' },
      { keys: 'Ctrl + 数字键 1-9', desc: '设置书签' },
      { keys: '数字键 1-9', desc: '跳转到书签' },
      { keys: 'Alt + 2 ~ Alt + 0', desc: '切换视图模式（线框 / 无光照 / 光照等）' },
    ],
  },
  {
    title: '编辑器通用', subtitle: 'EDITOR GENERAL',
    shortcuts: [
      { keys: 'Ctrl + S', desc: '保存当前关卡' },
      { keys: 'Ctrl + Z', desc: '撤销' },
      { keys: 'Ctrl + Y', desc: '重做' },
      { keys: 'Ctrl + B', desc: '在内容浏览器中查找选中资产' },
      { keys: 'F2', desc: '重命名选中项' },
      { keys: 'F4', desc: '打开 Actor 详细信息面板' },
      { keys: 'Alt + P', desc: '在编辑器中播放' },
      { keys: 'Alt + S', desc: '在编辑器中模拟' },
      { keys: 'F8', desc: '从玩家视角弹出（PIE 中）' },
      { keys: 'Ctrl + Tab', desc: '浏览标签页' },
    ],
  },
  {
    title: '资产编辑器视口', subtitle: 'ASSET EDITOR VIEWPORTS',
    shortcuts: [
      { keys: 'I', desc: '切换环境显示' },
      { keys: 'O', desc: '切换地板显示' },
      { keys: 'P', desc: '切换后处理显示' },
    ],
  },
];