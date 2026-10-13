export function localizeHero(host) {
  if (document.documentElement.lang !== 'zh-CN') return;
  const copy = {'Products':'产品','Resources':'资源','Pricing':'套餐','Careers':'加入我们','Log in':'登录','Join Suno for free':'免费开始创作','Join Suno for Free':'免费开始创作','Overview':'产品概览','V6 Models':'V6 音乐模型','Studio':'音乐工作台','Voices':'人声录制 Voices','Stem Separation':'分轨','Remix':'重混','Custom Models':'自定义模型','Our Latest Model':'最新音乐模型','Introducing the v6 family.':'认识 V6 模型家族','It’s our most powerful model yet, and there’s more than just one.':'我们迄今最强大的音乐模型，带来更多创作可能。','Be a control freak.':'掌控每一处声音','A browser-based DAW for arranging, editing and mixing every part of a song until it is exactly yours.':'在浏览器中编曲、编辑和混音，让歌曲的每一部分都成为你的表达。','Company':'关于 Suno','About':'关于我们','Blog':'博客','Release Notes':'更新日志','Safety':'安全','Community Guidelines':'社区准则','Contact Us':'联系我们','Help':'帮助中心','Latest news':'最新动态','See all ↗':'查看全部 ↗','5 Albums You Can’t Miss':'五张不容错过的专辑','Discover some of the first albums on Suno.':'发现 Suno 创作者的首批专辑。','Introducing Speech (beta)':'认识语音功能（测试版）','A new way to express yourself creatively':'用全新的方式表达创意','Three Must-learn Tips for Using EQ':'三个实用的均衡器技巧','Get started with Suno Studio.':'开始使用 Suno Studio。','AI music app':'AI 音乐应用','Android':'安卓'};
  function translate() {
    const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode, key = node.textContent.trim();
      if (copy[key]) node.textContent = node.textContent.replace(key, copy[key]);
    }
  }
  host.querySelector('.hero-line').innerHTML = '<span class="vibrant-line">下一首让你心动的歌，</span><span class="vibrant-line">可以由你创作。</span><span class="hero-line-lift" aria-hidden="true"><span class="vibrant-line">下一首让你心动的歌，</span><span class="vibrant-line">可以由你创作。</span></span>';
  translate();
  new MutationObserver(translate).observe(host.querySelector('.site-header'), {childList:true,subtree:true,characterData:true});
}
export function setupFontPanel(host) {
  if (document.documentElement.lang !== 'zh-CN') return;
  const style = document.createElement('style');
  style.textContent = `@import url("https://fontsapi.zeoseven.com/551/main/result.css");
@import url("https://fontsapi.zeoseven.com/268/main/result.css");
@import url("https://fontsapi.zeoseven.com/880/main/result.css");
@import url("https://fontsapi.zeoseven.com/642/main/result.css");
@scope (#hero-experience) { .hero-line {font-family:var(--zh-title-font);font-weight:var(--zh-title-weight);font-synthesis:weight;line-height:1.35;letter-spacing:0} }
@scope (:root) to (#hero-experience) { :scope:lang(zh-CN) #main > section h2 {font-family:var(--zh-title-font);font-weight:var(--zh-title-weight);font-synthesis:weight} }
@scope (.capabilities) { :scope:lang(zh-CN) h2 {font-family:var(--zh-title-font);font-weight:var(--zh-title-weight);font-synthesis:weight} }
html[lang="zh-CN"] #hero-experience .motion-tools {display:none!important}
html[lang="zh-CN"] #hero-experience .settings-panel:not([hidden]) {display:none!important}
#font-panel select {width:100%;padding:10px;margin:8px 0 20px;background:#29252b;color:white;border:1px solid #ffffff30;border-radius:8px;font:inherit}
`;
  document.head.append(style);
  const root = document.documentElement.style;
  root.setProperty('--zh-title-font','"Neue Montreal", "PingFang SC", sans-serif');
  host.querySelector('.hero-line').style.fontFamily='"Editorial New", "PingFang SC", serif';
  root.setProperty('--zh-title-weight','300');
  const tools=host.querySelector('.motion-tools'), tab=document.createElement('button'), panel=document.createElement('section');
  tab.id='toggle-font'; tab.textContent='字体切换 ＋'; tab.setAttribute('aria-controls','font-panel'); tab.setAttribute('aria-expanded','false'); tools.append(tab);
  panel.id='font-panel'; panel.className='settings-panel'; panel.hidden=true;
  Object.assign(panel.style,{position:'fixed',left:'16px',bottom:'74px',zIndex:'101',width:'min(310px, calc(100vw - 32px))'});
  panel.innerHTML='<div class="settings-heading"><h2>字体切换</h2></div><label for="title-font">标题字体</label><select id="title-font"><option value="original" selected>原本字体</option><option>B2 Hana</option><option>Nyushu Firmia</option><option>NanxiChuxiasong</option><option>ChillDINGothic</option></select><label for="title-weight">字重</label><select id="title-weight">'+[100,200,300,400,500,600,700,800,900].map(w=>`<option value="${w}" ${w===300?'selected':''}>${w}</option>`).join('')+'</select><p style="font-size:11px;color:#b5adb9">字体缺少对应字重时，由浏览器合成；部分字重的效果可能相同。</p>';
  host.append(panel);
  panel.addEventListener('change',()=>{
    const font=panel.querySelector('#title-font').value,weight=panel.querySelector('#title-weight').value;
    if(font==='original') {root.setProperty('--zh-title-font','"Neue Montreal", "PingFang SC", sans-serif');host.querySelector('.hero-line').style.fontFamily='"Editorial New", "PingFang SC", serif';}
    else {root.setProperty('--zh-title-font',`"${font}", "PingFang SC", sans-serif`);host.querySelector('.hero-line').style.removeProperty('font-family');}
    root.setProperty('--zh-title-weight',weight);
  });
  tools.addEventListener('click',e=>{
    const button=e.target.closest('button[aria-controls]'); if(!button)return;
    if(button===tab){panel.hidden=!panel.hidden;tab.setAttribute('aria-expanded',String(!panel.hidden));}
    else {panel.hidden=true;tab.setAttribute('aria-expanded','false');}
    if(button===tab) host.querySelectorAll('.settings-panel').forEach(p=>{if(p!==panel)p.hidden=true;});
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){panel.hidden=true;tab.setAttribute('aria-expanded','false');}});
}
