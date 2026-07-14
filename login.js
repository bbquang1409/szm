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
    USER={email:info.email,role:r.data.role,hoTen:r.data.hoTen||info.name,lopPhuTrach:r.data.lopPhuTrach||'',token:t.access_token,tokenExpiry:Date.now()+(t.expires_in||3600)*1000};
    saveSession();
    scheduleTokenRefresh();
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
// ── LAM MOI TOKEN NGAM (tranh bi vang ra ngoai giua chung khi dang thao tac) ──
let _refreshTimer=null;
function scheduleTokenRefresh(){
  if(_refreshTimer) clearTimeout(_refreshTimer);
  if(!USER || !USER.tokenExpiry) return;
  // Lam moi truoc khi het han 5 phut, de token gan nhu khong bao gio het han
  // trong luc dang dung app (dang go form, dang diem danh...).
  const delay = Math.max(5000, USER.tokenExpiry - Date.now() - 5*60*1000);
  _refreshTimer = setTimeout(()=>{ refreshTokenSilently(); }, delay);
}
// Xin access_token moi ma KHONG hien popup dang nhap (prompt:'') - Google cho phep
// vi nguoi dung da dong y quyen truoc do trong cung phien lam viec nay.
function refreshTokenSilently(){
  return new Promise(resolve=>{
    if(!USER){ resolve(false); return; }
    try{
      google.accounts.oauth2.initTokenClient({
        client_id:GCI,scope:'profile email',prompt:'',
        callback:(t)=>{
          if(t && t.access_token){
            USER.token=t.access_token;
            USER.tokenExpiry=Date.now()+(t.expires_in||3600)*1000;
            saveSession();
            scheduleTokenRefresh();
            resolve(true);
          } else resolve(false);
        },
        error_callback:()=>resolve(false),
      }).requestAccessToken();
    }catch(e){ resolve(false); }
  });
}

function logout(){
  if(_refreshTimer) clearTimeout(_refreshTimer);
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
  const r = await fetch(API+'?action='+encodeURIComponent(action)+'&email='+encodeURIComponent(email)+'&_='+Date.now(), {
    method:'POST',
    cache:'no-store',
    // Cố ý dùng text/plain (không phải application/json) — nếu để application/json, trình duyệt sẽ
    // gửi 1 request "dò đường" (preflight, method OPTIONS) trước, mà Google Apps Script KHÔNG hỗ trợ
    // xử lý OPTIONS, trả về lỗi 405 khiến request thật không bao giờ được gửi ("Failed to fetch").
    // Backend vẫn đọc được JSON bình thường vì nó đọc thẳng nội dung thô (e.postData.contents),
    // không quan tâm Content-Type khai báo là gì.
    headers:{'Content-Type':'text/plain;charset=utf-8'},
    body: JSON.stringify({...rest,action,email,token})
  });
  if(!r.ok) throw new Error('HTTP '+r.status);
  const res = await r.json();
  if(!res.ok && /dang nhap|token/i.test(res.error||'') && !params._retried){
    // Thu lam moi token ngam roi gui lai request 1 lan, thay vi dang xuat ngay
    // va lam mat het thong tin nguoi dung dang nhap dang do.
    const refreshed = await refreshTokenSilently();
    if(refreshed) return callPost({...params,_retried:true});
    toast('Phiên đăng nhập hết hạn, vui lòng đăng nhập lại','error'); logout();
  }
  return res;
}

async function call(params){
  const p={email:USER?.email||'',token:USER?.token||'',...params,_:Date.now()};
  const qs=Object.entries(p).map(([k,v])=>encodeURIComponent(k)+'='+encodeURIComponent(typeof v==='object'?JSON.stringify(v):String(v))).join('&');
  const r=await fetch(API+'?'+qs,{cache:'no-store'});
  if(!r.ok) throw new Error('HTTP '+r.status);
  const res = await r.json();
  if(!res.ok && /dang nhap|token/i.test(res.error||'') && params.action!=='whoami' && !params._retried){
    const refreshed = await refreshTokenSilently();
    if(refreshed) return call({...params,_retried:true});
    toast('Phiên đăng nhập hết hạn, vui lòng đăng nhập lại','error'); logout();
  }
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
    scheduleTokenRefresh();
    return true;
  }catch(e){ return false; }
}
