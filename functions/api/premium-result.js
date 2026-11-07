const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
export async function onRequestGet({request,env}){
 if(!env.DB)return json({error:'Not configured'},503);
 const id=new URL(request.url).searchParams.get('order');if(!id||!/^[0-9a-f-]{36}$/i.test(id))return json({error:'Invalid order'},400);
 const row=await env.DB.prepare('SELECT * FROM premium_orders WHERE id=?').bind(id).first();
 if(!row)return json({error:'Order not found'},404);
 if(row.status==='pending')return json({error:'Payment not yet verified'},202);
 if(row.status!=='paid'&&row.status!=='completed')return json({error:'Payment not available'},403);
 if(row.result)return json({settings:JSON.parse(row.result)});
 const offset={balanced:0,rush:9,headshot:13,sniper:-7}[row.style]||0;
 const max=row.scale,clamp=n=>Math.min(max,Math.max(0,Math.round(n*max/200)));
 const settings={'Device':row.brand+' '+row.model,'General':clamp(174+offset),'Red Dot':clamp(169+offset),'2X Scope':clamp(155+offset/2),'4X Scope':clamp(137-offset/3),'Sniper Scope':clamp(80-(offset/2)),'Free Look':clamp(140+offset/3),'Fire Button Size':'41%'};
 const updated=await env.DB.prepare("UPDATE premium_orders SET status='completed',result=? WHERE id=? AND status='paid'").bind(JSON.stringify(settings),id).run();
 if(!updated.meta?.changes){const latest=await env.DB.prepare('SELECT result FROM premium_orders WHERE id=?').bind(id).first();if(latest?.result)return json({settings:JSON.parse(latest.result)});return json({error:'Please retry'},503)}
 return json({settings});
}
