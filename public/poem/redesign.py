# -*- coding: utf-8 -*-
import os
import re
import shutil
from datetime import datetime

# ==========================================
# NH_REDESIGN_FIX_V152
# 本次修复：
# 1. 暴力去除所有父级容器的 padding 和 margin。
# 2. 强制页面全屏纯黑，不留任何灰色边框和红边。
# 3. 修复悬浮菜单被终端挡住的问题。
# ==========================================

FILENAME = 'index.html'

GLOBAL_SCRIPT = """<style id="nh-terminal-css">
/* 终极终端界面 */
#nh-fullscreen-term {
    position: fixed !important; 
    top: 0 !important; left: 0 !important; 
    width: 100vw !important; height: 100vh !important;
    background: #020202 !important; 
    z-index: 2147483646 !important; /* 比菜单低一层，让菜单浮出来 */
    padding: 40px !important; box-sizing: border-box !important;
    font-family: "Consolas", "Courier New", monospace !important; 
    font-size: 16px !important; line-height: 1.8 !important;
    overflow-y: auto !important; 
    display: flex !important; flex-direction: column !important; justify-content: center !important;
}
#nh-fullscreen-term::after {
    content: ""; position: absolute; top: 0; left: 0; width: 100%; height: 100%;
    background: repeating-linear-gradient(0deg, rgba(0,255,0,0.03) 0px, rgba(0,255,0,0.03) 1px, transparent 1px, transparent 3px);
    pointer-events: none; z-index: 10;
}
#nh-term-content {
    max-width: 800px !important; width: 100% !important; margin: 0 auto !important;
    color: #00ff00 !important; text-shadow: 0 0 3px rgba(0,255,0,0.5) !important; 
    text-align: left !important;
}
.nh-t-line { min-height: 1.5em; }
#nh-term-input-area {
    display: none; max-width: 800px !important; width: 100% !important; margin: 20px auto 0 !important;
}
#nh-term-input {
    background: transparent; border: none; color: #00ff00;
    font-family: "Consolas", monospace; font-size: 16px; outline: none;
    width: 80%; text-shadow: 0 0 3px rgba(0,255,0,0.5);
    border-bottom: 2px solid transparent;
    animation: nhCursorBlink 1s step-end infinite;
}
@keyframes nhCursorBlink {
    0%, 100% { border-color: transparent; }
    50% { border-color: #00ff00; }
}
.nh-term-shortcut {
    color: #008800; cursor: pointer; text-decoration: underline;
    font-size: 14px; margin-right: 15px; transition: color 0.2s;
}
.nh-term-shortcut:hover { color: #00ff00; }

.nh-identity-btn {
    background: linear-gradient(180deg, #b02828, #7a1414) !important;
    color: #fff !important;
    border: 1px solid rgba(220,120,120,0.6) !important;
    box-shadow: 0 8px 24px rgba(176, 40, 40, 0.6) !important;
}

/* 悬浮菜单 z-index 拉满 */
#nh-menu-btn {
    z-index: 2147483647 !important;
}

/* 手机端适配 */
@media (max-width: 768px), (pointer: coarse) {
    #nh-fullscreen-term {
        padding: 20px 10px !important;
        justify-content: flex-start !important;
        padding-top: 50px !important;
        font-size: 14px !important;
    }
    #nh-term-content { font-size: 13px !important; }
    #nh-term-input-area {
        position: sticky; bottom: 10px; background: #020202; padding: 10px 0; z-index: 99;
    }
    #nh-term-input { width: 60%; font-size: 16px !important; }
    .nh-term-shortcut {
        display: inline-block; padding: 8px 15px; background: #003300; color: #00ff00;
        border: 1px solid #00aa00; border-radius: 4px; text-decoration: none;
        margin-top: 10px; font-size: 13px;
    }
    #lw-tabs, #lw-nav-bar, .lw-top-banner, #ui-bar { display: none !important; }
}
</style>

<script id="nh-terminal-script">
// 强行隐藏顶部标签栏并清空边距
window.__nhLockIdentityPage = function() {
    if (window.SugarCube && SugarCube.State && SugarCube.State.passage === '身份揭露') {
        var hideList = ['#lw-tabs', '#lw-nav-bar', '.lw-top-banner', '#ui-bar'];
        hideList.forEach(function(sel) {
            document.querySelectorAll(sel).forEach(function(el) {
                el.style.setProperty('display', 'none', 'important');
            });
        });
        
        // 暴力清除所有容器的边距
        document.documentElement.style.setProperty('background', '#050505', 'important');
        document.body.style.setProperty('background', '#050505', 'important');
        document.body.style.setProperty('margin', '0', 'important');
        document.body.style.setProperty('padding', '0', 'important');
        
        var story = document.getElementById('story');
        if (story) {
            story.style.setProperty('margin', '0', 'important');
            story.style.setProperty('padding', '0', 'important');
            story.style.setProperty('width', '100vw', 'important');
            story.style.setProperty('max-width', '100vw', 'important');
        }
        
        var pass = document.getElementById('passages');
        if (pass) {
            pass.style.setProperty('margin', '0', 'important');
            pass.style.setProperty('padding', '0', 'important');
            pass.style.setProperty('width', '100vw', 'important');
            pass.style.setProperty('max-width', '100vw', 'important');
        }

        // 把黑框放大并移除边框
        var box = document.querySelector('.nh-identity-box');
        if (box) {
            box.style.setProperty('width', '100vw', 'important');
            box.style.setProperty('max-width', '100vw', 'important');
            box.style.setProperty('min-height', '100vh', 'important');
            box.style.setProperty('margin', '0', 'important');
            box.style.setProperty('border', 'none', 'important');
            box.style.setProperty('box-shadow', 'none', 'important');
            box.style.setProperty('border-radius', '0', 'important');
            box.style.setProperty('padding', '60px 20px', 'important');
            box.style.setProperty('box-sizing', 'border-box', 'important');
        }

    } else {
        // 离开页面时恢复
        document.documentElement.style.background = '';
        document.body.style.background = '';
        document.body.style.margin = '';
        document.body.style.padding = '';
        
        var story2 = document.getElementById('story');
        if (story2) {
            story2.style.margin = '';
            story2.style.padding = '';
            story2.style.width = '';
            story2.style.maxWidth = '';
        }
        
        var pass2 = document.getElementById('passages');
        if (pass2) {
            pass2.style.margin = '';
            pass2.style.padding = '';
            pass2.style.width = '';
            pass2.style.maxWidth = '';
        }
    }
};
setInterval(window.__nhLockIdentityPage, 100);

window.__nhOpenTerminal = function() {
    if (document.getElementById('nh-fullscreen-term')) return;
    var term = document.createElement('div');
    term.id = 'nh-fullscreen-term';
    term.innerHTML = `
        <div id="nh-term-content"></div>
        <div id="nh-term-input-area">
            <div style="display:flex; align-items:center; margin-bottom: 15px;">
                <span style="color:#00ff00; font-size:16px; margin-right:10px;">A.R.C &gt;</span>
                <input type="text" id="nh-term-input" autocomplete="off" spellcheck="false" autofocus>
            </div>
            <div style="font-size:12px; color:#004400; margin-top:20px; font-family:'微软雅黑';">
                [ 提示：请输入指令后按回车执行。如无法输入英文，可点击下方命令 ]
            </div>
            <div style="margin-top:8px;">
                <span class="nh-term-shortcut" onclick="document.getElementById('nh-term-input').value='exec sacrifice'; window.__nhExecTerminal();">exec sacrifice</span>
                <span class="nh-term-shortcut" onclick="document.getElementById('nh-term-input').value='abort link'; window.__nhExecTerminal();">abort link</span>
            </div>
        </div>
    `;
    document.body.appendChild(term);
    document.body.style.setProperty('overflow', 'hidden', 'important');
    setTimeout(window.__nhTypeTerminal, 200);
};

window.__nhTypeTerminal = function() {
    var content = document.getElementById('nh-term-content');
    var inputArea = document.getElementById('nh-term-input-area');
    if (!content) return;
    var lines = [
        '<div class="nh-t-line">A.R.C 作战网络接入成功。</div>',
        '<div class="nh-t-line">正在同步目标节点数据...</div>',
        '<div class="nh-t-line">--------------------------------------------------</div>',
        '<div class="nh-t-line">&gt; 警告：监测到高维模因污染源溢出</div>',
        '<div class="nh-t-line">&gt; 污染半径：<span style="color:#fff;">0.8 千米</span></div>',
        '<div class="nh-t-line" style="color:#ff4444;">[ 更正 ] 污染半径：2.5 千米</div>',
        '<div class="nh-t-line" style="color:#ff4444;">[ 更正 ] 污染半径：7.3 千米</div>',
        '<div class="nh-t-line" style="color:#ff0000; font-weight:bold;">[ 更正 ] 污染已突破 10 千米阈值，正在覆盖全城</div>',
        '<div class="nh-t-line" style="color:#ff4444;">&gt; 抑制协议：失败</div>',
        '<div class="nh-t-line" style="color:#ff4444;">&gt; 唯一有效手段：操作员物理接触核心</div>',
        '<div class="nh-t-line">--------------------------------------------------</div>',
        '<div class="nh-t-line" style="font-weight:bold;">【请输入有效指令】</div>',
        '<div class="nh-t-line">&gt; 执行献祭：<span style="color:#00ff00;">exec sacrifice</span></div>',
        '<div class="nh-t-line">&gt; 中断链接：<span style="color:#00ff00;">abort link</span></div>'
    ];
    var index = 0;
    function addNext() {
        if (index >= lines.length) {
            if (inputArea) {
                inputArea.style.display = 'block';
                var inputEl = document.getElementById('nh-term-input');
                if (inputEl) inputEl.focus();
            }
            return;
        }
        content.insertAdjacentHTML('beforeend', lines[index]);
        index++;
        setTimeout(addNext, 350);
    }
    addNext();
};

window.__nhExecTerminal = function() {
    var inputEl = document.getElementById('nh-term-input');
    if (!inputEl) return;
    var cmd = inputEl.value.trim().toLowerCase();
    
    document.body.style.overflow = '';
    
    if (cmd === 'exec sacrifice') {
        var term = document.getElementById('nh-fullscreen-term');
        if (term) term.remove();
        try { SugarCube.Engine.play('结局:献祭'); } catch(e) {}
    } else if (cmd === 'abort link') {
        var term2 = document.getElementById('nh-fullscreen-term');
        if (term2) term2.remove();
        try { SugarCube.Engine.play('结局:逃离'); } catch(e) {}
    } else if (cmd !== '') {
        inputEl.value = '';
        var content = document.getElementById('nh-term-content');
        if(content) {
            content.insertAdjacentHTML('beforeend', '<div class="nh-t-line" style="color:#ff0000;">&gt; 错误：未知指令。请检查输入。</div>');
        }
    }
};

document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        var inputEl = document.getElementById('nh-term-input');
        if (inputEl && document.activeElement === inputEl) {
            e.preventDefault();
            window.__nhExecTerminal();
        }
    }
});
</script>"""

