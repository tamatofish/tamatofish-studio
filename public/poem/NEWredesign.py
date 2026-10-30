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

def check_ok(html, label):
    ifs = html.count('&lt;&lt;if ')
    endifs = html.count('&lt;&lt;/if&gt;&gt;')
    print(f'  [{label}] if={ifs}/{endifs}')
    return ifs == endifs

if not check_ok(html, 'start'):
    raise SystemExit(1)

# ============ 先删掉 V137 加的坏 CSS ============
bad_css_pattern = re.compile(
    r'<style id="nh-hide-navbar-qd-expand">.*?</style>\s*',
    re.DOTALL
)
html, n = bad_css_pattern.subn('', html)
print(f'[1] 删 V137 的坏 CSS：{n} 处')

if not check_ok(html, 'after del'):
    shutil.copy2(backup_path, PATH); raise SystemExit(1)

# ============ 新脚本：暴力按 passage 隐藏 nav bar ============
new_script = '''<script id="nh-hide-navbar-by-passage">
/* NH_HIDE_NAVBAR_BY_PASSAGE_V1：
   每次 passagedisplay 时，按当前 passage 决定是否隐藏 #lw-nav-bar。
   不依赖 body[data-passage]（SugarCube 不加这个属性）。 */
(function () {
    'use strict';

    var HIDE_LIST = [
        'ZEmail',
        '泉都论坛', '泉都论坛·帖子1', '泉都论坛·帖子2', '泉都论坛·帖子3',
        '失联时间线', '第六个人', '意外？', '名如其人'
    ];

    function apply() {
        var bar = document.getElementById('lw-nav-bar');
        if (!bar) return;
        var cur = '';
        try { cur = SugarCube.State.passage; } catch (e) {}
        if (HIDE_LIST.indexOf(cur) !== -1) {
            bar.style.display = 'none';
        } else {
            bar.style.display = '';
        }
    }

    if (window.jQuery) {
        jQuery(document).on(':passagedisplay.nhHideNavbar', function () {
            [0, 30, 120, 300, 600].forEach(function (t) {
                setTimeout(apply, t);
            });
        });
        jQuery(document).on(':passagestart.nhHideNavbar', function () {
            apply();
        });
    } else {
        setInterval(apply, 300);
    }
    apply();

    console.log('[nh-hide-navbar-by-passage] v1 loaded');
})();
</script>'''

# 找 </body> 前插入
if 'nh-hide-navbar-by-passage' not in html:
    body_end = html.rfind('</body>')
    if body_end != -1:
        html = html[:body_end] + new_script + '\n' + html[body_end:]
        print('[2] 插入独立脚本 ✅')
    else:
        print('[2] WARN: 找不到 </body>')
else:
    print('[2] 脚本已存在，跳过')

if not check_ok(html, 'final'):
    shutil.copy2(backup_path, PATH); raise SystemExit(1)

new_len = len(html)
delta = new_len - old_len
delta_str = f'+{delta}' if delta > 0 else str(delta)
print(f'[main] 净变动：{delta_str}')

with open(PATH, 'w', encoding='utf-8') as f:
    f.write(html)

print('[main] done')