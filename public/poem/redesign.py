# -*- coding: utf-8 -*-
import os
import re
import shutil
from datetime import datetime

FILENAME = 'index.html'

# ==========================================
# 带有内部样式的帖子内容
# ==========================================

# 通用内部样式，保证在外部样式表丢失时也能正常显示
FORUM_CSS = """
<style>
.qd-wrap { max-width: 880px; margin: 0 auto; font-family: "微软雅黑", sans-serif; color: #333; background: #f7f4ec; padding-bottom: 40px; }
.qd-topbar { background: #4a5a6a; color: #e8eef4; padding: 18px 28px; border-bottom: 3px solid #2a3a4a; }
.qd-logo { font-size: 22px; letter-spacing: 4px; font-weight: 600; }
.qd-sub { font-size: 12px; opacity: 0.75; margin-top: 4px; letter-spacing: 1px; font-family: Consolas, monospace; }
.qd-nav { background: #fff; border-bottom: 1px solid #e0d8c8; padding: 0 20px; display: flex; }
.qd-nav-item { padding: 10px 18px; font-size: 13.5px; color: #666; }
.qd-nav-item a { color: #2a4a6a; text-decoration: none; cursor: pointer; }
.qd-nav-item a:hover { color: #8b0000; text-decoration: underline; }
.qd-body { padding: 20px; }
.qd-main { background: #fff; border: 1px solid #e0d8c8; border-radius: 3px; padding: 20px 24px; }
.qd-thread-title { font-size: 18px; color: #2a4a6a; font-weight: 600; line-height: 1.5; margin-bottom: 8px; }
.qd-thread-meta { font-size: 12px; color: #999; padding-bottom: 12px; border-bottom: 1px solid #e8e0d0; margin-bottom: 18px; font-family: Consolas, monospace; }
.qd-floor { display: flex; gap: 16px; padding: 16px 0; border-bottom: 1px dashed #f0e8d8; }
.qd-floor:last-of-type { border-bottom: none; }
.qd-floor-l { flex: 0 0 80px; text-align: center; }
.qd-floor-avatar { width: 48px; height: 48px; background: #4a5a6a; color: #fff; border-radius: 3px; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 18px; margin: 0 auto 6px; }
.qd-floor-name { font-size: 12px; color: #4a5a6a; word-break: break-all; }
.qd-floor-r { flex: 1; min-width: 0; }
.qd-floor-head { font-size: 11.5px; color: #999; margin-bottom: 8px; font-family: Consolas, monospace; }
.qd-floor-body { font-size: 14px; line-height: 1.9; color: #333; }
.qd-floor-body p { margin: 0 0 6px; }
</style>
"""

CONTENT_LOSSLINE = FORUM_CSS + """<div class="qd-wrap">
  <div class="qd-topbar">
    <div class="qd-logo">泉都论坛</div>
    <div class="qd-sub">悬案疑云 · 帖子详情</div>
  </div>
  <div class="qd-nav">
    <span class="qd-nav-item"><a data-passage="泉都论坛" class="link-internal">← 返回首页</a></span>
  </div>
  <div class="qd-body">
    <div class="qd-main">
      <div class="qd-thread-title">【整理】南华大学失联案 · 时间线（2015）</div>
      <div class="qd-thread-meta">楼主：ARC-CC | 2020-09-15 03:14 | 查看 2103 | 回复 31</div>
      
      <div class="qd-floor">
        <div class="qd-floor-l"><div class="qd-floor-avatar">A</div><div class="qd-floor-name">ARC-CC</div></div>
        <div class="qd-floor-r">
          <div class="qd-floor-head">1 楼 · 2020-09-15 03:14</div>
          <div class="qd-floor-body">
            <p>我花了整整三天，把当年所有能找到的公开资料、贴吧截图、甚至报纸边角料都翻出来了。</p>
            <p>结合前几帖的线索，我重新排了一下那晚的时间轴：</p>
            <br>
            <p><b>【22:13】</b> 监控显示，6个人进入旧教学楼地下室B102。注意，门禁记录的是5个人，但监控里是6个人影。</p>
            <p><b>【22:21】</b> 门开了，跑出来5个人。监控里，门内还站着一个黑影，没有跟着出来。</p>
            <p><b>【22:26】</b> 监控信号开始受到严重干扰，画面出现雪花。走廊尽头出现人影，在靠近镜头。</p>
            <p><b>【22:47】</b> 火警触发。消防车抵达。</p>
            <br>
            <p>这里有一个<strong>巨大的时间断层</strong>：从22:26到22:47，整整二十分钟，那个“没出来的黑影”在做什么？那5个跑出来的人，又为什么没有立刻报警？</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>"""

