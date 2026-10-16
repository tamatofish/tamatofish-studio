import os, re, shutil, datetime

PATH = 'index.html'

backup_dir = os.path.join(os.path.dirname(os.path.abspath(PATH)), 'backups')
os.makedirs(backup_dir, exist_ok=True)
ts = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
backup_path = os.path.join(backup_dir, f'index_backup_{ts}.html')
shutil.copy2(PATH, backup_path)
print(f'[backup] {backup_path}')

with open(PATH, 'r', encoding='utf-8') as f:
    html = f.read()
old_len = len(html)
print(f'[main] 原 index.html 字符数：{old_len}')

# 校验 if 配对
count_if = html.count('&lt;&lt;if ')
count_endif = html.count('&lt;&lt;/if&gt;&gt;')
print(f'[0] 全文件 if：{count_if} / {count_endif}')
if count_if != count_endif:
    print('[0] WARN: if 不配对，abort')
    raise SystemExit(1)

# ---------- 1. 从首页删掉 nh-progress-card ----------
m_home = re.search(
    r'(<tw-passagedata\b[^>]*\bname="内网首页"[^>]*>)(.*?)(</tw-passagedata>)',
    html, re.DOTALL
)
if not m_home:
    print('[1] WARN: 找不到内网首页')
    raise SystemExit(1)

home_body = m_home.group(2)

# 找卡片起始
idx_card = home_body.find('&lt;div class=&quot;nh-progress-card&quot;')
if idx_card == -1:
    print('[1] 首页没有卡片，跳过删除')
else:
    # 找 uni-hero 之前作为结束
    idx_hero = home_body.find('&lt;div class=&quot;uni-hero&quot;', idx_card)
    if idx_hero == -1:
        print('[1] WARN: 找不到 uni-hero，abort')
        raise SystemExit(1)
    home_body = home_body[:idx_card] + home_body[idx_hero:]
    html = html[:m_home.start(2)] + home_body + html[m_home.end(2):]
    print(f'[1] 从首页删除进度卡片（{idx_card} → {idx_hero}）')

# ---------- 2. 构造侧边栏浮窗 HTML ----------
# 侧边栏的 HTML 里，加一个按钮
# 然后加一个浮窗（默认隐藏，点按钮显示）

# 侧边栏 HTML 大概长这样：
#   <div id="nh-sidebar">
#     <div class="head">...</div>
#     <div class="body">
#       <button class="item" id="nh-sidebar-saves">...</button>
#       <button class="item nh-home" id="nh-sidebar-home">...</button>
#       <button class="item danger" id="nh-sidebar-restart">...</button>
#       <button class="item" id="nh-sidebar-debug">...</button>
#     </div>
#     <div class="foot">...</div>
#   </div>

# 找侧边栏的 debug 按钮，在它后面加"调查进度"按钮
old_debug_btn = '<button class="item" id="nh-sidebar-debug" type="button">'
if old_debug_btn not in html:
    print('[2] WARN: 找不到侧边栏 debug 按钮')
else:
    # 在 debug 按钮之后插入"调查进度"按钮
    new_btn = (
        '        <button class="item" id="nh-sidebar-progress" type="button">\n'
        '            <span class="ico">📋</span>\n'
        '            <span>调查进度</span>\n'
        '        </button>\n'
    )
    # 找 debug 按钮的完整块，在它后面加
    # debug 按钮完整块
    idx_debug = html.find(old_debug_btn)
    # 找 debug 按钮的结束 </button>
    idx_debug_end = html.find('</button>', idx_debug) + len('</button>')
    # 在它后面插入
    html = html[:idx_debug_end] + '\n' + new_btn + html[idx_debug_end:]
    print('[2] 侧边栏加"调查进度"按钮')

# ---------- 3. 加浮窗 HTML（放在 <body> 里，跟记事本浮窗一样） ----------
# 找 <body> 后，插入浮窗（放到 #nh-note-win 附近，如果存在的话）
# 简单做法：在 </body> 前插入

