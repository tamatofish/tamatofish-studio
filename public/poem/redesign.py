import os
import re
import shutil
from datetime import datetime

INDEX_FILE = "index.html"
VERSION = "V202_LOGIN_LOCK"

def main():
    if not os.path.exists(INDEX_FILE):
        print(f"错误：找不到 {INDEX_FILE}")
        return

    with open(INDEX_FILE, "r", encoding="utf-8") as f:
        original_content = f.read()

    original_len = len(original_content)
    modified_content = original_content
    applied_fixes = []

    print(f"开始执行 redesign.py {VERSION} ...")

    # 清理之前注入的可能无效的补丁
    modified_content = re.sub(r'<script id="nh-login-persist-fix">.*?</script>', '', modified_content, flags=re.DOTALL)

    login_lock_script = r"""
<script id="nh-login-lock-hard">
(function () {
    'use strict';

    var LS_LOGIN = 'nh_is_logged_in_locked';
    var LS_USER = 'nh_username_locked';

    // 1. 监听登录成功（捕获点击事件）
    document.addEventListener('click', function(ev) {
        var el = ev.target;
        while (el && el !== document.body) {
            if (el.tagName === 'BUTTON' && (el.textContent || '').indexOf('登') !== -1) {
                setTimeout(function() {
                    try {
                        if (window.SugarCube && SugarCube.State && SugarCube.State.variables) {
                            if (SugarCube.State.variables.loggedIn === true) {
                                localStorage.setItem(LS_LOGIN, 'true');
                                localStorage.setItem(LS_USER, SugarCube.State.variables.username || 'admin');
                                console.log('🔒 [Login Lock] 登录状态已刻入本地');
                            }
                        }
                    } catch(e) {}
                }, 500); // 延迟等待游戏内部赋值
                break;
            }
            el = el.parentNode;
        }
    }, true);

    // 2. 核心：在每个页面即将渲染完成时，强行把变量塞进去
    function enforceLogin() {
        if (localStorage.getItem(LS_LOGIN) !== 'true') return;
        
        try {
            if (window.SugarCube && SugarCube.State && SugarCube.State.variables) {
                var v = SugarCube.State.variables;
                if (v.loggedIn !== true) {
                    v.loggedIn = true;
                    v.username = localStorage.getItem(LS_USER) || 'admin';
                    console.log('🔒 [Login Lock] 强制恢复登录状态');
                }
            }
        } catch(e) {}
    }

    // 3. 拦截引擎，在页面渲染的瞬间和之后强制执行
    if (window.jQuery) {
        // 监听引擎的所有关键节点
        jQuery(document).on(':passagestart', enforceLogin);
        jQuery(document).on(':passagerender', enforceLogin);
        jQuery(document).on(':passagedisplay', function() {
            enforceLogin();
            setTimeout(enforceLogin, 10);
            setTimeout(enforceLogin, 100);
            setTimeout(enforceLogin, 500);
        });
    }

    // 4. 极限兜底：每 100 毫秒轮询一次（比游戏自身的防作弊还快）
    setInterval(enforceLogin, 100);

    // 页面加载第一瞬间执行
    setTimeout(enforceLogin, 0);
    setTimeout(enforceLogin, 100);

    // 暴露给全局，如果进入 Start 页，强行跳转
    if (window.jQuery) {
        jQuery(document).on(':passagedisplay', function() {
            try {
                if (SugarCube.State.passage === 'Start' && localStorage.getItem(LS_LOGIN) === 'true') {
                    // 发现跳回了登录页，立刻强行跳回首页
                    console.log('🔒 [Login Lock] 拦截登录页跳转，强入内网首页');
                    setTimeout(function() {
                        SugarCube.Engine.play('内网首页');
                    }, 50);
                }
            } catch(e) {}
        });
    }
})();
</script>
"""

    if 'id="nh-login-lock-hard"' not in modified_content:
        modified_content = modified_content.replace('</body>', login_lock_script + '\n</body>')
        applied_fixes.append("注入超强力登录锁定引擎，彻底防止刷新掉登录。")
        print("✅ 成功注入：超强力登录锁定引擎")

    # ==========================================
    # 写入更新记录与备份
    # ==========================================
    if modified_content == original_content:
        print("没有进行任何修改，无需备份。")
        return

    new_len = len(modified_content)
    diff = new_len - original_len
    diff_str = f"+{diff}" if diff >= 0 else str(diff)

    now_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    fix_list_str = "\n".join([f"     · {desc}" for desc in applied_fixes])
    
    changelog = f"""<!--
  NH_REDESIGN_FIX_CHANGELOG_{VERSION}
  =============================
  生成时间：{now_time}
  本次（redesign.py {VERSION}）修复清单：

  1] {fix_list_str}

  文本字数变动：
    · 原 index.html 字符数：{original_len}
    · 新 index.html 字符数：{new_len}
    · 净变动：{diff_str}
-->

"""

    if "<!DOCTYPE html>" in modified_content:
        modified_content = modified_content.replace("<!DOCTYPE html>", f"<!DOCTYPE html>\n{changelog}", 1)
    else:
        modified_content = changelog + modified_content

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_file = f"index_backup_{timestamp}.html"
    shutil.copy2(INDEX_FILE, backup_file)
    print(f"📁 已创建备份文件: {backup_file}")

    with open(INDEX_FILE, "w", encoding="utf-8") as f:
        f.write(modified_content)

    print(f"✨ 修复完成！净变动字符数: {diff_str}")

if __name__ == "__main__":
    main()