import React, { useEffect, useMemo, useState } from "react";

const COLORS = { instagram:'#a855f7', tiktok:'#06b6d4', youtube:'#ef4444', x:'#0ea5e9' };
const RANGES = ['1h','24h','7d','30d'];

function seedRand(seed){ let x=Math.sin(seed)*10000; return x-Math.floor(x); }
function mockPosts(seed,count){ const out=[]; for(let i=0;i<count;i++){ const r=seedRand(seed+i); const likes=Math.floor(r*800),comments=Math.floor(r*120),shares=Math.floor(r*60); const impressions=Math.floor(r*12000)+likes+comments*2+shares*3; const sentiment=Number(((r-0.5)*2).toFixed(2)); out.push({id:`post_${seed}_${i}`,url:'#',title:`Post ${i+1}`,publishedAt:new Date(Date.now()-i*3600*1000).toISOString(),impressions,likes,comments,shares,engagementRate:impressions?(likes+comments+shares)/impressions:0,sentimentScore:sentiment}); } return out; }
function mockBundle(platform,range,seed){ const n=24; const timeseries=Array.from({length:n},(_,i)=>({impressions:Math.floor((seedRand(seed+i*(platform.length+1))+0.2)*3000)})); const impressions=timeseries.reduce((a,p)=>a+p.impressions,0); const posts=mockPosts(seed+platform.length,6); const engagements=posts.reduce((a,p)=>a+(p.likes||0)+(p.comments||0)+(p.shares||0),0); const likes=posts.reduce((a,p)=>a+(p.likes||0),0); const comments=posts.reduce((a,p)=>a+(p.comments||0),0); const shares=posts.reduce((a,p)=>a+(p.shares||0),0); return {platform,accountId:'demo',timeRange:range,totals:{followers:Math.floor(10000+seedRand(seed)*5000),followerGrowth:Math.floor((seedRand(seed+2)-0.45)*500),impressions,engagements,posts:posts.length,avgEngagementRate:impressions?engagements/impressions:0,sentimentScore:Number((posts.reduce((a,p)=>a+(p.sentimentScore||0),0)/posts.length).toFixed(2)),likes,comments,shares},timeseries,posts}; }

function Legend({keys}){
  return (
    <div style={{display:'flex',flexWrap:'wrap',gap:12,fontSize:12,marginTop:8}}>
      {keys.map(k=> (
        <span key={k} style={{display:'inline-flex',alignItems:'center',gap:8,textTransform:'capitalize'}}>
          <span style={{display:'inline-block',width:12,height:12,background:COLORS[k]||'#111'}}></span>{k}
        </span>
      ))}
    </div>
  );
}
function LineChart({seriesMap,height=240}){
  const keys=Object.keys(seriesMap); const all=keys.flatMap(k=>seriesMap[k]||[]);
  const w=860,h=height,pad=28; const maxY=Math.max(1,...all.map(p=>p.impressions||0));
  const count=seriesMap[keys[0]]?.length||1; const coord=(i,y)=>{const x=pad+(i/(count-1||1))*(w-pad*2);const yv=h-pad-(y/maxY)*(h-pad*2);return`${x},${yv}`;};
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{width:'100%',height:260}}>
        <rect x={0} y={0} width={w} height={h} rx={16} fill="white"/>
        {Array.from({length:4}).map((_,i)=>(<line key={i} x1={28} x2={w-28} y1={28+(i/3)*(h-56)} y2={28+(i/3)*(h-56)} stroke="#e5e7eb"/>))}
        {keys.map(k=>(<polyline key={k} fill="none" stroke={COLORS[k]||'#111'} strokeWidth={2} points={(seriesMap[k]||[]).map((pt,i)=>coord(i,pt.impressions||0)).join(' ')}/>))}
      </svg>
      <Legend keys={keys}/>
    </div>
  );
}
function GroupedBars({seriesByPlatform,height=240}){
  const keys=Object.keys(seriesByPlatform);
  const w=860,h=height,pad=28; const len=(seriesByPlatform[keys[0]]||[]).length;
  const maxY=Math.max(1,...keys.flatMap(k=>seriesByPlatform[k]||[])); const groupW=((w-pad*2)/len)-2; const barW=Math.max(2,(groupW/keys.length)-2);
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{width:'100%',height:260}}>
        <rect x={0} y={0} width={w} height={h} rx={16} fill="white"/>
        {Array.from({length:len}).map((_,i)=>{
          const gx=pad+i*(groupW+2);
          return (
            <g key={i}>
              {keys.map((k,idx)=>{
                const val=seriesByPlatform[k][i]||0; const hbar=(val/maxY)*(h-pad*2);
                const x=gx+idx*(barW+2); const y=h-pad-hbar;
                return <rect key={k} x={x} y={y} width={barW} height={hbar} fill={COLORS[k]||'#111'} rx={2} />;
              })}
            </g>
          );
        })}
      </svg>
      <Legend keys={keys}/>
    </div>
  );
}

