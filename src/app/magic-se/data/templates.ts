/* ==================== 模板 ==================== */
import type { Template } from './nodeLibrary';

/**
 * 模板端口索引说明：
 *  - 所有端口在模板使用时都会被 `sortPorts()` 重排：exec 一律排在前。
 *  - 因此下面所有 fromPort / toPort 都按"排序后"的真实索引写。
 *
 * 关键节点的端口顺序（排序后）：
 *  - Event BeginPlay:  in=[]                 out=[exec]
 *  - Event Tick:       in=[]                 out=[exec, Delta(float)]
 *  - Event BeginOverlap: in=[]               out=[exec, OtherActor(actor)]
 *  - Event AnyDamage:  in=[]                 out=[exec, Damage(float)]
 *  - Input Action:     in=[]                 out=[Pressed(exec), Released(exec)]
 *  - Branch:           in=[exec, Condition(bool)]  out=[True(exec), False(exec)]
 *  - Sequence:         in=[exec]             out=[Then0(exec), Then1(exec), Then2(exec)]
 *  - Do Once:          in=[exec, Reset(exec), StartClosed(bool)]  out=[Completed(exec)]
 *  - Delay:            in=[exec, Duration(float)]  out=[Completed(exec)]
 *  - Cast To BP_Player: in=[exec, Object(object)]  out=[CastFailed(exec), Success(exec), AsPlayer(actor)]
 *  - SpawnActor:       in=[exec, Class(class), SpawnTransform(rotator), CollisionHandling(string)]  out=[exec, ReturnValue(actor)]
 *  - GetPlayer:        in=[PlayerIndex(int)] out=[ReturnValue(actor)]
 *  - Add Movement:     in=[exec, WorldDir(vector), Scale(float)]  out=[exec]
 *  - SetActorLocation: in=[exec, NewLocation(vector)] out=[exec]
 *  - SetActorRotation: in=[exec, NewRotation(rotator)] out=[exec]
 *  - SetActorVisibility: in=[exec, NewHidden(bool)] out=[exec]
 *  - AddActorRotation: in=[exec, DeltaRotation(rotator)] out=[exec]
 *  - FindLookAt:       in=[Start(vector), Target(vector)] out=[ReturnValue(rotator)]   (纯函数)
 *  - GetActorLocation: in=[Target(actor)] out=[ReturnValue(vector)]  (纯)
 *  - GetForward:       in=[Target(actor)] out=[ReturnValue(vector)]  (纯)
 *  - GetDistance:      in=[OtherActor(actor)] out=[ReturnValue(float)] (纯)
 *  - MakeVector:       in=[X(float), Y(float), Z(float)] out=[ReturnValue(vector)] (纯)
 *  - BreakVector:      in=[InVec(vector)] out=[X(float), Y(float), Z(float)] (纯)
 *  - PrintString:      in=[exec, InString(string), Duration(float)] out=[exec]
 *  - PlaySound2D:      in=[exec, Sound(object)] out=[exec]
 *  - PlaySoundAtLoc:   in=[exec, Sound(object), Location(vector)] out=[exec]
 *  - CreateWidget:     in=[Class(class)] out=[ReturnValue(object)]  (纯)
 *  - AddToViewport:    in=[exec, Target(object)] out=[exec]
 *  - SetPositionViewport: in=[exec, Target(object), Position(vector)] out=[exec]
 *  - WorldToScreen:    in=[WorldPosition(vector)] out=[ScreenPosition(vector)] (纯)
 *  - SetText:          in=[exec, Target(object), InText(string)] out=[exec]
 *  - SaveGameToSlot:   in=[exec, SaveGameObject(object), SlotName(string)] out=[exec, ReturnValue(bool)]
 *  - LoadGameFromSlot: in=[SlotName(string)] out=[ReturnValue(object)] (纯)
 *  - IsValid:          in=[Object(object)] out=[ReturnValue(bool)] (纯)
 *  - SetTimerByEvent:  in=[exec, Object(object), Event(object), Time(float), Looping(bool)] out=[exec, ReturnValue(object)]
 *  - Lerp:             in=[A(float), B(float), Alpha(float)] out=[ReturnValue(float)] (纯)
 *  - Add/Subtract/Multiply(float): in=[A(float), B(float)] out=[ReturnValue(float)] (纯)
 *  - Greater/Less(float): in=[A(float), B(float)] out=[ReturnValue(bool)] (纯)
 *  - Equal(float):     in=[A(float), B(float)] out=[ReturnValue(bool)] (纯)
 *  - AddInt/SubInt/MulInt: in=[A(int), B(int)] out=[ReturnValue(int)] (纯)
 *  - RandomFloat:      in=[Min(float), Max(float)] out=[ReturnValue(float)] (纯)
 *  - GetWorldDelta:    in=[] out=[ReturnValue(float)] (纯)
 *  - GetPlayerCharacter: in=[PlayerIndex(int)] out=[ReturnValue(actor)] (纯)
 *  - OpenLevel:        in=[exec, LevelName(string)] out=[exec]
 *  - DestroyActor:     in=[exec, Target(actor)] out=[exec]
 *
 *  - var_get_xxx: in=[] out=[Value]
 *  - var_set_xxx: in=[exec, Value] out=[exec]
 */

