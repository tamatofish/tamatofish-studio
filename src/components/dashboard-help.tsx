'use client';

const FAQ = [
  {
    q: '如何提交合作意向？',
    a: '在左侧点击「合作意向」，填写主题与需求描述后提交，工作室会在 1-3 个工作日内通过你留的联系方式回复。',
  },
  {
    q: '为什么我的意向没有回复？',
    a: '请确认已填写有效的联系方式。如果长时间未回复，可在「问题反馈」中提醒我们。',
  },
  {
    q: '如何修改我的档案信息？',
    a: '点击左侧「我的档案」，修改后点「保存档案」。称呼为必填项。',
  },
  {
    q: '我的信息会被公开吗？',
    a: '不会。你提交的档案与合作意向仅工作室内部可见，不会对外公开。',
  },
  {
    q: '遇到 Bug 或想提建议怎么办？',
    a: '点击左侧「问题反馈」，选择分类并描述问题，我们会尽快处理。',
  },
];

export function DashboardHelp() {
  return (
    <div className="space-y-6">
      <div className="border border-[#e3e4e8] bg-white">
        <div className="border-b border-[#e3e4e8] px-7 py-5">
          <h2 className="text-sm font-light tracking-[0.2em] text-[#1b1c1e]">使用帮助</h2>
          <p className="mt-1 text-xs font-light text-[#9b9ea4]">常见问题与联系方式</p>
        </div>
        <div className="divide-y divide-[#f0f1f3]">
          {FAQ.map((item, i) => (
            <div key={i} className="px-7 py-5">
              <p className="text-sm font-light text-[#1b1c1e]">
                <span className="mr-2 text-[#e8704a]">Q{i + 1}</span>
                {item.q}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-xs font-light leading-6 text-[#85888e]">{item.a}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="border border-[#e3e4e8] bg-white p-7">
        <h3 className="text-xs font-light tracking-[0.25em] text-[#85888e]">联系我们</h3>
        <div className="mt-4 space-y-2 text-xs font-light text-[#55585e]">
          <p>邮箱：<span className="text-[#1b1c1e]">contact@tamatofish.top</span></p>
          <p>工作时间：周一至周五 10:00 - 19:00</p>
          <p className="text-[#9b9ea4]">如需紧急联系，请通过「问题反馈」注明「紧急」。</p>
        </div>
      </div>
    </div>
  );
}