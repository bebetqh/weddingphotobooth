/* Wedding digital photobooth — Supabase + automatic 3-shot timer + QR sharing */
const SUPABASE_URL = "https://hxaudbnyagbfhhwuawua.supabase.co";
const SUPABASE_KEY = "sb_publishable_5qi7c3qLl4qX3WZgVBxf7g_wl9TPJIO";
const BUCKET = "wedding-media";
const PHOTO_TABLE = "wedding_photos";
const GUESTBOOK_TABLE = "wedding_guestbook";
const COUPLE_NAMES = "SYAZWAN  ♥  SYILAH";
const WEDDING_DATE = "19 · 12 · 2026";
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const views = {photos:$("#photosView"),photobooth:$("#photoboothView"),result:$("#resultView"),guestbook:$("#guestbookView")};
let supabaseClient=null, cameraStream=null, capturedPhotos=[], selectedTemplate="classic", latestStripData="", latestPublicUrl="", busy=false, cameraStarting=false, captureSequence=false;

function setMessage(selector,message){const el=$(selector);if(el)el.textContent=message}
function makeText(text,className="muted"){const p=document.createElement("p");p.className=className;p.textContent=text;return p}
function initSupabase(){
  if(!window.supabase?.createClient){setMessage("#photoCount","Gallery unavailable");$("#photoGrid").replaceChildren(makeText("Gallery service did not load. Check your connection and reload."));return false}
  try{supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);return true}catch(e){console.error(e);return false}
}
function showView(name){
  if(!views[name])return;
  Object.values(views).forEach(v=>v.classList.remove("active"));views[name].classList.add("active");
  $$(".nav-tab").forEach(b=>{const active=b.dataset.page===name;b.classList.toggle("active",active);if(active)b.setAttribute("aria-current","page");else b.removeAttribute("aria-current")});
  $("#navTabs").classList.remove("open");$("#menuButton").setAttribute("aria-expanded","false");window.scrollTo({top:0,behavior:"smooth"});
  if(name!=="photobooth")stopCamera();if(name==="photos")loadGallery();if(name==="guestbook")loadGuestbook();
}
$$("[data-page]").forEach(b=>b.addEventListener("click",async e=>{e.preventDefault();const page=b.dataset.page;showView(page);if(page==="photobooth")await startCamera()}));
$("#menuButton").addEventListener("click",()=>{const open=$("#navTabs").classList.toggle("open");$("#menuButton").setAttribute("aria-expanded",String(open))});
function delay(ms){return new Promise(r=>setTimeout(r,ms))}
async function startCamera(){
  if(cameraStream||cameraStarting)return;
  if(!navigator.mediaDevices?.getUserMedia){setMessage("#cameraStatus","Camera unavailable");setMessage("#cameraHelp","Camera requires HTTPS or localhost. Open the secure website and try again.");return}
  cameraStarting=true;$("#startCamera").disabled=true;setMessage("#cameraStatus","Opening camera…");setMessage("#cameraHelp","Please allow camera access when your browser asks.");
  try{
    cameraStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"user",width:{ideal:1280},height:{ideal:960}},audio:false});
    const video=$("#cameraVideo");video.srcObject=cameraStream;video.muted=true;video.playsInline=true;
    await new Promise((resolve,reject)=>{if(video.readyState>=2&&video.videoWidth){resolve();return}const ready=()=>{clean();resolve()},err=()=>{clean();reject(new Error("Camera video could not be displayed."))},clean=()=>{video.removeEventListener("loadeddata",ready);video.removeEventListener("error",err)};video.addEventListener("loadeddata",ready,{once:true});video.addEventListener("error",err,{once:true})});
    await video.play();video.classList.add("ready");$("#cameraPlaceholder").style.display="none";setMessage("#cameraStatus","Camera is ready");setMessage("#cameraHelp","Tap the shutter to begin three automatic snaps. Each photo has a 3-second countdown.");renderSlots();
  }catch(error){console.error(error);stopCamera();const messages={NotAllowedError:"Camera permission was denied. Allow camera access in your browser settings.",NotFoundError:"No camera was found on this device.",NotReadableError:"The camera may be in use by another app.",SecurityError:"Camera access requires HTTPS."};setMessage("#cameraStatus","Camera unavailable");setMessage("#cameraHelp",messages[error.name]||`Could not open camera: ${error.message||"check permissions"}.`)}
  finally{cameraStarting=false;$("#startCamera").disabled=false}
}
function stopCamera(){if(cameraStream){cameraStream.getTracks().forEach(t=>t.stop());cameraStream=null}const video=$("#cameraVideo");if(video){video.srcObject=null;video.classList.remove("ready")}if($("#cameraPlaceholder"))$("#cameraPlaceholder").style.display="flex";if($("#startCamera"))$("#startCamera").disabled=false;if($("#cameraStatus"))$("#cameraStatus").textContent="Camera not started";if($("#captureButton"))$("#captureButton").disabled=true;captureSequence=false}
$("#startCamera").addEventListener("click",startCamera);window.addEventListener("beforeunload",stopCamera);

