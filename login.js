const GCI = '39863848508-e8iffhhvlv2h7l06395vunsp2i3ksnh8.apps.googleusercontent.com';
const API = 'https://script.google.com/macros/s/AKfycbw7w_WgTjrskEXN6ubY1wLEFAoJjvOBuobmkymTaEd2kAYq4Nf7mEJt-g2KevZvVcI9/exec';

let USER=null;

// ── AUTH ──
function startGoogleLogin(){
  startLoading();
  google.accounts.oauth2.initTokenClient({client_id:GCI,scope:'profile email',callback:onToken}).requestAccessToken();
}
async function onToken(t){
  // showLoginError('Đang xác thực...'); // ẩn để tránh nhầm lỗi
  try{
    const res=await fetch('https://www.googleapis.com/oauth2/v3/userinfo',{headers:{Authorization:'Bearer '+t.access_token}});
    const info=await res.json();
    if(!info.email){showLoginError('Không lấy được email');return;}
    const r=await call({action:'whoami',email:info.email,token:t.access_token});
    if(!r.ok){showLoginError(r.error||'Email không được phép');return;}
    // Lưu access_token thật để mọi request sau đều được backend xác thực,
    // thay vì chỉ tin vào chuỗi email (tránh giả mạo email để leo quyền).
    USER={email:info.email,role:r.data.role,hoTen:r.data.hoTen||info.name,lopPhuTrach:r.data.lopPhuTrach||'',token:t.access_token};
    saveSession();
    completeLoading();
    setTimeout(startApp, 300);
  }catch(e){showLoginError('Lỗi: '+e.message);}
}
function showLoginError(msg){
  stopLoading();
  const el=document.getElementById('login-error');
  el.textContent=msg;el.style.display='block';
}

let _loadTimers=[];
function startLoading(){
  document.getElementById('login-btn').disabled=true;
  document.getElementById('login-btn').style.opacity='.6';
  document.getElementById('login-error').style.display='none';
  document.getElementById('login-loading').style.display='block';
  const fill=document.getElementById('loading-fill');
  fill.style.transition='none';
  fill.style.width='0%';
  // ép trình duyệt "chốt" lại width 0% trước khi đổi, để bước tiếp theo chắc chắn animate mượt
  void fill.offsetWidth;
  fill.style.transition='width 2.6s cubic-bezier(.22,.61,.36,1)';
  fill.style.width='92%'; // chạy mượt liên tục tới 92% trong lúc chờ xác thực, không nhảy cóc theo mốc %

  const msgs=[
    {msg:'Đang kết nối Google...',t:200},
    {msg:'Xác thực tài khoản...',t:900},
    {msg:'Kiểm tra quyền truy cập...',t:1700},
    {msg:'Đang tải dữ liệu...',t:2400},
  ];
  _loadTimers.forEach(id=>clearTimeout(id));
  _loadTimers=msgs.map(({msg,t})=>setTimeout(()=>{
    document.getElementById('loading-msg').textContent=msg;
  },t));
}
function stopLoading(){
  _loadTimers.forEach(id=>clearTimeout(id));
  _loadTimers=[];
  document.getElementById('login-btn').disabled=false;
  document.getElementById('login-btn').style.opacity='1';
  document.getElementById('login-loading').style.display='none';
  const fill=document.getElementById('loading-fill');
  fill.style.transition='none';
  fill.style.width='0%';
}
function completeLoading(){
  _loadTimers.forEach(id=>clearTimeout(id));
  _loadTimers=[];
  const fill=document.getElementById('loading-fill');
  fill.style.transition='width .5s ease';
  fill.style.width='100%';
  document.getElementById('loading-msg').textContent='Hoàn tất!';
}
function logout(){
  USER=null;
  clearSession();
  stopLoading(); // reset thanh loading + mở lại nút "Đăng nhập bằng Google" (trước đây quên reset, gây kẹt ở 100%/disabled sau khi đăng xuất)
  document.getElementById('app-shell').style.display='none';
  document.getElementById('login-screen').style.display='flex';
  document.getElementById('login-error').style.display='none';
}

// ── API ──
async function callPost(params){
  // Dùng POST để tránh giới hạn URL với JSON lớn (caHoc)
  const {action,...rest} = params;
  const email = USER?.email||'';
  const token = rest.token || USER?.token || '';
  const r = await fetch(API+'?action='+encodeURIComponent(action)+'&email='+encodeURIComponent(email), {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({...rest,action,email,token})
  });
  if(!r.ok) throw new Error('HTTP '+r.status);
  const res = await r.json();
  if(!res.ok && /dang nhap|token/i.test(res.error||'')){ toast('Phiên đăng nhập hết hạn, vui lòng đăng nhập lại','error'); logout(); }
  return res;
}

async function call(params){
  const p={email:USER?.email||'',token:USER?.token||'',...params};
  const qs=Object.entries(p).map(([k,v])=>encodeURIComponent(k)+'='+encodeURIComponent(typeof v==='object'?JSON.stringify(v):String(v))).join('&');
  const r=await fetch(API+'?'+qs);
  if(!r.ok) throw new Error('HTTP '+r.status);
  const res = await r.json();
  if(!res.ok && /dang nhap|token/i.test(res.error||'') && params.action!=='whoami'){ toast('Phiên đăng nhập hết hạn, vui lòng đăng nhập lại','error'); logout(); }
  return res;
}

// ── PHIEN DANG NHAP (sessionStorage) ──
const SESSION_KEY = 'szm_session';

function saveSession(){
  try{ sessionStorage.setItem(SESSION_KEY, JSON.stringify(USER)); }catch(e){}
}
function clearSession(){
  try{ sessionStorage.removeItem(SESSION_KEY); }catch(e){}
}
// Thu khoi phuc phien dang nhap da luu (khi F5 trong luc test, khoi phai dang nhap lai
// tu dau) -- van goi whoami de xac nhan token con hop le truoc khi cho vao thang app.
async function tryRestoreSession(){
  try{
    const raw = sessionStorage.getItem(SESSION_KEY);
    if(!raw) return false;
    const saved = JSON.parse(raw);
    if(!saved || !saved.email || !saved.token) return false;
    const r = await call({action:'whoami', email:saved.email, token:saved.token});
    if(!r.ok){ clearSession(); return false; }
    USER = saved;
    return true;
  }catch(e){ return false; }
}