export const TEMPLATES: Template[] = [
  /* ========== 1. 开门交互 ========== */
  {
    id: 'tpl_door',
    name: '1. 开门交互',
    desc: '按 E 键切换门的开关状态（开关 + 旋转）',
    nodes: [
      { refId: 'input',    nodeId: 'inputaction',      x:   60, y:  60 },
      { refId: 'varget',   nodeId: 'var_get_bool',     x:   60, y: 260 },
      { refId: 'branch',   nodeId: 'branch',           x:  380, y:  60 },
      { refId: 'settrue',  nodeId: 'var_set_bool',     x:  700, y:  20 },
      { refId: 'rot_open', nodeId: 'setactorrotation', x: 1020, y:  20 },
      { refId: 'setfalse', nodeId: 'var_set_bool',     x:  700, y: 260 },
      { refId: 'rot_close',nodeId: 'setactorrotation', x: 1020, y: 260 },
    ],
    connections: [
      { fromRef: 'input',    fromPort: 0, toRef: 'branch',    toPort: 0 },
      { fromRef: 'varget',   fromPort: 0, toRef: 'branch',    toPort: 1 },
      { fromRef: 'branch',   fromPort: 0, toRef: 'settrue',   toPort: 0 },
      { fromRef: 'settrue',  fromPort: 0, toRef: 'rot_open',  toPort: 0 },
      { fromRef: 'branch',   fromPort: 1, toRef: 'setfalse',  toPort: 0 },
      { fromRef: 'setfalse', fromPort: 0, toRef: 'rot_close', toPort: 0 },
    ],
  },

  /* ========== 2. 玩家移动 ========== */
  {
    id: 'tpl_move',
    name: '2. 玩家移动',
    desc: 'Tick + Forward Vector + Delta Seconds 实现帧率无关的移动',
    nodes: [
      { refId: 'tick',   nodeId: 'tick',                 x:  60, y:  60 },
      { refId: 'fwd',    nodeId: 'getforward',           x:  60, y: 260 },
      { refId: 'delta',  nodeId: 'getworlddelta',        x:  60, y: 460 },
      { refId: 'speed',  nodeId: 'multiply_float',       x: 380, y: 460 },
      { refId: 'move',   nodeId: 'addmovement',          x: 700, y:  60 },
    ],
    connections: [
      { fromRef: 'tick',   fromPort: 0, toRef: 'move',   toPort: 0 },
      { fromRef: 'fwd',    fromPort: 0, toRef: 'move',   toPort: 1 },
      { fromRef: 'delta',  fromPort: 0, toRef: 'speed',  toPort: 0 },
      { fromRef: 'speed',  fromPort: 0, toRef: 'move',   toPort: 2 },
    ],
  },

  /* ========== 3. 血条 UI 跟随 ========== */
  {
    id: 'tpl_healthbar',
    name: '3. 血条 UI 跟随',
    desc: 'BeginPlay 创建 UI，Tick 把世界坐标转屏幕坐标并更新位置',
    nodes: [
      { refId: 'begin',  nodeId: 'beginplay',       x:   60, y:  60 },
      { refId: 'create', nodeId: 'createwidget',    x:   60, y: 240 },
      { refId: 'add',    nodeId: 'addviewport',     x:  380, y:  60 },
      { refId: 'tick',   nodeId: 'tick',            x:   60, y: 460 },
      { refId: 'getloc', nodeId: 'getactorlocation',x:   60, y: 640 },
      { refId: 'proj',   nodeId: 'worldtoscreen',   x:  380, y: 640 },
      { refId: 'setpos', nodeId: 'setposviewport',  x:  700, y: 460 },
    ],
    connections: [
      { fromRef: 'begin',  fromPort: 0, toRef: 'add',    toPort: 0 },
      { fromRef: 'create', fromPort: 0, toRef: 'add',    toPort: 1 },
      { fromRef: 'tick',   fromPort: 0, toRef: 'setpos', toPort: 0 },
      { fromRef: 'getloc', fromPort: 0, toRef: 'proj',   toPort: 0 },
      { fromRef: 'proj',   fromPort: 0, toRef: 'setpos', toPort: 2 },
    ],
  },

  /* ========== 4. 子弹发射 ========== */
  {
    id: 'tpl_fire',
    name: '4. 子弹发射',
    desc: '鼠标左键 → SpawnActor → 设置速度（用 Forward Vector × 速度）',
    nodes: [
      { refId: 'input',  nodeId: 'inputaction',     x:   60, y:  60 },
      { refId: 'spawn',  nodeId: 'spawn',           x:  380, y:  60 },
      { refId: 'fwd',    nodeId: 'getforward',      x:   60, y: 300 },
      { refId: 'mul',    nodeId: 'multiply_float',  x:  380, y: 300 },
      { refId: 'setvel', nodeId: 'setvelocity',     x:  700, y:  60 },
    ],
    connections: [
      { fromRef: 'input', fromPort: 0, toRef: 'spawn',  toPort: 0 },
      { fromRef: 'spawn', fromPort: 0, toRef: 'setvel', toPort: 0 },
      { fromRef: 'fwd',   fromPort: 0, toRef: 'mul',    toPort: 0 },
      { fromRef: 'mul',   fromPort: 0, toRef: 'setvel', toPort: 1 },
    ],
  },

  /* ========== 5. 拾取道具 ========== */
  {
    id: 'tpl_pickup',
    name: '5. 拾取道具',
    desc: 'Overlap → Cast 到玩家 → 播放音效 → 销毁自己',
    nodes: [
      { refId: 'overlap', nodeId: 'beginoverlap', x:   60, y:  60 },
      { refId: 'cast',    nodeId: 'cast',         x:  380, y:  60 },
      { refId: 'sound',   nodeId: 'playsound2d',  x:  700, y:  60 },
      { refId: 'destroy', nodeId: 'destroy',      x: 1020, y:  60 },
    ],
    connections: [
      { fromRef: 'overlap', fromPort: 0, toRef: 'cast',    toPort: 0 },
      { fromRef: 'overlap', fromPort: 1, toRef: 'cast',    toPort: 1 },
      { fromRef: 'cast',    fromPort: 1, toRef: 'sound',   toPort: 0 },
      { fromRef: 'sound',   fromPort: 0, toRef: 'destroy', toPort: 0 },
    ],
  },

  /* ========== 6. 倒计时 ========== */
  {
    id: 'tpl_timer',
    name: '6. 倒计时',
    desc: 'BeginPlay 设置循环定时器；每次触发减 1，归零时加载下一关',
    nodes: [
      { refId: 'begin',  nodeId: 'beginplay',        x:   60, y:  60 },
      { refId: 'timer',  nodeId: 'settimer',         x:  380, y:  60 },
      { refId: 'getf',   nodeId: 'var_get_float',    x:   60, y: 320 },
      { refId: 'const1', nodeId: 'const_float',      x:   60, y: 480 },
      { refId: 'sub',    nodeId: 'subtract_float',   x:  380, y: 320 },
      { refId: 'setf',   nodeId: 'var_set_float',    x:  700, y: 320 },
      { refId: 'cmp',    nodeId: 'less_equal_float', x: 1020, y: 320 },
      { refId: 'branch', nodeId: 'branch',           x: 1340, y: 320 },
      { refId: 'level',  nodeId: 'openlevel',        x: 1660, y: 260 },
      { refId: 'text',   nodeId: 'settext',          x: 1660, y: 440 },
    ],
    connections: [
      { fromRef: 'begin',  fromPort: 0, toRef: 'timer',  toPort: 0 },
      { fromRef: 'timer',  fromPort: 0, toRef: 'setf',   toPort: 0 },
      { fromRef: 'getf',   fromPort: 0, toRef: 'sub',    toPort: 0 },
      { fromRef: 'const1', fromPort: 0, toRef: 'sub',    toPort: 1 },
      { fromRef: 'sub',    fromPort: 0, toRef: 'setf',   toPort: 1 },
      { fromRef: 'setf',   fromPort: 0, toRef: 'cmp',    toPort: 0 },
      { fromRef: 'cmp',    fromPort: 0, toRef: 'branch', toPort: 1 },
      { fromRef: 'branch', fromPort: 0, toRef: 'level',  toPort: 0 },
      { fromRef: 'branch', fromPort: 1, toRef: 'text',   toPort: 0 },
    ],
  },

  /* ========== 7. AI 追逐 ========== */
  {
    id: 'tpl_ai',
    name: '7. AI 追逐',
    desc: 'Tick → 计算到玩家的距离，小于阈值时朝玩家移动',
    nodes: [
      { refId: 'tick',     nodeId: 'tick',              x:   60, y:  60 },
      { refId: 'getpl',    nodeId: 'getplayer',         x:   60, y: 240 },
      { refId: 'dist',     nodeId: 'getdistance',       x:  380, y: 240 },
      { refId: 'const',    nodeId: 'const_float',       x:   60, y: 420 },
      { refId: 'cmp',      nodeId: 'less_float',        x:  380, y: 420 },
      { refId: 'branch',   nodeId: 'branch',            x:  700, y:  60 },
      { refId: 'getloc',   nodeId: 'getactorlocation',  x:   60, y: 600 },
      { refId: 'find',     nodeId: 'findlookat',        x:  380, y: 600 },
      { refId: 'rot',      nodeId: 'setactorrotation',  x:  700, y: 600 },
      { refId: 'move',     nodeId: 'addmovement',       x: 1020, y:  60 },
      { refId: 'fwd',      nodeId: 'getforward',        x:  700, y: 260 },
    ],
    connections: [
      { fromRef: 'tick',   fromPort: 0, toRef: 'branch', toPort: 0 },
      { fromRef: 'getpl',  fromPort: 0, toRef: 'dist',   toPort: 0 },
      { fromRef: 'dist',   fromPort: 0, toRef: 'cmp',    toPort: 0 },
      { fromRef: 'const',  fromPort: 0, toRef: 'cmp',    toPort: 1 },
      { fromRef: 'cmp',    fromPort: 0, toRef: 'branch', toPort: 1 },
      { fromRef: 'branch', fromPort: 0, toRef: 'move',   toPort: 0 },
      { fromRef: 'fwd',    fromPort: 0, toRef: 'move',   toPort: 1 },
      { fromRef: 'getloc', fromPort: 0, toRef: 'find',   toPort: 0 },
      { fromRef: 'find',   fromPort: 0, toRef: 'rot',    toPort: 1 },
      { fromRef: 'branch', fromPort: 0, toRef: 'rot',    toPort: 0 },
    ],
  },

  /* ========== 8. 钥匙开门 ========== */
  {
    id: 'tpl_keydoor',
    name: '8. 钥匙开门',
    desc: '按 E 时检查是否持有钥匙，有则开门、没有则打印提示',
    nodes: [
      { refId: 'input',  nodeId: 'inputaction',     x:   60, y:  60 },
      { refId: 'getkey', nodeId: 'var_get_bool',    x:   60, y: 260 },
      { refId: 'branch', nodeId: 'branch',          x:  380, y:  60 },
      { refId: 'sound',  nodeId: 'playsound2d',     x:  700, y:  20 },
      { refId: 'rot',    nodeId: 'setactorrotation',x: 1020, y:  20 },
      { refId: 'print',  nodeId: 'print',           x:  700, y: 280 },
    ],
    connections: [
      { fromRef: 'input',  fromPort: 0, toRef: 'branch', toPort: 0 },
      { fromRef: 'getkey', fromPort: 0, toRef: 'branch', toPort: 1 },
      { fromRef: 'branch', fromPort: 0, toRef: 'sound',  toPort: 0 },
      { fromRef: 'sound',  fromPort: 0, toRef: 'rot',    toPort: 0 },
      { fromRef: 'branch', fromPort: 1, toRef: 'print',  toPort: 0 },
    ],
  },

  /* ========== 9. 掉落物旋转 ========== */
  {
    id: 'tpl_rotate',
    name: '9. 掉落物旋转',
    desc: 'Tick 每帧 Add Actor Local Rotation，让道具匀速自转',
    nodes: [
      { refId: 'tick',   nodeId: 'tick',         x:  60, y:  60 },
      { refId: 'addrot', nodeId: 'addrotation',  x: 380, y:  60 },
    ],
    connections: [
      { fromRef: 'tick', fromPort: 0, toRef: 'addrot', toPort: 0 },
    ],
  },

  /* ========== 10. 存档 / 读档 ========== */
  {
    id: 'tpl_save',
    name: '10. 存档 / 读档',
    desc: 'F5 保存，F9 读取并校验是否有效',
    nodes: [
      { refId: 'in_save', nodeId: 'inputaction',      x:   60, y:  60 },
      { refId: 'save',    nodeId: 'savegame',         x:  380, y:  60 },
      { refId: 'in_load', nodeId: 'inputaction',      x:   60, y: 320 },
      { refId: 'load',    nodeId: 'loadgame',         x:  380, y: 320 },
      { refId: 'valid',   nodeId: 'isvalid',          x:  700, y: 320 },
      { refId: 'branch',  nodeId: 'branch',           x: 1020, y: 320 },
      { refId: 'print',   nodeId: 'print',            x: 1340, y: 280 },
    ],
    connections: [
      { fromRef: 'in_save', fromPort: 0, toRef: 'save',   toPort: 0 },
      { fromRef: 'in_load', fromPort: 0, toRef: 'print',  toPort: 0 },
      { fromRef: 'load',    fromPort: 0, toRef: 'valid',  toPort: 0 },
      { fromRef: 'valid',   fromPort: 0, toRef: 'branch', toPort: 1 },
      { fromRef: 'branch',  fromPort: 0, toRef: 'print',  toPort: 0 },
    ],
  },

  /* ========== 11. 触发器自动门 ========== */
  {
    id: 'tpl_door_trigger',
    name: '11. 触发器自动门',
    desc: 'Overlap → 开门（无需按键）',
    nodes: [
      { refId: 'overlap', nodeId: 'beginoverlap',      x:  60, y:  60 },
      { refId: 'cast',    nodeId: 'cast',              x: 380, y:  60 },
      { refId: 'rot',     nodeId: 'setactorrotation',  x: 700, y:  60 },
    ],
    connections: [
      { fromRef: 'overlap', fromPort: 0, toRef: 'cast', toPort: 0 },
      { fromRef: 'overlap', fromPort: 1, toRef: 'cast', toPort: 1 },
      { fromRef: 'cast',    fromPort: 1, toRef: 'rot',  toPort: 0 },
    ],
  },

  /* ========== 12. 摄像机环绕 ========== */
  {
    id: 'tpl_orbit',
    name: '12. 摄像机环绕',
    desc: 'Tick 每帧给镜头加一点 Yaw，实现环绕',
    nodes: [
      { refId: 'tick',   nodeId: 'tick',        x:  60, y:  60 },
      { refId: 'addrot', nodeId: 'addrotation', x: 380, y:  60 },
    ],
    connections: [
      { fromRef: 'tick', fromPort: 0, toRef: 'addrot', toPort: 0 },
    ],
  },

  /* ========== 13. 传送门 ========== */
  {
    id: 'tpl_teleport',
    name: '13. 传送门',
    desc: '按 E 把自己传送到指定坐标（Set Actor Location）',
    nodes: [
      { refId: 'input',  nodeId: 'inputaction',      x:  60, y:  60 },
      { refId: 'mv',     nodeId: 'makevector',       x:  60, y: 280 },
      { refId: 'setloc', nodeId: 'setactorlocation', x: 380, y:  60 },
    ],
    connections: [
      { fromRef: 'input', fromPort: 0, toRef: 'setloc', toPort: 0 },
      { fromRef: 'mv',    fromPort: 0, toRef: 'setloc', toPort: 1 },
    ],
  },

  /* ========== 14. 死亡重生 ========== */
  {
    id: 'tpl_respawn',
    name: '14. 死亡重生',
    desc: '受伤 → 播放 2D 音效 → 延迟 2 秒 → 回到出生点',
    nodes: [
      { refId: 'dmg',    nodeId: 'anydamage',       x:   60, y:  60 },
      { refId: 'sound',  nodeId: 'playsound2d',     x:  380, y:  60 },
      { refId: 'delay',  nodeId: 'delay',           x:  700, y:  60 },
      { refId: 'spawn',  nodeId: 'makevector',      x:   60, y: 320 },
      { refId: 'setloc', nodeId: 'setactorlocation',x: 1020, y:  60 },
    ],
    connections: [
      { fromRef: 'dmg',    fromPort: 0, toRef: 'sound',  toPort: 0 },
      { fromRef: 'sound',  fromPort: 0, toRef: 'delay',  toPort: 0 },
      { fromRef: 'delay',  fromPort: 0, toRef: 'setloc', toPort: 0 },
      { fromRef: 'spawn',  fromPort: 0, toRef: 'setloc', toPort: 1 },
    ],
  },

  /* ========== 15. HP 系统 ========== */
  {
    id: 'tpl_health',
    name: '15. HP 系统',
    desc: '受伤 → HP 减少 → 判断是否 ≤ 0 → 销毁',
    nodes: [
      { refId: 'dmg',    nodeId: 'anydamage',        x:   60, y:  60 },
      { refId: 'gethp',  nodeId: 'var_get_float',    x:   60, y: 260 },
      { refId: 'sub',    nodeId: 'subtract_float',   x:  380, y: 260 },
      { refId: 'sethp',  nodeId: 'var_set_float',    x:  700, y: 260 },
      { refId: 'const',  nodeId: 'const_float',      x:   60, y: 460 },
      { refId: 'cmp',    nodeId: 'less_equal_float', x: 1020, y: 460 },
      { refId: 'branch', nodeId: 'branch',           x: 1340, y:  60 },
      { refId: 'destroy',nodeId: 'destroy',          x: 1660, y:  20 },
    ],
    connections: [
      { fromRef: 'dmg',    fromPort: 0, toRef: 'sethp',  toPort: 0 },
      { fromRef: 'gethp',  fromPort: 0, toRef: 'sub',    toPort: 0 },
      { fromRef: 'sub',    fromPort: 0, toRef: 'sethp',  toPort: 1 },
      { fromRef: 'sethp',  fromPort: 0, toRef: 'branch', toPort: 0 },
      { fromRef: 'cmp',    fromPort: 0, toRef: 'branch', toPort: 1 },
      { fromRef: 'const',  fromPort: 0, toRef: 'cmp',    toPort: 1 },
      { fromRef: 'sethp',  fromPort: 0, toRef: 'cmp',    toPort: 0 },
      { fromRef: 'branch', fromPort: 0, toRef: 'destroy',toPort: 0 },
    ],
  },

  /* ========== 16. 巡逻 AI ========== */
  {
    id: 'tpl_patrol',
    name: '16. 巡逻 AI',
    desc: 'Tick 每帧向 Forward 方向移动',
    nodes: [
      { refId: 'tick', nodeId: 'tick',         x:   60, y:  60 },
      { refId: 'fwd',  nodeId: 'getforward',   x:   60, y: 260 },
      { refId: 'move', nodeId: 'addmovement',  x:  380, y:  60 },
    ],
    connections: [
      { fromRef: 'tick', fromPort: 0, toRef: 'move', toPort: 0 },
      { fromRef: 'fwd',  fromPort: 0, toRef: 'move', toPort: 1 },
    ],
  },

  /* ========== 17. 物体自转 ========== */
  {
    id: 'tpl_rotate_tick',
    name: '17. 物体自转',
    desc: 'Tick 每帧 Add Actor Local Rotation',
    nodes: [
      { refId: 'tick',   nodeId: 'tick',        x:  60, y:  60 },
      { refId: 'addrot', nodeId: 'addrotation', x: 380, y:  60 },
    ],
    connections: [
      { fromRef: 'tick', fromPort: 0, toRef: 'addrot', toPort: 0 },
    ],
  },

  /* ========== 18. 拾取加分 ========== */
  {
    id: 'tpl_pickup_score',
    name: '18. 拾取加分',
    desc: 'Overlap → 分数 +1 → 更新 UI → 销毁自己',
    nodes: [
      { refId: 'overlap',  nodeId: 'beginoverlap',   x:   60, y:  60 },
      { refId: 'cast',     nodeId: 'cast',           x:  380, y:  60 },
      { refId: 'destroy',  nodeId: 'destroy',        x:  700, y:  60 },
      { refId: 'getscore', nodeId: 'var_get_int',    x:   60, y: 320 },
      { refId: 'one',      nodeId: 'const_int',      x:   60, y: 480 },
      { refId: 'add',      nodeId: 'add_int',        x:  380, y: 320 },
      { refId: 'setscore', nodeId: 'var_set_int',    x:  700, y: 320 },
    ],
    connections: [
      { fromRef: 'overlap',  fromPort: 0, toRef: 'cast',     toPort: 0 },
      { fromRef: 'overlap',  fromPort: 1, toRef: 'cast',     toPort: 1 },
      { fromRef: 'cast',     fromPort: 1, toRef: 'destroy',  toPort: 0 },
      { fromRef: 'getscore', fromPort: 0, toRef: 'add',      toPort: 0 },
      { fromRef: 'one',      fromPort: 0, toRef: 'add',      toPort: 1 },
      { fromRef: 'add',      fromPort: 0, toRef: 'setscore', toPort: 1 },
      { fromRef: 'cast',     fromPort: 1, toRef: 'setscore', toPort: 0 },
    ],
  },

  /* ========== 19. UI 开关 ========== */
  {
    id: 'tpl_ui_toggle',
    name: '19. UI 开关',
    desc: '按键 → 创建 UI 并添加到视口',
    nodes: [
      { refId: 'input',  nodeId: 'inputaction',  x:   60, y:  60 },
      { refId: 'create', nodeId: 'createwidget', x:   60, y: 260 },
      { refId: 'add',    nodeId: 'addviewport',  x:  380, y:  60 },
    ],
    connections: [
      { fromRef: 'input',  fromPort: 0, toRef: 'add', toPort: 0 },
      { fromRef: 'create', fromPort: 0, toRef: 'add', toPort: 1 },
    ],
  },

  /* ========== 20. 钥匙 + 自动门 ========== */
  {
    id: 'tpl_door_key',
    name: '20. 钥匙 + 自动门',
    desc: 'Overlap 时检查是否有钥匙，有则开门',
    nodes: [
      { refId: 'overlap', nodeId: 'beginoverlap',      x:  60, y:  60 },
      { refId: 'getkey',  nodeId: 'var_get_bool',      x:  60, y: 280 },
      { refId: 'branch',  nodeId: 'branch',            x: 380, y:  60 },
      { refId: 'rot',     nodeId: 'setactorrotation',  x: 700, y:  20 },
    ],
    connections: [
      { fromRef: 'overlap', fromPort: 0, toRef: 'branch', toPort: 0 },
      { fromRef: 'getkey',  fromPort: 0, toRef: 'branch', toPort: 1 },
      { fromRef: 'branch',  fromPort: 0, toRef: 'rot',    toPort: 0 },
    ],
  },
];