def read_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        return f.read()

def write_file(filepath, content):
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

def backup_file(filepath):
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_path = filepath.replace('.html', f'.backup.{timestamp}.html')
    shutil.copy2(filepath, backup_path)
    print(f"[*] 已创建备份文件: {backup_path}")
    return backup_path

def fix_identity_passage(html):
    pattern = re.compile(
        r'(<tw-passagedata[^>]*name="身份揭露"[^>]*>)(.*?)(</tw-passagedata>)',
        re.DOTALL
    )
    
    def replacer(match):
        content = match.group(2)
        
        if r'&lt;p style="margin-top:28px;color:#ffaaaa;"&gt;但就在这时' in content:
            content = content.split(r'&lt;p style="margin-top:28px;color:#ffaaaa;"&gt;但就在这时')[0].rstrip()
        if r'&lt;div class="nh-identity-choices"' in content:
            content = content.split(r'&lt;div class="nh-identity-choices"')[0].rstrip()
        if content.endswith('&lt;/div&gt;'):
            content = content[:-6].rstrip()
            
        insert_html = """
&lt;p style="margin-top:28px;color:#ffaaaa;"&gt;但就在这时，屏幕右下角弹出了新邮件的提示。&lt;/p&gt;

&lt;div class="nh-identity-choices"&gt;
    &lt;button type="button" class="nh-identity-btn sacrifice" onclick="window.__nhOpenTerminal(); return false;"&gt;查看 A.R.C 紧急邮件&lt;/button&gt;
&lt;/div&gt;

&lt;/div&gt;
"""
        return match.group(1) + content + insert_html + match.group(3)

    return pattern.subn(replacer, html)[0]