async function countdown(seconds=3){
  const el=$("#countdown");el.classList.add("show");
  try{for(let n=seconds;n>=1;n--){el.textContent=n;await delay(1000)}el.textContent="♥";await delay(300)}finally{el.classList.remove("show");el.textContent=""}
}
async function takeSnapshot(){
  const video=$("#cameraVideo");if(!cameraStream||!video.videoWidth||!video.videoHeight)throw new Error("Camera is not ready. Turn on the camera and try again.");
  const canvas=$("#captureCanvas");canvas.width=video.videoWidth;canvas.height=video.videoHeight;const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Could not access photo canvas.");
  ctx.save();ctx.translate(canvas.width,0);ctx.scale(-1,1);ctx.drawImage(video,0,0,canvas.width,canvas.height);ctx.restore();return canvas.toDataURL("image/jpeg",.92)
}
function renderSlots(){
  $$("#snapSlots .snap-slot").forEach((slot,i)=>{slot.replaceChildren();if(capturedPhotos[i]){const img=document.createElement("img");img.src=capturedPhotos[i];img.alt=`Captured photo ${i+1}`;slot.append(img)}else slot.textContent=String(i+1)});
  $("#finishButton").disabled=capturedPhotos.length!==3||busy;$("#captureButton").disabled=!cameraStream||capturedPhotos.length>=3||busy;$("#retakeButton").disabled=busy||capturedPhotos.length===0;
  if(capturedPhotos.length===3)setMessage("#cameraStatus","All three snaps captured");else if(cameraStream)setMessage("#cameraStatus",captureSequence?"Taking photos…":`Ready · ${capturedPhotos.length} of 3 photos`);else setMessage("#cameraStatus","Camera not started")
}
$("#captureButton").addEventListener("click",async()=>{
  if(!cameraStream||busy||captureSequence||capturedPhotos.length>=3)return;
  captureSequence=true;busy=true;renderSlots();$("#captureButton").disabled=true;
  try{while(capturedPhotos.length<3&&cameraStream){setMessage("#cameraHelp",`Photo ${capturedPhotos.length+1} of 3 — get ready!`);await countdown(3);if(!cameraStream)break;capturedPhotos.push(await takeSnapshot());renderSlots();if(capturedPhotos.length<3)await delay(500)}setMessage("#cameraHelp",capturedPhotos.length===3?"All done! Choose your style and make your photo strip.":"Capture stopped.")}catch(e){setMessage("#cameraHelp",e.message||"Could not capture photo.")}finally{captureSequence=false;busy=false;renderSlots()}
});
function resetPhotos(){
  capturedPhotos=[];latestStripData="";latestPublicUrl="";$("#stripCanvas").getContext("2d").clearRect(0,0,600,1760);renderSlots();$("#qrPanel").hidden=true;$("#qrCode").replaceChildren();$("#uploadButton").disabled=false;$("#uploadButton").textContent="Upload to wedding gallery";$("#downloadButton").disabled=false;setMessage("#resultMessage","");setMessage("#cameraHelp",cameraStream?"Tap the shutter to begin three automatic snaps.":"Turn on your camera to get started.")
}
$("#retakeButton").addEventListener("click",resetPhotos);
$$(".template-option").forEach(b=>b.addEventListener("click",()=>{selectedTemplate=b.dataset.template;$$(".template-option").forEach(x=>{const on=x===b;x.classList.toggle("selected",on);x.setAttribute("aria-pressed",String(on))})}));
function loadImage(src){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error("Could not load a captured photo."));im.src=src})}
function drawCrop(ctx,img,x,y,w,h){const sr=img.width/img.height,tr=w/h;let sx=0,sy=0,sw=img.width,sh=img.height;if(sr>tr){sw=img.height*tr;sx=(img.width-sw)/2}else{sh=img.width/tr;sy=(img.height-sh)/2}ctx.drawImage(img,sx,sy,sw,sh,x,y,w,h)}
function drawFlower(ctx,x,y,r,color){ctx.save();ctx.translate(x,y);ctx.fillStyle=color;for(let i=0;i<5;i++){ctx.rotate(Math.PI*2/5);ctx.beginPath();ctx.ellipse(0,-r*.65,r*.42,r*.7,0,0,Math.PI*2);ctx.fill()}ctx.beginPath();ctx.arc(0,0,r*.25,0,Math.PI*2);ctx.fillStyle="#f9e9bd";ctx.fill();ctx.restore()}
async function renderStrip(){
  if(capturedPhotos.length!==3)throw new Error("Please capture three photos first.");
  const canvas=$("#stripCanvas"),ctx=canvas.getContext("2d"),w=canvas.width,h=canvas.height;
  const themes={
    classic:{bg:"#fffdf8",ink:"#51413b",line:"#e6d8ca",accent:"#cdb9a9"},
    sakura:{bg:"#f8e4e9",ink:"#98556b",line:"#e6b5c5",accent:"#d99caf"},
    doodle:{bg:"#fff8ec",ink:"#61475a",line:"#d9b7c5",accent:"#d99caf"},
    minimal:{bg:"#ffffff",ink:"#222222",line:"#dedede",accent:"#dedede"},
    colorful:{bg:"#fff0d8",ink:"#663c65",line:"#ee9a86",accent:"#e77d9b"},
    film:{bg:"#252323",ink:"#f8ead8",line:"#bca48b",accent:"#d7c3aa"},
    botanical:{bg:"#eef2e8",ink:"#425c47",line:"#b5c5ae",accent:"#789477"},
    night:{bg:"#24243a",ink:"#f7e7bd",line:"#8d83a8",accent:"#d3b56e"}
  };
  const t=themes[selectedTemplate]||themes.classic;ctx.clearRect(0,0,w,h);ctx.fillStyle=t.bg;ctx.fillRect(0,0,w,h);
  if(selectedTemplate==="classic"||selectedTemplate==="minimal"||selectedTemplate==="botanical"||selectedTemplate==="film"||selectedTemplate==="night"){ctx.strokeStyle=t.line;ctx.lineWidth=selectedTemplate==="minimal"?1:3;ctx.strokeRect(20,20,w-40,h-40)}
  if(selectedTemplate==="sakura"){for(let i=0;i<38;i++)drawFlower(ctx,(i*83+24)%w,(i*127+35)%h,7+(i%3)*2,"#d99caf")}
  if(selectedTemplate==="doodle"){ctx.strokeStyle=t.accent;ctx.lineWidth=3;ctx.font="30px serif";for(let i=0;i<9;i++){ctx.fillStyle=t.accent;ctx.fillText(["♡","✧","☆","♡","✿"][i%5],35+(i*67)%520,230+i*160%1450)}}
  if(selectedTemplate==="colorful"){for(let i=0;i<18;i++){ctx.fillStyle=["#ef9d91","#e7c45f","#8cb8a2","#b3a1d5","#e77d9b"][i%5];ctx.beginPath();ctx.arc((i*91+30)%w,(i*113+50)%h,8+(i%4)*3,0,Math.PI*2);ctx.fill()}}
  if(selectedTemplate==="botanical"){ctx.font="52px serif";ctx.fillStyle=t.accent;ctx.fillText("❧",42,190);ctx.fillText("❧",510,1660)}
  if(selectedTemplate==="night"){for(let i=0;i<32;i++){ctx.fillStyle="#d3b56e";ctx.font=`${8+(i%3)*4}px serif`;ctx.fillText("✦",(i*71+20)%w,(i*97+50)%h)}}
  if(selectedTemplate==="film"){ctx.fillStyle=t.line;for(let y=34;y<h-30;y+=26){ctx.fillRect(28,y,12,13);ctx.fillRect(w-40,y,12,13)}}
  ctx.textAlign="center";ctx.fillStyle=t.ink;ctx.font="600 19px 'DM Sans',sans-serif";ctx.fillText("OUR WEDDING DAY",w/2,68);
  ctx.font="italic 48px 'Playfair Display',serif";ctx.fillText("Just Married",w/2,128);
  ctx.font="18px 'DM Sans',sans-serif";ctx.fillText(COUPLE_NAMES,w/2,165);
  const margin=65,photoW=w-margin*2,photoH=350,gap=18;let y=205;
  for(const src of capturedPhotos){const img=await loadImage(src);ctx.fillStyle=selectedTemplate==="film"?"#403b39":"#ffffff";ctx.fillRect(margin-8,y-8,photoW+16,photoH+16);drawCrop(ctx,img,margin,y,photoW,photoH);if(selectedTemplate==="film"){ctx.strokeStyle=t.line;ctx.lineWidth=5;ctx.strokeRect(margin,y,photoW,photoH)}y+=photoH+gap}
  ctx.font="italic 29px 'Playfair Display',serif";ctx.fillStyle=t.ink;ctx.fillText("A memory to keep forever",w/2,1500);
  ctx.font="16px 'DM Sans',sans-serif";ctx.fillText("THANK YOU FOR CELEBRATING WITH US",w/2,1540);ctx.fillText(WEDDING_DATE,w/2,1580);
  if(selectedTemplate==="sakura"||selectedTemplate==="botanical"){drawFlower(ctx,78,1695,23,t.accent);drawFlower(ctx,522,1695,23,t.accent)}else{ctx.strokeStyle=t.line;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(90,1695);ctx.lineTo(510,1695);ctx.stroke()}
  latestStripData=canvas.toDataURL("image/png")
}
$("#finishButton").addEventListener("click",async()=>{if(busy||capturedPhotos.length!==3)return;busy=true;$("#finishButton").disabled=true;$("#finishButton").textContent="Creating strip…";try{await renderStrip();showView("result")}catch(e){alert(e.message||"Could not create photo strip.")}finally{busy=false;$("#finishButton").textContent="Make my photo strip →";renderSlots()}});
$("#downloadButton").addEventListener("click",()=>{if(!latestStripData){setMessage("#resultMessage","Create your photo strip first.");return}const a=document.createElement("a");a.href=latestStripData;a.download="syazwan-syilah-wedding-photo-strip.png";document.body.append(a);a.click();a.remove();setMessage("#resultMessage","Your download should begin shortly.")});
function dataURLToBlob(data){const parts=data.split(",");const m=parts[0].match(/:(.*?);/);if(!m)throw new Error("Invalid image data.");const bin=atob(parts[1]),bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);return new Blob([bytes],{type:m[1]})}
function safeFileName(){return `${Date.now()}-${window.crypto?.randomUUID?crypto.randomUUID():Math.random().toString(16).slice(2)}.png`}
$("#uploadButton").addEventListener("click",uploadPhotoStrip);
async function uploadPhotoStrip(){
  if(!latestStripData||busy){if(!latestStripData)setMessage("#resultMessage","Create your photo strip first.");return}
  if(!supabaseClient){setMessage("#resultMessage","Upload is not configured. Check Supabase settings.");return}
  busy=true;const btn=$("#uploadButton");btn.disabled=true;btn.textContent="Uploading…";setMessage("#resultMessage","Uploading your photo strip…");
  const path=`photostrips/${safeFileName()}`,name=$("#guestName").value.trim().slice(0,60)||"A wedding guest";
  try{
    const {error:upErr}=await supabaseClient.storage.from(BUCKET).upload(path,dataURLToBlob(latestStripData),{contentType:"image/png",cacheControl:"3600",upsert:false});if(upErr)throw upErr;
    const {error:dbErr}=await supabaseClient.from(PHOTO_TABLE).insert({name,image_path:path});if(dbErr){await supabaseClient.storage.from(BUCKET).remove([path]);throw dbErr}
    const {data:publicData}=supabaseClient.storage.from(BUCKET).getPublicUrl(path);latestPublicUrl=publicData.publicUrl;
    $("#qrCode").replaceChildren();if(window.QRCode)new QRCode($("#qrCode"),{text:latestPublicUrl,width:180,height:180,colorDark:"#352b29",colorLight:"#fffdf9",correctLevel:QRCode.CorrectLevel.H});
    $("#photoLink").href=latestPublicUrl;$("#qrPanel").hidden=false;setMessage("#resultMessage","Uploaded! Scan the QR code with your phone to open and save your photo.");btn.textContent="✓ Uploaded successfully";await loadGallery()
  }catch(e){console.error(e);setMessage("#resultMessage",`Upload failed: ${e.message||"check Supabase table and storage policies"}.`);btn.textContent="Try uploading again"}
  finally{busy=false;btn.disabled=false}
}
async function loadGallery(){
  const grid=$("#photoGrid");grid.replaceChildren(makeText("Loading wedding photos…"));if(!supabaseClient){setMessage("#photoCount","Not connected");grid.replaceChildren(makeText("Gallery is not connected. Check Supabase setup."));return}
  try{const {data,error}=await supabaseClient.from(PHOTO_TABLE).select("id,name,image_path,created_at").order("created_at",{ascending:false}).limit(100);if(error)throw error;setMessage("#photoCount",`${data.length} ${data.length===1?"photo":"photos"}`);grid.replaceChildren();if(!data.length){grid.append(makeText("No photos yet. Be the first to share a memory!"));return}
    for(const photo of data){const {data:u}=supabaseClient.storage.from(BUCKET).getPublicUrl(photo.image_path);const card=document.createElement("article");card.className="photo-card";const img=document.createElement("img");img.className="uploaded-photo";img.src=u.publicUrl;img.alt=`Wedding photo shared by ${photo.name||"a guest"}`;img.loading="lazy";img.onerror=()=>{img.alt="Photo could not be loaded";img.style.opacity=".5"};const cap=document.createElement("p");cap.textContent=`Shared by ${photo.name||"A wedding guest"}`;card.append(img,cap);grid.append(card)}
  }catch(e){console.error(e);setMessage("#photoCount","Unavailable");grid.replaceChildren(makeText(`Could not load gallery: ${e.message||"check Supabase permissions"}.`))}
}
async function loadGuestbook(){
  const list=$("#wishesList");list.replaceChildren(makeText("Loading wishes…"));if(!supabaseClient){list.replaceChildren(makeText("Guestbook is not connected. Check Supabase setup."));return}
  try{const {data,error}=await supabaseClient.from(GUESTBOOK_TABLE).select("id,name,message,created_at").order("created_at",{ascending:false}).limit(100);if(error)throw error;list.replaceChildren();if(!data.length){list.append(makeText("No wishes yet. Leave the first message!"));return}
    data.forEach(w=>{const card=document.createElement("article");card.className="wish-card";const heart=document.createElement("span");heart.className="wish-heart";heart.textContent="♡";const h=document.createElement("h3");h.textContent=w.name||"A wedding guest";const p=document.createElement("p");p.textContent=w.message||"";card.append(heart,h,p);list.append(card)})
  }catch(e){console.error(e);list.replaceChildren(makeText(`Could not load messages: ${e.message||"check table permissions"}.`))}
}
$("#guestbookForm").addEventListener("submit",async e=>{
  e.preventDefault();const name=$("#messageName").value.trim(),message=$("#messageText").value.trim(),btn=$("#sendWishButton"),status=$("#guestbookStatus");
  if(!name||!message){status.textContent="Please enter your name and a wish.";return}if(name.length>50||message.length>400){status.textContent="Please shorten your name or message.";return}if(!supabaseClient){status.textContent="Guestbook is not configured. Check Supabase setup.";return}
  btn.disabled=true;btn.textContent="Sending…";status.textContent="";
  try{const {error}=await supabaseClient.from(GUESTBOOK_TABLE).insert({name,message});if(error)throw error;$("#guestbookForm").reset();status.textContent="Your wishes have been shared. Thank you!";await loadGuestbook()}catch(e){console.error(e);status.textContent=`Could not send message: ${e.message||"check guestbook permissions"}`}finally{btn.disabled=false;btn.textContent="Send your wishes ♡"}
});
$("#againButton").addEventListener("click",async()=>{resetPhotos();showView("photobooth");await startCamera()});
async function initialiseApp(){if(initSupabase())await Promise.allSettled([loadGallery(),loadGuestbook()]);renderSlots()}
initialiseApp();