export default function App(){
  const [range,setRange]=useState('24h');
  const [platforms,setPlatforms]=useState(['instagram','tiktok']);
  const [handle,setHandle]=useState('club.lore');
  const [useRealApi,setUseRealApi]=useState(false);
  const [data,setData]=useState({bundles:[],summary:{totals:{followers:0,followerGrowth:0,impressions:0,engagements:0,posts:0},byPlatform:{},changePct:0},winner:null});
  const [loading,setLoading]=useState(false);

  const API = (import.meta && import.meta.env && import.meta.env.VITE_API_URL) || 'http://localhost:4000';

  async function fetchMetricsReal({platforms,range,handle}){
    const u=new URL(API + '/api/metrics'); u.searchParams.set('platforms',platforms.join(',')); u.searchParams.set('range',range); u.searchParams.set('handles',handle);
    const r=await fetch(u.toString()); return r.json();
  }

  useEffect(()=>{
    let alive=true; setLoading(true);
    (async()=>{
      if(useRealApi){
        try{ const res=await fetchMetricsReal({platforms,range,handle}); if(!alive) return; setData(res); }
        catch(e){ if(!alive) return; console.error(e); }
        finally{ if(alive) setLoading(false); }
      }else{
        const seed=Date.now()%10000; const bundles=platforms.map((p,idx)=>mockBundle(p,range,seed+idx*11));
        const summary=bundles.reduce((acc,b)=>{acc.totals.followers+=b.totals.followers;acc.totals.impressions+=b.totals.impressions;acc.byPlatform[b.platform]=b.totals;return acc;},{totals:{followers:0,impressions:0},byPlatform:{}});
        if(!alive) return; setData({bundles,summary}); setLoading(false);
      }
    })();
    return ()=>{ alive=false; };
  },[platforms.join(','),range,handle,useRealApi]);

  const bundles=data.bundles||[];
  const seriesMap=useMemo(()=>{ const map={}; bundles.forEach(b=>{ map[b.platform]=b.timeseries; }); return map; },[bundles]);
  const seriesByPlatform=useMemo(()=>{ const map={}; bundles.forEach(b=>{ map[b.platform]=b.timeseries.map(t=>t.impressions); }); return map; },[bundles]);
  const totals=data.summary?.totals||{followers:0,impressions:0};

  return (
    <div style={{padding:24, maxWidth:1200, margin:'0 auto'}}>
      <h1 style={{fontSize:24, fontWeight:700}}>Cross‑Platform Social Analytics</h1>
      <p style={{color:'#6b7280'}}>Track <b>club.lore</b> across Instagram and TikTok with colorful charts and detailed tables.</p>

      <div style={{border:'1px solid #e5e7eb', borderRadius:16, padding:16, marginTop:16}}>
        <div style={{display:'flex', gap:8, flexWrap:'wrap', alignItems:'center'}}>
          <span style={{fontSize:12, color:'#6b7280', fontWeight:600}}>PLATFORMS</span>
          {['instagram','tiktok'].map(p=>(
            <button key={p} onClick={()=>setPlatforms(prev=> prev.includes(p)? prev.filter(x=>x!==p): [...prev,p])} style={{padding:'6px 12px', border:'1px solid #e5e7eb', borderRadius:999, textTransform:'capitalize', background: platforms.includes(p)?'#111':'#fff', color: platforms.includes(p)?'#fff':'#111'}}>{p}</button>
          ))}
          <span style={{fontSize:12, color:'#6b7280', fontWeight:600, marginLeft:12}}>HANDLE</span>
          <input value={handle} onChange={e=>setHandle(e.target.value)} placeholder="club.lore" style={{border:'1px solid #e5e7eb', borderRadius:12, padding:'6px 10px'}} />
          <div style={{marginLeft:'auto', display:'flex', alignItems:'center', gap:12}}>
            <label style={{fontSize:12, color:'#6b7280'}}><input type="checkbox" checked={useRealApi} onChange={e=>setUseRealApi(e.target.checked)} /> Use real API</label>
            <button onClick={()=>setLoading(true)} style={{padding:'8px 12px', borderRadius:12, background:'#111', color:'#fff', border:'1px solid #111'}}>{loading?'Syncing…':'Sync now'}</button>
          </div>
        </div>
        <div style={{display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', marginTop:12}}>
          <span style={{fontSize:12, color:'#6b7280', fontWeight:600}}>RANGE</span>
          {RANGES.map(r=>(
            <button key={r} onClick={()=>setRange(r)} style={{padding:'6px 12px', border:'1px solid #e5e7eb', borderRadius:999, background: range===r?'#111':'#fff', color: range===r?'#fff':'#111'}}>{r==='1h'?'Last hour':r==='24h'?'24 hours':r==='7d'?'7 days':'30 days'}</button>
          ))}
          <div style={{marginLeft:'auto', fontSize:14}}>Total impressions: <b>{(totals.impressions||0).toLocaleString()}</b></div>
        </div>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:24, marginTop:24}}>
        <div style={{border:'1px solid #e5e7eb', borderRadius:16, padding:16}}>
          <div style={{fontWeight:600, marginBottom:8}}>Total Impressions</div>
          <LineChart seriesMap={seriesMap} />
        </div>
        <div style={{border:'1px solid #e5e7eb', borderRadius:16, padding:16}}>
          <div style={{fontWeight:600, marginBottom:8}}>Platform comparison</div>
          <GroupedBars seriesByPlatform={seriesByPlatform} />
        </div>
      </div>

      <div style={{border:'1px solid #e5e7eb', borderRadius:16, padding:16, marginTop:24}}>
        <div style={{display:'flex', justifyContent:'space-between', marginBottom:8}}>
          <div style={{fontWeight:600}}>Breakdown by platform</div>
          <div style={{fontSize:12, color:'#6b7280'}}>Totals</div>
        </div>
        <div style={{overflow:'auto', border:'1px solid #e5e7eb', borderRadius:16}}>
          <table style={{width:'100%', fontSize:14, borderCollapse:'collapse'}}>
            <thead style={{background:'#f9fafb'}}>
              <tr>
                <th style={{padding:8, textAlign:'left'}}>Platform</th>
                <th style={{padding:8}}>Impressions</th>
                <th style={{padding:8}}>Likes</th>
                <th style={{padding:8}}>Comments</th>
                <th style={{padding:8}}>Shares</th>
                <th style={{padding:8}}>Follows</th>
              </tr>
            </thead>
            <tbody>
              {bundles.map(b=>(
                <tr key={b.platform} style={{borderTop:'1px solid #e5e7eb'}}>
                  <td style={{padding:8, textTransform:'capitalize'}}>{b.platform}</td>
                  <td style={{padding:8, textAlign:'center'}}>{b.totals.impressions.toLocaleString()}</td>
                  <td style={{padding:8, textAlign:'center'}}>{(b.totals.likes||0).toLocaleString()}</td>
                  <td style={{padding:8, textAlign:'center'}}>{(b.totals.comments||0).toLocaleString()}</td>
                  <td style={{padding:8, textAlign:'center'}}>{(b.totals.shares||0).toLocaleString()}</td>
                  <td style={{padding:8, textAlign:'center'}}>{(b.totals.followers||0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}