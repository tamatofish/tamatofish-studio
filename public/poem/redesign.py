#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
redesign.py
===========
[FIX_V70] 用正则替换 __nhUnblockHotkeys，兼容缩进差异。
"""

import io
import os
import re
import sys

TARGET = "index.html"


def read_html(path):
    with io.open(path, "r", encoding="utf-8") as f:
        return f.read()


def write_html(path, text):
    with io.open(path, "w", encoding="utf-8") as f:
        f.write(text)


def apply_patch(html):
    if "FIX_V70_MARK" in html:
        print("[redesign] 已应用过，跳过")
        return html, False

    # 正则匹配：window.__nhUnblockHotkeys = function () {  ...  };
    # 中间部分用非贪婪匹配到 } 结束
    pattern = re.compile(
        r"(window\.__nhUnblockHotkeys\s*=\s*function\s*\(\s*\)\s*\{)"
        r"(.*?)"
        r"(\};)",
        re.DOTALL,
    )
    m = pattern.search(html)
    if not m:
        print("[redesign] 未找到 __nhUnblockHotkeys 函数")
        return html, False

    print("[redesign] 找到函数体：")
    print(m.group(2)[:200])

    # 新的函数体
    new_body = (
        "\n        blocked = false;\n"
        "        /* FIX_V70_MARK: 同步 __nhDebugMode */\n"
        "        window.__nhDebugMode = true;\n"
        "        console.log('[nh] 调试模式已开启，快捷键屏蔽解除');\n"
        "    "
    )
    new_block = m.group(1) + new_body + m.group(3)
    html = html[:m.start()] + new_block + html[m.end():]
    return html, True


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(here, TARGET)

    if not os.path.isfile(path):
        print("[redesign] 找不到 %s" % path)
        sys.exit(1)

    html = read_html(path)
    original_len = len(html)

    html, ok = apply_patch(html)

    new_len = len(html)
    delta = new_len - original_len

    write_html(path, html)

    print("[redesign] 已原地更新 %s" % path)
    print("[redesign] 字数变动: %+d（原 %d → 新 %d）" % (delta, original_len, new_len))
    print("[redesign] 修复项: FIX_V70 (正则替换 __nhUnblockHotkeys)")
    print("[redesign] 补丁应用: %s" % ("成功" if ok else "未找到"))


if __name__ == "__main__":
    main()