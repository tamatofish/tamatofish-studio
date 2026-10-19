# -*- coding: utf-8 -*-
import os
import shutil
from datetime import datetime

# ==========================================
# NH_REDESIGN_FIX_V178
# 本次修复：
# 修复字数0变动的BUG，直接对裸文本进行样式注入。
# ==========================================

FILENAME = 'index.html'

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

def force_fix_text(html):
    # 极其醒目的样式：大红字、加粗、居中、发光
    style_str = 'color:#e63946; font-size:28px; font-weight:900; text-align:center; margin: 30px 0; text-shadow: 0 0 15px rgba(230,57,70,0.5); letter-spacing: 8px; display:block;'
    
    count = 0
    
    # 把「我」、「会」、「记得你」强行用 <span> 包裹
    # 注意：只替换带「」括号的，防止把剧情里正常的“我”也变红
    def replace_text(text, target):
        nonlocal count
        if target in text:
            # 检查是否已经被替换过，防止重复嵌套
            if f'<span style="{style_str}">{target}</span>' in text:
                return text
            count += text.count(target)
            return text.replace(target, f'<span style="{style_str}">{target}</span>')
        return text

    # 1. 替换「我」（这里小心，如果有 `&lt;span&gt;` 的转义，最好连带着一起清掉）
    html = html.replace('&lt;span style="color:#e63946; font-size:24px; font-weight:bold; text-align:center; margin: 30px 0; text-shadow: 0 0 10px rgba(230,57,70,0.4); letter-spacing: 4px;"&gt;「我」&lt;/span&gt;', '「我」')
    html = replace_text(html, '「我」')
    
    # 2. 替换「会」
    html = html.replace('&lt;span style="color:#e63946; font-size:24px; font-weight:bold; text-align:center; margin: 30px 0; text-shadow: 0 0 10px rgba(230,57,70,0.4); letter-spacing: 4px;"&gt;「会」&lt;/span&gt;', '「会」')
    html = replace_text(html, '「会」')
    
    # 3. 替换「记得你」
    html = html.replace('&lt;span style="color:#e63946; font-size:24px; font-weight:bold; text-align:center; margin: 30px 0; text-shadow: 0 0 10px rgba(230,57,70,0.4); letter-spacing: 4px;"&gt;「记得你」&lt;/span&gt;', '「记得你」')
    html = replace_text(html, '「记得你」')

    return html, count

def main():
    if not os.path.exists(FILENAME):
        print(f"[!] 错误：找不到文件 {FILENAME}")
        return

    print(f"[*] 开始处理 {FILENAME} ...")
    original_html = read_file(FILENAME)
    original_len = len(original_html)
    
    backup_file(FILENAME)
    
    modified_html, count = force_fix_text(original_html)
    
    if count > 0:
        print(f"[+] 成功！共找到并修改了 {count} 处碎片文本，已强行注入大红字样式。")
    else:
        print("[!] 依然没找到「我」、「会」、「记得你」的文本。")
    
    new_len = len(modified_html)
    write_file(FILENAME, modified_html)
    print(f"[*] 字数变动：{original_len} -> {new_len}")
    print("[*] 请回浏览器强制刷新 (Ctrl + F5) 查看效果。")

if __name__ == '__main__':
    main()