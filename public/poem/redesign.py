#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
redesign.py
===========
对 index.html 进行原地修复（不生成新文件）。

本次修复内容（NH_REDESIGN_FIX_V35）
----------------------------------
[FIX_V53] 序幕正文写入时按句折行（源码可读）。

    需求（用户明确）：
      那段序幕文字现在是一整行塞在 &lt;p&gt;...&lt;/p&gt; 里，
      希望写入时**自动按句号/省略号折行**，源码里也是多行。

    修复方式：
      1) 新文案按标点拆成多行（保留原标点）。
      2) 每一行用 &lt;br&gt; 分隔（浏览器显示时也是这几行）。
         或者不用 &lt;br&gt;，纯用源码换行（浏览器会当空格）。
      3) 用户选择：源码里换行 + 浏览器里也换行 → 用 &lt;br&gt; 分隔。

      这里采用方案：每句一行，行与行之间加 &lt;br&gt;，
      让浏览器显示时也按句断行，源码可读。

    实现要点：
      · 用正则匹配转义后的 prologue-body 块
      · 拆句 → 逐行拼接（行间加 &lt;br&gt;）
      · 写入 HTML

字数变动
--------
替换序幕正文：
  旧文案约 130 字（7 段）→ 新文案约 118 字（5 行）
  净变动约 -12 字（仅正文）。

脚本 changelog：约 +400 字。

净变动：约 +390 字。

使用方法
--------
    python3 redesign.py
"""

import io
import os
import re
import sys

TARGET = "index.html"

# 新文案按句拆开（手动预先拆好，避免正则拆错）
PROLOGUE_LINES = [
    "你是Z站的一名灵异探险区UP主。",
    "在一次直播中，有粉丝向你讲述了南华大学15年前发生的一起失踪案。",
    "你从论坛上找到了一个南大的旧内网镜像。",
    "你点开了它，从那之后，你经常产生有人在注视你的错觉。",
    "直到那天，一封没有主题的邮件出现在了你的信箱里....",
]


def build_escaped_block():
    """
    生成转义后的 prologue-body 块。
    每句一行，行间加 &lt;br&gt;，浏览器显示时也按句断行。
    源码里也是多行，可读。
    """
    inner_lines = []
    for i, line in enumerate(PROLOGUE_LINES):
        if i == len(PROLOGUE_LINES) - 1:
            inner_lines.append("        " + line)
        else:
            inner_lines.append("        " + line + "&lt;br&gt;")
    inner = "\n".join(inner_lines)
    return (
        '&lt;div class="prologue-body"&gt;\n'
        '      &lt;p&gt;\n'
        + inner + "\n"
        '      &lt;/p&gt;\n'
        '    &lt;/div&gt;'
    )


def build_raw_block():
    """
    生成未转义的 prologue-body 块（备用）。
    """
    inner_lines = []
    for i, line in enumerate(PROLOGUE_LINES):
        if i == len(PROLOGUE_LINES) - 1:
            inner_lines.append("        " + line)
        else:
            inner_lines.append("        " + line + "<br>")
    inner = "\n".join(inner_lines)
    return (
        '<div class="prologue-body">\n'
        '      <p>\n'
        + inner + "\n"
        '      </p>\n'
        '    </div>'
    )


def read_html(path):
    with io.open(path, "r", encoding="utf-8") as f:
        return f.read()


def write_html(path, text):
    with io.open(path, "w", encoding="utf-8") as f:
        f.write(text)


def replace_prologue_body(html):
    """替换序幕页的 prologue-body 块（转义 / 未转义 都兼容）。"""
    # 转义版本
    pattern_escaped = re.compile(
        r'&lt;div\s+class="prologue-body"&gt;.*?&lt;/div&gt;',
        re.DOTALL,
    )
    m = pattern_escaped.search(html)
    if m:
        html = html[:m.start()] + build_escaped_block() + html[m.end():]
        return html, True

    # 未转义版本
    pattern_raw = re.compile(
        r'<div\s+class="prologue-body"[^>]*>.*?</div>',
        re.DOTALL,
    )
    m = pattern_raw.search(html)
    if m:
        html = html[:m.start()] + build_raw_block() + html[m.end():]
        return html, True

    # 宽松匹配（属性位置不定）
    pattern_loose_escaped = re.compile(
        r'&lt;div\b[^&]*?prologue-body[^&]*?&gt;.*?&lt;/div&gt;',
        re.DOTALL,
    )
    m = pattern_loose_escaped.search(html)
    if m:
        html = html[:m.start()] + build_escaped_block() + html[m.end():]
        return html, True

    return html, False


def patch_changelog(html):
    if "NH_REDESIGN_FIX_CHANGELOG_V35" in html:
        return html

    changelog = """
