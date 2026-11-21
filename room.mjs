// LittleFileRoom: one file on each computer, Node 22+, no npm install.
import fs from 'node:fs/promises';
import path from 'node:path';
import {homedir} from 'node:os';
import {randomUUID,createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const id=x=>typeof x==='string' && /^\d{17,20}$/.test(x);
const MAX=8*1024*1024;
const sha=x=>createHash('sha256').update(x).digest('hex');
function guard(v,t){if(!v)throw Error(t)}
function safeName(n){guard(/^[A-Za-z0-9][A-Za-z0-9 _.-]{0,95}$/.test(n)&&!/[ .]$/.test(n)&&!n.includes('..')&&!/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(n),'Use a simple visible filename.');return n;}
export function client({guild,channel,token,home=path.join(homedir(),'LittleFileRoom-data'),request=fetch}){
 guard(id(guild)&&id(channel)&&token,'Set ROOM_GUILD, ROOM_CHANNEL and ROOM_TOKEN locally.');
 const dir=path.join(home,guild,channel), out=path.join(dir,'outbox'), inbox=path.join(dir,'inbox');
 async function api(s,opts={}){const r=await request('https://discord.com/api/v10'+s,{...opts,headers:{Authorization:'Bot '+token,...opts.headers},redirect:'error',signal:AbortSignal.timeout(30000)});guard(r.ok,`Discord HTTP ${r.status}. No retry; inspect the room before another send.`);return r.json();}
 async function sync(){const rows=await api(`/channels/${channel}/messages?limit=100`);guard(Array.isArray(rows),'Invalid history');const log=rows.reverse().map(m=>{guard(m.channel_id===channel&&id(m.id),'Wrong room/message');return JSON.stringify({id:m.id,from:m.author.id,name:m.author.username,text:m.content,files:(m.attachments??[]).map(a=>({id:a.id,name:a.filename,bytes:a.size}))});}).join('\n');const tmp=path.join(dir,randomUUID()+'.tmp');await fs.writeFile(tmp,log+(log?'\n':''),{flag:'wx',mode:0o600});await fs.rename(tmp,path.join(dir,'chat.jsonl'));return {messages:rows.length,chat:path.join(dir,'chat.jsonl')};}
 async function run(action,arg){const room=await api('/channels/'+channel);guard(room.id===channel&&room.guild_id===guild&&room.type===0,'Not the configured server text channel.');await fs.mkdir(out,{recursive:true,mode:0o700});await fs.mkdir(inbox,{recursive:true,mode:0o700});
 if(action==='status')return {channel:room.name,dir};if(action==='sync')return sync();
 if(action==='say'||action==='send'){let content=arg,body,headers={};const nonce=randomUUID().replaceAll('-','').slice(0,24);const base={allowed_mentions:{parse:[]},nonce,enforce_nonce:true};
 if(action==='say'){guard(typeof arg==='string'&&arg.length>0&&arg.length<=1000,'Use 1–1000 characters.');body=JSON.stringify({...base,content});headers={'Content-Type':'application/json'};}
 else{const name=safeName(arg),p=path.join(out,name),st=await fs.lstat(p);guard(st.isFile()&&st.nlink===1&&st.size>0&&st.size<=MAX,'Expected staged plain file, 1 byte–8 MiB.');const data=await fs.readFile(p);guard(data.length===st.size,'Changed file.');content='sha256:'+sha(data);body=new FormData();body.set('payload_json',JSON.stringify({...base,content,attachments:[{id:0,filename:name}]}));body.set('files[0]',new Blob([data]),name);}
 const m=await api(`/channels/${channel}/messages`,{method:'POST',headers,body});guard(m.channel_id===channel&&id(m.id)&&m.content===content,'Uncertain send: inspect chat; do not resend.');if(action==='send')guard(m.attachments?.length===1&&m.attachments[0].filename===arg,'Attachment not confirmed. Inspect channel.');return {posted:m.id,channel};}
 if(action==='get'){guard(id(arg),'Specify the message ID from chat.jsonl');const m=await api(`/channels/${channel}/messages/${arg}`);guard(m.id===arg&&m.channel_id===channel&&m.attachments?.length===1&&/^sha256:[a-f0-9]{64}$/.test(m.content),'Expected one hashed FileRoom attachment.');const a=m.attachments[0],url=new URL(a.url);guard(id(a.id)&&url.origin==='https://cdn.discordapp.com'&&url.pathname.startsWith(`/attachments/${channel}/${a.id}/`)&&a.size>0&&a.size<=MAX,'Invalid attachment');const name=safeName(a.filename);const r=await request(url,{redirect:'error',signal:AbortSignal.timeout(30000)});guard(r.ok,'Cannot download attachment');const chunks=[];let size=0;for await(const b of r.body){size+=b.length;guard(size<=a.size,'Oversize download');chunks.push(b);}const data=Buffer.concat(chunks);guard(size===a.size&&'sha256:'+sha(data)===m.content,'Checksum mismatch');const dst=path.join(inbox,arg+'-'+name);await fs.writeFile(dst,data,{flag:'wx',mode:0o600});return {verified:dst,bytes:size};}throw Error('Use status, sync, say TEXT, send FILENAME or get MESSAGE_ID');}
 return run;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){try{const run=client({guild:process.env.ROOM_GUILD,channel:process.env.ROOM_CHANNEL,token:process.env.ROOM_TOKEN});console.log(JSON.stringify(await run(process.argv[2],process.argv[3])));}catch(e){console.error(e.message);process.exitCode=1;}}
