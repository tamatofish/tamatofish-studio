#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
redesign.py — 第七首诗 index.html 自动修复脚本
================================================

流程：
  1. 读取 index.html
  2. 逐条应用 patch（字符串查找替换）
  3. 备份原文件为 index.html.bak.YYYYMMDD_HHMMSS
  4. 原地覆盖写回 index.html（不生成新 html）
  5. 控制台输出：应用的 patch 列表 + 字数变动

用法：
  python redesign.py                    # 默认修 ./index.html
  python redesign.py path/to/index.html # 指定文件

本次 V46 修复：
  A1/A2/A3/B1  V45 遗留：CLEAN_V46 重复重建导航栏、未暴露 updateUI
  A4           V46 新增：> 前进按钮跳到空白页（全角/半角冒号失配）
  A5           V46 新增：< 后退按钮同样加名字校正（防御性）
"""

import os
import sys
import shutil
import datetime

# ============ 配置 ============
DEFAULT_INDEX = "index.html"
TS_FMT = "%Y%m%d_%H%M%S"

# ============ changelog 文本（写入 <head> 顶部） ============
CHANGELOG_ANCHOR = "<!-- NH_NATURAL_VOICE_V1 -->"
CHANGELOG_TEXT = """<!--
  NH_REDESIGN_FIX_CHANGELOG_V46
  =============================
  本次（redesign.py V46）在 V45 基础上继续修复浏览历史 < > 按钮，
  解决点击 > 后跳入空白页的问题。不改变任何游戏功能表现。

  【A 类：严重】
  [A4] > 前进按钮跳到空白页
       问题：nh_nav_list 里存的名字含全角冒号（如「公告：选课安排」），
             而 Story 里真实 passage 名使用半角冒号
             （「公告:选课安排」），Engine.play(target) 找不到目标，
             渲染为空 passage，只留悬浮按钮和背景纹理（空白页）。
       修复：goForward() 调 Engine.play 之前，先经
             window.__nhResolvePassageName 校正名字
             （该函数由 nh-colon-fallback 暴露，
              做全角↔半角冒号互转）。校正失败再退回原名。

  [A5] < 后退按钮同样加名字校正（防御性）
       问题：虽然历史栈里的名字多来自真实打开过的页面，
             但 reset/刷新后可能残留不匹配项，同样会跳到空白页。
       修复：goBackward() 也走 __nhResolvePassageName 校正。

  【继承 V45】
  [A1] CLEAN_V46 的 buildNav() 不再重复重建导航栏
  [A2] nh-nav-history-patch 暴露 window.__nhRefreshNavUI = updateUI
  [A3] buildNav() 末尾调用 __nhRefreshNavUI(true) 同步禁用态
  [B1] 删除 CLEAN_V46 中空的 refreshDisabled 与重复事件绑定

  文本字数变动：
    - 新增 __nhResolvePassageName 校正逻辑：约 +520 字
    - 删除 CLEAN_V46 冗余逻辑（V45 已删）：约 -420 字
    - 新增本 changelog：约 +1100 字
    净变动约 +1200 字。
-->

