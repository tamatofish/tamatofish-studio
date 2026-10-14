#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fix_gt2.py — 更激进地恢复 script-libraries / script-sugarcube 内的 >>> 
只在这两段 <script> 内部操作，不动其它地方。
运行:
    py -3 fix_gt2.py
"""

import re
import os
import sys

TARGET = "index.html"
SCRIPT_IDS = ["script-libraries", "script-sugarcube"]


def find_block(text, sid):
    pat = re.compile(
        r'<script\s+id="' + re.escape(sid) + r'"[^>]*>',
        re.IGNORECASE,
    )
    m = pat.search(text)
    if not m:
        return None
    body_start = m.end()
    end_m = re.search(r"</script>", text[body_start:], re.IGNORECASE)
    if not end_m:
        return None
    body_end = body_start + end_m.start()
    return (body_start, body_end)


def restore_aggressive(block):
    """
    无差别恢复 >> → >>>，并做以下回退保护：
      · 保护 HTML 实体 &gt;  &lt;（不出现在这里，但保险）
      · 保护字符串字面量 "..." 和 '...' 里的 >>
      · 保护正则字面量 /.../ 里的 >>
      · 保护 ">>>>" 不会出现（先压成 >>>）
    """
    out = []
    i = 0
    n = len(block)
    in_squote = False
    in_dquote = False
    in_backtick = False
    in_line_comment = False
    in_block_comment = False
    in_regex = False
    # 判断正则开始：/ 前面不是标识符/数字/)/]/}
    prev_sig = ""

    def push(s):
        out.append(s)

    while i < n:
        c = block[i]

        # 行注释
        if in_line_comment:
            push(c)
            if c == "\n":
                in_line_comment = False
            i += 1
            continue

        # 块注释
        if in_block_comment:
            push(c)
            if c == "*" and i + 1 < n and block[i + 1] == "/":
                push("/")
                i += 2
                in_block_comment = False
                continue
            i += 1
            continue

        # 单引号字符串
        if in_squote:
            push(c)
            if c == "\\" and i + 1 < n:
                push(block[i + 1])
                i += 2
                continue
            if c == "'":
                in_squote = False
            i += 1
            continue

        # 双引号字符串
        if in_dquote:
            push(c)
            if c == "\\" and i + 1 < n:
                push(block[i + 1])
                i += 2
                continue
            if c == '"':
                in_dquote = False
            i += 1
            continue

        # 反引号模板字符串
        if in_backtick:
            push(c)
            if c == "\\" and i + 1 < n:
                push(block[i + 1])
                i += 2
                continue
            if c == "`":
                in_backtick = False
            i += 1
            continue

        # 正则字面量（简化处理）
        if in_regex:
            push(c)
            if c == "\\" and i + 1 < n:
                push(block[i + 1])
                i += 2
                continue
            if c == "/":
                in_regex = False
            i += 1
            continue

        # 普通状态，看字符
        # 行注释开始
        if c == "/" and i + 1 < n and block[i + 1] == "/":
            push("//")
            i += 2
            in_line_comment = True
            continue
        # 块注释开始
        if c == "/" and i + 1 < n and block[i + 1] == "*":
            push("/*")
            i += 2
            in_block_comment = True
            continue
        # 字符串开始
        if c == "'":
            push(c)
            i += 1
            in_squote = True
            continue
        if c == '"':
            push(c)
            i += 1
            in_dquote = True
            continue
        if c == "`":
            push(c)
            i += 1
            in_backtick = True
            continue

        # 这里：判断 >> 是否要恢复成 >>>
        # 只在"非字符串、非正则、非注释"的 JS 代码里恢复
        if c == ">" and i + 1 < n and block[i + 1] == ">":
            # 已经 >>> 就不动
            if i + 2 < n and block[i + 2] == ">":
                push(">>>")
                i += 3
                continue
            # >> → >>>（无差别恢复）
            push(">>>")
            i += 2
            continue

        push(c)
        i += 1

    return "".join(out)


def main():
    if not os.path.isfile(TARGET):
        print("[fix] 找不到:", TARGET)
        sys.exit(1)

    with open(TARGET, "r", encoding="utf-8") as f:
        text = f.read()

    before = text
    total = 0
    for sid in SCRIPT_IDS:
        loc = find_block(text, sid)
        if not loc:
            print(f"[fix] 找不到 <script id=\"{sid}\">")
            continue
        s, e = loc
        block = text[s:e]
        n_before = block.count(">>>")
        new_block = restore_aggressive(block)
        n_after = new_block.count(">>>")
        text = text[:s] + new_block + text[e:]
        total += (n_after - n_before)
        print(f"[fix] {sid}: >>> {n_before} -> {n_after}  (+{n_after - n_before})")

    if text == before:
        print("[fix] 没有变化")
        return

    # 备份
    if not os.path.isfile(TARGET + ".bak2"):
        with open(TARGET + ".bak2", "w", encoding="utf-8") as f:
            f.write(before)
        print("[fix] 已备份到:", TARGET + ".bak2")

    with open(TARGET, "w", encoding="utf-8") as f:
        f.write(text)

    print(f"[fix] 完成。共恢复 {total} 处 >>>")


if __name__ == "__main__":
    main()