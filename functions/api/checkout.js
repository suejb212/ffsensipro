const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
export async function onRequestPost({request,env}){
 try{
  if(!env.DB||!env.LEMON_API_KEY||!env.LEMON_STORE_ID||!env.LEMON_VARIANT_ID)return json({error:'Payment setup is incomplete'},503);
  const origin=new URL(request.url).origin;
  const {brand,model,style='balanced',scale='200'}=await request.json();
  if(typeof brand!=='string'||typeof model!=='string'||!brand.trim()||!model.trim()||brand.length>50||model.length>80||!['balanced','rush','headshot','sniper'].includes(style)||!['100','200'].includes(String(scale)))return json({error:'Invalid device details'},400);
  const id=crypto.randomUUID();
  await env.DB.prepare('INSERT INTO premium_orders (id,status,brand,model,style,scale) VALUES (?,?,?,?,?,?)').bind(id,'pending',brand.trim(),model.trim(),style,Number(scale)).run();
  const response=await fetch('https://api.lemonsqueezy.com/v1/checkouts',{method:'POST',headers:{'Authorization':'Bearer '+env.LEMON_API_KEY,'Accept':'application/vnd.api+json','Content-Type':'application/vnd.api+json'},body:JSON.stringify({data:{type:'checkouts',attributes:{checkout_data:{custom:{order_id:id}},product_options:{redirect_url:origin+'/premium.html?order='+encodeURIComponent(id)}},relationships:{store:{data:{type:'stores',id:String(env.LEMON_STORE_ID)}},variant:{data:{type:'variants',id:String(env.LEMON_VARIANT_ID)}}}}})});
  const body=await response.json();if(!response.ok||!body.data?.attributes?.url)return json({error:'Checkout provider rejected request'},502);
  return json({url:body.data.attributes.url});
 }catch(e){return json({error:'Unable to create checkout'},500)}
}