"""


# ============ 工具函数 ============

def backup(path, ts):
    if not os.path.isfile(path):
        return None
    bak = path + ".bak." + ts
    shutil.copy2(path, bak)
    return bak


def warn(msg):
    print("[WARN] " + msg)


def ok(msg):
    print("[OK] " + msg)


# ============ Patch 定义 ============
PATCHES = [

    # ---------- A2：在 nh-nav-history-patch 暴露 __nhRefreshNavUI ----------
    {
        "id": "A2",
        "desc": "nh-nav-history-patch 暴露 window.__nhRefreshNavUI = updateUI",
        "find": (
            "    function recordPage(rawName) {\n"
            "        var passageName = normalize(rawName);\n"
        ),
        "repl": (
            "    /* [FIX_V46 A2] 对外暴露 updateUI，\n"
            "       供 CLEAN_V46 等脚本在 DOM 变动后主动同步按钮禁用态。 */\n"
            "    window.__nhRefreshNavUI = updateUI;\n"
            "\n"
            "    function recordPage(rawName) {\n"
            "        var passageName = normalize(rawName);\n"
        ),
        "expect": 1,
    },

    # ---------- A1 + A3：CLEAN_V46 buildNav 只创建不重建 ----------
    {
        "id": "A1",
        "desc": "CLEAN_V46 buildNav 改为只创建不重建",
        "find": (
            "        /* 只保留一个 */\n"
            "        var existing = document.getElementById('lw-nav-bar');\n"
            "        if (existing) existing.remove();\n"
        ),
        "repl": (
            "        /* [FIX_V46 A1] 只保留一个，但不再重建——\n"
            "           若已存在直接返回，避免丢失\n"
            "           nh-nav-history-patch 绑定在按钮上的事件监听器。 */\n"
            "        var existing = document.getElementById('lw-nav-bar');\n"
            "        if (existing) {\n"
            "            /* [FIX_V46 A3] 顺带强制同步一次按钮禁用态 */\n"
            "            if (typeof window.__nhRefreshNavUI === 'function') {\n"
            "                window.__nhRefreshNavUI(true);\n"
            "            }\n"
            "            return;\n"
            "        }\n"
        ),
        "expect": 1,
    },

    # ---------- A3：buildNav 末尾首次创建后调用 __nhRefreshNavUI ----------
    {
        "id": "A3",
        "desc": "CLEAN_V46 buildNav 末尾首次创建后调用 __nhRefreshNavUI",
        "find": (
            "        /* 监听历史更新 */\n"
            "        if (window.jQuery) {\n"
            "            jQuery(document).off('.lw-nav').on('historyupdate.lw-nav', refreshDisabled);\n"
            "        } else {\n"
            "            setTimeout(refreshDisabled, 100);\n"
            "            setTimeout(refreshDisabled, 400);\n"
            "        }\n"
            "    }\n"
        ),
        "repl": (
            "        /* [FIX_V46 A3] 首次创建完成后，强制同步一次禁用态。\n"
            "           此后由 nh-nav-history-patch 在 :passagedisplay\n"
            "           时统一更新，不再重复绑定。 */\n"
            "        if (typeof window.__nhRefreshNavUI === 'function') {\n"
            "            window.__nhRefreshNavUI(true);\n"
            "        }\n"
            "    }\n"
        ),
        "expect": 1,
    },

    # ---------- B1：删除空的 refreshDisabled 与重复绑定 ----------
    {
        "id": "B1",
        "desc": "删除 CLEAN_V46 中空的 refreshDisabled 与重复绑定",
        "find": (
            "        function refreshDisabled() {\n"
            "            /* 禁用态交由 LW_NAV_HISTORY_V5 统一管理，这里不覆盖。 */\n"
            "        }\n"
            "        refreshDisabled();\n"
            "        /* 原生历史变化时同步按钮禁用态 */\n"
            "        if (window.jQuery) {\n"
            "            jQuery(document).off('historyupdate.lwNav46').on('historyupdate.lwNav46', refreshDisabled);\n"
            "        }\n"
            "        /* 原生历史变化时同步按钮禁用态，避免从 ZEmail 返回后状态错乱 */\n"
            "        if (window.jQuery) {\n"
            "            jQuery(document).off('historyupdate.lwNav46').on('historyupdate.lwNav46', refreshDisabled);\n"
            "        }\n"
            "\n"
        ),
        "repl": (
            "        /* [FIX_V46 B1] 删除空的 refreshDisabled 与重复事件绑定；\n"
            "           按钮禁用态由 nh-nav-history-patch 的\n"
            "           __nhRefreshNavUI 统一管理。 */\n"
            "\n"
        ),
        "expect": 1,
    },

    # ---------- A4：goForward 加名字校正 ----------
    {
        "id": "A4",
        "desc": "goForward 调 Engine.play 前用 __nhResolvePassageName 校正名字",
        "find": (
            "    function goForward() {\n"
            "        if (!getMode()) return;\n"
            "        var list = loadList();\n"
            "        var pos = loadPos();\n"
            "        if (pos < 0 || pos >= list.length - 1) { updateUI(); return; }\n"
            "        pos = pos + 1;\n"
            "        var target = list[pos];\n"
            "        savePos(pos);\n"
            "        console.log('[nh-nav] 前进 ->', target);\n"
            "        updateUI();\n"
            "        try {\n"
            "            if (window.SugarCube && SugarCube.Engine) {\n"
            "                SugarCube.Engine.play(target);\n"
            "            }\n"
            "        } catch (e) { console.warn('[nh-nav] play failed:', e); }\n"
            "    }\n"
        ),
        "repl": (
            "    /* [FIX_V46 A4] 名字校正：把列表里存的名字\n"
            "       （可能含全角冒号）转为 Story 里真实的名字。 */\n"
            "    function resolveTarget(name) {\n"
            "        if (!name) return name;\n"
            "        try {\n"
            "            if (window.SugarCube && SugarCube.Story && SugarCube.Story.has(name)) {\n"
            "                return name;\n"
            "            }\n"
            "        } catch (e) {}\n"
            "        if (typeof window.__nhResolvePassageName === 'function') {\n"
            "            try {\n"
            "                var resolved = window.__nhResolvePassageName(name);\n"
            "                if (resolved) return resolved;\n"
            "            } catch (e) {}\n"
            "        }\n"
            "        return name;\n"
            "    }\n"
            "\n"
            "    function goForward() {\n"
            "        if (!getMode()) return;\n"
            "        var list = loadList();\n"
            "        var pos = loadPos();\n"
            "        if (pos < 0 || pos >= list.length - 1) { updateUI(); return; }\n"
            "        pos = pos + 1;\n"
            "        var target = resolveTarget(list[pos]);\n"
            "        savePos(pos);\n"
            "        console.log('[nh-nav] 前进 ->', target);\n"
            "        updateUI();\n"
            "        try {\n"
            "            if (window.SugarCube && SugarCube.Engine) {\n"
            "                SugarCube.Engine.play(target);\n"
            "            }\n"
            "        } catch (e) { console.warn('[nh-nav] play failed:', e); }\n"
            "    }\n"
        ),
        "expect": 1,
    },

    # ---------- A5：goBackward 同样加名字校正 ----------
    {
        "id": "A5",
        "desc": "goBackward 调 Engine.play 前用 __nhResolvePassageName 校正名字",
        "find": (
            "    function goBackward() {\n"
            "        if (!getMode()) return;\n"
            "        var list = loadList();\n"
            "        var pos = loadPos();\n"
            "        if (pos <= 0) { updateUI(); return; }\n"
            "        pos = pos - 1;\n"
            "        var target = list[pos];\n"
            "        savePos(pos);\n"
            "        console.log('[nh-nav] 返回 ->', target);\n"
            "        updateUI();\n"
            "        try {\n"
            "            if (window.SugarCube && SugarCube.Engine) {\n"
            "                SugarCube.Engine.play(target);\n"
            "            }\n"
            "        } catch (e) { console.warn('[nh-nav] play failed:', e); }\n"
            "    }\n"
        ),
        "repl": (
            "    function goBackward() {\n"
            "        if (!getMode()) return;\n"
            "        var list = loadList();\n"
            "        var pos = loadPos();\n"
            "        if (pos <= 0) { updateUI(); return; }\n"
            "        pos = pos - 1;\n"
            "        /* [FIX_V46 A5] 同样做名字校正，防止残留不匹配项 */\n"
            "        var target = resolveTarget(list[pos]);\n"
            "        savePos(pos);\n"
            "        console.log('[nh-nav] 返回 ->', target);\n"
            "        updateUI();\n"
            "        try {\n"
            "            if (window.SugarCube && SugarCube.Engine) {\n"
            "                SugarCube.Engine.play(target);\n"
            "            }\n"
            "        } catch (e) { console.warn('[nh-nav] play failed:', e); }\n"
            "    }\n"
        ),
        "expect": 1,
    },
]


# ============ 应用逻辑 ============

def apply_patches(text):
    applied = []
    failed = []
    for p in PATCHES:
        pid = p["id"]
        find = p["find"]
        repl = p["repl"]
        expect = p.get("expect", 1)

        cnt = text.count(find)
        if cnt == expect:
            text = text.replace(find, repl, expect)
            applied.append(pid)
            print("[OK] patch " + pid + " 应用：" + p["desc"])
        elif cnt == 0:
            failed.append(pid)
            warn("patch " + pid + " 未匹配（可能已修复过）：" + p["desc"])
        else:
            failed.append(pid)
            warn("patch " + pid + " 匹配 " + str(cnt) + " 次（期望 " + str(expect)
                 + "），已跳过，避免误改：" + p["desc"])
    return text, applied, failed


def insert_changelog(text):
    if "NH_REDESIGN_FIX_CHANGELOG_V46" in text:
        print("[INFO] changelog V46 已存在，跳过插入。")
        return text, False
    if CHANGELOG_ANCHOR not in text:
        warn("找不到 changelog 锚点：" + CHANGELOG_ANCHOR + "，跳过 changelog 插入。")
        return text, False
    text = text.replace(CHANGELOG_ANCHOR, CHANGELOG_TEXT + CHANGELOG_ANCHOR, 1)
    print("[OK] changelog V46 已插入 <head> 顶部。")
    return text, True


# ============ 主流程 ============

def main():
    path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_INDEX
    if not os.path.isfile(path):
        print("[ERROR] 找不到文件：" + path)
        sys.exit(1)

    with open(path, "r", encoding="utf-8") as f:
        original = f.read()

    print("=" * 60)
    print("redesign.py V46 — 修复 < > 按钮 + 前进空白页 bug")
    print("目标文件：" + os.path.abspath(path))
    print("原始大小：" + str(len(original)) + " 字符")
    print("=" * 60)

    patched, applied, failed = apply_patches(original)
    patched, clog_inserted = insert_changelog(patched)

    if patched == original:
        print("=" * 60)
        print("[INFO] 没有任何改动，文件未修改，未创建备份。")
        return

    ts = datetime.datetime.now().strftime(TS_FMT)
    bak = backup(path, ts)
    if bak:
        ok("已备份原文件 → " + os.path.basename(bak))
    else:
        warn("备份失败，继续写回。")

    with open(path, "w", encoding="utf-8") as f:
        f.write(patched)

    delta = len(patched) - len(original)
    print("=" * 60)
    print("[OK] 已写回：" + os.path.abspath(path))
    print("[OK] 应用的 patch：" + (", ".join(applied) if applied else "无"))
    if failed:
        print("[WARN] 跳过的 patch：" + ", ".join(failed))
    print("[OK] changelog：" + ("已插入" if clog_inserted else "未插入"))
    print("[OK] 字数变动：%+d 字符" % delta)
    print("=" * 60)


if __name__ == "__main__":
    main()