CONTENT_SIXTH = FORUM_CSS + """<div class="qd-wrap">
  <div class="qd-topbar">
    <div class="qd-logo">泉都论坛</div>
    <div class="qd-sub">悬案疑云 · 帖子详情</div>
  </div>
  <div class="qd-nav">
    <span class="qd-nav-item"><a data-passage="泉都论坛" class="link-internal">← 返回首页</a></span>
  </div>
  <div class="qd-body">
    <div class="qd-main">
      <div class="qd-thread-title">【分析】5 个人还是 6 个人？我数了三遍</div>
      <div class="qd-thread-meta">楼主：ARC-CC | 2020-09-15 03:41 | 查看 947 | 回复 18</div>
      
      <div class="qd-floor">
        <div class="qd-floor-l"><div class="qd-floor-avatar">A</div><div class="qd-floor-name">ARC-CC</div></div>
        <div class="qd-floor-r">
          <div class="qd-floor-head">1 楼 · 2020-09-15 03:41</div>
          <div class="qd-floor-body">
            <p>你们有没有想过，为什么官方通报上只有5个人失联？</p>
            <p>林晚、张昊、王佳、李阳、赵晓。这是当年的5人名单。南大校史、市志、当年的报纸，全都是这5个名字。</p>
            <br>
            <p>但是，在2015年9月18日，也就是火灾发生后的第三天，南大内网发生了一次极不正常的<b>“学籍封存”</b>操作。</p>
            <p>这5个人被封存了。但是，封存记录的总数，是<b>6</b>。</p>
            <p>第6个学号是 2015010462。这个人在所有的系统里都被删得干干净净，连失踪名单上都没有她。</p>
            <p>可是，图书馆的借阅记录里，有她。文学社的招新公示里，有她。甚至那份没有署名的《第七首诗》，也是她写的。</p>
            <br>
            <p>她叫<b>苏言</b>。</p>
            <p>为什么要把一个死去的受害者，从档案里彻底抹除？那5个人，到底在怕什么？</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>"""

CONTENT_FIRE = FORUM_CSS + """<div class="qd-wrap">
  <div class="qd-topbar">
    <div class="qd-logo">泉都论坛</div>
    <div class="qd-sub">悬案疑云 · 帖子详情</div>
  </div>
  <div class="qd-nav">
    <span class="qd-nav-item"><a data-passage="泉都论坛" class="link-internal">← 返回首页</a></span>
  </div>
  <div class="qd-body">
    <div class="qd-main">
      <div class="qd-thread-title">【分析】那场火，不可能是意外</div>
      <div class="qd-thread-meta">楼主：ARC-CC | 2020-09-15 04:07 | 查看 1287 | 回复 24</div>
      
      <div class="qd-floor">
        <div class="qd-floor-l"><div class="qd-floor-avatar">A</div><div class="qd-floor-name">ARC-CC</div></div>
        <div class="qd-floor-r">
          <div class="qd-floor-head">1 楼 · 2020-09-15 04:07</div>
          <div class="qd-floor-body">
            <p>那天的《消防事故调查报告》我搞到了一份复印件。</p>
            <p>官方的结论是“电路老化，引燃旧报纸”。但这根本经不起推敲。</p>
            <p>第一，地下室是密集书库，常年阴冷潮湿，旧报纸怎么可能那么巧就在那天晚上被电火花引燃？</p>
            <p>第二，事后那5个学生的笔录，口径太一致了。警察问什么，他们就答什么，情绪异常稳定，连字句都不带差的。像是提前排练过。</p>
            <p>第三，如果真的是意外，为什么跑出来的5个人，要把苏言的存在彻底抹杀掉？</p>
            <br>
            <p>我倾向于认为：当晚在地下室，发生了一场激烈的争执。那场火，大概率是在争执中，有人碰倒了电线，或者……有人故意点燃了那些诗稿。</p>
            <p>那5个人跑了。把门锁了。把苏言留在了里面。</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>"""

