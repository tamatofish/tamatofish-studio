# -*- coding: utf-8 -*-
import os
import re
import shutil
from datetime import datetime

# ==========================================
# NH_REDESIGN_FIX_V195
# 本次修复：
# 1. 强制串行逻辑：前一章没完成，后面的章节全部锁死。
# 2. 修复已完成章节 UI 标题缺失打勾的问题。
# ==========================================

FILENAME = 'index.html'

GLOBAL_SCRIPT = """<script id="nh-checklist-progress">
(function () {
    'use strict';

    var ACTS = [
        { 
            id: 1, name: '十五年前', 
            tasks: [
                { page: '公告:失联通报', text: '去公告栏翻翻当年的通报，看看那次事件到底怎么了。' },
                { page: '旧教学楼失火', text: '官方通报里对那场火灾的描述，似乎藏着什么没说清楚的东西。' },
                { page: '消防事故调查报告', text: '如果那真的是一场意外，也许我该找找那份事故调查报告。' }
            ]
        },
        { 
            id: 2, name: '第六个人', 
            tasks: [
                { page: '文学社主页', text: '旧社团的成员名单里，总觉得少了一个影子。' },
                { page: '诗刊', text: '她留下的那些字，会不会被印在某一期的社刊里？' },
                { page: '苏言档案', text: '她被从历史里抹去了，但我能在教务系统的底层找到她的残档吗？' }
            ]
        },
        { 
            id: 3, name: '意外？', 
            tasks: [
                { page: '监控录像', text: '旧教学楼地下室的安防记录里，也许拍到了什么不该出现的东西。' },
                { page: '2015笔录', text: '那些跑出来的人，在警方面前到底说了什么？' },
                { page: '苏言残稿', text: '图书馆的某个角落，似乎封存着她未完成的手稿。' }
            ]
        },
        { 
            id: 4, name: '沉默的羔羊', 
            tasks: [
                { page: '陈默教研日志', text: '当年那位老师，为什么在这件事后突然选择了沉默？' },
                { page: '林晚的留言', text: '林晚留在这个世界上的最后几句话，在什么地方？' },
                { page: '第七个书架', text: '所有的线索都指向了旧教学楼地下室的深处。' }
            ]
        },
        { 
            id: 5, name: '我是谁？', 
            tasks: [
                { page: '身份揭露', text: '邮箱里应该有一封来自 A.R.C 的密令。而那个该死的网页搜索框，或许能敲开真相的大门。' }
            ]
        }
    ];

    function isVisited(targetPage) {
        if (!window.SugarCube || !SugarCube.State) return false;
        if (SugarCube.State.passage === targetPage) return true;
        try {
            if (SugarCube.State.hasPlayed(targetPage)) return true;
        } catch(e) {}
        try {
            var v = SugarCube.State.variables;
            if (Array.isArray(v.nhVisitedDocs) && v.nhVisitedDocs.indexOf(targetPage) !== -1) return true;
            if (Array.isArray(v.nhUnlockedPassages) && v.nhUnlockedPassages.indexOf(targetPage) !== -1) return true;
        } catch(e) {}
        try {
            var raw = localStorage.getItem('nh_true_physical_ledger');
            if (raw) {
                var arr = JSON.parse(raw);
                if (arr.indexOf(targetPage) !== -1) return true;
            }
        } catch(e) {}
        return false;
    }

    function render() {
        var body = document.getElementById('nh-custom-progress-body');
        if (!body) return;
        
        var html = '';
        var prevDone = true; 

        ACTS.forEach(function(act, idx) {
            var count = 0;
            act.tasks.forEach(function(task) {
                if (isVisited(task.page)) count++;
            });

            var isDone = false;
            // 【核心修复】：只有当上一幕完成时，才允许判定当前幕完成
            if (prevDone) {
                if (idx === 4) {
                    isDone = prevDone; // 第五幕依赖前四幕全完成
                } else {
                    isDone = (count >= act.tasks.length);
                }
            }

            // 只有上一幕完成了，且当前这一幕没完成，才是“正在进行”
            var isCurrent = prevDone && !isDone;
            
            var cls = isDone ? 'done' : (isCurrent ? 'current' : 'locked');
            
            html += '<div class="nh-c-act ' + cls + '">';
            
            // 标题打勾
            var titleIcon = isDone ? '<span style="color:#2a8a3a; margin-left:8px;">✔</span>' : '';
            html += '<div class="nh-c-act-title"><span class="nh-c-act-num">' + (idx+1) + '</span>' + act.name + titleIcon + '</div>';
            
            // 内容区域
            if (isCurrent || isDone) {
                html += '<div style="margin-top:12px; padding:10px; background:#fff5f5; border-left:3px solid #c83535; border-radius:2px; font-size:13.5px; color:#5a1a10; line-height:1.8;">';
                
                if (isCurrent) {
                    html += '<div style="color:#c83535; font-weight:bold; margin-bottom:6px;">我在想……</div>';
                } else {
                    html += '<div style="color:#2a8a3a; font-weight:bold; margin-bottom:6px;">我已经弄清了这些事：</div>';
                }

                act.tasks.forEach(function(task) {
                    var visited = isVisited(task.page);
                    var icon = visited ? '☑' : '☐';
                    var color = visited ? '#2a8a3a' : '#8a6a4a';
                    var style = visited ? 'text-decoration: line-through; opacity: 0.7;' : '';
                    html += '<div style="color:' + color + '; ' + style + ' margin-bottom:4px;">' + icon + ' ' + task.text + '</div>';
                });
                
                html += '</div>';
            } else if (!isDone) {
                html += '<div style="color:#aaa; font-style:italic; margin-top:10px;">请先理清上一章的头绪。</div>';
            }

            html += '</div>';
            
            // 如果这一幕没完成，后面的幕就全部锁死
            if (!isDone) prevDone = false;
        });

        body.innerHTML = html;
    }

    function openPanel() {
        var panel = document.getElementById('nh-custom-progress');
        if (!panel) return;
        panel.classList.add('open');
        render();
    }
    function closePanel() {
        var panel = document.getElementById('nh-custom-progress');
        if (panel) panel.classList.remove('open');
    }

    document.addEventListener('click', function(e) {
        var el = e.target;
        while (el && el !== document.body) {
            if (el.id === 'nh-sidebar-progress') {
                e.preventDefault();
                e.stopImmediatePropagation();
                e.stopPropagation();
                
                var sidebar = document.getElementById('nh-sidebar');
                var mask = document.getElementById('nh-sidebar-mask');
                var menuBtn = document.getElementById('nh-menu-btn');
                if (sidebar) sidebar.classList.remove('open');
                if (mask) mask.classList.remove('open');
                if (menuBtn) menuBtn.textContent = '☰';
                
                openPanel();
                return;
            }
            el = el.parentNode;
        }
    }, true);

    setTimeout(function() {
        var closeBtn = document.getElementById('nh-custom-progress-close');
        if (closeBtn) closeBtn.onclick = closePanel;
        
        var refreshBtn = document.getElementById('nh-custom-progress-refresh');
        if (refreshBtn) {
            refreshBtn.onclick = function() {
                refreshBtn.style.transform = 'rotate(360deg)';
                refreshBtn.style.transition = 'transform 0.4s';
                setTimeout(function(){ refreshBtn.style.transform = 'rotate(0deg)'; refreshBtn.style.transition = 'none'; }, 400);
                render();
            };
        }

        if (window.jQuery) {
            jQuery(document).on(':passagedisplay.nhCustomTracker', function() {
                var panel = document.getElementById('nh-custom-progress');
                if (panel && panel.classList.contains('open')) {
                    setTimeout(render, 100);
                }
            });
        }

        var panel = document.getElementById('nh-custom-progress');
        if (!panel) return;

        var isDragging = false;
        var startX, startY, initialLeft, initialTop;

        panel.addEventListener('mousedown', function(e) {
            if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A' || e.target.tagName === 'INPUT' || e.target.closest('button')) return;
            isDragging = true;
            panel.style.transform = 'none';
            startX = e.clientX;
            startY = e.clientY;
            var rect = panel.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;
            panel.style.left = initialLeft + 'px';
            panel.style.top = initialTop + 'px';
            panel.style.margin = '0';
            e.preventDefault();
        });

        document.addEventListener('mousemove', function(e) {
            if (!isDragging) return;
            var dx = e.clientX - startX;
            var dy = e.clientY - startY;
            panel.style.left = (initialLeft + dx) + 'px';
            panel.style.top = (initialTop + dy) + 'px';
        });

        document.addEventListener('mouseup', function() { isDragging = false; });

        panel.addEventListener('touchstart', function(e) {
            if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A' || e.target.tagName === 'INPUT' || e.target.closest('button')) return;
            isDragging = true;
            panel.style.transform = 'none';
            var touch = e.touches[0];
            startX = touch.clientX;
            startY = touch.clientY;
            var rect = panel.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;
            panel.style.left = initialLeft + 'px';
            panel.style.top = initialTop + 'px';
            panel.style.margin = '0';
        }, { passive: true });

        document.addEventListener('touchmove', function(e) {
            if (!isDragging) return;
            var touch = e.touches[0];
            var dx = touch.clientX - startX;
            var dy = touch.clientY - startY;
            panel.style.left = (initialLeft + dx) + 'px';
            panel.style.top = (initialTop + dy) + 'px';
        }, { passive: true });

        document.addEventListener('touchend', function() { isDragging = false; });

    }, 1000);

})();
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

def inject_panels(html):
    html = re.sub(r'<script id="nh-checklist-progress">.*?</script>', '', html, flags=re.DOTALL)
    
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
    modified_html = inject_panels(original_html)
        
    new_len = len(modified_html)
    diff = new_len - original_len
    
    write_file(FILENAME, modified_html)
    print(f"[+] 文件修改完成！")
    print(f"[*] 字数变动：{original_len} -> {new_len}")

if __name__ == '__main__':
    main()