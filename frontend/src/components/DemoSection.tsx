'use client'
import { useEffect } from 'react'

export function DemoSection() {
  useEffect(() => {
    ;(function(){
    'use strict';

    const B: Record<string, [number, number]> = {
      labelIn: [0.00, 0.04],
      connect: [0.04, 0.24],
      chatIn:  [0.24, 0.30],
      mA0:     [0.30, 0.40],
      mA:      [0.40, 0.50],
      mB:      [0.50, 0.58],
      reading: [0.58, 0.68],
      mC:      [0.68, 0.80],
      cta:     [0.80, 1.00],
    };

    const DOT_BEATS = ['connect','mA0','mA','mB','reading','mC','cta'];
    const dotsWrap = document.getElementById('scrollProgress');
    if (!dotsWrap) return;
    dotsWrap.innerHTML = '';
    DOT_BEATS.forEach((_,i)=>{
      const d=document.createElement('div');
      d.className='sp-dot'; d.id='spd'+i;
      dotsWrap.appendChild(d);
    });

    function lerp(a: number, b: number, t: number){ return a+(b-a)*t; }

    function updateClock(){
      const n=new Date(),h=n.getHours()%12||12,m=String(n.getMinutes()).padStart(2,'0');
      const t=h+':'+m;
      const st = document.getElementById('stime');
      const ct = document.getElementById('ctime');
      if (st) st.textContent=t;
      if (ct) ct.textContent=t;
    }
    updateClock(); setInterval(updateClock,30000);

    const last: Record<string, any> = {
      labelShow:false,
      ci:[false,false,false], cl:[false,false],
      connectDone:false, connectGone:false,
      chatOn:false,
      mA0:false, mA:false, mB:false, reading:false, mC:false,
      ctaShow:false, activeDot:-1,
    };

    function render(p: number){
      const labelShow = p >= B.labelIn[0];
      if(labelShow !== last.labelShow){
        document.getElementById('stageLabel')?.classList.toggle('show', labelShow);
        last.labelShow = labelShow;
      }

      const connectRange = B.connect[1] - B.connect[0];
      const slotW = connectRange / 3;

      for(let i=0;i<3;i++){
        const iconStart  = B.connect[0] + i * slotW;
        const checkStart = iconStart + slotW * 0.4;
        const lineStart  = iconStart + slotW * 0.6;
        const iconShow  = p >= iconStart;
        const checkShow = p >= checkStart;
        const lineShow  = i < 2 && p >= lineStart;

        if(iconShow !== last.ci[i]){
          document.getElementById('ci'+i)?.classList.toggle('show', iconShow);
          last.ci[i] = iconShow;
        }
        document.getElementById('ci'+i)?.classList.toggle('connected', checkShow);
        if(i < 2 && lineShow !== last.cl[i]){
          document.getElementById('cl'+i)?.classList.toggle('on', lineShow);
          last.cl[i] = lineShow;
        }
      }

      const allConnected = p >= B.connect[0] + slotW * 2.4;
      const statusEl = document.getElementById('connectStatus');
      if(statusEl && allConnected !== last.connectDone){
        statusEl.textContent = allConnected ? 'all connected \u2713' : 'connecting\u2026';
        statusEl.classList.toggle('done', allConnected);
        last.connectDone = allConnected;
      }

      const connectGone = p >= B.chatIn[1];
      if(connectGone !== last.connectGone){
        document.getElementById('connectScreen')?.classList.toggle('gone', connectGone);
        last.connectGone = connectGone;
      }

      const chatOn = p >= lerp(B.chatIn[0], B.chatIn[1], 0.4);
      if(chatOn !== last.chatOn){
        document.getElementById('chatScreen')?.classList.toggle('on', chatOn);
        last.chatOn = chatOn;
      }

      const mA0     = p >= B.mA0[0];
      const mA      = p >= B.mA[0];
      const mB      = p >= B.mB[0];
      const reading = p >= B.reading[0] && p < B.mC[0];
      const mC      = p >= B.mC[0];
      const ctaShow = p >= B.cta[0];

      if(mA0 !== last.mA0){ document.getElementById('mA0')?.classList.toggle('v', mA0); last.mA0=mA0; }
      if(mA  !== last.mA ){ document.getElementById('mA')?.classList.toggle('v', mA);   last.mA=mA;   }
      if(mB  !== last.mB ){ document.getElementById('mB')?.classList.toggle('v', mB);   last.mB=mB;   }
      if(reading !== last.reading){ document.getElementById('readingRow')?.classList.toggle('v', reading); last.reading=reading; }
      if(mC  !== last.mC ){ document.getElementById('mC')?.classList.toggle('v', mC);   last.mC=mC;   }
      if(ctaShow !== last.ctaShow){ document.getElementById('ctaWrap')?.classList.toggle('v', ctaShow); last.ctaShow=ctaShow; }

      const dotStarts = DOT_BEATS.map(k => B[k][0]);
      let activeDot = -1;
      dotStarts.forEach((s,i)=>{ if(p>=s) activeDot=i; });
      if(activeDot !== last.activeDot){
        dotsWrap!.classList.toggle('show', p > 0.01);
        DOT_BEATS.forEach((_,i)=>{
          const d=document.getElementById('spd'+i);
          if(!d)return;
          d.classList.remove('active','done');
          if(i < activeDot) d.classList.add('done');
          else if(i === activeDot) d.classList.add('active');
        });
        last.activeDot = activeDot;
      }
    }

    const track = document.getElementById('demoTrack');
    if (!track) return;
    function getProgress(){
      const rect=track!.getBoundingClientRect();
      const scrolled=-rect.top;
      return Math.max(0,Math.min(1,scrolled/(track!.offsetHeight-window.innerHeight)));
    }
    window.addEventListener('scroll',()=>render(getProgress()),{passive:true});
    render(getProgress());

    })();
  }, [])

  const feedBubbles = [
    { dir: 'r', ava: 'g2', text: 'see you at 5?' },
    { dir: 's', ava: 'g1', text: 'yeah for sure' },
    { dir: 'r', ava: 'g3', text: 'pls pay me back \ud83d\ude2d' },
    { dir: 's', ava: 'g1', text: 'venmo me' },
    { dir: 'r', ava: 'g4', text: 'meet at 10?' },
    { dir: 'r', ava: 'g2', text: 'make sure q3 is done' },
    { dir: 's', ava: 'g1', text: 'on it' },
    { dir: 'r', ava: 'g3', text: 'i need help with the slides' },
    { dir: 'r', ava: 'g4', text: 'can you hop on a call?' },
    { dir: 's', ava: 'g1', text: '5 mins' },
    { dir: 'r', ava: 'g2', text: 'deadline moved to friday' },
    { dir: 's', ava: 'g1', text: 'got it, thanks' },
    { dir: 'r', ava: 'g3', text: 'lunch today?' },
    { dir: 'r', ava: 'g4', text: "what's your status on the report" },
    { dir: 's', ava: 'g1', text: 'almost done' },
  ]

  const renderFeed = () => [...feedBubbles, ...feedBubbles].map((b, i) => (
    <div key={i} className={`feed-bubble ${b.dir}`}>
      <div className={`feed-ava ${b.ava}`}></div>
      <div className={`feed-text f${b.dir}`}>{b.text}</div>
    </div>
  ))

  return (
    <>
      <div className="demo-track" id="demoTrack">
        <div className="sticky-stage" id="stickyStage">
          <div className="stage-label" id="stageLabel">
            <h2>Every app collects your life.</h2>
            <p>Nudge gives it back.</p>
          </div>

          <div className="frame-outer">
            <div className="frame-inner">
              <div className="phone" id="phone">
                <div className="status-bar">
                  <div className="di"></div>
                  <span id="stime">9:41</span>
                  <div className="sicons">
                    <svg width="15" height="11" viewBox="0 0 15 11" fill="#fff"><rect x="0" y="4" width="3" height="7" rx="0.5"/><rect x="4" y="2.5" width="3" height="8.5" rx="0.5"/><rect x="8" y="0.5" width="3" height="10.5" rx="0.5"/><rect x="12" y="0" width="3" height="11" rx="0.5" opacity="0.3"/></svg>
                    <svg width="13" height="10" viewBox="0 0 13 10" fill="#fff"><path d="M6.5 2C8.5 2 10.3 2.9 11.5 4.3L12.6 3.2C11.1 1.6 9 .6 6.5.6S1.9 1.6.4 3.2L1.5 4.3C2.7 2.9 4.5 2 6.5 2z"/><path d="M6.5 5c1.3 0 2.5.5 3.3 1.4L11 5.2C9.9 4 8.3 3.2 6.5 3.2S3.1 4 2 5.2L3.2 6.4C4 5.5 5.2 5 6.5 5z"/><circle cx="6.5" cy="8.5" r="1.5"/></svg>
                    <svg width="23" height="11" viewBox="0 0 23 11" fill="none"><rect x=".5" y=".5" width="19" height="10" rx="3" stroke="#fff" strokeOpacity=".4"/><rect x="2" y="2" width="14" height="7" rx="1.5" fill="#fff"/><path d="M21 3.5v4a2 2 0 000-4z" fill="#fff" fillOpacity=".35"/></svg>
                  </div>
                </div>

                {/* CONNECT SCREEN */}
                <div className="connect-screen" id="connectScreen">
                  <div className="connect-body">
                    <div className="connect-title">nudge is connecting</div>
                    <div className="connect-icons">
                      <div className="conn-icon" id="ci0">
                        <div className="conn-app" style={{background:'#fff',borderRadius:12}}>
                          <svg viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="17" rx="2" fill="#fff" stroke="#dadce0" strokeWidth="1.2"/><rect x="3" y="7" width="18" height="2.5" fill="#4285f4"/><rect x="3" y="7" width="18" height="1" fill="#1a73e8"/><text x="12" y="18" fontSize="7" fontWeight="700" fill="#1a73e8" textAnchor="middle" fontFamily="sans-serif">28</text><line x1="8" y1="4" x2="8" y2="6.5" stroke="#5f6368" strokeWidth="1.5" strokeLinecap="round"/><line x1="16" y1="4" x2="16" y2="6.5" stroke="#5f6368" strokeWidth="1.5" strokeLinecap="round"/></svg>
                          <div className="conn-badge"><svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 3l2 2 4-4" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
                        </div>
                        <div className="conn-label">calendar</div>
                      </div>
                      <div className="conn-line" id="cl0"><div className="conn-line-fill"></div></div>
                      <div className="conn-icon" id="ci1">
                        <div className="conn-app" style={{background:'#fff',borderRadius:12}}>
                          <svg viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="4" fill="#fff"/><path d="M4 6h16v12H4z" fill="#f1f3f4"/><path d="M4 6l8 7 8-7" stroke="#ea4335" strokeWidth="1.5" fill="none"/><rect x="4" y="6" width="16" height="12" rx="1" fill="none" stroke="#dadce0" strokeWidth="1"/><path d="M4 6l8 6.5L20 6" fill="#ea4335"/></svg>
                          <div className="conn-badge"><svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 3l2 2 4-4" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
                        </div>
                        <div className="conn-label">gmail</div>
                      </div>
                      <div className="conn-line" id="cl1"><div className="conn-line-fill"></div></div>
                      <div className="conn-icon" id="ci2">
                        <div className="conn-app" style={{background:'linear-gradient(145deg,#34c759,#30b050)',borderRadius:12}}>
                          <svg viewBox="0 0 24 24" fill="none"><path d="M4 4h16a1 1 0 011 1v10a1 1 0 01-1 1H8l-4 4V5a1 1 0 011-1z" fill="#fff" fillOpacity="0.95"/></svg>
                          <div className="conn-badge"><svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 3l2 2 4-4" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
                        </div>
                        <div className="conn-label">messages</div>
                      </div>
                    </div>
                    <div className="connect-status" id="connectStatus">connecting&hellip;</div>
                  </div>
                  <div className="msg-feed-wrap">
                    <div className="msg-feed">{renderFeed()}</div>
                  </div>
                </div>

                {/* CHAT SCREEN */}
                <div className="chat-screen" id="chatScreen">
                  <div className="chat-status">
                    <div className="chat-di"></div>
                    <span id="ctime">9:41</span>
                    <div style={{display:'flex',alignItems:'center',gap:4}}>
                      <svg width="15" height="11" viewBox="0 0 15 11" fill="#000"><rect x="0" y="4" width="3" height="7" rx="0.5"/><rect x="4" y="2.5" width="3" height="8.5" rx="0.5"/><rect x="8" y="0.5" width="3" height="10.5" rx="0.5"/><rect x="12" y="0" width="3" height="11" rx="0.5" opacity="0.3"/></svg>
                      <svg width="13" height="10" viewBox="0 0 13 10" fill="#000"><path d="M6.5 2C8.5 2 10.3 2.9 11.5 4.3L12.6 3.2C11.1 1.6 9 .6 6.5.6S1.9 1.6.4 3.2L1.5 4.3C2.7 2.9 4.5 2 6.5 2z"/><path d="M6.5 5c1.3 0 2.5.5 3.3 1.4L11 5.2C9.9 4 8.3 3.2 6.5 3.2S3.1 4 2 5.2L3.2 6.4C4 5.5 5.2 5 6.5 5z"/><circle cx="6.5" cy="8.5" r="1.5"/></svg>
                      <svg width="23" height="11" viewBox="0 0 23 11" fill="none"><rect x=".5" y=".5" width="19" height="10" rx="3" stroke="#000" strokeOpacity=".35"/><rect x="2" y="2" width="14" height="7" rx="1.5" fill="#000"/><path d="M21 3.5v4a2 2 0 000-4z" fill="#000" fillOpacity=".4"/></svg>
                    </div>
                  </div>
                  <div className="chat-hdr">
                    <div className="chat-ava">{'\u2726'}</div>
                    <div className="chat-name">nudge</div>
                    <div className="chat-sub">AI Assistant &middot; iMessage</div>
                  </div>
                  <div className="msgs">
                    <div className="mrow" id="mA0">
                      <div className="mava">{'\u2726'}</div>
                      <div className="bub br" style={{fontSize:'11.5px'}}>morning. you&apos;ve got 3 things today. the one that matters: sarah at 2pm.</div>
                    </div>
                    <div className="mrow" id="mA">
                      <div className="mava">{'\u2726'}</div>
                      <div className="bub br" style={{fontSize:'11.5px'}}>you need to finish the q3 breakdown &mdash; you&apos;ve got 45 minutes at 10. that&apos;s enough.</div>
                    </div>
                    <div className="mrow sent" id="mB">
                      <div className="wb-wrap">
                        <div className="wb-img">
                          <div className="wbl a" style={{width:'70%'}}></div>
                          <div className="wbl" style={{width:'100%'}}></div>
                          <div className="wbl" style={{width:'85%'}}></div>
                          <div className="wbl a" style={{width:'60%'}}></div>
                          <div className="wbl" style={{width:'90%'}}></div>
                          <div className="wblbl">IMG_4721.jpg</div>
                        </div>
                      </div>
                    </div>
                    <div className="reading-row" id="readingRow">
                      <div className="reading-dot"></div>
                      <div className="reading-dot"></div>
                      <div className="reading-dot"></div>
                      <div className="reading-label">nudge is reading your image&hellip;</div>
                    </div>
                    <div className="mrow" id="mC">
                      <div className="mava">{'\u2726'}</div>
                      <div className="bub br" style={{fontSize:'11.5px'}}>oh &mdash; new to-do in there. scheduling it for tomorrow and i&apos;ll remind you. focus on sarah first, that&apos;s the urgent one.</div>
                    </div>
                  </div>
                  <div className="input-bar">
                    <div className="input-pill">iMessage</div>
                    <div className="send-dot">
                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M5.5 9V2M5.5 2L2 5.5M5.5 2L9 5.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="cta-wrap" id="ctaWrap">
            <button className="cta-btn" onClick={() => document.getElementById('waitlist')?.scrollIntoView({behavior:'smooth'})}>request access &rarr;</button>
            <div className="cta-sub">nudge is in private beta</div>
          </div>
        </div>
      </div>
      <div className="scroll-progress" id="scrollProgress"></div>
    </>
  )
}
