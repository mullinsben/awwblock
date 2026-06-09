const fs=require("fs"),path=require("path");
const ROOT=path.resolve(__dirname,"..");
const ANIMALS=["capybara","duck","puppy","kitten"];
const LABEL={capybara:"Capybara",duck:"Duck",puppy:"Puppy",kitten:"Kitten"};

// Load every animal's photos: {a, u, ar}
const photos=[];
for(const a of ANIMALS){
  const dir=path.join(ROOT,"photos",a);
  if(!fs.existsSync(dir)) continue;
  for(const f of fs.readdirSync(dir).filter(f=>/\.jpg$/i.test(f)).sort()){
    const m=f.match(/(\d+)x(\d+)/); if(!m) continue;
    photos.push({a, u:"photos/"+a+"/"+f, ar:+(+m[1]/+m[2]).toFixed(4)});
  }
}

const html=`<!doctype html><html><head><meta charset="utf-8"><title>Calming Animals: demo</title>
<style>
 body{margin:0;background:#0e1116;color:#cdd3da;font-family:system-ui,Segoe UI,Roboto,sans-serif}
 .top{background:#171b22;padding:10px 0;display:flex;justify-content:center;border-bottom:1px solid #222}
 .bar{display:flex;gap:14px;align-items:center;justify-content:center;flex-wrap:wrap;padding:12px;background:#141821;border-bottom:1px solid #222;position:sticky;top:0;z-index:5}
 .bar label{display:flex;gap:6px;align-items:center;font-size:14px;cursor:pointer;user-select:none}
 .reload{background:#B08458;color:#fff;border:0;border-radius:9px;padding:9px 15px;font-weight:700;cursor:pointer}
 .wrap{max-width:1080px;margin:18px auto;display:grid;grid-template-columns:1fr 300px;gap:22px;padding:0 16px}
 h1.logo{font-size:22px;color:#fff;margin:0 0 14px}
 .art h2{color:#fff} .art p{line-height:1.6;color:#aab2bb}
 .ph{font-size:13px;color:#5a6470;margin:24px 0 8px;text-transform:uppercase;letter-spacing:1px}
 .slot{border-radius:12px;overflow:hidden;position:relative;background:#F3E2BE;margin:0 auto;max-width:100%}
 .slot img{width:100%;height:100%;display:block}
 .tag{position:absolute;top:6px;left:6px;font:600 10px/1 system-ui;color:#fff;
      background:rgba(0,0,0,.45);border-radius:6px;padding:3px 6px;letter-spacing:.3px}
 .bb{width:970px;height:250px} .lead{width:728px;height:90px} .mob{width:320px;height:50px}
 .rect{width:300px;height:250px} .mrec{width:336px;height:280px}
 .sky{width:160px;height:600px} .thin{width:120px;height:600px} .port{width:300px;height:600px}
 .side{display:flex;flex-direction:column;gap:18px;align-items:center}
</style></head><body>
<div class="top"><div class="lead slot"></div></div>
<div class="bar">
 <strong style="color:#fff">show:</strong>
 <label><input type="checkbox" class="tog" value="capybara" checked> Capybara</label>
 <label><input type="checkbox" class="tog" value="duck" checked> Duck</label>
 <label><input type="checkbox" class="tog" value="puppy" checked> Puppy</label>
 <label><input type="checkbox" class="tog" value="kitten" checked> Kitten</label>
 <button class="reload" onclick="fill()">↻ reshuffle</button>
</div>
<div class="wrap">
 <div class="art">
   <h1 class="logo">The Daily Nothing</h1>
   <h2>Local animal remains calm amid everything</h2>
   <p>In a stunning display of doing absolutely nothing, an animal was seen being cute today. Witnesses described the scene as "deeply chill."</p>
   <div class="rect slot" style="float:right;margin:0 0 12px 16px"></div>
   <p>Experts confirm the creature has no notes, no thoughts, and no interest in your attention. The advertising industry could not be reached, having been replaced.</p>
   <p>Reporters noted the "unbothered energy" and "executive-level serenity." More on this developing non-story as it fails to develop.</p>
   <div class="ph">billboard unit</div>
   <div class="bb slot"></div>
   <div class="ph">in-article unit</div>
   <div class="mrec slot"></div>
   <p>The animal, asked for a statement, blinked slowly and continued being an animal.</p>
   <div class="ph">mobile banner</div>
   <div class="mob slot"></div>
 </div>
 <div class="side">
   <div class="ph">sidebar</div>
   <div class="rect slot"></div>
   <div class="sky slot"></div>
   <div class="thin slot"></div>
   <div class="port slot"></div>
 </div>
</div>
<script>
 const PHOTOS=${JSON.stringify(photos)};
 const TOL=0.12, rnd=a=>a[Math.floor(Math.random()*a.length)];
 function enabledAnimals(){ return [...document.querySelectorAll('.tog:checked')].map(c=>c.value); }
 function match(w,h,pool){ const ar=w/h;
   const close=pool.filter(p=>Math.abs(p.ar-ar)/ar<=TOL);
   if(close.length){const c=rnd(close);return {u:c.u,a:c.a,fit:"cover"};}
   const sameSide=pool.filter(p=> ar>=1 ? p.ar>=ar : p.ar<=ar);
   const cands=sameSide.length?sameSide:pool;
   let b=cands[0],bd=1e9; for(const p of cands){const d=Math.abs(Math.log(p.ar/ar)); if(d<bd){bd=d;b=p;}}
   return {u:b.u,a:b.a,fit: bd<=0.70 ? "cover" : "contain"}; }
 function fill(){
   const on=enabledAnimals();
   const pool=PHOTOS.filter(p=>on.includes(p.a));
   document.querySelectorAll('.slot').forEach(s=>{
     if(!pool.length){s.innerHTML='';return;}
     const r=s.getBoundingClientRect();
     const m=match(r.width,r.height,pool);
     s.innerHTML='<img src="'+m.u+'" style="object-fit:'+m.fit+'" alt="'+m.a+'">'+
                 '<span class="tag">'+m.a+'</span>';
   });
 }
 document.querySelectorAll('.tog').forEach(c=>c.addEventListener('change',fill));
 addEventListener('resize',()=>clearTimeout(window._t)||(window._t=setTimeout(fill,150)));
 fill();
</script></body></html>`;
fs.writeFileSync(path.join(ROOT,"demo.html"),html);
console.log("demo.html rebuilt; all 4 animals; photos:",photos.length);