CONTENT_TEACHER = FORUM_CSS + """<div class="qd-wrap">
  <div class="qd-topbar">
    <div class="qd-logo">泉都论坛</div>
    <div class="qd-sub">悬案疑云 · 帖子详情</div>
  </div>
  <div class="qd-nav">
    <span class="qd-nav-item"><a data-passage="泉都论坛" class="link-internal">← 返回首页</a></span>
  </div>
  <div class="qd-body">
    <div class="qd-main">
      <div class="qd-thread-title">【分析】那个"沉默"的老师</div>
      <div class="qd-thread-meta">楼主：ARC-CC | 2020-09-15 04:33 | 查看 421 | 回复 9</div>
      
      <div class="qd-floor">
        <div class="qd-floor-l"><div class="qd-floor-avatar">A</div><div class="qd-floor-name">ARC-CC</div></div>
        <div class="qd-floor-r">
          <div class="qd-floor-head">1 楼 · 2020-09-15 04:33</div>
          <div class="qd-floor-body">
            <p>大家一直忽略了一个人。陈默，文学社的指导老师。</p>
            <p>案发那晚，他不在学校。警方对他的调查也很快就结束了。因为他既不是失联者，也不是嫌疑人。</p>
            <p>但是，他的档案里存在极大的矛盾：</p>
            <p>2015年9月，他短暂担任了文学社的指导老师，不到两个月就离职了，原因是“个人原因”。</p>
            <p>他走得很急，几乎是逃离了南华大学。但可怕的是，他留在内网的账号，却从未真正注销。</p>
            <br>
            <p>系统日志记录，每年的9月15日，那个账号都会自动登入一次。</p>
            <p>停留时间：<b>1分17秒</b>。</p>
            <p>他只访问一个页面：<b>旧教学楼失火</b>。</p>
            <br>
            <p>他为什么每年都要回来看一眼？他在内疚什么？</p>
            <p>或者，这份档案的记录人不是他，而是某个“使用他账号”的存在？</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>"""


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

def replace_passage_content(html, passage_name, new_content):
    # 匹配 <tw-passagedata ... name="passage_name" ...>...</tw-passagedata>
    pattern = re.compile(
        r'(<tw-passagedata[^>]*name="' + re.escape(passage_name) + r'"[^>]*>)(.*?)(</tw-passagedata>)',
        re.DOTALL
    )
    
    # 替换前先编码 HTML 实体（因为原文件中的内容是经过编码的）
    new_content_encoded = (new_content
                           .replace('&', '&amp;')
                           .replace('<', '&lt;')
                           .replace('>', '&gt;')
                           .replace('"', '&quot;'))
    
    def replacer(match):
        return match.group(1) + new_content_encoded + match.group(3)
    
    new_html, count = pattern.subn(replacer, html)
    if count == 0:
        print(f"[!] 警告：未找到 passage '{passage_name}'，请检查名称是否正确。")
    else:
        print(f"[+] 成功替换 passage '{passage_name}' 的内容 (共 {count} 处)。")
    return new_html

def main():
    if not os.path.exists(FILENAME):
        print(f"[!] 错误：找不到文件 {FILENAME}，请确保脚本与 index.html 在同一目录下。")
        return

    print(f"[*] 开始处理 {FILENAME} ...")
    
    # 1. 读取原文件
    original_html = read_file(FILENAME)
    original_len = len(original_html)
    
    # 2. 备份文件
    backup_file(FILENAME)
    
    # 3. 执行替换
    modified_html = original_html
    replacements = [
        ("失联时间线", CONTENT_LOSSLINE),
        ("第六个人", CONTENT_SIXTH),
        ("意外？", CONTENT_FIRE),
        ("名如其人", CONTENT_TEACHER)
    ]
    
    for name, content in replacements:
        modified_html = replace_passage_content(modified_html, name, content)
        
    # 4. 计算字数变动
    new_len = len(modified_html)
    diff = new_len - original_len
    diff_str = f"+{diff}" if diff >= 0 else str(diff)
    
    # 5. 插入 Changelog
    changelog = f"""<!--
  NH_REDESIGN_FIX_CHANGELOG_V121
  =============================
  生成时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
  本次（redesign.py V121）修复清单：

  1] 修复泉都论坛四个分析帖子内容完全重复的问题
     · 症状：在【泉都论坛】首页点击“失联时间线”、“第六个人”、
             “意外？”、“名如其人”四个帖子，进入后内容一模一样。
     · 原因：之前生成时，这四个 passage 的内部 HTML 被错误地
             全量复制成了同一段主帖内容。
     · 修复：提取这四个 passage，分别替换为符合当前标题的
             独立剧情正文内容（时间轴推理、人数论证、人为纵火
             分析、陈默暗线）。
  2] 修复论坛帖子样式丢失问题
     · 为防止外部动态注入样式失效导致页面裸奔，在四个帖子的
       HTML 内部直接注入了基础的 CSS 样式。

  文本字数变动：
    · 原 index.html 字符数：{original_len}
    · 新 index.html 字符数：{new_len}
    · 净变动：{diff_str}
-->

"""
    # 查找 <head> 标签并在其后插入（或者插在文件最前面）
    if '<!DOCTYPE html>' in modified_html:
        modified_html = modified_html.replace('<!DOCTYPE html>', '<!DOCTYPE html>\n' + changelog, 1)
    else:
        modified_html = changelog + modified_html
        
    # 6. 保存新文件
    write_file(FILENAME, modified_html)
    print(f"[+] 文件修改完成！")
    print(f"[*] 字数变动：{original_len} -> {new_len} ({diff_str})")

if __name__ == '__main__':
    main()