progress_window_html = '''
<!-- ===== NH_PROGRESS_WINDOW_V1 ===== -->
<style id="style-nh-progress-window">
#nh-progress-win {
    position: fixed;
    right: 80px;
    top: 80px;
    width: 380px;
    max-height: 520px;
    background: #fdfaf3;
    border: 1px solid #b8a888;
    border-radius: 6px;
    box-shadow: 0 12px 40px rgba(0,0,0,0.35);
    z-index: 2147483499;
    display: none;
    flex-direction: column;
    font-family: "楷体", "KaiTi", "Microsoft YaHei", sans-serif;
    font-size: 14px;
    color: #3a2a1a;
    overflow: hidden;
}
#nh-progress-win.open { display: flex; }

#nh-progress-win-titlebar {
    height: 36px;
    background: linear-gradient(180deg, #8b0000 0%, #6a0000 100%);
    color: #f0e8d8;
    display: flex;
    align-items: center;
    padding: 0 10px 0 14px;
    cursor: move;
    user-select: none;
    flex-shrink: 0;
}
#nh-progress-win-titlebar .title {
    flex: 1;
    font-size: 14px;
    letter-spacing: 4px;
    font-family: "微软雅黑", sans-serif;
}
#nh-progress-win-titlebar .btn {
    width: 28px;
    height: 24px;
    border: 1px solid rgba(255,255,255,0.3);
    background: transparent;
    color: #f0e8d8;
    border-radius: 3px;
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    padding: 0;
    margin-left: 4px;
    font-family: inherit;
}
#nh-progress-win-titlebar .btn:hover {
    background: rgba(255,255,255,0.2);
}

#nh-progress-win-body {
    padding: 18px 22px;
    overflow-y: auto;
    flex: 1;
}

#nh-progress-win-body .progress-count {
    font-size: 15px;
    color: #5a1a10;
    margin: 0 0 14px;
    letter-spacing: 1px;
}
#nh-progress-win-body .progress-count b {
    color: #8b0000;
    font-size: 17px;
    padding: 0 3px;
}

#nh-progress-win-body ul {
    list-style: none;
    padding: 0;
    margin: 0 0 16px;
}
#nh-progress-win-body li {
    padding: 6px 0;
    font-size: 14px;
    line-height: 1.7;
    color: #3a2a1a;
    border-bottom: 1px dashed rgba(120,90,50,0.15);
}
#nh-progress-win-body li:last-child { border-bottom: none; }
#nh-progress-win-body li.done {
    color: #2a6a3a;
    font-weight: 500;
}
#nh-progress-win-body li.done::before {
    content: "✓ ";
    color: #2a8a3a;
    font-weight: bold;
    margin-right: 4px;
}
#nh-progress-win-body li.undone {
    color: #999;
}
#nh-progress-win-body li.undone::before {
    content: "○ ";
    color: #bbb;
    margin-right: 4px;
}

#nh-progress-win-body .progress-hint {
    margin-top: 16px;
    padding-top: 14px;
    border-top: 1px solid rgba(120,90,50,0.15);
    font-size: 13px;
    color: #8a6a4a;
    font-style: italic;
    line-height: 1.9;
    letter-spacing: 0.5px;
}

#nh-progress-win-body .progress-done {
    margin-top: 16px;
    padding-top: 14px;
    border-top: 1px solid rgba(120,90,50,0.2);
}
#nh-progress-win-body .progress-done p {
    margin: 6px 0;
    font-size: 14px;
    line-height: 1.9;
    color: #5a1a10;
}
#nh-progress-win-body .progress-done a {
    color: #8b0000;
    text-decoration: underline;
    cursor: pointer;
    font-size: 15px;
    font-weight: 600;
}
#nh-progress-win-body .progress-done a:hover {
    color: #c02020;
}
</style>

<div id="nh-progress-win" role="dialog" aria-label="调查进度">
    <div id="nh-progress-win-titlebar">
        <span class="title">调查进度</span>
        <button class="btn" id="nh-progress-win-close" type="button" title="关闭">×</button>
    </div>
    <div id="nh-progress-win-body">
        <div id="nh-progress-content">
            <p style="color:#999;font-size:13px;text-align:center;padding:20px 0;">（进入游戏后显示进度）</p>
        </div>
    </div>
</div>

<script id="nh-progress-window-js">
(function () {
    'use strict';

    var WIN_ID = 'nh-progress-win';
    var BALL_ID = 'nh-sidebar-progress';
    var POS_KEY = 'nh_progress_win_pos';

    function $id(id) { return document.getElementById(id); }

    function loadPos() {
        try {
            var s = localStorage.getItem(POS_KEY);
            if (!s) return null;
            var p = s.split(',');
            if (p.length !== 2) return null;
            var l = parseFloat(p[0]), t = parseFloat(p[1]);
            if (isNaN(l) || isNaN(t)) return null;
            return { left: l, top: t };
        } catch (e) { return null; }
    }
    function savePos(left, top) {
        try { localStorage.setItem(POS_KEY, left + ',' + top); } catch (e) {}
    }
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

    function makeDraggable(el, handle, onEnd) {
        if (!el) return;
        var dragging = false, sx = 0, sy = 0, ol = 0, ot = 0, moved = false;

        function onDown(e) {
            if (e.button !== undefined && e.button !== 0) return;
            if (handle && e.target !== handle && !handle.contains(e.target)) return;
            dragging = true; moved = false;
            var pt = e.touches ? e.touches[0] : e;
            sx = pt.clientX; sy = pt.clientY;
            var r = el.getBoundingClientRect();
            ol = r.left; ot = r.top;
            el.style.right = 'auto'; el.style.bottom = 'auto';
            el.style.left = ol + 'px'; el.style.top = ot + 'px';
            if (e.cancelable) e.preventDefault();
        }
        function onMove(e) {
            if (!dragging) return;
            var pt = e.touches ? e.touches[0] : e;
            var dx = pt.clientX - sx, dy = pt.clientY - sy;
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
            var r = el.getBoundingClientRect();
            var maxL = window.innerWidth - r.width;
            var maxT = window.innerHeight - r.height;
            el.style.left = clamp(ol + dx, 0, Math.max(0, maxL)) + 'px';
            el.style.top = clamp(ot + dy, 0, Math.max(0, maxT)) + 'px';
            if (e.cancelable) e.preventDefault();
        }
        function onUp() {
            if (!dragging) return;
            dragging = false;
            if (moved) {
                var r = el.getBoundingClientRect();
                if (onEnd) onEnd(r.left, r.top);
            }
        }
        el.addEventListener('mousedown', onDown, false);
        document.addEventListener('mousemove', onMove, true);
        document.addEventListener('mouseup', onUp, true);
        el.addEventListener('touchstart', onDown, { passive: false });
        document.addEventListener('touchmove', onMove, { passive: false, capture: true });
        document.addEventListener('touchend', onUp, true);
        document.addEventListener('touchcancel', onUp, true);
    }

    function openWin() {
        var win = $id(WIN_ID);
        if (!win) return;
        win.classList.add('open');
        var pos = loadPos();
        if (pos) {
            win.style.right = 'auto';
            win.style.top = 'auto';
            win.style.left = pos.left + 'px';
            win.style.top = pos.top + 'px';
        }
        refresh();
    }
    function closeWin() {
        var win = $id(WIN_ID);
        if (!win) return;
        win.classList.remove('open');
    }
    function toggleWin() {
        var win = $id(WIN_ID);
        if (!win) return;
        if (win.classList.contains('open')) closeWin();
        else openWin();
    }

    // 更新进度内容
    function refresh() {
        var content = $id('nh-progress-content');
        if (!content) return;
        try {
            var SC = window.SugarCube;
            if (!SC || !SC.State) return;

            var v = SC.State.variables;
            var list = [
                { id: '旧教学楼失火', label: '旧教学楼失火' },
                { id: '苏言残稿',     label: '苏言残稿' },
                { id: '2015笔录',     label: '2015笔录' },
                { id: '监控录像',     label: '监控录像' },
                { id: '陈默教研日志', label: '陈默教研日志' },
                { id: '林晚的留言',   label: '林晚的留言' },
                { id: '第七个书架',   label: '第七个书架' }
            ];

            var visited = 0;
            var itemsHtml = '';
            for (var i = 0; i < list.length; i++) {
                var item = list[i];
                var done = false;
                try { done = window.nhVisited ? window.nhVisited(item.id) : false; }
                catch (e) {}
                if (done) visited++;
                itemsHtml += '<li class="' + (done ? 'done' : 'undone') + '">' + item.label + '</li>';
            }

            var hintHtml = '';
            var hints = [
                '提示：旧教学楼那场火，报告里写着「1 人失联」。',
                '提示：文学社名单里，有一个被划掉的名字。',
                '提示：2015 年 9 月 16 日有一份询问笔录。',
                '提示：地下室那晚的监控，门禁和画面人数对不上。',
                '提示：图书馆分区里有一份没提交的教研日志。',
                '提示：林晚留下过一段话，藏在内网底层。',
                '提示：论坛里提到的「第七个书架」，似乎真的存在。'
            ];
            if (visited < 7 && visited < hints.length) {
                hintHtml = '<div class="progress-hint">' + hints[visited] + '</div>';
            }

            var finalHtml = '';
            if (visited >= 7) {
                var lvl = 0;
                try { lvl = v.corruptionLevel || 0; } catch (e) {}
                if (lvl < 3) {
                    finalHtml = '<div class="progress-done">' +
                        '<p>所有线索都找到了。</p>' +
                        '<p>但还不够。你总觉得有人在看着你。</p>' +
                        '<p class="progress-hint">（继续查看内网的其它页面，直到它变得不对劲。）</p>' +
                        '</div>';
                } else {
                    finalHtml = '<div class="progress-done">' +
                        '<p>你看着屏幕上这些字。</p>' +
                        '<p>你忽然想起来了。</p>' +
                        '<p><a id="nh-progress-identity-link">你想起了一些事。</a></p>' +
                        '</div>';
                }
            }

            content.innerHTML =
                '<p class="progress-count">已找到线索：<b>' + visited + '</b> / 7</p>' +
                '<ul>' + itemsHtml + '</ul>' +
                hintHtml +
                finalHtml;

            // 绑定身份揭露链接
            var link = $id('nh-progress-identity-link');
            if (link && !link.__nhBound) {
                link.__nhBound = true;
                link.addEventListener('click', function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    try { SC.Engine.play('身份揭露'); } catch (err) {}
                });
            }
        } catch (e) {
            console.warn('[nh-progress-window] refresh error:', e);
        }
    }

    function bind() {
        var ball = $id(BALL_ID);
        var win = $id(WIN_ID);
        if (!ball || !win) return false;
        if (ball.__nhProgressBound) return true;
        ball.__nhProgressBound = true;

        ball.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            // 关掉侧边栏
            var sidebar = $id('nh-sidebar');
            var mask = $id('nh-sidebar-mask');
            var menuBtn = $id('nh-menu-btn');
            if (sidebar) sidebar.classList.remove('open');
            if (mask) mask.classList.remove('open');
            if (menuBtn) menuBtn.textContent = '☰';
            // 打开浮窗
            toggleWin();
        });

        var closeBtn = $id('nh-progress-win-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                closeWin();
            });
        }

        var titlebar = $id('nh-progress-win-titlebar');
        makeDraggable(win, titlebar, function (l, t) { savePos(l, t); });

        return true;
    }

    // 监听页面切换，刷新进度
    if (window.jQuery) {
        jQuery(document).on(':passagedisplay.nhProgressWin', function () {
            var win = $id(WIN_ID);
            if (win && win.classList.contains('open')) {
                setTimeout(refresh, 100);
                setTimeout(refresh, 500);
            }
        });
    }

    // 启动
    var tries = 0;
    var t = setInterval(function () {
        if (bind() || ++tries > 100) clearInterval(t);
    }, 100);
    bind();

    console.log('[nh-progress-window] v1 loaded');
})();
</script>
<!-- ===== end NH_PROGRESS_WINDOW_V1 ===== -->
'''

# 在 </body> 前插入
if 'nh-progress-window-js' not in html:
    idx_body_end = html.rfind('</body>')
    if idx_body_end == -1:
        print('[3] WARN: 找不到 </body>')
    else:
        html = html[:idx_body_end] + progress_window_html + '\n' + html[idx_body_end:]
        print('[3] 插入浮窗 HTML + JS')
else:
    print('[3] 浮窗已存在，跳过')

# ---------- 4. 校验 ----------
final_if = html.count('&lt;&lt;if ')
final_endif = html.count('&lt;&lt;/if&gt;&gt;')
print(f'[final] 全文件 if：{final_if} / {final_endif}')
if final_if != final_endif:
    print('[final] WARN: if 不配对！abort')
    shutil.copy2(backup_path, PATH)
    print('[final] 已从备份恢复')
    raise SystemExit(1)

new_len = len(html)
delta = new_len - old_len
delta_str = f'+{delta}' if delta > 0 else str(delta)
print(f'[main] 新 index.html 字符数：{new_len}')
print(f'[main] 净变动：{delta_str}')

with open(PATH, 'w', encoding='utf-8') as f:
    f.write(html)

print('[main] done')