<!--
  NH_REDESIGN_FIX_CHANGELOG_V35
  =============================
  本次（redesign.py V35）序幕正文源码折行。

  [FIX_V53] 序幕正文写入时按句折行（源码可读 + 浏览器显示也断行）。
            问题：之前把整段文字写成一整行塞在 &lt;p&gt; 里，
                  源码不美观，浏览器里也是一大坨。
            方案：
              (1) 文案按句拆成 5 行：
                    · 你是Z站的一名灵异探险区UP主。
                    · 在一次直播中，有粉丝向你讲述了南华大学15年前
                      发生的一起失踪案。
                    · 你从论坛上找到了一个南大的旧内网镜像。
                    · 你点开了它，从那之后，你经常产生有人在注视你
                      的错觉。
                    · 直到那天，一封没有主题的邮件出现在了你的信箱
                      里....
              (2) 行间加 &lt;br&gt; 标签，浏览器显示时也按句断行。
              (3) 源码里就是多行，可读。

  文本字数变动：
    - 序幕正文：约 130 字 → 118 字，净 -12 字
    - 新增 changelog：约 +400 字
    净变动约 +390 字。
-->
"""
    for anchor in [
        "<!--\n  NH_REDESIGN_FIX_CHANGELOG_V34",
        "<!--\n  NH_REDESIGN_FIX_CHANGELOG_V33",
        "<!--\n  NH_REDESIGN_FIX_CHANGELOG_V32",
        "<!--\n  NH_REDESIGN_FIX_CHANGELOG_V31",
        "<!--\n  NH_REDESIGN_FIX_CHANGELOG_V30",
        "<!--\n  NH_REDESIGN_FIX_CHANGELOG_V29",
        "<!--\n  NH_REDESIGN_FIX_CHANGELOG_V28",
        "<!--\n  NH_REDESIGN_FIX_CHANGELOG_V27",
        "<!--\n  NH_REDESIGN_FIX_CHANGELOG_V26",
        "<!--\n  NH_REDESIGN_FIX_CHANGELOG_V25",
        "<!--\n  NH_REDESIGN_FIX_CHANGELOG_V24",
        "<!--\n  NH_REDESIGN_FIX_CHANGELOG_V23",
        "<!--\n  NH_REDESIGN_FIX_CHANGELOG_V22",
        "<!--\n  NH_REDESIGN_FIX_CHANGELOG_V21",
        "<!--\n  NH_REDESIGN_FIX_CHANGELOG_V20",
        "<!--\n  NH_REDESIGN_FIX_CHANGELOG_V19",
        "<!--\n  NH_REDESIGN_FIX_CHANGELOG_V18",
        "<!--\n  NH_REDESIGN_FIX_CHANGELOG_V17",
        "<!--\n  NH_REDESIGN_FIX_CHANGELOG_V16",
        "<!--\n  NH_REDESIGN_FIX_CHANGELOG_V15",
        "<!--\n  NH_REDESIGN_FIX_CHANGELOG_V14",
        "<!--\n  NH_REDESIGN_FIX_CHANGELOG_V13",
        "<!--\n  NH_REDESIGN_FIX_CHANGELOG_V12",
        "<!--\n  NH_REDESIGN_FIX_CHANGELOG_V11",
        "<!--\n  NH_REDESIGN_FIX_CHANGELOG_V10",
        "<!--\n  NH_REDESIGN_FIX_CHANGELOG_V9",
        "<!--\n  NH_REDESIGN_FIX_CHANGELOG_V8",
        "<!--\n  NH_REDESIGN_FIX_CHANGELOG_V7",
        "<!--\n  NH_REDESIGN_FIX_CHANGELOG_V6",
        "<!--\n  NH_REDESIGN_FIX_CHANGELOG_V5",
        "<!--\n  NH_REDESIGN_FIX_CHANGELOG_V4",
        "<!--\n  NH_REDESIGN_UPDATE_V2 (序章页面重做)",
    ]:
        if anchor in html:
            return html.replace(anchor, changelog + "\n" + anchor, 1)
    idx = html.find("<head>")
    if idx != -1:
        end = html.find(">", idx) + 1
        return html[:end] + "\n" + changelog + html[end:]
    return html


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(here, TARGET)

    if not os.path.isfile(path):
        print("[redesign] 找不到 %s" % path)
        sys.exit(1)

    html = read_html(path)
    original_len = len(html)

    html, ok_body = replace_prologue_body(html)

    html = patch_changelog(html)

    new_len = len(html)
    delta = new_len - original_len

    write_html(path, html)

    print("[redesign] 已原地更新 %s" % path)
    print("[redesign] 字数变动: %+d（原 %d → 新 %d）" % (delta, original_len, new_len))
    print("[redesign] 修复项: FIX_V53 (序幕正文按句折行)")
    print("[redesign] 序幕正文替换: %s" % ("成功" if ok_body else "未找到"))


if __name__ == "__main__":
    main()