def inject_global_js(html):
    html = re.sub(r'<style id="nh-terminal-css">.*?</style>', '', html, flags=re.DOTALL)
    html = re.sub(r'<script id="nh-terminal-script">.*?</script>', '', html, flags=re.DOTALL)
    
    if '</body>' in html:
        html = html.replace('</body>', GLOBAL_SCRIPT + '\n</body>', 1)
    else:
        html = html + '\n' + GLOBAL_SCRIPT
    return html

def main():
    if not os.path.exists(FILENAME):
        print(f"[!] 错误：找不到文件 {FILENAME}")
        return

    print(f"[*] 开始处理 {FILENAME} ...")
    original_html = read_file(FILENAME)
    original_len = len(original_html)
    
    backup_file(FILENAME)
    
    modified_html = fix_identity_passage(original_html)
    modified_html = inject_global_js(modified_html)
        
    new_len = len(modified_html)
    diff = new_len - original_len
    diff_str = f"+{diff}" if diff >= 0 else str(diff)
    
    changelog = f"""<!--
  NH_REDESIGN_FIX_CHANGELOG_V152
  =============================
  生成时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
  本次（redesign.py V152）修复清单：

  1] 修复身份揭露页面无法铺满全屏的问题。
     · 使用 JS 强行清除 `#story` 和 `#passages` 的 margin 和 padding。
     · 强行把 `.nh-identity-box` 扩展为 100vw/100vh 纯黑背景。
     · 解决悬浮按钮被挡住的问题。

  文本字数变动：
    · 原 index.html 字符数：{original_len}
    · 新 index.html 字符数：{new_len}
    · 净变动：{diff_str}
-->

"""
    if '<!DOCTYPE html>' in modified_html:
        modified_html = modified_html.replace('<!DOCTYPE html>', '<!DOCTYPE html>\n' + changelog, 1)
    else:
        modified_html = changelog + modified_html
        
    write_file(FILENAME, modified_html)
    print(f"[+] 文件修改完成！")
    print(f"[*] 字数变动：{original_len} -> {new_len} ({diff_str})")

if __name__ == '__main__':
    main()