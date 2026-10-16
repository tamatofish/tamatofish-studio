import os, re, shutil, datetime

PATH = 'index.html'

backup_dir = os.path.join(os.path.dirname(os.path.abspath(PATH)), 'backups')
os.makedirs(backup_dir, exist_ok=True)
ts = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
backup_path = os.path.join(backup_dir, f'index_backup_{ts}.html')
shutil.copy2(PATH, backup_path)
print(f'[backup] {backup_path}')

with open(PATH, 'r', encoding='utf-8') as f:
    html = f.read()
old_len = len(html)

def check_ok(html, label):
    ifs = html.count('&lt;&lt;if ')
    endifs = html.count('&lt;&lt;/if&gt;&gt;')
    print(f'  [{label}] if={ifs}/{endifs}')
    return ifs == endifs

if not check_ok(html, 'start'):
    raise SystemExit(1)

# ============ 找 泉都论坛 passage 里的 style，改 qd-body 的 CSS ============
# 找那个 &lt;style&gt; 里的 .qd-body { ... }
# 替换为 grid-column 强约束

old_qd_body = '.qd-body {\n  max-width: 1200px;\n  margin: 0 auto;\n  padding: 12px 16px;\n  display: grid;\n  grid-template-columns: 1fr 220px;\n  gap: 12px;\n}'

new_qd_body = '''.qd-body {
  max-width: 1200px;
  margin: 0 auto;
  padding: 12px 16px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 220px;
  gap: 12px;
}
.qd-body > .qd-left { grid-column: 1; grid-row: 1; }
.qd-body > .qd-right { grid-column: 2; grid-row: 1; }'''

if old_qd_body in html:
    html = html.replace(old_qd_body, new_qd_body, 1)
    print('[1] 替换 .qd-body CSS ✅')
else:
    # 宽松匹配
    pattern = re.compile(
        r'\.qd-body\s*\{[^}]*\}',
        re.DOTALL
    )
    m = pattern.search(html)
    if m:
        print(f'[1] 找到 .qd-body，原内容：{m.group(0)[:200]}')
        html = html[:m.start()] + new_qd_body + html[m.end():]
        print('[1] 替换 ✅')
    else:
        print('[1] WARN: 找不到 .qd-body')

if not check_ok(html, 'after'):
    shutil.copy2(backup_path, PATH); raise SystemExit(1)

new_len = len(html)
delta = new_len - old_len
delta_str = f'+{delta}' if delta > 0 else str(delta)
print(f'[main] 净变动：{delta_str}')

with open(PATH, 'w', encoding='utf-8') as f:
    f.write(html)

print('[main] done')