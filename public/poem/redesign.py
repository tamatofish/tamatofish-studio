#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
redesign.py —— 第七首诗 / index.html 原地修补器

用法：
    1. 在 PATCHES 列表里写你的修改（用 替换 / 正则替换 / 替换函数体）。
    2. 运行：python redesign.py
    3. 脚本会：
         · 先把当前 index.html 备份到 backups/index.YYYYMMDD-HHMMSS.html
         · 再原地写回修改后的 index.html（同名覆盖，不生成新 html）
         · 把「本次修复摘要 + 字数变动」写进 html 顶部的 changelog 注释区

设计原则：
    · 只改 index.html，不生成任何 *_new.html / *_fixed.html。
    · 备份与覆盖是原子的：先备份成功，才允许写回。
    · changelog 采用「最新的在最上面」，历史条目保留。
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

VERSION = "V48"

# 本次修复的粗略内容（写进 changelog 的「摘要」段）
FIX_SUMMARY = [
    "A9] 语义引擎 emlet：本地优先，失败回退 unpkg",
    "    · 移除 @xenova/transformers + hf-mirror 加载逻辑",
    "    · 改为「本地 js/emlet.mjs 优先」+「unpkg 回退」双通道",
    "    · emlet 纯 JS、无 WASM、无外部请求（本地命中时）",
    "    · 保留 __nhEmbedReady / __nhEmbedLoading 标志",
    "    · 保留 __nhEmbedMatch 接口（内部改调 emlet.embed + 余弦相似度）",
    "    · nh-zmail-fusion 无需改动，继续按原接口调用",
    "    · 全部加载失败时静默退回关键词引擎",
]

# ============================================================
# 修改操作（PATCHES 里用到的工具函数）
# ============================================================

def 替换(旧, 新, 必改=True):
    """把 旧 字符串替换为 新（只替换第一处）。"""
    def _patch(html):
        if 旧 not in html:
            if 必改:
                raise RuntimeError(
                    "未找到目标片段（前 80 字）：\n" + 旧[:80]
                )
            return html
        return html.replace(旧, 新, 1)
    return _patch


def 正则替换(模式, 新, flags=re.DOTALL, 必改=True):
    """用正则替换（只替换第一处）。"""
    def _patch(html):
        new_html, n = re.subn(模式, 新, html, count=1, flags=flags)
        if n == 0 and 必改:
            raise RuntimeError("正则未匹配：\n" + 模式[:100])
        return new_html
    return _patch


def 替换函数体(函数声明模式, 新函数体):
    """
    精确定位 `async function 名() { ... }` 并按大括号配对替换整个函数体（含末尾 }）。
    函数声明模式 是一个编译好的正则，匹配到 '{' 为止。
    """
    def _patch(html):
        m = 函数声明模式.search(html)
        if not m:
            raise RuntimeError("找不到函数声明：" + 函数声明模式.pattern)
        start = m.end() - 1        # 指向 '{'
        depth = 0
        i = start
        while i < len(html):
            c = html[i]
            if c == '{':
                depth += 1
            elif c == '}':
                depth -= 1
                if depth == 0:
                    break
            i += 1
        else:
            raise RuntimeError("函数括号不配对：" + 函数声明模式.pattern)
        return html[:start] + 新函数体 + html[i+1:]
    return _patch


# ============================================================
# 本次要做的修改
# ============================================================

# ---- patch 1：把单 URL 常量换成候选列表 ----
旧_EMLET_URL = "var EMLET_URL = 'https://unpkg.com/emlet@0.1.4/dist/index.mjs';"

新_EMLET_URLS = """/* NH_EMLET_LOCAL_FIRST_V1：
       本地优先，失败回退 unpkg。
       本地路径相对 index.html 所在目录。 */
    var EMLET_URLS = [
        'js/emlet.mjs',
        'https://unpkg.com/emlet@0.1.4/dist/index.mjs'
    ];"""

# ---- patch 2：替换 loadEmlet 函数体为「逐个尝试」 ----
新_loadEmlet_体 = """{
        /* NH_EMLET_LOCAL_FIRST_V1：候选列表逐个尝试 */
        var mod = null, lastErr = null, usedUrl = null;
        for (var i = 0; i < EMLET_URLS.length; i++) {
            try {
                mod = await import(EMLET_URLS[i]);
                usedUrl = EMLET_URLS[i];
                console.log('[nh-embed] emlet 已加载：' + usedUrl);
                break;
            } catch (e) {
                lastErr = e;
                console.warn('[nh-embed] emlet 加载失败：'
                             + EMLET_URLS[i] + ' —— ' + e.message);
            }
        }
        try {
            if (!mod) throw (lastErr || new Error('all emlet sources failed'));
            var emlet = mod.emlet || mod.default;
            if (!emlet || typeof emlet.embed !== 'function') {
                throw new Error('emlet.embed not found');
            }
            window.__nhEmbed = emlet;
            _emletReady = true;
            window.__nhEmbedReady = true;
            window.__nhEmbedLoading = false;
            window.__nhEmbedSource = usedUrl;

            /* 预热：给每个 intent 的样本算向量，缓存起来 */
            await precomputeIntentVectors();
            try { document.dispatchEvent(new CustomEvent('nh:embed-ready')); } catch (e) {}
        } catch (err) {
            console.log('[nh-embed] emlet 全部加载失败，退回关键词引擎:', err.message);
            window.__nhEmbedReady = false;
            window.__nhEmbedLoading = false;
            try { document.dispatchEvent(new CustomEvent('nh:embed-failed')); } catch (e) {}
        }
    }"""

函数声明_LOADEMLET = re.compile(r"async\s+function\s+loadEmlet\s*\(\s*\)\s*\{")


PATCHES = [
    (
        "emlet URL 常量 → 候选列表（本地优先 + unpkg 回退）",
        替换(旧_EMLET_URL, 新_EMLET_URLS)
    ),
    (
        "loadEmlet 改为逐个尝试候选源",
        替换函数体(函数声明_LOADEMLET, 新_loadEmlet_体)
    ),
]


# ============================================================
# changelog 注释块的生成与插入
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
        pos = m.end()
        return html[:pos] + "\n" + block + html[pos:]
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