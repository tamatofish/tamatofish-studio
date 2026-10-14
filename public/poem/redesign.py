#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
redesign.py —— 第七首诗 / index.html 原地修补器
"""

import os
import re
import sys
import shutil
import datetime

# ============================================================
# 配置
# ============================================================

HTML_FILE = "index.html"
BACKUP_DIR = "backups"

VERSION = "V49"

FIX_SUMMARY = [
    "B1] 修复 A.R.C. 回信正文中 [[...]] 未被转成加粗的问题",
    "    · 原因：nh-bold-render-final 的 fixBody 里",
    "      `if (el.querySelector('strong')) return;`",
    "      导致正文里一旦出现任意 <strong>，整段就被跳过，",
    "      [[陈默]]、[[工号 ...]] 等标记原样显示。",
    "    · 处理：新增独立兜底脚本 nh-bold-fix，与前者互不干扰：",
    "      - 只对 .zm163-detail .body / .zm163-panel .body 生效",
    "      - 用 data-nh-bold=1 标记，处理过就跳过（幂等）",
    "      - 只把 [[xxx]] 转成 <strong>xxx</strong>，其它字符原样",
    "      - :passagedisplay 后 0/100/300/800ms 触发 + 每 800ms 兜底",
]

# ============================================================
# 工具
# ============================================================

def 替换(旧, 新, 必改=True):
    def _patch(html):
        if 旧 not in html:
            if 必改:
                raise RuntimeError("未找到目标片段（前 80 字）：\n" + 旧[:80])
            return html
        return html.replace(旧, 新, 1)
    return _patch


# ============================================================
# 新增的兜底脚本（插在 </body> 前）
# ============================================================

NH_BOLD_FIX = r'''<!-- ===== NH_BOLD_FIX_V1 ===== -->
<script id="nh-bold-fix">
/* NH_BOLD_FIX_V1：兜底把 ZMail 邮件正文里的 [[...]] 转成 <strong>。
   与 nh-bold-render-final 互不干扰：
     · 后者对含 <strong> 的 body 早退，不会碰这种 body；
     · 本脚本主动接管所有「含 [[ 且未被本脚本处理过」的 body。
   幂等：处理过的 body 打 data-nh-bold=1，不再重复。 */
(function () {
    'use strict';

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function boldify(raw) {
        var e = escapeHtml(raw);
        return e.replace(/\[\[([^\]]+)\]\]/g, '<strong>$1</strong>');
    }

    function fixBody(el) {
        if (!el || el.nodeType !== 1) return;
        if (el.getAttribute('data-nh-bold') === '1') return;
        var t = el.textContent || '';
        if (t.indexOf('[[') === -1) return;
        el.innerHTML = boldify(t);
        el.setAttribute('data-nh-bold', '1');
    }

    function tick() {
        var list = document.querySelectorAll(
            '.zm163-detail .body, .zm163-panel .body'
        );
        for (var i = 0; i < list.length; i++) fixBody(list[i]);
    }

    /* 定时兜底 */
    setInterval(tick, 800);

    /* 切页时多打几枪，抢在面板刚渲染完那一刻 */
    if (window.jQuery) {
        jQuery(document).on(':passagedisplay.nhBoldFix', function () {
            [0, 100, 300, 800, 1500].forEach(function (t) {
                setTimeout(tick, t);
            });
        });
    }

    /* 立即跑一次 */
    tick();

    console.log('[nh-bold-fix] v1 loaded');
})();
</script>
<!-- ===== end NH_BOLD_FIX_V1 ===== -->
'''

# ============================================================
# PATCHES
# ============================================================

PATCHES = [
    (
        "在 </body> 前插入 nh-bold-fix 脚本",
        替换("</body>", NH_BOLD_FIX + "\n</body>")
    ),
]


# ============================================================
# changelog
# ============================================================

CHANGELOG_ANCHOR = '<meta charset="UTF-8" />'


def 生成_changelog(净字数变动, 原字数, 新字数):
    sign = "+" if 净字数变动 >= 0 else ""
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    摘要 = "\n".join("  " + line for line in FIX_SUMMARY)
    return f"""<!--
  NH_REDESIGN_FIX_CHANGELOG_{VERSION}
  =============================
  生成时间：{now}
  本次（redesign.py {VERSION}）修复清单：

{摘要}

  文本字数变动：
    · 原 index.html 字符数：{原字数}
    · 新 index.html 字符数：{新字数}
    · 净变动：{sign}{净字数变动}
-->

"""


def 插入_changelog(html, block):
    if CHANGELOG_ANCHOR in html:
        return html.replace(CHANGELOG_ANCHOR, block + CHANGELOG_ANCHOR, 1)
    m = re.search(r"<head[^>]*>", html, re.IGNORECASE)
    if m:
        return html[:m.end()] + "\n" + block + html[m.end():]
    return block + html


# ============================================================
# 备份
# ============================================================

def 备份(html_path):
    if not os.path.exists(html_path):
        return None
    os.makedirs(BACKUP_DIR, exist_ok=True)
    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    base = os.path.splitext(os.path.basename(html_path))[0]
    dst = os.path.join(BACKUP_DIR, f"{base}.{stamp}.html")
    n = 1
    while os.path.exists(dst):
        dst = os.path.join(BACKUP_DIR, f"{base}.{stamp}-{n}.html")
        n += 1
    shutil.copy2(html_path, dst)
    return dst


# ============================================================
# 主流程
# ============================================================

def main():
    here = os.path.dirname(os.path.abspath(__file__))
    html_path = os.path.join(here, HTML_FILE)

    if not os.path.exists(html_path):
        print(f"[×] 找不到 {html_path}")
        sys.exit(1)

    with open(html_path, "r", encoding="utf-8") as f:
        原html = f.read()
    原字数 = len(原html)

    新html = 原html
    for 描述, patch_fn in PATCHES:
        try:
            新html = patch_fn(新html)
            print(f"[✓] {描述}")
        except Exception as e:
            print(f"[×] {描述} —— {e}")
            print("    已中止，index.html 未改动。")
            sys.exit(2)

    if 新html == 原html:
        print("[i] 内容无变化，跳过写回与备份。")
        return

    新字数 = len(新html)
    净 = 新字数 - 原字数

    bak = 备份(html_path)
    if bak:
        print(f"[✓] 已备份：{bak}")
    else:
        print("[!] 备份失败，出于安全考虑不写回。")
        sys.exit(3)

    block = 生成_changelog(净, 原字数, 新字数)
    新html = 插入_changelog(新html, block)

    with open(html_path, "w", encoding="utf-8") as f:
        f.write(新html)

    print()
    print("=" * 50)
    print(f"  {HTML_FILE} 已更新（原地写回）")
    print(f"  原字数：{原字数}")
    print(f"  新字数：{len(新html)}（含 changelog）")
    print(f"  净变动：{'+' if 净>=0 else ''}{净}（不含 changelog）")
    print("=" * 50)


if __name__ == "__main__":
    main()