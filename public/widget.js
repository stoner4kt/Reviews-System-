(function(){"use strict";const h="open",c="thanks",m="closed",k="#0ea5e9",L=`
.rfw *, .rfw *::before, .rfw *::after { box-sizing: border-box; }
.rfw { all: initial; }
.rfw-button {
  position: fixed; z-index: 2147483000; bottom: 20px; right: 20px;
  display: flex; align-items: center; gap: 8px;
  border: none; cursor: pointer;
  background: var(--rf-primary); color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 14px; font-weight: 600;
  padding: 12px 20px; border-radius: 9999px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.rfw-button:hover { transform: translateY(-2px); box-shadow: 0 12px 28px rgba(0, 0, 0, 0.5); }
.rfw-button.rfw-hidden { display: none; }
.rfw-position-bottom-left .rfw-button { right: auto; left: 20px; }
.rfw-panel {
  position: fixed; z-index: 2147483001; bottom: 90px; right: 20px;
  width: 380px; max-width: calc(100vw - 40px);
  background: var(--rf-card); color: var(--rf-text);
  border: 1px solid var(--rf-border); border-radius: 16px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  overflow: hidden; display: none;
  transform: translateY(12px); opacity: 0;
  transition: opacity 0.2s ease, transform 0.25s ease;
}
.rfw-panel.rfw-open { display: block; transform: translateY(0); opacity: 1; }
.rfw-panel.rfw-thanks .rfw-form { display: none; }
.rfw-position-bottom-left .rfw-panel { right: auto; left: 20px; }
.rfw-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 18px; background: linear-gradient(135deg, #0b0f19, #0d1629);
  border-bottom: 1px solid var(--rf-border);
}
.rfw-header-title { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 700; color: #fff; }
.rfw-header-star { color: var(--rf-primary); font-size: 18px; }
.rfw-close {
  background: none; border: none; cursor: pointer;
  color: var(--rf-muted); font-size: 18px; line-height: 1; padding: 4px;
}
.rfw-close:hover { color: #fff; }
.rfw-form { padding: 18px; display: flex; flex-direction: column; gap: 10px; }
.rfw-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.rfw-field label {
  display: block; font-size: 11px; font-weight: 600; letter-spacing: 0.04em;
  text-transform: uppercase; color: var(--rf-muted); margin-bottom: 5px;
}
.rfw-field input, .rfw-field textarea {
  width: 100%; background: var(--rf-bg);
  border: 1px solid var(--rf-border); border-radius: 10px;
  color: var(--rf-text); font-size: 14px; padding: 10px 12px;
  outline: none; transition: border-color 0.15s ease;
}
.rfw-field input:focus, .rfw-field textarea:focus { border-color: var(--rf-primary); }
.rfw-field input::placeholder, .rfw-field textarea::placeholder { color: rgba(148, 163, 184, 0.45); }
.rfw-field textarea { resize: vertical; min-height: 72px; }
.rfw-field .rfw-required { color: var(--rf-primary); }
.rfw-submit {
  margin-top: 4px; width: 100%; padding: 12px; border: none; cursor: pointer;
  background: var(--rf-primary); color: #fff; font-size: 14px; font-weight: 700;
  border-radius: 10px; transition: opacity 0.15s ease;
}
.rfw-submit:hover { opacity: 0.9; }
.rfw-submit:disabled { opacity: 0.6; cursor: wait; }
.rfw-error {
  display: none; font-size: 12px; color: #fda4af; background: rgba(244, 63, 94, 0.1);
  border: 1px solid rgba(244, 63, 94, 0.3); border-radius: 8px; padding: 8px 10px;
}
.rfw-error.rfw-show { display: block; }
.rfw-thanks { display: none; padding: 36px 24px; text-align: center; }
.rfw-thanks-icon { font-size: 36px; }
.rfw-panel.rfw-thanks .rfw-thanks { display: block; }
.rfw-thanks-title { font-size: 17px; font-weight: 700; color: #fff; margin-top: 10px; }
.rfw-thanks-text { font-size: 13px; color: var(--rf-muted); margin-top: 6px; line-height: 1.5; }
.rfw-footer { padding: 10px 18px; text-align: center; font-size: 10px; color: rgba(148, 163, 184, 0.6); border-top: 1px solid var(--rf-border); }
.rfw-footer a { color: var(--rf-primary); text-decoration: none; }
@media (max-width: 480px) {
  .rfw-button { bottom: 16px; right: 16px; left: 16px; width: auto; justify-content: center; padding: 12px 16px; }
  .rfw-panel { bottom: 0; right: 0; left: 0; width: 100%; max-width: none; border-radius: 16px 16px 0 0; }
  .rfw-position-bottom-left .rfw-panel { left: 0; right: 0; }
}
`;function C(e){const t=e.replace("#","").match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);return t?{r:parseInt(t[1],16),g:parseInt(t[2],16),b:parseInt(t[3],16)}:null}function $(e){const t=e.trim();if(/^#[0-9a-fA-F]{6}$/.test(t))return t.toLowerCase();const o=t.match(/^([0-9a-fA-F]{3})$/);if(o){const[n,u,i]=o[1];return`#${n}${n}${u}${u}${i}${i}`.toLowerCase()}return null}function z(e){const t=document.documentElement,o=$(e)||k;t.style.setProperty("--rf-primary",o),t.style.setProperty("--rf-primary-soft","rgba(14, 165, 233, 0.12)"),t.style.setProperty("--rf-bg","#070b14"),t.style.setProperty("--rf-card","#0d1629"),t.style.setProperty("--rf-border","#1a2234"),t.style.setProperty("--rf-text","#f1f5f9"),t.style.setProperty("--rf-muted","#94a3b8");const n=C(o);n&&t.style.setProperty("--rf-primary-soft",`rgba(${n.r}, ${n.g}, ${n.b}, 0.12)`)}function F(e){return e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}function P(){const e=document.querySelector('script[src*="widget.js"][data-api-key]')||document.querySelector('script[data-api-key][src*="widget.js"]'),t=e==null?void 0:e.dataset.apiKey;return t?{apiKey:t,position:(e==null?void 0:e.dataset.position)==="bottom-left"?"bottom-left":"bottom-right",color:(e==null?void 0:e.dataset.color)||k,buttonText:(e==null?void 0:e.dataset.buttonText)||"Get in Touch",supabaseUrl:(e==null?void 0:e.dataset.supabaseUrl)||void 0}:(console.warn("[ReviewFlow] Missing data-api-key attribute on the script tag."),null)}function O(e,t){return`${(t.supabaseUrl||""||"#FUNCTIONS_BASE#").replace(/\/$/,"")}/functions/v1/${e}`}function S(e){const{apiKey:t,position:o,color:n,buttonText:u}=e,i=document.createElement("style");i.id="reviewflow-style",i.textContent=L,document.head.appendChild(i),z(n);const f=document.createElement("div");f.className="rfw",f.classList.add(o==="bottom-left"?"rfw-position-bottom-left":"rfw-position-bottom-right");const l=document.createElement("button");l.type="button",l.className="rfw-button",l.innerHTML=`<span>${F(u)}</span><span class="rfw-header-star">★</span>`;const s=document.createElement("div");s.className="rfw-panel",s.innerHTML=`
    <div class="rfw-header">
      <div class="rfw-header-title"><span class="rfw-header-star">★</span> <span>Get in Touch</span></div>
      <button type="button" class="rfw-close" aria-label="Close">×</button>
    </div>
    <form class="rfw-form" novalidate>
      <div class="rfw-row">
        <div class="rfw-field">
          <label>First name</label>
          <input name="first_name" type="text" autocomplete="given-name" />
        </div>
        <div class="rfw-field">
          <label>Last name</label>
          <input name="last_name" type="text" autocomplete="family-name" />
        </div>
      </div>
      <div class="rfw-field">
        <label>Email <span class="rfw-required">*</span></label>
        <input name="email" type="email" required autocomplete="email" placeholder="you@example.com" />
      </div>
      <div class="rfw-field">
        <label>Phone</label>
        <input name="phone" type="tel" autocomplete="tel" />
      </div>
      <div class="rfw-field">
        <label>Service</label>
        <input name="service" type="text" placeholder="What do you need?" />
      </div>
      <div class="rfw-field">
        <label>Message</label>
        <textarea name="message" rows="3" placeholder="Optional notes…"></textarea>
      </div>
      <p class="rfw-error"></p>
      <button type="submit" class="rfw-submit">Send Message</button>
    </form>
    <div class="rfw-thanks">
      <div class="rfw-thanks-icon">✓</div>
      <p class="rfw-thanks-title">Thank you!</p>
      <p class="rfw-thanks-text">Your message has been received. We'll be in touch soon.</p>
    </div>
    <div class="rfw-footer">Powered by <a href="https://conextsol.co.za" target="_blank" rel="noopener">ReviewFlow</a> by Conextsol</div>
  `,f.appendChild(l),f.appendChild(s),document.body.appendChild(f);const w=s.querySelector(".rfw-form"),b=s.querySelector(".rfw-error"),E=w.elements.namedItem("email"),g=s.querySelector(".rfw-submit"),R=s.querySelector(".rfw-close");let y=m;function d(r){y=r;const a=r===h||r===c;s.classList.toggle("rfw-open",a),s.classList.toggle("rfw-thanks",r===c),l.classList.toggle("rfw-hidden",a)}function _(r){b.textContent=r,b.classList.add("rfw-show")}function v(){b.textContent="",b.classList.remove("rfw-show")}async function T(r){if(!r.email)return{ok:!1,error:"Email is required."};const a=r.email.trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a))return{ok:!1,error:"Please enter a valid email address."};try{const p=await fetch(O("capture-lead",e),{method:"POST",headers:{"Content-Type":"application/json","x-widget-key":t},body:JSON.stringify({first_name:r.first_name||"",last_name:r.last_name||"",email:a,phone:r.phone||null,service:r.service||null,message:r.message||null})}),x=await p.json().catch(()=>({}));return p.ok?{ok:!0}:{ok:!1,error:x.error||`Request failed (${p.status})`}}catch{return{ok:!1,error:"Network error. Please try again."}}}l.addEventListener("click",()=>{if(y===h||y===c){d(m);return}v(),d(h),window.setTimeout(()=>E.focus(),50)}),R.addEventListener("click",()=>d(m)),w.addEventListener("submit",async r=>{if(r.preventDefault(),v(),!E.validity.valid){_("Please enter a valid email address.");return}const a=new FormData(w),p={first_name:String(a.get("first_name")||""),last_name:String(a.get("last_name")||""),email:String(a.get("email")||""),phone:String(a.get("phone")||""),service:String(a.get("service")||""),message:String(a.get("message")||"")};g.disabled=!0,g.textContent="Sending…";const x=await T(p);g.disabled=!1,g.textContent="Send Message",x.ok?(w.reset(),d(c),window.setTimeout(()=>d(m),4e3)):_(x.error||"Something went wrong.")}),window.ReviewFlow={capture:r=>(v(),T(r))}}(function(){const t=window;if(t.__RFW_LOADED__)return;t.__RFW_LOADED__=!0;const o=P();if(!o){t.ReviewFlow={capture:()=>Promise.resolve({ok:!1,error:"ReviewFlow widget is not configured (missing data-api-key)."})};return}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>S(o)):S(o)})()})();
