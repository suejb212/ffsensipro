const enc=new TextEncoder();
const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
export async function onRequestPost({request,env}){
 if(!env.LEMON_WEBHOOK_SECRET||!env.DB)return new Response('Not configured',{status:503});
 const raw=await request.text(),signature=request.headers.get('X-Signature')||'';
 const key=await crypto.subtle.importKey('raw',enc.encode(env.LEMON_WEBHOOK_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const expected=hex(await crypto.subtle.sign('HMAC',key,enc.encode(raw)));
 if(signature.length!==expected.length||![...signature.toLowerCase()].every((c,i)=>c===expected[i]))return new Response('Invalid signature',{status:401});
 let payload;try{payload=JSON.parse(raw)}catch{return new Response('Invalid JSON',{status:400})}
 if(payload.meta?.event_name!=='order_created')return new Response('Ignored');
 const id=payload.meta?.custom_data?.order_id;
 const attributes=payload.data?.attributes;
 if(!id||!attributes||attributes.status!=='paid'||String(attributes.first_order_item?.variant_id||'')!==String(env.LEMON_VARIANT_ID))return new Response('Ignored');
 const result=await env.DB.prepare("UPDATE premium_orders SET status='paid',provider_order_id=? WHERE id=? AND status='pending'").bind(String(payload.data.id),id).run();
 return new Response('OK');
}
