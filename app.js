const CAP_DO_COLORS = {'A1':'#e8f0fb','A2':'#e1f5ee','B1':'#faeeda','B2':'#fef0ee','LTB1':'#f0ebff','LTB2':'#e8f5e1'};
const CAP_DO_TEXT   = {'A1':'#1a50a0','A2':'#0f6e56','B1':'#7d4e0a','B2':'#993c1d','LTB1':'#5a30b5','LTB2':'#1a6e3c'};
const LOP_COLORS    = ['#378add','#1d9e75','#ba7517','#d4537e','#7f77dd','#0f6e56'];
const LOAI_DIEM     = {bai_tap:'Bài tập',giua_ky:'Giữa kỳ',cuoi_ky:'Cuối kỳ',khong_lam_btvn:'Không làm BTVN'};
const TRANG_THAI_DD = {co_mat:'Có mặt',vang_phep:'Nghỉ có phép',vang_khong_phep:'Nghỉ không phép',di_tre:"Đi trễ >15'"};
const TRANG_THAI_HV = {danghoc:'Đang học',nghi:'Đã nghỉ',baoluu:'Bảo lưu'};
const ROLES_VI      = {admin:'Admin',giaovien:'Giáo viên',trogiang:'Trợ giảng',quanly:'Quản lý',phuhuynh:'Phụ huynh'};

let LOPS=[], LOP_DATA=[], CURRENT_PAGE='dashboard', CURRENT_LOP='', CURRENT_TAB='', MODAL_CB=null;

// ── BOOT ──
function dismissAlert(lopId){
  const d = JSON.parse(localStorage.getItem('szm_alert_dismissed')||'{}');
  d[lopId] = Date.now();
  localStorage.setItem('szm_alert_dismissed', JSON.stringify(d));
  loadLops(); // reload để cập nhật banner
}

async function startApp(){
  document.getElementById('login-screen').style.display='none';
  document.getElementById('app-shell').style.display='flex';
  const ini=USER.hoTen.split(' ').slice(-2).map(w=>w[0]).join('').toUpperCase();
  const av=document.getElementById('user-avatar');
  av.textContent=ini;av.style.background='#e8f0fb';av.style.color='#1a50a0';
  document.getElementById('user-display-name').textContent=USER.hoTen;
  const rp=document.getElementById('user-role-pill');
  rp.textContent=ROLES_VI[USER.role]||USER.role;rp.className='role-pill r-'+USER.role;
  applyRoleNav();
  await loadLops();
  await refreshAllAccounts();
  navTo('dashboard');
}

// Danh sách tài khoản (dùng để tra tên/vai trò giáo viên-trợ giảng) chỉ tự tải lúc đăng nhập,
// không tự làm mới — gọi lại hàm này sau khi có thay đổi tài khoản (tạo test, thêm/sửa/xóa TK)
// để tránh hiện thiếu tên do dữ liệu cũ còn lưu trong bộ nhớ trình duyệt.
async function refreshAllAccounts(){
  if(!['admin','giaovien','quanly','trogiang'].includes(USER.role)) return;
  const tk=await call({action:'getTaiKhoanList'});
  window.ALL_ACCOUNTS = tk.ok?tk.data:(window.ALL_ACCOUNTS||[]);
}

function applyRoleNav(){
  const r=USER.role;
  if(r==='phuhuynh'){['nav-lophoc','nav-hocvien','nav-taikhoan','lop-section','lop-nav'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='none';});}
  if(r==='giaovien') document.getElementById('nav-taikhoan').style.display='none';
  if(r==='trogiang') document.getElementById('nav-taikhoan').style.display='none';
  if(r==='quanly') document.getElementById('nav-taikhoan').style.display='none';
}

async function loadLops(){
  const r=await call({action:'getLopList'});
  if(!r.ok) return;
  LOP_DATA=r.data;
  LOPS=LOP_DATA.map(l=>l.tenLop);
  renderLopNav();
  renderFilterLop();
  // Cảnh báo kiểm tra
  // Lọc các cảnh báo còn hiệu lực (chưa quá hạn) và chưa bị tắt
  const dismissed = JSON.parse(localStorage.getItem('szm_alert_dismissed')||'{}');
  const alerts = LOP_DATA.filter(l=>{
    if(l.daQuaGiuaKy && l.daQuaCuoiKy) return false; // đã quá hạn cả 2 → tự tắt
    if(dismissed[l.lopId]) return false; // đã bị tắt thủ công
    return l.canhBaoGiuaKy || l.canhBaoCuoiKy;
  });
  if(alerts.length>0){
    document.getElementById('badge-lop').style.display='';
    const banner = document.getElementById('alert-banner');
    banner.style.display='flex';
    banner.style.flexDirection='column';
    banner.style.gap='4px';
    banner.innerHTML = alerts.map(l=>{
      const msg = l.canhBaoCuoiKy
        ? `🔴 <strong>${l.tenLop}</strong>: Cuối kỳ còn <strong>${l.soNgayConCuoiKy} ngày</strong>!`
        : `🟡 <strong>${l.tenLop}</strong>: Giữa kỳ còn <strong>${l.soNgayConGiuaKy} ngày</strong>!`;
      return `<div style="display:flex;align-items:center;gap:10px;padding:2px 0">
        <span class="alert-blink"></span>
        <span style="flex:1;font-size:13px">${msg}</span>
        <button onclick="dismissAlert('${l.lopId}')" style="background:none;border:1.5px solid rgba(125,78,10,.3);border-radius:6px;padding:2px 8px;font-size:11px;color:#7d4e0a;cursor:pointer">✕ Tắt</button>
      </div>`;
    }).join('');
  } else {
    document.getElementById('badge-lop').style.display='none';
    document.getElementById('alert-banner').style.display='none';
  }
}

function renderLopNav(){
  const nav=document.getElementById('lop-nav');
  if(!nav) return;
  nav.innerHTML=LOP_DATA.map((l,i)=>{
    const hasAlert=l.canhBaoGiuaKy||l.canhBaoCuoiKy;
    return `<div class="nav-lop" data-lop="${l.tenLop}" onclick="filterByLop('${l.tenLop}')">
      <span class="lop-dot" style="background:${LOP_COLORS[i%LOP_COLORS.length]}"></span>
      ${l.tenLop}
      ${hasAlert?'<span class="alert-dot"></span>':''}
    </div>`;
  }).join('');
}

function renderFilterLop(){
  const sel=document.getElementById('filter-lop');
  sel.innerHTML='<option value="">Tất cả lớp</option>'+LOPS.map(l=>`<option value="${l}">${l}</option>`).join('');
  sel.onchange=()=>{CURRENT_LOP=sel.value;renderCurrentPage();};
}

function filterByLop(lop){
  CURRENT_LOP=lop;
  document.getElementById('filter-lop').value=lop;
  document.querySelectorAll('.nav-lop').forEach(el=>el.classList.toggle('active',el.dataset.lop===lop));
  if(CURRENT_PAGE==='hocvien'){ renderCurrentPage(); return; }
  // Click từ sidebar → mở thẳng lớp đó (tab điểm danh)
  const lopObj = LOP_DATA.find(l=>l.tenLop===lop);
  if(lopObj){ openLopDetail(lopObj.lopId); }
  else { navTo('hocvien'); }
}

// ── NAV ──
function navTo(page){
  CURRENT_PAGE=page;CURRENT_TAB='';
  document.querySelectorAll('.nav-item[data-page]').forEach(el=>el.classList.toggle('active',el.dataset.page===page));
  const titles={dashboard:'Dashboard',lophoc:'Lớp học',hocvien:'Học viên',taikhoan:'Tài khoản'};
  document.getElementById('page-title').textContent=titles[page]||page;
  document.getElementById('btn-back').style.display='none';
  document.getElementById('btn-msg').style.display='none';
  document.getElementById('btn-bulk').style.display='none';
  document.getElementById('filter-lop').style.display=page==='hocvien'?'':'none';
  document.getElementById('filter-ngay').style.display='none';
  document.getElementById('btn-add').style.display=['lophoc','hocvien','taikhoan'].includes(page)&&USER.role!=='phuhuynh'?'':'none';
  document.getElementById('tab-bar').style.display=page==='hocvien'?'':'none';
  tutInit(page);
  renderCurrentPage();
}

function renderCurrentPage(){
  switch(CURRENT_PAGE){
    case 'dashboard': renderDashboard();break;
    case 'lophoc':   renderLopHoc();break;
    case 'lopdetail':renderLopDetail();break;
    case 'hocvien':  renderHocVien();break;
    case 'taikhoan': renderTaiKhoan();break;
  }
}

// ── DASHBOARD ──
async function renderDashboard(){
  setContent('<div class="empty">Đang tải...</div>');
  const r=await call({action:'getDashboard'});
  if(!r.ok){setContent('<div class="empty">Không tải được</div>');return;}
  const d=r.data;
  if(USER.role==='phuhuynh'){await renderDashboardPH(d);return;}
  const ktAlerts=(d.canhBaoKiemTra||[]);
  setContent(`
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-label">Tổng học viên</div><div class="stat-value">${d.tongHocVien||0}</div><div class="stat-sub">${d.tongLop||0} lớp</div></div>
      <div class="stat-card"><div class="stat-label">Chuyên cần TB</div><div class="stat-value" style="color:${(d.chuyenCanTB||0)>=80?'#0f6e56':'#ba7517'}">${d.chuyenCanTB!=null?d.chuyenCanTB+'%':'—'}</div><div class="stat-sub">7 ngày gần nhất</div></div>
      <div class="stat-card"><div class="stat-label">Điểm TB</div><div class="stat-value">${d.diemTB||'—'}</div><div class="stat-sub">Toàn trung tâm</div></div>
      <div class="stat-card"><div class="stat-label">Cần liên hệ</div><div class="stat-value" style="color:#e24b4a">${d.canhBaoLan2||0}</div><div class="stat-sub">${d.canhBaoLan1||0} đang theo dõi</div></div>
    </div>
    ${ktAlerts.length>0?`
    <div class="table-wrap" style="margin-bottom:16px;padding:14px 16px">
      <div style="font-size:13px;font-weight:600;color:#0d2d5e;margin-bottom:10px">🔔 Cảnh báo kiểm tra sắp tới</div>
      ${ktAlerts.map(l=>`
        <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #f0f4fa">
          <span style="font-weight:500">${l.tenLop}</span>
          ${l.canhBaoGiuaKy?`<span class="badge b-warn1" style="animation:pulse 1.5s infinite">Giữa kỳ còn ${l.soNgayConGiuaKy} ngày</span>`:''}
          ${l.canhBaoCuoiKy?`<span class="badge b-warn2" style="animation:pulse 1.5s infinite">Cuối kỳ còn ${l.soNgayConCuoiKy} ngày</span>`:''}
          <button class="btn btn-sm" onclick="navTo('lophoc')">Xem lớp</button>
        </div>`).join('')}
    </div>`:''}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <div class="table-wrap" style="padding:14px 16px">
        <div style="font-size:13px;font-weight:600;color:#0d2d5e;margin-bottom:10px">Lớp học</div>
        ${LOP_DATA.map((l,i)=>`<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid #f0f4fa;cursor:pointer" onclick="filterByLop('${l.tenLop}')">
          <span style="width:8px;height:8px;border-radius:50%;background:${LOP_COLORS[i%LOP_COLORS.length]};display:inline-block;flex-shrink:0"></span>
          <span style="flex:1;font-size:13px">${l.tenLop}</span>
          <span class="lop-cap" style="background:${CAP_DO_COLORS[l.capDo]||'#f0f4fa'};color:${CAP_DO_TEXT[l.capDo]||'#5a6478'}">${l.capDo||''}</span>
          ${l.canhBaoGiuaKy||l.canhBaoCuoiKy?'<span style="width:7px;height:7px;border-radius:50%;background:#e24b4a;flex-shrink:0"></span>':''}
        </div>`).join('')}
      </div>
      <div class="table-wrap" style="padding:14px 16px">
        <div style="font-size:13px;font-weight:600;color:#0d2d5e;margin-bottom:10px">Chuyên cần</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:4px">
          <div style="background:#fef0ee;border-radius:8px;padding:12px;text-align:center"><div style="font-size:22px;font-weight:600;color:#e24b4a">${d.canhBaoLan2||0}</div><div style="font-size:11px;color:#993c1d;margin-top:4px">Email đã gửi PH</div></div>
          <div style="background:#faeeda;border-radius:8px;padding:12px;text-align:center"><div style="font-size:22px;font-weight:600;color:#ba7517">${d.canhBaoLan1||0}</div><div style="font-size:11px;color:#7d4e0a;margin-top:4px">Cờ cảnh báo</div></div>
        </div>
      </div>
    </div>
  `);
}
async function renderDashboardPH(d){
  const hvList = d.hocVien||[];
  // Lấy điểm và điểm danh của từng con
  const bdRes = await Promise.all(hvList.map(hv=>call({action:'getBangDiemByStudent',studentId:hv.studentId})));
  const ddRes = await Promise.all(hvList.map(hv=>call({action:'getDiemDanhByStudent',studentId:hv.studentId})));

  // Lấy tin nhắn của phụ huynh
  const tbR = await call({action:'getThongBao'});
  const msgList = (tbR.ok?tbR.data:[]).slice().sort((a,b)=>a.ngayGui.localeCompare(b.ngayGui));

  setContent(`
    <div class="stat-grid" style="grid-template-columns:1fr 1fr">
      <div class="stat-card"><div class="stat-label">Học viên</div><div class="stat-value">${d.soHocVien||0}</div></div>
      <div class="stat-card"><div class="stat-label">Tin nhắn chưa đọc</div><div class="stat-value" style="color:#1a50a0">${d.thongBaoChuaDoc||0}</div></div>
    </div>
    ${hvList.map((hv,i)=>{
      const bd = bdRes[i].ok?bdRes[i].data:[];
      const dd = ddRes[i].ok?ddRes[i].data:[];
      const viPham = dd.filter(r=>['vang_phep','vang_khong_phep','di_tre'].includes(r.trangThai));
      // Thời lượng khóa học + % tiến độ (dựa theo ngày bắt đầu/kết thúc của lớp)
      let tienDoHtml = '';
      if(hv.lopNgayBatDau && hv.lopNgayKetThuc){
        const tong = diffDaysClient(hv.lopNgayBatDau, hv.lopNgayKetThuc);
        const daQua = diffDaysClient(hv.lopNgayBatDau, todayStr());
        const pct = tong>0 ? Math.max(0, Math.min(100, Math.round(daQua/tong*100))) : 0;
        tienDoHtml = `<div style="margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;color:#5a6478;margin-bottom:5px">
            <span>📅 ${fmtDate(hv.lopNgayBatDau)} – ${fmtDate(hv.lopNgayKetThuc)}</span>
            <span style="font-weight:700;color:#1a50a0">Đã học ${pct}%</span>
          </div>
          <div style="height:6px;background:#eef2f7;border-radius:4px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#1a50a0,#3a7bd5);border-radius:4px"></div>
          </div>
        </div>`;
      }
      return `
      <div class="table-wrap" style="margin-top:14px;padding:14px 16px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
          <div class="avatar" style="background:#e8f0fb;color:#1a50a0">${ini(hv.hoTen)}</div>
          <div><div style="font-weight:600;font-size:14px">${hv.hoTen}</div><div style="font-size:11px;color:#8a96a8">${hv.lop}</div></div>
          <span class="badge ${ttClass(hv.trangThai)}" style="margin-left:auto">${TRANG_THAI_HV[hv.trangThai]||hv.trangThai}</span>
        </div>
        ${tienDoHtml}
        <div style="font-size:12px;font-weight:600;color:#5a6478;margin-bottom:6px">Bảng điểm gần đây</div>
        ${bd.length===0?'<div style="font-size:12px;color:#a0aab8;margin-bottom:10px">Chưa có điểm</div>':
          `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">${bd.slice(0,8).map(b=>
            b.loai==='khong_lam_btvn'
            ?`<span class="badge b-vang">${fmtDate(b.ngay)}: Không làm BTVN</span>`
            :`<span class="badge ${loaiClass(b.loai)}">${LOAI_DIEM[b.loai]}: ${b.diem}</span>`
          ).join('')}</div>`}
        <div style="font-size:12px;font-weight:600;color:#5a6478;margin-bottom:6px">Chuyên cần gần đây</div>
        ${viPham.length===0?'<div style="font-size:12px;color:#0f6e56">Đi học đầy đủ, không vi phạm</div>':
          `<div style="display:flex;flex-wrap:wrap;gap:6px">${viPham.slice(0,8).map(v=>
            `<span class="badge ${ddClass(v.trangThai)}">${fmtDate(v.ngay)}: ${TRANG_THAI_DD[v.trangThai]}</span>`
          ).join('')}</div>`}
      </div>`;
    }).join('')}

    <div class="table-wrap" style="margin-top:14px;padding:14px 16px">
      <div style="font-size:13px;font-weight:600;color:#0d2d5e;margin-bottom:12px">✉️ Tin nhắn từ trung tâm</div>
      ${msgList.length===0?'<div class="empty" style="padding:20px"><p>Chưa có tin nhắn nào</p></div>':
        msgList.map(tb=>`
        <div style="background:#f5f8fd;border-radius:12px;border-bottom-left-radius:4px;padding:10px 14px;margin-bottom:10px;${!tb.daDocs?'box-shadow:0 0 0 2px #3a7bd5':''}">
          <div style="font-size:13px;line-height:1.6;white-space:pre-wrap">${escapeHtml(tb.noiDung)}</div>
          <div style="font-size:10px;margin-top:6px;color:#8a96a8;display:flex;gap:8px">
            <span>${tb.nguoiGui}</span><span>${fmtDate(tb.ngayGui)}</span>
            ${tb.lopTarget?`<span>· Lớp ${tb.lopTarget}</span>`:''}
            ${!tb.daDocs?'<span style="color:#1a50a0;font-weight:600">● Mới</span>':''}
          </div>
        </div>`).join('')}
    </div>
  `);

  // Đánh dấu đã đọc
  msgList.filter(tb=>!tb.daDocs).forEach(tb=>call({action:'markThongBaoDaDoc',tbId:tb.tbId}));
}

function escapeHtml(s){
  const d=document.createElement('div'); d.textContent=s||''; return d.innerHTML;
}

// ── LOP HOC ──
async function renderLopHoc(){
  setContent('<div class="empty">Đang tải...</div>');
  const r=await call({action:'getLopList'});
  LOP_DATA=r.ok?r.data:[];
  document.getElementById('btn-add').onclick=()=>openModalLop(null);
  document.getElementById('btn-add').textContent='+ Thêm lớp';
  const canMsg=['admin','quanly'].includes(USER.role);
  const btnMsg=document.getElementById('btn-msg');
  if(canMsg){ btnMsg.style.display=''; btnMsg.onclick=openModalGuiTinLop; } else { btnMsg.style.display='none'; }
  if(LOP_DATA.length===0){setContent('<div class="empty"><p>Chưa có lớp nào. Thêm lớp đầu tiên!</p></div>');return;}
  setContent(`
    <div class="lop-grid">${LOP_DATA.map(l=>lopCard(l)).join('')}</div>
  `);
}

function openModalGuiTinLop(){
  showModal('Gửi tin nhắn cho lớp',`
    <div class="form-row"><label>Gửi tới *</label>
      <select id="f-target">
        <option value="all">📢 Tất cả phụ huynh (mọi lớp)</option>
        ${LOPS.map(l=>`<option value="lop_${l}">👥 Phụ huynh lớp ${l}</option>`).join('')}
      </select>
    </div>
    <div class="form-row"><label>Nội dung *</label><textarea id="f-msg" rows="4" placeholder="Nhập nội dung tin nhắn..."></textarea></div>
  `,async()=>{
    const target=document.getElementById('f-target').value;
    const noiDung=document.getElementById('f-msg').value.trim();
    if(!noiDung){toast('Nhập nội dung','error');return;}
    const body={tieuDe:noiDung.slice(0,40),noiDung,nguoiNhan:target.startsWith('lop_')?'all':target,lop:target.startsWith('lop_')?target.replace('lop_',''):''};
    const r=await call({action:'sendThongBao',...body});
    if(!r.ok){toast(r.error||'Lỗi khi gửi','error');return;}
    closeModal();toast('Đã gửi tin nhắn','success');
  });
}

function lopCard(l){
  const total=dateDiff(l.ngayBatDau,l.ngayKetThuc);
  const passed=dateDiff(l.ngayBatDau,todayStr());
  const pct=total>0?Math.max(0,Math.min(100,Math.round(passed/total*100))):0;
  const canEdit=['admin'].includes(USER.role);
  return `<div class="lop-card ${l.canhBaoGiuaKy||l.canhBaoCuoiKy?'has-alert':''}"
    onclick="openLopDetail('${l.lopId}')" style="cursor:pointer">
    ${canEdit?`<div class="lop-actions">
      <button class="btn btn-sm" onclick="event.stopPropagation();openModalLop('${l.lopId}')">Sửa</button>
      <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();deleteLop('${l.lopId}')">Xóa</button>
    </div>`:''}
    <div class="lop-title">${l.tenLop}</div>
    <span class="lop-cap" style="background:${CAP_DO_COLORS[l.capDo]||'#f0f4fa'};color:${CAP_DO_TEXT[l.capDo]||'#5a6478'}">${l.capDo||'—'}</span>
    <div style="font-size:11px;color:#8a96a8">GV: ${l.giaoVienEmail||'—'}</div>
    ${l.ngayBatDau&&l.ngayKetThuc?`
    <div class="lop-progress-wrap">
      <div class="lop-progress-label"><span>Tiến độ</span><span>${pct}%</span></div>
      <div class="lop-progress"><div class="lop-progress-fill" style="width:${pct}%;background:${pct>=100?'#0f6e56':'#3a7bd5'}"></div></div>
    </div>
    <div class="lop-dates">${fmtDate(l.ngayBatDau)} → ${fmtDate(l.ngayKetThuc)}</div>
    ${l.ngayGiuaKy?`<div style="font-size:11px;color:#8a96a8;margin-top:4px">Giữa kỳ: ${fmtDate(l.ngayGiuaKy)}</div>`:''}
    `:''}
    ${l.canhBaoGiuaKy?`<div class="kt-alert giua">⚠ Giữa kỳ còn ${l.soNgayConGiuaKy} ngày!</div>`:''}
    ${l.canhBaoCuoiKy?`<div class="kt-alert cuoi">🔴 Cuối kỳ còn ${l.soNgayConCuoiKy} ngày!</div>`:''}
  </div>`;
}

async function openModalLop(lopId){
  // Ghi nhớ NGAY bạn đang đứng ở đâu tại thời điểm mở modal này (trang danh sách Lớp học
  // hay trang chi tiết 1 lớp cụ thể) — để sau khi lưu xong, quay lại ĐÚNG chỗ đó, không phụ
  // thuộc vào biến toàn cục CURRENT_PAGE (biến này có thể bị đổi bởi thao tác khác trong lúc
  // đang chờ lưu, khiến bị "văng" sang trang khác ngoài ý muốn).
  const originPage = CURRENT_PAGE;
  const originLopDetailId = LOP_DETAIL_ID;
  let l=null;
  if(lopId) l=LOP_DATA.find(x=>x.lopId===lopId)||null;
  const tvList=await call({action:'getTaiKhoanList'});
  const gvList=tvList.ok?tvList.data.filter(t=>['giaovien','trogiang','admin'].includes(t.role)):[];
  CA_HOC_GV_LIST = gvList;
  let caHocList = [];
  try{ caHocList = l?.caHoc ? JSON.parse(l.caHoc) : []; }catch(e){ caHocList = []; }
  if(caHocList.length===0) caHocList=[{ten:'',nguoiDay:''}];

  showModal(l?'Sửa lớp':'Thêm lớp mới',`
    <div class="form-grid2">
      <div class="form-row"><label>Tên lớp *</label><input id="f-tenLop" value="${l?.tenLop||''}"></div>
      <div class="form-row"><label>Cấp độ</label>
        <select id="f-capDo">
          ${['A1','A2','B1','B2','LTB1','LTB2'].map(c=>`<option value="${c}" ${l?.capDo===c?'selected':''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="form-row"><label>Ngày bắt đầu</label><input type="date" id="f-ngayBD" value="${l?.ngayBatDau||''}"></div>
      <div class="form-row"><label>Ngày kết thúc (dự kiến)</label><input type="date" id="f-ngayKT" value="${l?.ngayKetThuc||''}"></div>
    </div>
    <div class="form-row"><label>Giáo viên chính</label>
      <select id="f-gv">
        <option value="">— Chọn giáo viên —</option>
        ${gvList.map(gv=>`<option value="${gv.email}" ${l?.giaoVienEmail===gv.email?'selected':''}>${gv.hoTen} (${gv.email})</option>`).join('')}
      </select>
    </div>

    <div class="form-row">
      <label>Các buổi học trong tuần <span style="font-weight:400;color:#8a96a8">(vd: Sáng - Trợ giảng, Chiều - GV Việt...)</span></label>
      <div id="ca-hoc-list">
        ${caHocList.map((ca,i)=>caHocRow(ca,i,gvList)).join('')}
      </div>
      <button type="button" class="btn btn-sm" style="margin-top:6px" onclick="addCaHocRow()">+ Thêm buổi học</button>
    </div>

    <div class="form-row" style="margin-top:10px"><label>Ghi chú</label><textarea id="f-ghiChu" rows="2">${l?.ghiChu||''}</textarea></div>
    <div class="hint">Ngày kiểm tra giữa kỳ sẽ được tính tự động = 50% thời gian lớp học. Cảnh báo sẽ hiện khi còn ≤ 7 ngày. Khi điểm danh, giáo viên/trợ giảng sẽ chọn đúng buổi học đang dạy.</div>
  `,async()=>{
    const caHoc = collectCaHocList();
    const body={tenLop:document.getElementById('f-tenLop').value.trim(),capDo:document.getElementById('f-capDo').value,ngayBatDau:document.getElementById('f-ngayBD').value,ngayKetThuc:document.getElementById('f-ngayKT').value,giaoVienEmail:document.getElementById('f-gv').value,ghiChu:document.getElementById('f-ghiChu').value.trim(),caHoc:JSON.stringify(caHoc)};
    if(!body.tenLop){toast('Nhập tên lớp','error');return;}
    let r;
    if(l){body.lopId=lopId;r=await callPost({action:'updateLop',...body});}
    else r=await callPost({action:'addLop',...body});
    if(!r.ok){toast(r.error||'Lỗi khi lưu lớp','error');return;}
    closeModal();toast(l?'Đã cập nhật lớp':'Đã thêm lớp','success');
    await loadLops();
    await refreshAllAccounts();
    if(originPage==='lopdetail' && originLopDetailId){
      LOP_DETAIL_ID = originLopDetailId;
      CURRENT_PAGE = 'lopdetail';
      const nl=LOP_DATA.find(x=>x.lopId===originLopDetailId);
      if(nl) renderLopDetail(); else renderLopHoc();
    } else {
      renderLopHoc();
    }
  });
}
async function deleteLop(lopId){
  if(!confirm('Xóa lớp này? Dữ liệu học viên không bị xóa.')) return;
  const r=await call({action:'deleteLop',lopId});
  if(!r.ok){toast(r.error||'Lỗi khi xóa lớp','error');return;}
  toast('Đã xóa lớp','success');await loadLops();renderLopHoc();
}

// ── CA HOC (quản lý các ca trong tuần của 1 lớp) ──
let CA_HOC_COUNTER = 0;
function caHocRow(ca,i,gvList){
  const rowId = 'ca-row-'+i+'-'+(CA_HOC_COUNTER++);
  const PRESETS = ['Sáng','Chiều','Tối'];
  const THU_LIST = ['T2','T3','T4','T5','T6','T7','CN'];
  // Parse existing thu nếu có
  const thuArr = ca.thu ? ca.thu.split(',') : [];
  return `<div class="ca-hoc-row" data-rowid="${rowId}" style="background:#f8fafd;border-radius:10px;padding:10px 12px;margin-bottom:8px;border:1.5px solid #e4ebf5">
    <div style="display:flex;gap:8px;margin-bottom:8px;align-items:center">
      <div style="display:flex;gap:4px">
        ${PRESETS.map(p=>`<button type="button" class="ca-preset-btn btn btn-sm ${ca.ten===p?'btn-primary':''}"
          style="min-width:52px" onclick="setCaPreset(this,'${rowId}','${p}')">${p}</button>`).join('')}
      </div>
      <input class="ca-ten" placeholder="Hoặc tự nhập tên ca..." value="${ca.ten||''}"
        style="flex:1;font-size:13px" oninput="clearCaPreset('${rowId}')">
      <button type="button" class="btn btn-sm btn-danger" onclick="removeCaHocRow('${rowId}')" style="flex-shrink:0">✕</button>
    </div>
    <div style="display:flex;gap:8px;align-items:center">
      <select class="ca-nguoidạy" style="flex:1;font-size:12px">
        <option value="">— Người dạy —</option>
        ${gvList.map(gv=>`<option value="${gv.email}" ${ca.nguoiDay===gv.email?'selected':''}>${gv.hoTen}</option>`).join('')}
      </select>
      <div style="display:flex;gap:3px;flex-shrink:0" title="Chọn các thứ học ca này">
        ${THU_LIST.map(t=>`<button type="button" class="ca-thu-btn btn btn-sm ${thuArr.includes(t)?'btn-primary':''}"
          style="min-width:28px;padding:3px 5px;font-size:11px" onclick="toggleCaThu(this,'${rowId}','${t}')">${t}</button>`).join('')}
      </div>
    </div>
    <input type="hidden" class="ca-thu-val" value="${thuArr.join(',')}">
  </div>`;
}

function setCaPreset(btn, rowId, preset){
  const row = document.querySelector(`.ca-hoc-row[data-rowid="${rowId}"]`);
  row.querySelector('.ca-ten').value = preset;
  row.querySelectorAll('.ca-preset-btn').forEach(b=>b.classList.toggle('btn-primary', b.textContent===preset));
}
function clearCaPreset(rowId){
  const row = document.querySelector(`.ca-hoc-row[data-rowid="${rowId}"]`);
  row.querySelectorAll('.ca-preset-btn').forEach(b=>{b.classList.remove('btn-primary');});
}
function toggleCaThu(btn, rowId, thu){
  btn.classList.toggle('btn-primary');
  const row = document.querySelector(`.ca-hoc-row[data-rowid="${rowId}"]`);
  const hidden = row.querySelector('.ca-thu-val');
  const vals = hidden.value ? hidden.value.split(',').filter(Boolean) : [];
  const idx = vals.indexOf(thu);
  if(idx>=0) vals.splice(idx,1); else vals.push(thu);
  hidden.value = vals.join(',');
}
function addCaHocRow(){
  const wrap=document.getElementById('ca-hoc-list');
  const div=document.createElement('div');
  div.innerHTML=caHocRow({ten:'',nguoiDay:'',thu:''},Date.now(),CA_HOC_GV_LIST||[]);
  wrap.appendChild(div.firstElementChild);
}
let CA_HOC_GV_LIST=[];
function removeCaHocRow(rowId){
  const row=document.querySelector(`.ca-hoc-row[data-rowid="${rowId}"]`);
  if(row) row.remove();
}
function collectCaHocList(){
  const rows=document.querySelectorAll('.ca-hoc-row');
  const list=[];
  rows.forEach(row=>{
    const ten=row.querySelector('.ca-ten')?.value?.trim();
    const nguoiDay=row.querySelector('.ca-nguoidạy')?.value||'';
    const thu=row.querySelector('.ca-thu-val')?.value||'';
    if(ten) list.push({ten,nguoiDay,thu});
  });
  return list;
}

// ── HOC VIEN ──
async function renderHocVien(){
  // Tab bar
  const tabBar=document.getElementById('tab-bar');
  tabBar.style.display='';
  if(!CURRENT_TAB) CURRENT_TAB='kanban';
  tabBar.innerHTML=`
    <div class="tab ${CURRENT_TAB==='kanban'?'active':''}" onclick="switchTab('kanban')">Thông tin chung</div>
    <div class="tab ${CURRENT_TAB==='list'?'active':''}" onclick="switchTab('list')">Danh sách</div>
  `;
  document.getElementById('btn-add').onclick=()=>openModalHV(null);
  document.getElementById('btn-add').textContent='+ Thêm học viên';
  const btnBulk=document.getElementById('btn-bulk');
  if(['admin','giaovien','trogiang'].includes(USER.role)){ btnBulk.style.display=''; btnBulk.onclick=openModalBulkHV; } else { btnBulk.style.display='none'; }
  if(CURRENT_TAB==='list') await renderHVList();
  else await renderHVKanban();
}

function switchTab(tab){CURRENT_TAB=tab;renderHocVien();}

async function renderHVKanban(){
  setContent('<div class="empty">Đang tải...</div>');
  const [hvR,cbR]=await Promise.all([call({action:'getHocVienByLop',lop:CURRENT_LOP}),CURRENT_LOP?call({action:'getThongKeCanhBao',lop:CURRENT_LOP}):{ok:false}]);
  const hvList=hvR.ok?hvR.data.filter(hv=>hv.trangThai==='danghoc'||!hv.trangThai):[];
  const cbMap={};if(cbR.ok)cbR.data.forEach(c=>cbMap[c.studentId]=c);
  const tot=hvList.filter(hv=>!cbMap[hv.studentId]||cbMap[hv.studentId].diemViPham<3);
  const theo=hvList.filter(hv=>cbMap[hv.studentId]?.loaiCanhBao==='canh_bao_1');
  const crit=hvList.filter(hv=>cbMap[hv.studentId]?.loaiCanhBao==='canh_bao_2');
  setContent(`<div class="kanban">
    ${kCol('Học tốt',tot.length,'b-ok',tot.map(hv=>hvCard(hv,cbMap[hv.studentId],'ok')).join(''))}
    ${kCol('Cần theo dõi',theo.length,'b-warn1',theo.map(hv=>hvCard(hv,cbMap[hv.studentId],'warn')).join(''))}
    ${kCol('Cần liên hệ ngay',crit.length,'b-warn2',crit.map(hv=>hvCard(hv,cbMap[hv.studentId],'danger')).join(''))}
  </div>`);
}

function kCol(title,count,badge,html){
  return `<div class="kanban-col"><div class="col-header"><span>${title}</span><span class="badge ${badge}">${count}</span></div><div class="col-body">${html||'<div style="padding:20px;text-align:center;font-size:12px;color:#a0aab8">Không có</div>'}</div></div>`;
}
function hvCard(hv,cb,status){
  const dp=cb?cb.diemViPham:0;
  const pct=Math.max(0,Math.min(100,Math.round((1-dp/10)*100)));
  const clr=status==='ok'?'#1d9e75':status==='warn'?'#ba7517':'#e24b4a';
  const canMsg = ['admin','quanly','giaovien','trogiang'].includes(USER.role) && hv.emailPhuHuynh;
  return `<div class="hv-card ${status!=='ok'?status:''}">
    <div onclick="openModalHV('${hv.studentId}')" style="cursor:pointer">
      <div class="hv-name"><div class="avatar" style="width:24px;height:24px;font-size:10px;background:#e8f0fb;color:#1a50a0">${ini(hv.hoTen)}</div>${hv.hoTen}${cb?.emailDaGui?'<span class="badge b-warn2" style="margin-left:auto;font-size:9px">Email PH</span>':''}</div>
      <div class="hv-meta">${hv.lop}</div>
      ${dp>0?`<div class="hv-meta" style="color:#ba7517">⚠ ${dp} điểm VP</div>`:''}
      ${hv.soDienThoaiPH?`<div class="hv-meta">PH: ${hv.soDienThoaiPH}</div>`:''}
      <div class="progress"><div class="progress-fill" style="width:${pct}%;background:${clr}"></div></div>
    </div>
    ${canMsg?`<button class="btn btn-sm" style="margin-top:8px;width:100%" onclick="event.stopPropagation();openModalNhanTinPH('${hv.studentId}','${hv.hoTen}')">✉️ Nhắn tin phụ huynh</button>`:''}
  </div>`;
}

async function renderHVList(){
  setContent('<div class="empty">Đang tải...</div>');
  const r=await call({action:'getHocVienByLop',lop:CURRENT_LOP});
  const hvList=r.ok?r.data:[];
  const canEdit=['admin','giaovien','trogiang'].includes(USER.role);
  const canMsg=['admin','quanly','giaovien','trogiang'].includes(USER.role);
  setContent(`
    <div class="table-wrap">
      <div class="table-toolbar">
        <span style="font-size:13px;font-weight:500">${CURRENT_LOP||'Tất cả'} — ${hvList.length} học viên</span>
        <span style="flex:1"></span>
        <input placeholder="Tìm tên..." style="width:160px" oninput="filterHVTable(this.value)">
      </div>
      <div style="overflow-x:auto">
      <table id="hv-table">
        <thead><tr>
          <th>Họ tên</th><th>Lớp</th><th>SĐT cá nhân</th><th>Email cá nhân</th>
          <th>SĐT phụ huynh</th><th>Email PH</th>
          <th>Đóng tiền</th><th>Trạng thái</th><th>Ghi chú</th>
          ${canMsg?'<th>Nhắn tin</th>':''}
          ${canEdit?'<th>Sửa</th>':''}
        </tr></thead>
        <tbody>
          ${hvList.map(hv=>`<tr data-name="${hv.hoTen.toLowerCase()}">
            <td><div style="display:flex;align-items:center;gap:7px"><div class="avatar" style="width:26px;height:26px;font-size:10px;background:#e8f0fb;color:#1a50a0">${ini(hv.hoTen)}</div><span style="font-weight:500">${hv.hoTen}</span></div></td>
            <td>${hv.lop}</td>
            <td>${hv.sdtCaNhan||'—'}</td>
            <td style="font-size:12px">${hv.emailCaNhan||'—'}</td>
            <td>${hv.soDienThoaiPH||'—'}</td>
            <td style="font-size:12px">${hv.emailPhuHuynh||'—'}</td>
            <td style="text-align:center">
              ${canEdit
                ?`<input type="checkbox" class="cb" ${hv.daDongTien==='true'?'checked':''} onchange="toggleDongTien('${hv.studentId}',this.checked)">`
                :`<span class="badge ${hv.daDongTien==='true'?'b-dong':'b-chua'}">${hv.daDongTien==='true'?'Đã đóng':'Chưa'}</span>`}
            </td>
            <td>
              ${canEdit
                ?`<select class="tt-select" style="font-size:12px;padding:4px 8px" onchange="toggleTrangThai('${hv.studentId}',this.value)">
                    <option value="danghoc" ${hv.trangThai==='danghoc'?'selected':''}>Đang học</option>
                    <option value="nghi" ${hv.trangThai==='nghi'?'selected':''}>Đã nghỉ</option>
                    <option value="baoluu" ${hv.trangThai==='baoluu'?'selected':''}>Bảo lưu</option>
                  </select>`
                :`<span class="badge ${ttClass(hv.trangThai)}">${TRANG_THAI_HV[hv.trangThai]||hv.trangThai}</span>`}
            </td>
            <td style="font-size:12px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${hv.ghiChu||''}">${hv.ghiChu||'—'}</td>
            ${canMsg?`<td>${hv.emailPhuHuynh?`<button class="btn btn-sm" onclick="openModalNhanTinPH('${hv.studentId}','${hv.hoTen}')">✉️</button>`:'<span style="color:#a0aab8;font-size:11px">—</span>'}</td>`:''}
            ${canEdit?`<td><button class="btn btn-sm" onclick="openModalHV('${hv.studentId}')">Sửa</button></td>`:''}
          </tr>`).join('')}
        </tbody>
      </table>
      </div>
    </div>
  `);
}

function filterHVTable(q){
  document.querySelectorAll('#hv-table tbody tr').forEach(tr=>{
    tr.style.display=tr.dataset.name.includes(q.toLowerCase())?'':'none';
  });
}

async function toggleDongTien(studentId,checked){
  const r=await call({action:'updateHocVien',studentId,daDongTien:String(checked)});
  if(!r.ok){toast(r.error||'Lỗi khi cập nhật','error');return;}
  toast(checked?'Đã đánh dấu đóng tiền':'Chưa đóng tiền','success');
}
async function toggleTrangThai(studentId,val){
  const r=await call({action:'updateHocVien',studentId,trangThai:val});
  if(!r.ok){toast(r.error||'Lỗi khi cập nhật','error');return;}
  toast('Đã cập nhật trạng thái','success');
}

let HV_AUTOCOMPLETE_LIST = [];
async function openModalHV(studentId, defaultLop){
  if(USER.role==='phuhuynh') return;
  let hv=null;
  if(studentId){const r=await call({action:'getHocVienById',studentId});if(r.ok)hv=r.data;}
  const isEdit=!!hv;
  const preselectLop = hv?.lop || defaultLop || '';

  // Chỉ admin mới thấy gợi ý học viên có sẵn (mọi lớp) khi TẠO MỚI — tránh giáo viên/trợ giảng
  // nhìn thấy/động vào học viên của lớp không phải mình phụ trách.
  HV_AUTOCOMPLETE_LIST = [];
  if(!isEdit && USER.role==='admin'){
    const r = await call({action:'getHocVienByLop',lop:''});
    if(r.ok) HV_AUTOCOMPLETE_LIST = r.data;
  }
  const showAutocomplete = !isEdit && USER.role==='admin';

  showModal(isEdit?'Sửa học viên':'Thêm học viên',`
    <div class="form-grid2">
      <div class="form-row" style="position:relative">
        <label>Họ tên *${showAutocomplete?' <span style="font-weight:400;color:#8a96a8">(gõ để tìm học viên có sẵn)</span>':''}</label>
        <input id="f-hoTen" value="${hv?.hoTen||''}" autocomplete="off" ${showAutocomplete?`oninput="filterHVAutocomplete()" onfocus="filterHVAutocomplete()"`:''}>
        <input type="hidden" id="f-existingId" value="">
        ${showAutocomplete?`<div id="hv-autocomplete" style="display:none;position:absolute;top:100%;left:0;right:0;z-index:50;background:#fff;border:1.5px solid #e4ebf5;border-radius:8px;max-height:220px;overflow-y:auto;box-shadow:0 8px 24px rgba(0,0,0,.12);margin-top:2px"></div>`:''}
      </div>
      <div class="form-row"><label>Lớp *</label>
        <select id="f-lop">
          ${LOPS.map(l=>`<option value="${l}" ${preselectLop===l?'selected':''}>${l}</option>`).join('')}
          <option value="__new__">+ Lớp mới...</option>
        </select>
      </div>
      <div class="form-row"><label>Ngày sinh</label><input type="date" id="f-ngaySinh" value="${hv?.ngaySinh||''}"></div>
      <div class="form-row"><label>Giới tính</label>
        <select id="f-gioiTinh">
          <option value="">—</option>
          <option value="Nam" ${hv?.gioiTinh==='Nam'?'selected':''}>Nam</option>
          <option value="Nữ" ${hv?.gioiTinh==='Nữ'?'selected':''}>Nữ</option>
        </select>
      </div>
      <div class="form-row"><label>SĐT cá nhân</label><input id="f-sdtCN" value="${hv?.sdtCaNhan||''}"></div>
      <div class="form-row"><label>Email cá nhân</label><input id="f-emailCN" value="${hv?.emailCaNhan||''}"></div>
      <div class="form-row"><label>SĐT phụ huynh</label><input id="f-sdtPH" value="${hv?.soDienThoaiPH||''}"></div>
      <div class="form-row"><label>Email phụ huynh</label><input id="f-emailPH" value="${hv?.emailPhuHuynh||''}"></div>
    </div>
    <div class="form-grid2">
      <div class="form-row"><label>Trạng thái</label>
        <select id="f-tt">
          <option value="danghoc" ${hv?.trangThai==='danghoc'||!hv?'selected':''}>Đang học</option>
          <option value="nghi" ${hv?.trangThai==='nghi'?'selected':''}>Đã nghỉ</option>
          <option value="baoluu" ${hv?.trangThai==='baoluu'?'selected':''}>Bảo lưu</option>
        </select>
      </div>
      <div class="form-row"><label>Đóng tiền</label>
        <select id="f-dongTien">
          <option value="false" ${hv?.daDongTien!=='true'?'selected':''}>Chưa đóng</option>
          <option value="true" ${hv?.daDongTien==='true'?'selected':''}>Đã đóng</option>
        </select>
      </div>
    </div>
    <div class="form-row"><label>Ghi chú</label><textarea id="f-ghiChu" rows="2">${hv?.ghiChu||''}</textarea></div>
    ${isEdit&&USER.role==='admin'?`<button class="btn btn-danger btn-sm" onclick="deleteHV('${studentId}')">Xóa học viên</button>`:''}
  `,async()=>{
    const lopVal=document.getElementById('f-lop').value;
    const body={hoTen:document.getElementById('f-hoTen').value.trim(),lop:lopVal==='__new__'?prompt('Tên lớp mới:'):lopVal,sdtCaNhan:document.getElementById('f-sdtCN').value.trim(),emailCaNhan:document.getElementById('f-emailCN').value.trim(),soDienThoaiPH:document.getElementById('f-sdtPH').value.trim(),emailPhuHuynh:document.getElementById('f-emailPH').value.trim(),gioiTinh:document.getElementById('f-gioiTinh').value,ngaySinh:document.getElementById('f-ngaySinh').value,trangThai:document.getElementById('f-tt').value,daDongTien:document.getElementById('f-dongTien').value,ghiChu:document.getElementById('f-ghiChu').value.trim()};
    if(!body.hoTen||!body.lop){toast('Nhập đủ họ tên và lớp','error');return;}
    // Nếu chọn từ gợi ý học viên có sẵn (f-existingId có giá trị) → CẬP NHẬT đúng học viên đó
    // (thực chất là chuyển sang lớp mới), KHÔNG tạo học viên trùng mới.
    const existingId = document.getElementById('f-existingId')?.value || '';
    const isReassign = !isEdit && existingId;
    let r;
    if(isEdit){body.studentId=studentId;r=await call({action:'updateHocVien',...body});}
    else if(isReassign){body.studentId=existingId;r=await call({action:'updateHocVien',...body});}
    else r=await call({action:'addHocVien',...body});
    if(!r.ok){toast(r.error||'Lỗi khi lưu học viên','error');return;}
    closeModal();toast(isEdit?'Đã cập nhật':(isReassign?'Đã chuyển học viên sang lớp này':'Đã thêm học viên'),'success');
    if(CURRENT_PAGE==='lopdetail'){ const l=LOP_DATA.find(x=>x.lopId===LOP_DETAIL_ID); if(l) renderTabDiemDanh(l); }
    else renderHocVien();
  });
}
function filterHVAutocomplete(){
  const box = document.getElementById('hv-autocomplete');
  if(!box) return;
  document.getElementById('f-existingId').value=''; // gõ lại thì hủy lựa chọn cũ, coi như tạo mới trừ khi chọn lại
  const q = document.getElementById('f-hoTen').value.trim().toLowerCase();
  if(!q){ box.style.display='none'; box.innerHTML=''; return; }
  const matches = HV_AUTOCOMPLETE_LIST.filter(hv=>hv.hoTen.toLowerCase().includes(q)).slice(0,15);
  if(matches.length===0){ box.style.display='none'; box.innerHTML=''; return; }
  box.innerHTML = matches.map(hv=>`<div onclick="pickHVAutocomplete('${hv.studentId}')" style="padding:9px 12px;cursor:pointer;border-bottom:1px solid #f0f4fa" onmouseover="this.style.background='#f5f8fc'" onmouseout="this.style.background='#fff'">
    <div style="font-size:13px;font-weight:600;color:#1a2236">${hv.hoTen}</div>
    <div style="font-size:11px;color:#8a96a8">${hv.lop?'Hiện đang ở lớp: '+hv.lop:'Chưa có lớp'}</div>
  </div>`).join('');
  box.style.display='block';
}
function pickHVAutocomplete(studentId){
  const hv = HV_AUTOCOMPLETE_LIST.find(h=>h.studentId===studentId);
  if(!hv) return;
  document.getElementById('f-hoTen').value = hv.hoTen;
  document.getElementById('f-existingId').value = hv.studentId;
  document.getElementById('f-ngaySinh').value = hv.ngaySinh||'';
  document.getElementById('f-gioiTinh').value = hv.gioiTinh||'';
  document.getElementById('f-sdtCN').value = hv.sdtCaNhan||'';
  document.getElementById('f-emailCN').value = hv.emailCaNhan||'';
  document.getElementById('f-sdtPH').value = hv.soDienThoaiPH||'';
  document.getElementById('f-emailPH').value = hv.emailPhuHuynh||'';
  document.getElementById('f-dongTien').value = hv.daDongTien==='true'?'true':'false';
  document.getElementById('f-ghiChu').value = hv.ghiChu||'';
  // Cố ý KHÔNG đổi ô "Lớp" — giữ nguyên lớp đang chọn sẵn trong form (đây chính là lớp sẽ chuyển học viên này tới)
  document.getElementById('hv-autocomplete').style.display='none';
  toast('Đã điền thông tin có sẵn — bấm Lưu để chuyển học viên này sang lớp đang chọn','info');
}

async function deleteHV(studentId){
  if(!confirm('Xóa học viên này?')) return;
  const r=await call({action:'deleteHocVien',studentId});
  if(!r.ok){toast(r.error||'Lỗi khi xóa','error');return;}
  closeModal();toast('Đã xóa','success');renderHocVien();
}

// ── THÊM HÀNG LOẠT HỌC VIÊN (dùng để tạo nhanh dữ liệu test hoặc nhập từ danh sách có sẵn) ──
function openModalBulkHV(){
  if(!['admin','giaovien','trogiang'].includes(USER.role)) return;
  showModal('Thêm hàng loạt học viên',`
    <div class="form-row">
      <label>Lớp *</label>
      <select id="bulk-lop">
        ${LOPS.map(l=>`<option value="${l}">${l}</option>`).join('')}
        <option value="__new__">+ Lớp mới...</option>
      </select>
    </div>
    <div class="form-row" style="margin-top:10px">
      <label>Danh sách học viên — mỗi dòng 1 người</label>
      <textarea id="bulk-list" rows="10" placeholder="Chỉ cần họ tên, mỗi dòng 1 người:
Nguyễn Văn A
Trần Thị B
Lê Văn C

Hoặc ghi thêm SĐT/email phụ huynh, cách nhau bằng dấu phẩy:
Nguyễn Văn A, 0901234567, mevanA@gmail.com"></textarea>
    </div>
    <div style="font-size:12px;color:#8a96a8;margin-top:8px">
      💡 Dùng để tạo nhanh dữ liệu test (VD: dán 30 tên bất kỳ) hoặc nhập cả lớp cùng lúc. SĐT/email không bắt buộc — bỏ trống vẫn tạo được, chỉ không dùng được tính năng nhắn tin cho phụ huynh của học viên đó.
    </div>
  `,async()=>{
    const lopVal=document.getElementById('bulk-lop').value;
    const lop = lopVal==='__new__' ? (prompt('Tên lớp mới:')||'').trim() : lopVal;
    if(!lop){toast('Chưa chọn lớp','error');return;}
    const raw=document.getElementById('bulk-list').value;
    const lines=raw.split('\n').map(l=>l.trim()).filter(Boolean);
    if(lines.length===0){toast('Chưa nhập danh sách','error');return;}
    const records=lines.map(line=>{
      const parts=line.split(',').map(p=>p.trim());
      return {hoTen:parts[0]||'',soDienThoaiPH:parts[1]||'',emailPhuHuynh:parts[2]||'',lop};
    }).filter(r=>r.hoTen);
    if(records.length===0){toast('Không đọc được tên nào hợp lệ','error');return;}
    if(!confirm(`Tạo ${records.length} học viên vào lớp "${lop}"?`)) return;
    const r=await callPost({action:'addHocVienBulk',records});
    closeModal();
    if(r.ok) toast(`Đã tạo ${r.data.count||records.length} học viên`,'success');
    else toast(r.error||'Lỗi khi tạo hàng loạt','error');
    renderHocVien();
  });
}

// ── NHẮN TIN CHO PHỤ HUYNH (1 học viên cụ thể) ──
async function openModalNhanTinPH(studentId,hoTen){
  const hv=await call({action:'getHocVienById',studentId});
  const emailPH = hv.ok?hv.data.emailPhuHuynh:'';
  if(!emailPH){toast('Học viên chưa có email phụ huynh','error');return;}

  showModal(`Nhắn tin phụ huynh — ${hoTen}`,`
    <div class="hint" style="margin-bottom:12px">Gửi tới: ${emailPH}</div>
    <div class="form-row"><label>Nội dung *</label><textarea id="f-msg" rows="4" placeholder="Nhập nội dung tin nhắn..."></textarea></div>
  `,async()=>{
    const noiDung=document.getElementById('f-msg').value.trim();
    if(!noiDung){toast('Nhập nội dung','error');return;}
    const r=await call({action:'sendThongBao',tieuDe:noiDung.slice(0,40),noiDung,nguoiNhan:emailPH,lop:''});
    if(!r.ok){toast(r.error||'Lỗi khi gửi','error');return;}
    closeModal();toast('Đã gửi tin nhắn','success');
  });
}

// ── CHUYEN CAN ──
// ── LOP DETAIL (Diem danh + Bang diem trong 1 lop) ──
let LOP_DETAIL_TAB = 'diemdanh';
let LOP_DETAIL_ID = '';

function openLopDetail(lopId){
  LOP_DETAIL_ID = lopId;
  LOP_DETAIL_TAB = 'diemdanh';
  CURRENT_PAGE = 'lopdetail';
  document.getElementById('page-title').textContent = 'Lớp học';
  const btnBack=document.getElementById('btn-back');
  btnBack.style.display=''; btnBack.onclick=()=>navTo('lophoc');
  document.getElementById('btn-msg').style.display='none';
  document.getElementById('filter-lop').style.display='none';
  document.getElementById('filter-ngay').style.display='none';
  document.getElementById('btn-add').style.display='none';
  document.getElementById('tab-bar').style.display='none';
  renderLopDetail();
}

async function renderLopDetail(){
  const lop = LOP_DATA.find(l=>l.lopId===LOP_DETAIL_ID);
  if(!lop){ setContent('<div class="empty">Không tìm thấy lớp</div>'); return; }

  const activeStyle = (tab)=> LOP_DETAIL_TAB===tab
    ? 'background:#1a50a0;color:#fff'
    : 'background:#f8fafd;color:#5a6478';

  setContent(`
    <div style="display:flex;border:1.5px solid #e4ebf5;border-bottom:none;border-radius:14px 14px 0 0;overflow:hidden">
      <div onclick="switchLopTab('diemdanh')" style="flex:1;text-align:center;padding:13px;font-size:14px;font-weight:700;cursor:pointer;transition:all .15s;${activeStyle('diemdanh')}">📋 Điểm danh</div>
      <div onclick="switchLopTab('diem')" style="flex:1;text-align:center;padding:13px;font-size:14px;font-weight:700;cursor:pointer;transition:all .15s;border-left:1.5px solid #e4ebf5;${activeStyle('diem')}">📊 Bảng điểm</div>
    </div>
    <div id="lop-detail-content" style="border:1.5px solid #e4ebf5;border-top:none;border-radius:0 0 14px 14px;overflow:hidden;background:#fff"></div>
  `);

  if(LOP_DETAIL_TAB==='diemdanh') renderTabDiemDanh(lop);
  else renderTabBangDiem(lop);
}

function switchLopTab(tab){
  LOP_DETAIL_TAB = tab;
  renderLopDetail();
}

// ── TAB DIEM DANH ──
let LOP_DD_DATE = '';
let LOP_DD_CA = '';

async function renderTabDiemDanh(lop){
  const wrap = document.getElementById('lop-detail-content');
  wrap.innerHTML = '<div class="empty">Đang tải...</div>';

  const ngay = LOP_DD_DATE || todayStr();
  LOP_DD_DATE = ngay;

  let caHocList = [];
  try{ caHocList = lop.caHoc ? JSON.parse(lop.caHoc) : []; }catch(e){ caHocList = []; }

  // Nếu lớp chưa có ca học nào → dùng 1 ca mặc định "Buổi học" để vẫn điểm danh được
  if(caHocList.length===0) caHocList=[{ten:'Buổi học',nguoiDay:''}];

  // Mặc định chọn ca đầu tiên nếu chưa chọn
  if(!LOP_DD_CA || !caHocList.find(c=>caKey(c)===LOP_DD_CA)) LOP_DD_CA = caKey(caHocList[0]);
  const caId = LOP_DD_CA;

  const hvR = await call({action:'getHocVienByLop',lop:lop.tenLop});
  const hvList = (hvR.ok?hvR.data:[]).filter(hv=>hv.trangThai==='danghoc'||!hv.trangThai);

  // Bảng học viên + lịch tuần được gộp làm MỘT bảng duy nhất (renderLichTuan)
  // để hàng tên học viên luôn khớp hàng ô điểm danh, không còn lệch nhau.
  wrap.innerHTML = `<div id="lich-tuan-wrap"><div class="empty" style="padding:40px">Đang tải lịch...</div></div>`;

  renderLichTuan(lop, hvList, ngay, caId).then(html=>{
    document.getElementById('lich-tuan-wrap').innerHTML = html;
  }).catch(err=>{
    // TRUOC DAY: neu renderLichTuan loi (vd 1 trong 7 lenh goi mang cho tung ngay trong tuan bi
    // truc trac), loi bi "nuot" am tham — khung lich bi ket mai o "Dang tai..." du du lieu da
    // luu thanh cong that su o server, khien nguoi dung tuong nham la chua luu duoc.
    console.error(err);
    document.getElementById('lich-tuan-wrap').innerHTML =
      `<div class="empty" style="padding:40px;text-align:center">
        Không tải được lịch điểm danh (dữ liệu vừa lưu vẫn đã được ghi lại bình thường).<br>
        <button class="btn btn-primary" style="margin-top:10px" onclick="renderTabDiemDanh(LOP_DATA.find(l=>l.lopId==='${lop.lopId}'))">Thử tải lại</button>
      </div>`;
  });
}

// Modal điểm danh nhanh (mở khi bấm nút "Điểm danh hôm nay")
async function openDiemDanhModal(){
  const lop = LOP_DATA.find(l=>l.lopId===LOP_DETAIL_ID);
  const ngay = LOP_DD_DATE || todayStr();
  const caId = LOP_DD_CA;
  let caHocList = [];
  try{ caHocList = lop.caHoc ? JSON.parse(lop.caHoc) : []; }catch(e){ caHocList=[]; }
  if(caHocList.length===0) caHocList=[{ten:'Buổi học',nguoiDay:''}];
  const curCa = caHocList.find(ca=>caKey(ca)===caId)||caHocList[0];

  const [hvR, ddR] = await Promise.all([
    call({action:'getHocVienByLop',lop:lop.tenLop}),
    call({action:'getDiemDanhByLop',lop:lop.tenLop,ngay,caId}),
  ]);
  const hvList = (hvR.ok?hvR.data:[]).filter(hv=>hv.trangThai==='danghoc'||!hv.trangThai);
  const ddMap={}; if(ddR.ok) ddR.data.forEach(d=>ddMap[d.studentId]=d);

  showModal(`📋 Điểm danh — ${lop.tenLop} · ${curCa.ten} · ${fmtDate(ngay)}`, `
    <div style="margin-bottom:12px;display:flex;gap:8px;align-items:center">
      <input type="date" id="modal-dd-date" value="${ngay}" style="flex:1"
        onchange="LOP_DD_DATE=this.value;closeModal();setTimeout(openDiemDanhModal,50)">
      <select id="modal-dd-ca" style="flex:1.2" onchange="LOP_DD_CA=this.value;closeModal();setTimeout(openDiemDanhModal,50)">
        ${caHocList.map(ca=>`<option value="${caKey(ca)}" ${caKey(ca)===caId?'selected':''}>${ca.ten}</option>`).join('')}
      </select>
    </div>
    <table style="width:100%">
      <thead><tr><th style="text-align:left;padding:6px 8px;font-size:11px;color:#8a96a8">Học viên</th><th style="text-align:left;padding:6px 8px;font-size:11px;color:#8a96a8">Trạng thái</th><th style="padding:6px 8px;font-size:11px;color:#8a96a8">Ghi chú</th></tr></thead>
      <tbody>
        ${hvList.map(hv=>{const dd=ddMap[hv.studentId];const cur=dd?.trangThai||'co_mat';
          return `<tr style="border-top:1px solid #f0f4fa">
            <td style="padding:7px 8px;font-size:13px;font-weight:500">${hv.hoTen}</td>
            <td style="padding:7px 8px">
              <select class="dd-sel" data-sid="${hv.studentId}" style="font-size:12px;width:100%">
                <option value="co_mat" ${cur==='co_mat'?'selected':''}>✓ Có mặt</option>
                <option value="vang_phep" ${cur==='vang_phep'?'selected':''}>Nghỉ có phép</option>
                <option value="vang_khong_phep" ${cur==='vang_khong_phep'?'selected':''}>Nghỉ không phép</option>
                <option value="di_tre" ${cur==='di_tre'?'selected':''}>Đi trễ >15'</option>
              </select>
            </td>
            <td style="padding:7px 8px"><input class="dd-note" data-sid="${hv.studentId}" value="${dd?.ghiChu||''}" placeholder="..." style="width:100%;font-size:12px"></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  `, async()=>{
    const records=[];
    document.querySelectorAll('.dd-sel').forEach(sel=>{
      const sid=sel.dataset.sid;
      const note=document.querySelector(`.dd-note[data-sid="${sid}"]`)?.value||'';
      records.push({studentId:sid,ngay:LOP_DD_DATE||ngay,caId:LOP_DD_CA||caId,trangThai:sel.value,ghiChu:note});
    });
    const r=await call({action:'saveDiemDanh',records});
    if(r.ok){
      closeModal();
      toast('Đã lưu điểm danh','success');
      const lopObj=LOP_DATA.find(l=>l.lopId===LOP_DETAIL_ID);
      renderTabDiemDanh(lopObj);
    } else toast('Lỗi lưu','error');
  });
}

function caKey(ca){
  // Khóa định danh ổn định cho 1 ca: dựa trên tên (vì admin có thể đổi người dạy nhưng tên ca giữ nguyên)
  return 'ca_' + (ca.ten||'').trim().toLowerCase().replace(/\s+/g,'_');
}
function nguoiDayName(email){
  const acc = (window.ALL_ACCOUNTS||[]).find(a=>a.email===email);
  return acc ? acc.hoTen : email;
}

function changeDDDate(val){ LOP_DD_DATE = val; const lop=LOP_DATA.find(l=>l.lopId===LOP_DETAIL_ID); renderTabDiemDanh(lop); }
function changeDDCa(val){ LOP_DD_CA = val; const lop=LOP_DATA.find(l=>l.lopId===LOP_DETAIL_ID); renderTabDiemDanh(lop); }

async function saveDD(){
  const lop = LOP_DATA.find(l=>l.lopId===LOP_DETAIL_ID);
  const ngay = LOP_DD_DATE || todayStr();
  const caId = LOP_DD_CA;
  const records=[];
  document.querySelectorAll('.dd-sel').forEach(sel=>{
    const sid=sel.dataset.sid;
    const note=document.querySelector(`.dd-note[data-sid="${sid}"]`)?.value||'';
    records.push({studentId:sid,ngay,caId,trangThai:sel.value,ghiChu:note});
  });
  const r=await call({action:'saveDiemDanh',records});
  if(r.ok){toast('Đã lưu điểm danh','success');renderTabDiemDanh(lop);}
  else toast('Lỗi lưu','error');
}

// ── LỊCH TUẦN ──
let LICH_WEEK_OFFSET = 0; // 0 = tuần hiện tại, -1 = tuần trước...

function getWeekDates(dateStr, offset=0){
  const d = new Date(dateStr);
  const day = d.getDay();
  const mon = new Date(d);
  mon.setDate(d.getDate() - (day===0?6:day-1) + offset*7);
  return Array.from({length:7},(_,i)=>{
    const dd=new Date(mon); dd.setDate(mon.getDate()+i);
    return dd.toISOString().slice(0,10);
  });
}

async function toggleAutoDD(lopId, newValue, evt){
  if(evt) evt.stopPropagation();
  hideCaInfoBubble();
  const r = await call({action:'toggleTuDongDiemDanh', lopId, value:String(newValue)});
  if(!r.ok){ toast(r.error||'Lỗi khi cập nhật','error'); return; }
  toast(newValue?'Đã BẬT tự động điểm danh cho lớp này':'Đã TẮT — từ giờ phải điểm danh tay cho lớp này','success');
  await loadLops();
  const l=LOP_DATA.find(x=>x.lopId===lopId);
  if(l) renderTabDiemDanh(l);
}

const CA_INFO_TEXT = {
  auto: '🟢 Hệ thống sẽ tự động điểm danh — mặc định là có đi học. Admin có thể bấm nút gạt để Tắt riêng cho từng lớp, khi đó phải điểm danh tay hoàn toàn.',
  alert: '🔴 Học viên nghỉ 3 buổi liên tiếp, hoặc nghỉ hơn 10% tổng số buổi trong tuần.',
  split: '🔵 Ngày nào có 2 buổi học thì điểm danh 2 buổi.',
};
let _caInfoTimer=null, _caInfoDocHandler=null;
function showCaInfoBubble(key, evt){
  if(evt) evt.stopPropagation();
  const bubble = document.getElementById('ca-info-bubble');
  if(!bubble) return;
  const badge = evt.currentTarget.closest('[data-ca-badge]') || evt.currentTarget; // ô cụ thể vừa bấm (để canh mũi tên)
  const row = evt.currentTarget.closest('.ca-badge-row'); // cả hàng 3 ô (để canh chiều rộng bubble)
  if(!row) return;
  const rowRect = row.getBoundingClientRect();
  const badgeRect = badge.getBoundingClientRect();

  bubble.style.left = rowRect.left+'px';
  bubble.style.width = rowRect.width+'px';
  bubble.style.top = rowRect.top+'px'; // CSS transform:translateY(-100%) sẽ tự đẩy bubble lên trên điểm này
  // Mũi tên trỏ xuống đúng giữa ô vừa bấm, kiểu bong bóng thoại trong truyện tranh
  const arrowLeft = Math.round(badgeRect.left - rowRect.left + badgeRect.width/2 - 7);
  bubble.style.setProperty('--arrow-left', arrowLeft+'px');
  bubble.textContent = CA_INFO_TEXT[key];
  bubble.classList.add('show');

  clearTimeout(_caInfoTimer);
  _caInfoTimer = setTimeout(hideCaInfoBubble, 5000);

  // Bấm vào bất kỳ đâu trên trang (kể cả bubble) đều đóng lại — gắn listener sau khi
  // click hiện tại kết thúc để không tự đóng ngay lập tức do bubble effect của chính click này.
  if(_caInfoDocHandler) document.removeEventListener('click', _caInfoDocHandler);
  _caInfoDocHandler = hideCaInfoBubble;
  setTimeout(()=>document.addEventListener('click', _caInfoDocHandler, {once:true}), 0);
}
function hideCaInfoBubble(){
  const bubble = document.getElementById('ca-info-bubble');
  if(bubble) bubble.classList.remove('show');
  clearTimeout(_caInfoTimer);
  if(_caInfoDocHandler){ document.removeEventListener('click', _caInfoDocHandler); _caInfoDocHandler=null; }
}

async function renderLichTuan(lop, hvList, selectedNgay, activeCaId){
  const weekDates = getWeekDates(selectedNgay||todayStr(), LICH_WEEK_OFFSET);
  const thuLabels = ['T2','T3','T4','T5','T6','T7','CN'];
  const today = todayStr();
  const autoDDBat = lop.tuDongDiemDanh !== 'false'; // mặc định BẬT nếu chưa từng thiết lập (tương thích ngược)

  // Danh sách buổi học của lớp
  let caHocList = [];
  try{ caHocList = lop.caHoc ? JSON.parse(lop.caHoc) : []; }catch(e){ caHocList = []; }
  if(caHocList.length===0) caHocList=[{ten:'Buổi học',nguoiDay:'',thu:''}];

  // Với mỗi ngày trong tuần, xác định NHỮNG BUỔI nào thực sự học ngày đó (dựa vào "thu" admin đã gán khi tạo lớp).
  // - Lớp chỉ có 1 buổi → buổi đó luôn học đủ 7 ngày (không tách ô, giữ như trước).
  // - Lớp có từ 2 buổi trở lên → buổi nào có khai báo "thu" thì chỉ tính đúng những ngày đó; buổi chưa khai báo "thu"
  //   thì tạm coi là học tất cả các ngày (an toàn hơn là tự đoán bừa — admin có thể vào sửa lớp để khai báo rõ hơn).
  const dayCaList = thuLabels.map((t)=>{
    if(caHocList.length===1) return [caHocList[0]];
    return caHocList.filter(ca=>{
      const thuArr = ca.thu ? String(ca.thu).split(',').filter(Boolean) : [];
      return thuArr.length===0 || thuArr.includes(t);
    });
  });

  // Load điểm danh CẢ TUẦN, CẢ CÁC BUỔI cùng lúc (không lọc theo 1 buổi nữa vì giờ hiện tất cả buổi trong cùng 1 ô)
  // Dùng allSettled (không phải all) — nếu 1 ngày trong tuần bị lỗi mạng, chỉ ngày đó thiếu dữ liệu,
  // 6 ngày còn lại vẫn hiển thị đúng, thay vì cả bảng bị "treo" vì 1 request lẻ tẻ thất bại.
  const allDDSettled = await Promise.allSettled(
    weekDates.map(ngay=>call({action:'getDiemDanhByLop',lop:lop.tenLop,ngay,caId:''}))
  );
  const allDDRes = allDDSettled.map(s=>s.status==='fulfilled'?s.value:{ok:false});
  const ddByDateCa={}; // ddByDateCa[ngay][caId][studentId] = trangThai
  weekDates.forEach((ngay,i)=>{
    ddByDateCa[ngay]={};
    if(allDDRes[i].ok) allDDRes[i].data.forEach(d=>{
      if(!ddByDateCa[ngay][d.caId]) ddByDateCa[ngay][d.caId]={};
      ddByDateCa[ngay][d.caId][d.studentId]=d.trangThai;
    });
  });

  // Tổng số buổi đã điểm danh trong tuần của 1 ca cụ thể (để tính cảnh báo >10%)
  function tongBuoiCa(caId){
    return weekDates.filter((ngay,i)=>ngay<=today && dayCaList[i].some(c=>caKey(c)===caId)).reduce((sum,ngay)=>{
      const hasAny = hvList.some(hv=>ddByDateCa[ngay][caId]?.[hv.studentId]);
      return sum + (hasAny?1:0);
    }, 0);
  }

  // Thông tin điểm danh của 1 học viên trong 1 ca cụ thể — chuỗi nghỉ liên tiếp, tổng vắng, có cảnh báo không
  function cellInfo(sid, caId){
    let streak=0;
    for(let i=weekDates.length-1;i>=0;i--){
      if(weekDates[i]>today || !dayCaList[i].some(c=>caKey(c)===caId)) continue;
      const tt=ddByDateCa[weekDates[i]][caId]?.[sid];
      if(tt&&tt!=='co_mat') streak++; else if(tt) break;
    }
    const tong = tongBuoiCa(caId);
    const tongVang = weekDates.filter((ngay,i)=>ngay<=today && dayCaList[i].some(c=>caKey(c)===caId)).filter(ngay=>{
      const tt=ddByDateCa[ngay][caId]?.[sid];
      return tt && tt!=='co_mat';
    }).length;
    const over10pct = tong>0 && (tongVang/tong)>0.1;
    return {streak, tongVang, over10pct, tong};
  }

  function dayCell(sid, ngay, ca, info){
    const {streak, over10pct} = info;
    const caId = caKey(ca);
    const tt = ddByDateCa[ngay][caId]?.[sid];
    const isFuture = ngay > today;
    if(isFuture) return {bg:'#f8fafd',text:'#cbd5e1',border:'#e4ebf5',icon:'',tip:'Chưa đến'};
    if(!tt){
      if(autoDDBat) return {bg:'#dcfce7',text:'#166534',border:'#86efac',icon:'·',tip:`${ca.ten} — Tự động điểm danh (mặc định Có mặt)`};
      return {bg:'#f1f5f9',text:'#94a3b8',border:'#cbd5e1',icon:'?',tip:`${ca.ten} — Chưa điểm danh (lớp đã TẮT tự động điểm danh, cần bấm tay)`};
    }
    if(tt==='co_mat') return {bg:'#dcfce7',text:'#166534',border:'#86efac',icon:'✓',tip:`${ca.ten} — Có mặt`};
    if(streak>=3||over10pct) return {bg:'#fee2e2',text:'#991b1b',border:'#fca5a5',icon:streak>=3?'3+':Math.round(info.tongVang/(info.tong||1)*100)+'%',blink:true,tip:`${ca.ten} — ${streak>=3?'NGHỈ 3+ BUỔI LIÊN TIẾP!':'NGHỈ >10% TỔNG BUỔI!'}`};
    if(streak===2) return {bg:'#fed7aa',text:'#9a3412',border:'#fb923c',icon:'K',tip:`${ca.ten} — Nghỉ 2 lần liên tiếp`};
    if(tt==='vang_khong_phep') return {bg:'#fed7aa',text:'#9a3412',border:'#f97316',icon:'K',tip:`${ca.ten} — K: Nghỉ không phép`};
    if(tt==='vang_phep') return {bg:'#e0f2fe',text:'#0369a1',border:'#7dd3fc',icon:'P',tip:`${ca.ten} — P: Nghỉ có phép`};
    if(tt==='di_tre') return {bg:'#fef3c7',text:'#92400e',border:'#fcd34d',icon:'T',tip:`${ca.ten} — T: Đi trễ >15'`};
    return {bg:'#f1f5f9',text:'#94a3b8',border:'#e4ebf5',icon:'?',tip:''};
  }

  // Thông tin lớp hiển thị to, rõ ở ô trên-trái
  // 3 dòng cố định: Giáo viên chính (từ lop.giaoVienEmail) / Giáo viên bản xứ / Trợ giảng —
  // 2 dòng sau tự gom từ người dạy được gán ở TỪNG buổi (ca.nguoiDay), phân loại theo role tài khoản.
  const gvChinh = lop.giaoVienEmail ? ((window.ALL_ACCOUNTS||[]).find(a=>a.email===lop.giaoVienEmail)?.hoTen||lop.giaoVienEmail) : '';

  const banXuNames = [], troGiangNames = [];
  caHocList.forEach(ca=>{
    if(!ca.nguoiDay || ca.nguoiDay===lop.giaoVienEmail) return; // trùng GV chính thì khỏi liệt kê lại
    const acc = (window.ALL_ACCOUNTS||[]).find(a=>a.email===ca.nguoiDay);
    const nguoi = acc?.hoTen || ca.nguoiDay;
    if(acc?.role==='trogiang'){ if(!troGiangNames.includes(nguoi)) troGiangNames.push(nguoi); }
    else { if(!banXuNames.includes(nguoi)) banXuNames.push(nguoi); }
  });

  const caHocInfoHtml = `
    <div>Giáo viên chính: ${gvChinh?`<strong>${gvChinh}</strong>`:'<span style="color:#b0b8c8;font-weight:400">—</span>'}</div>
    <div>Giáo viên bản xứ: ${banXuNames.length?`<strong>${banXuNames.join(', ')}</strong>`:'<span style="color:#b0b8c8;font-weight:400">—</span>'}</div>
    <div>Trợ giảng: ${troGiangNames.length?`<strong>${troGiangNames.join(', ')}</strong>`:'<span style="color:#b0b8c8;font-weight:400">—</span>'}</div>
  `;

  const ROW_H = 54, HEAD_H = 46; // chiều cao cố định — dùng chung cho cả 2 cột để hàng luôn khớp nhau

  // Cột trái: danh sách học viên (chỉ ghi tên, bỏ avatar tròn — không có ý nghĩa)
  // Cảnh báo ⚠ nếu BẤT KỲ buổi nào của học viên đó có cảnh báo
  const nameRows = hvList.map(hv=>{
    const perCa = caHocList.map(ca=>cellInfo(hv.studentId, caKey(ca)));
    const hasAlert = perCa.some(info=>info.streak>=3||info.over10pct);
    const worst = perCa.find(info=>info.streak>=3||info.over10pct) || perCa[0];
    const alertTip = worst?.over10pct ? `Nghỉ ${Math.round(worst.tongVang/(worst.tong||1)*100)}% tổng buổi` : `Nghỉ ${worst?.streak||0} buổi liên tiếp`;
    return `<div style="height:${ROW_H}px;box-sizing:border-box;display:flex;align-items:center;gap:8px;padding:0 14px;border-bottom:1px solid #f0f4fa;overflow:hidden">
      <div style="font-size:13px;font-weight:500;color:#1a2236;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${escapeAttr(hv.hoTen)}">${hv.hoTen}</div>
      ${hasAlert?`<button class="btn btn-sm" style="font-size:9px;padding:2px 5px;margin-left:auto;flex-shrink:0;background:#fee2e2;border-color:#fca5a5;color:#991b1b"
        onclick="promptGuiTinNghiNhieu('${hv.studentId}','${escapeAttr(hv.hoTen)}')" title="${alertTip}">⚠</button>`:''}
    </div>`;
  }).join('');

  // Cột phải: lịch — ngày nào chỉ có 1 buổi thì hiện 1 ô vuông nguyên như trước;
  // ngày nào có 2+ buổi thì tách ô đó thành các dải nhỏ xếp chồng, mỗi dải điểm danh riêng 1 buổi.
  const calRows = hvList.map(hv=>{
    const cells = weekDates.map((ngay,dayIdx)=>{
      const casToday = dayCaList[dayIdx];
      const isToday = ngay===today;
      if(casToday.length===0){
        // Không buổi nào học ngày này
        return `<div style="flex:1;min-width:52px;box-sizing:border-box;display:flex;align-items:center;justify-content:center">
          <div title="Không có buổi học nào vào ngày này" style="width:38px;height:38px;border-radius:9px;border:2px solid #eef2f7;background:#f8fafd;background-image:repeating-linear-gradient(45deg,transparent,transparent 4px,#eef2f7 4px,#eef2f7 5px)"></div>
        </div>`;
      }
      const boxes = casToday.map(ca=>{
        const info = cellInfo(hv.studentId, caKey(ca));
        const {bg,text,border,icon,tip} = dayCell(hv.studentId, ngay, ca, info);
        const isFuture = ngay > today;
        const clickFn = !isFuture ?
          `onclick="openDiemDanhNgayHV('${hv.studentId}','${escapeAttr(hv.hoTen)}','${ngay}','${caKey(ca)}')"` : '';
        const h = casToday.length>1 ? `calc((100% - ${(casToday.length-1)*3}px)/${casToday.length})` : '38px';
        return `<div ${clickFn} title="${tip}${!isFuture?' — click để điểm danh':''}" style="
          width:${casToday.length>1?'100%':'38px'};height:${h};border-radius:${casToday.length>1?'6px':'9px'};border:2px solid ${border};
          background:${bg};color:${text};
          display:flex;align-items:center;justify-content:center;
          ${!isFuture?'cursor:pointer;':'cursor:default;'}transition:all .15s;
          ${isToday?'box-shadow:0 0 0 2px #3a7bd5;':''}
          font-size:${casToday.length>1?'11px':'14px'};font-weight:800;line-height:1"
          ${!isFuture?`onmouseover="this.style.filter='brightness(0.95)'" onmouseout="this.style.filter='none'"`:''}>${icon}</div>`;
      }).join('');
      const wrapStyle = casToday.length>1
        ? `width:38px;display:flex;flex-direction:column;gap:3px`
        : `display:flex;align-items:center;justify-content:center`;
      return `<div style="flex:1;min-width:52px;box-sizing:border-box;display:flex;align-items:center;justify-content:center">
        <div style="${wrapStyle}">${boxes}</div>
      </div>`;
    }).join('');
    return `<div style="height:${ROW_H}px;box-sizing:border-box;display:flex;border-bottom:1px solid #f0f4fa">${cells}</div>`;
  }).join('');

  const weekLabel = `${fmtDate(weekDates[0])} — ${fmtDate(weekDates[6])}`;

  return `<div class="table-wrap">
    <!-- HÀNG TRÊN: bảng 1 = thông tin lớp (trái), chú thích + điều hướng tuần (phải) -->
    <div style="display:flex">
      <div style="width:230px;flex-shrink:0;padding:14px 16px;border-right:2px solid #e4ebf5;background:#f8fafd;box-sizing:border-box">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:nowrap;margin-bottom:10px">
          <div style="font-size:19px;font-weight:800;color:#0d2d5e;text-transform:uppercase;white-space:nowrap">Lớp ${lop.tenLop}</div>
          <span style="font-size:12px;font-weight:700;padding:3px 10px;border-radius:20px;background:${CAP_DO_COLORS[lop.capDo]||'#f0f4fa'};color:${CAP_DO_TEXT[lop.capDo]||'#5a6478'};white-space:nowrap">Trình độ ${lop.capDo||'—'}</span>
        </div>
        ${lop.canhBaoGiuaKy?`<div class="badge b-warn1" style="animation:pulse 1.5s infinite;margin-bottom:6px">Giữa kỳ còn ${lop.soNgayConGiuaKy} ngày</div>`:''}
        ${lop.canhBaoCuoiKy?`<div class="badge b-warn2" style="animation:pulse 1.5s infinite;margin-bottom:6px">Cuối kỳ còn ${lop.soNgayConCuoiKy} ngày</div>`:''}
        ${lop.ngayBatDau?`<div style="margin-bottom:10px">
          <div style="font-size:12px;color:#8a96a8;margin-bottom:2px">📅 Thời gian học</div>
          <div style="font-size:15px;font-weight:700;color:#1a2236">${fmtDate(lop.ngayBatDau)} – ${fmtDate(lop.ngayKetThuc||'')}</div>
        </div>`:''}
        <!-- Mục "Giáo viên" (GV chính/bản xứ/trợ giảng) CHỈ dành cho nội bộ: admin/giáo viên/trợ giảng/quản lý.
             Phụ huynh không cần và không nên thấy — thực tế phụ huynh cũng không vào được trang Lớp học này
             luôn (bị ẩn hoàn toàn ở applyRoleNav()), nên không cần tự ẩn thêm ở đây. -->
        <div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
            <span style="font-size:13px;font-weight:700;font-style:italic;text-transform:uppercase;color:#5a6478">👥 Giáo viên</span>
            ${USER.role==='admin'?`<button class="btn btn-sm" style="font-style:normal;text-transform:none;font-size:10px;padding:2px 7px" onclick="openModalLop('${lop.lopId}')" title="Thêm/sửa giáo viên chính, giáo viên bản xứ, trợ giảng cho lớp">+ Thêm GV</button>`:''}
          </div>
          <div style="font-size:13px;font-weight:500;color:#1a2236;line-height:1.7">${caHocInfoHtml}</div>
        </div>
      </div>
      <div style="flex:1;padding:14px 16px;box-sizing:border-box;min-width:0">
        <div style="position:relative">
          <div class="ca-info-bubble" id="ca-info-bubble"></div>
          <div class="ca-badge-row" style="display:flex;gap:8px;margin-bottom:8px">
            <div data-ca-badge style="flex:1;display:flex;align-items:center;gap:6px;padding:8px 10px;border:1.5px solid ${autoDDBat?'#86efac':'#d1d8e0'};border-radius:9px;background:#fafbfd;font-size:12px;color:#5a6478;white-space:nowrap;transition:background .15s${autoDDBat?';--pulse-color:rgba(134,239,172,.55);animation:alertPing 1.8s infinite':''}" onmouseover="this.style.background='${autoDDBat?'#f0fdf4':'#f5f8fc'}'" onmouseout="this.style.background='#fafbfd'">
              <span onclick="showCaInfoBubble('auto',event)" style="display:flex;align-items:center;gap:6px;cursor:pointer;flex:1;min-width:0;overflow:hidden">
                <span style="display:inline-block;width:14px;height:14px;border-radius:4px;background:${autoDDBat?'#dcfce7':'#eef2f7'};border:1.5px solid ${autoDDBat?'#86efac':'#cbd5e1'};flex-shrink:0"></span>
                <span style="overflow:hidden;text-overflow:ellipsis">Tự động điểm danh</span>
              </span>
              ${USER.role==='admin'?`<span onclick="toggleAutoDD('${lop.lopId}',${!autoDDBat},event)" title="${autoDDBat?'Đang BẬT — bấm để tắt':'Đang TẮT — bấm để bật'}" style="flex-shrink:0;width:30px;height:17px;border-radius:20px;background:${autoDDBat?'#22c55e':'#cbd5e1'};position:relative;cursor:pointer;transition:background .2s">
                <span style="position:absolute;top:2px;left:${autoDDBat?'15px':'2px'};width:13px;height:13px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:left .2s"></span>
              </span>`:''}
              <span onclick="showCaInfoBubble('auto',event)" style="cursor:pointer;color:${autoDDBat?'#86efac':'#cbd5e1'};font-weight:700;flex-shrink:0">ⓘ</span>
            </div>
            <div data-ca-badge onclick="showCaInfoBubble('alert',event)" style="flex:1;display:flex;align-items:center;gap:6px;padding:8px 10px;border:1.5px solid #fca5a5;border-radius:9px;background:#fafbfd;font-size:12px;color:#5a6478;white-space:nowrap;cursor:pointer;transition:background .15s;--pulse-color:rgba(252,165,165,.55);animation:alertPing 1.8s infinite .3s" onmouseover="this.style.background='#fef2f2'" onmouseout="this.style.background='#fafbfd'">
              <span style="display:inline-block;width:14px;height:14px;border-radius:4px;background:#fee2e2;border:1.5px solid #fca5a5;flex-shrink:0"></span>Cảnh báo<span style="margin-left:auto;color:#fca5a5;font-weight:700;flex-shrink:0">ⓘ</span>
            </div>
            <div data-ca-badge onclick="showCaInfoBubble('split',event)" style="flex:1;display:flex;align-items:center;gap:6px;padding:8px 10px;border:1.5px solid #93c5fd;border-radius:9px;background:#fafbfd;font-size:12px;color:#5a6478;white-space:nowrap;cursor:pointer;transition:background .15s;--pulse-color:rgba(147,197,253,.55);animation:alertPing 1.8s infinite .6s" onmouseover="this.style.background='#eff6ff'" onmouseout="this.style.background='#fafbfd'">
              <span style="display:inline-block;width:14px;height:14px;border-radius:4px;background:#dbeafe;border:1.5px solid #93c5fd;flex-shrink:0"></span>Điểm danh theo buổi<span style="margin-left:auto;color:#93c5fd;font-weight:700;flex-shrink:0">ⓘ</span>
            </div>
          </div>
          <div style="display:flex;gap:8px">
            <div style="flex:1;display:flex;align-items:center;gap:6px;padding:8px 10px;border:1.5px solid #e4ebf5;border-radius:9px;background:#fafbfd;font-size:12px;color:#5a6478;white-space:nowrap"><span style="display:inline-block;width:14px;height:14px;border-radius:4px;background:#dbeafe;border:1.5px solid #93c5fd;flex-shrink:0"></span><strong>P</strong>&nbsp;Nghỉ có phép</div>
            <div style="flex:1;display:flex;align-items:center;gap:6px;padding:8px 10px;border:1.5px solid #e4ebf5;border-radius:9px;background:#fafbfd;font-size:12px;color:#5a6478;white-space:nowrap"><span style="display:inline-block;width:14px;height:14px;border-radius:4px;background:#fed7aa;border:1.5px solid #f97316;flex-shrink:0"></span><strong>K</strong>&nbsp;Nghỉ không phép</div>
            <div style="flex:1;display:flex;align-items:center;gap:6px;padding:8px 10px;border:1.5px solid #e4ebf5;border-radius:9px;background:#fafbfd;font-size:12px;color:#5a6478;white-space:nowrap"><span style="display:inline-block;width:14px;height:14px;border-radius:4px;background:#fef3c7;border:1.5px solid #fcd34d;flex-shrink:0"></span><strong>T</strong>&nbsp;Đi trễ >15'</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:10px">
          <button class="btn btn-sm" onclick="changeWeek(-1)" style="border:1.5px solid #e4ebf5;border-radius:9px;padding:10px;height:100%">← Tuần trước</button>
          <div style="border:1.5px solid #e4ebf5;border-radius:9px;padding:10px;background:#fafbfd;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center">
            <div style="font-size:14px;font-weight:700;color:#0d2d5e">${weekLabel}</div>
            ${LICH_WEEK_OFFSET<0?`<span style="font-size:11px;color:#3a7bd5;cursor:pointer;margin-top:2px" onclick="LICH_WEEK_OFFSET=0;const l=LOP_DATA.find(x=>x.lopId===LOP_DETAIL_ID);renderTabDiemDanh(l)">↺ Về tuần hiện tại</span>`:''}
          </div>
          <button class="btn btn-sm" onclick="changeWeek(1)" ${LICH_WEEK_OFFSET>=0?'disabled':''} style="border:1.5px solid #e4ebf5;border-radius:9px;padding:10px;height:100%">Tuần sau →</button>
        </div>
      </div>
    </div>
    <!-- HÀNG DƯỚI: bảng 2 = danh sách học viên (trái), bảng 3 = lịch điểm danh (phải) — chiều cao dòng khớp tuyệt đối -->
    <div style="display:flex">
      <div style="width:230px;flex-shrink:0;border-right:2px solid #e4ebf5;box-sizing:border-box">
        <div style="height:${HEAD_H}px;box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;padding:0 6px 0 14px;font-size:13px;font-weight:700;font-style:italic;text-transform:uppercase;color:#5a6478;background:#f5f8fc;border-bottom:1px solid #e4ebf5">
          <span>Danh sách lớp</span>
          <div style="display:flex;gap:4px">
            ${['admin','giaovien','trogiang'].includes(USER.role)?`<button class="btn btn-sm" style="font-style:normal;text-transform:none;font-size:11px;padding:4px 6px;white-space:nowrap" onclick="openModalHV(null,'${escapeAttr(lop.tenLop)}')">+ Thêm HV</button>`:''}
          </div>
        </div>
        ${nameRows}
      </div>
      <div style="flex:1;overflow-x:auto">
        <div style="min-width:400px">
          <div style="height:${HEAD_H}px;box-sizing:border-box;display:flex;background:linear-gradient(180deg,#fafbfd,#f5f8fc);border-bottom:1px solid #e4ebf5">
            ${thuLabels.map((t,i)=>`<div style="flex:1;min-width:52px;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center">
              <span style="font-size:12px;font-weight:700;color:${weekDates[i]===today?'#1a50a0':'#8a96a8'}">${t}</span>
              <span style="font-size:10px;font-weight:400;color:${weekDates[i]===today?'#3a7bd5':'#b0b8c8'}">${weekDates[i].slice(8)}/${weekDates[i].slice(5,7)}</span>
            </div>`).join('')}
          </div>
          ${calRows}
        </div>
      </div>
    </div>
  </div>`;
}

function changeWeek(dir){
  LICH_WEEK_OFFSET = Math.min(0, LICH_WEEK_OFFSET + dir);
  const lop = LOP_DATA.find(l=>l.lopId===LOP_DETAIL_ID);
  renderTabDiemDanh(lop);
}

function selectDDDate(ngay){
  LOP_DD_DATE = ngay;
  const lop = LOP_DATA.find(l=>l.lopId===LOP_DETAIL_ID);
  renderTabDiemDanh(lop);
}

function escapeAttr(s){ return (s||'').replace(/'/g,'&#39;').replace(/"/g,'&quot;'); }

// Click vào ô học sinh trong lịch → modal điểm danh riêng cho học sinh đó ngày đó
async function openDiemDanhNgayHV(studentId, hoTen, ngay, caId){
  const lop = LOP_DATA.find(l=>l.lopId===LOP_DETAIL_ID);
  let caHocList=[];
  try{ caHocList=lop.caHoc?JSON.parse(lop.caHoc):[]; }catch(e){ caHocList=[]; }
  if(caHocList.length===0) caHocList=[{ten:'Buổi học',nguoiDay:''}];

  // Lấy trạng thái hiện tại của học sinh này ngày này
  const ddR = await call({action:'getDiemDanhByLop',lop:lop.tenLop,ngay,caId});
  const existing = ddR.ok ? ddR.data.find(d=>d.studentId===studentId) : null;
  const curTT = existing?.trangThai || 'co_mat';
  const curNote = existing?.ghiChu || '';

  const caLabel = caHocList.find(ca=>caKey(ca)===caId)?.ten || 'Buổi học';

  showModal(`📋 Điểm danh — ${hoTen}`, `
    <div style="display:flex;gap:10px;margin-bottom:16px">
      <div style="background:#f5f8fd;border-radius:10px;padding:10px 16px;flex:1;text-align:center">
        <div style="font-size:11px;color:#8a96a8;margin-bottom:2px">Ngày</div>
        <div style="font-weight:700;color:#0d2d5e;font-size:15px">${fmtDate(ngay)}</div>
      </div>
      <div style="background:#f5f8fd;border-radius:10px;padding:10px 16px;flex:1;text-align:center">
        <div style="font-size:11px;color:#8a96a8;margin-bottom:2px">Buổi học</div>
        <div style="font-weight:700;color:#0d2d5e;font-size:15px">${caLabel}</div>
      </div>
    </div>

    <div class="form-row"><label>Trạng thái <span style="font-weight:400;color:#8a96a8">(click hoặc gõ phím: mặc định=Có mặt, P=phép, K=không phép, T=trễ)</span></label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px" id="tt-grid">
        ${[
          {v:'co_mat',       l:'✓ Có mặt',         short:'',  bg:'#dcfce7',bc:'#86efac',tc:'#166534'},
          {v:'vang_phep',    l:'P — Nghỉ có phép',  short:'P', bg:'#dbeafe',bc:'#93c5fd',tc:'#1e40af'},
          {v:'vang_khong_phep',l:'K — Nghỉ không phép',short:'K',bg:'#fed7aa',bc:'#f97316',tc:'#9a3412'},
          {v:'di_tre',       l:'T — Đi trễ >15\'', short:'T', bg:'#fef3c7',bc:'#fcd34d',tc:'#92400e'},
        ].map(opt=>`<button type="button" id="tt-${opt.v}"
          onclick="selectTT('${opt.v}')"
          style="padding:12px 10px;border-radius:12px;border:2px solid ${curTT===opt.v?opt.bc:'#e4ebf5'};
            background:${curTT===opt.v?opt.bg:'#fff'};color:${curTT===opt.v?opt.tc:'#5a6478'};
            font-size:14px;font-weight:600;cursor:pointer;transition:all .15s;text-align:left">
          ${opt.l}
        </button>`).join('')}
      </div>
      <div class="hint" style="margin-top:8px">💡 Gõ <strong>P</strong>, <strong>K</strong>, <strong>T</strong> để chọn nhanh. Bấm <strong>Enter</strong> để lưu. Không chọn = mặc định Có mặt.</div>
    </div>
    <div class="form-row"><label>Ghi chú</label>
      <input id="modal-note" value="${curNote}" placeholder="Ghi chú thêm...">
    </div>
    <input type="hidden" id="modal-tt-val" value="${curTT}">
  `, async()=>{
    const tt = document.getElementById('modal-tt-val').value || 'co_mat';
    const note = document.getElementById('modal-note').value.trim();
    const r = await call({action:'saveDiemDanh',records:[{studentId,ngay,caId,trangThai:tt,ghiChu:note}]});
    if(r.ok){
      closeModal();
      toast(`Đã điểm danh ${hoTen}`,'success');
      const lopObj = LOP_DATA.find(l=>l.lopId===LOP_DETAIL_ID);
      renderTabDiemDanh(lopObj);
    } else toast('Lỗi lưu','error');
  });

  // Gõ phím tắt P/K/T + Enter
  setTimeout(()=>{
    document.addEventListener('keydown', _ddKeyHandler);
  }, 100);
}

function selectTT(val){
  document.getElementById('modal-tt-val').value = val;
  const map = {
    co_mat:{bg:'#dcfce7',bc:'#86efac',tc:'#166534'},
    vang_phep:{bg:'#dbeafe',bc:'#93c5fd',tc:'#1e40af'},
    vang_khong_phep:{bg:'#fee2e2',bc:'#fca5a5',tc:'#991b1b'},
    di_tre:{bg:'#fef3c7',bc:'#fcd34d',tc:'#92400e'},
  };
  ['co_mat','vang_phep','vang_khong_phep','di_tre'].forEach(v=>{
    const btn = document.getElementById('tt-'+v);
    if(!btn) return;
    const {bg,bc,tc} = map[v];
    if(v===val){ btn.style.background=bg; btn.style.borderColor=bc; btn.style.color=tc; }
    else { btn.style.background='#fff'; btn.style.borderColor='#e4ebf5'; btn.style.color='#5a6478'; }
  });
}

async function promptGuiTinNghiNhieu(studentId, hoTen){
  const hvR = await call({action:'getHocVienById',studentId});
  const emailPH = hvR.ok?hvR.data.emailPhuHuynh:'';
  if(!emailPH){ toast('Học viên chưa có email phụ huynh','error'); return; }

  showModal(`⚠ Gửi tin cho phụ huynh — ${hoTen}`,`
    <div class="hint" style="margin-bottom:12px">
      <strong>${hoTen}</strong> đã nghỉ 3 buổi liên tiếp trong tuần này.<br>
      Gửi tới: <strong>${emailPH}</strong>
    </div>
    <div class="form-row"><label>Nội dung tin nhắn</label>
      <textarea id="f-msg-nghi" rows="4">${hoTen} đã nghỉ học 3 buổi liên tiếp trong tuần này. Kính nhờ phụ huynh liên hệ với trung tâm để được hỗ trợ.</textarea>
    </div>
  `,async()=>{
    const noiDung = document.getElementById('f-msg-nghi').value.trim();
    if(!noiDung){ toast('Nhập nội dung','error'); return; }
    const r=await call({action:'sendThongBao',tieuDe:`Cảnh báo chuyên cần - ${hoTen}`,noiDung,nguoiNhan:emailPH,lop:''});
    if(!r.ok){ toast(r.error||'Lỗi khi gửi','error'); return; }
    closeModal(); toast('Đã gửi tin nhắn cho phụ huynh','success');
  });
}

// ── TAB BANG DIEM ──
async function renderTabBangDiem(lop){
  const wrap = document.getElementById('lop-detail-content');
  wrap.innerHTML = '<div class="empty">Đang tải...</div>';
  const canEdit = ['admin','giaovien','trogiang'].includes(USER.role);

  const [hvR,bdR] = await Promise.all([
    call({action:'getHocVienByLop',lop:lop.tenLop}),
    call({action:'getBangDiemByLop',lop:lop.tenLop}),
  ]);
  const hvList = (hvR.ok?hvR.data:[]).filter(hv=>hv.trangThai==='danghoc'||!hv.trangThai);
  const bdList = bdR.ok?bdR.data:[];

  // Map theo studentId + loai
  const bdMap={};
  bdList.forEach(bd=>{
    if(!bdMap[bd.studentId]) bdMap[bd.studentId]={};
    if(!bdMap[bd.studentId][bd.loai]) bdMap[bd.studentId][bd.loai]=[];
    bdMap[bd.studentId][bd.loai].push(bd);
  });

  // Cảnh báo: học viên điểm <5 nhiều lần, hoặc không làm BTVN nhiều lần
  const canhBaoDiem = hvList.map(hv=>{
    const allDiem = (bdMap[hv.studentId]?.giua_ky||[]).concat(bdMap[hv.studentId]?.cuoi_ky||[]);
    const duoi5 = allDiem.filter(d=>parseFloat(d.diem)<5).length;
    const khongLamBT = (bdMap[hv.studentId]?.khong_lam_btvn||[]).length;
    return {hoTen:hv.hoTen,duoi5,khongLamBT};
  }).filter(x=>x.duoi5>0||x.khongLamBT>0);

  document.getElementById('btn-add').style.display='none';

  wrap.innerHTML = `
    <div style="padding:12px 16px;border-bottom:1px solid #f0f4fa;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <span style="font-size:15px;font-weight:800;color:#0d2d5e;text-transform:uppercase">Lớp ${lop.tenLop}</span>
      <span style="font-size:12px;font-weight:700;padding:3px 10px;border-radius:20px;background:${CAP_DO_COLORS[lop.capDo]||'#f0f4fa'};color:${CAP_DO_TEXT[lop.capDo]||'#5a6478'}">Trình độ ${lop.capDo||'—'}</span>
    </div>
    ${canhBaoDiem.length>0?`
    <div class="table-wrap" style="margin:14px 16px;padding:14px 16px">
      <div style="font-size:13px;font-weight:600;color:#0d2d5e;margin-bottom:10px">⚠ Cần lưu ý học tập</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">
        ${canhBaoDiem.map(c=>`<div style="background:#fef0ee;border-radius:8px;padding:10px 12px">
          <div style="font-size:13px;font-weight:600">${c.hoTen}</div>
          <div style="font-size:11px;margin-top:3px;color:#993c1d">
            ${c.duoi5>0?`${c.duoi5} lần điểm dưới 5`:''}${c.duoi5>0&&c.khongLamBT>0?' · ':''}${c.khongLamBT>0?`${c.khongLamBT} lần không làm BTVN`:''}
          </div>
        </div>`).join('')}
      </div>
    </div>`:''}

    <div class="table-wrap" style="margin:0 16px 14px;padding:14px 16px">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <span style="font-size:13px;font-weight:600;color:#0d2d5e">Nhập điểm hàng loạt</span>
        <select id="bd-loai" style="width:160px" onchange="renderBDInputType()">
          <option value="giua_ky">Kiểm tra giữa kỳ</option>
          <option value="cuoi_ky">Kiểm tra cuối kỳ</option>
          <option value="khong_lam_btvn">Không làm BTVN</option>
        </select>
        <input id="bd-tenBai" placeholder="Tên bài kiểm tra..." style="width:180px">
        <input type="date" id="bd-ngay" value="${todayStr()}" style="width:140px">
        ${canEdit?`<button class="btn btn-primary" onclick="saveBDGrid()">💾 Lưu tất cả</button>`:''}
      </div>
    </div>

    <div class="table-wrap" style="margin:0 16px 14px">
      <div style="overflow-x:auto">
      <table id="bd-grid">
        <thead><tr id="bd-grid-head">
          <th style="min-width:160px">Học viên</th>
          <th style="min-width:90px;text-align:center" id="bd-grid-input-head">Điểm</th>
          <th style="min-width:160px">Nhận xét</th>
        </tr></thead>
        <tbody>
          ${hvList.map(hv=>`<tr data-sid="${hv.studentId}">
            <td><div style="font-weight:500">${hv.hoTen}</div></td>
            <td style="text-align:center" id="bd-input-cell-${hv.studentId}">
              <input type="number" class="bd-diem" data-sid="${hv.studentId}" min="0" max="10" step="0.1" placeholder="—" style="width:70px;text-align:center;font-size:15px;font-weight:600" oninput="highlightRow(this)">
            </td>
            <td><input class="bd-nhanxet" data-sid="${hv.studentId}" placeholder="..." style="width:100%;font-size:12px"></td>
          </tr>`).join('')}
        </tbody>
      </table>
      </div>
    </div>

    <div class="table-wrap" style="margin:0 16px 16px">
      <div class="table-toolbar"><span style="font-size:13px;font-weight:600;color:#0d2d5e">Lịch sử</span></div>
      <div style="overflow-x:auto">
      <table>
        <thead><tr><th>Học viên</th><th>Loại</th><th>Tên bài</th><th>Điểm/Trạng thái</th><th>Ngày</th><th>Nhận xét</th>${canEdit?'<th>Xóa</th>':''}</tr></thead>
        <tbody>
          ${bdList.length===0?'<tr><td colspan="7" style="text-align:center;padding:24px;color:#8a96a8">Chưa có dữ liệu</td></tr>':bdList.sort((a,b)=>b.ngay.localeCompare(a.ngay)).map(bd=>{
            const hv=hvList.find(h=>h.studentId===bd.studentId);
            const isBT = bd.loai==='khong_lam_btvn';
            return `<tr>
              <td><div style="font-weight:500">${hv?.hoTen||bd.studentId}</div></td>
              <td><span class="badge ${loaiClass(bd.loai)}">${LOAI_DIEM[bd.loai]||bd.loai}</span></td>
              <td style="font-size:12px">${bd.tenBai||'—'}</td>
              <td>${isBT?'<span class="badge b-vang">Không làm</span>':`<span style="font-size:14px;font-weight:600;color:${parseFloat(bd.diem)>=5?'#0f6e56':'#e24b4a'}">${bd.diem}</span>`}</td>
              <td style="font-size:12px;color:#8a96a8">${fmtDate(bd.ngay)}</td>
              <td style="font-size:12px">${bd.nhanXet||'—'}</td>
              ${canEdit?`<td><button class="btn btn-danger btn-sm" onclick="deleteBD('${bd.recordId}')">Xóa</button></td>`:''}
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      </div>
    </div>
  `;
}

function renderBDInputType(){
  const loai = document.getElementById('bd-loai').value;
  const head = document.getElementById('bd-grid-input-head');
  const isBT = loai==='khong_lam_btvn';
  head.textContent = isBT ? 'Không làm' : 'Điểm';
  document.querySelectorAll('[id^="bd-input-cell-"]').forEach(cell=>{
    const sid = cell.id.replace('bd-input-cell-','');
    if(isBT){
      cell.innerHTML = `<input type="checkbox" class="cb bd-checkbox" data-sid="${sid}" style="width:20px;height:20px">`;
    } else {
      cell.innerHTML = `<input type="number" class="bd-diem" data-sid="${sid}" min="0" max="10" step="0.1" placeholder="—" style="width:70px;text-align:center;font-size:15px;font-weight:600" oninput="highlightRow(this)">`;
    }
  });
}

function highlightRow(input){
  const tr=input.closest('tr');
  if(input.value) tr.style.background='#f0f8ff';
  else tr.style.background='';
}

async function saveBDGrid(){
  const loai=document.getElementById('bd-loai').value;
  const tenBai=document.getElementById('bd-tenBai').value.trim();
  const ngay=document.getElementById('bd-ngay').value||todayStr();
  const isBT = loai==='khong_lam_btvn';
  const rows=document.querySelectorAll('#bd-grid tbody tr');
  const toSave=[];

  if(isBT){
    rows.forEach(tr=>{
      const sid=tr.dataset.sid;
      const checked=tr.querySelector('.bd-checkbox')?.checked;
      if(checked) toSave.push({studentId:sid,loai,tenBai:tenBai||'BTVN',diem:'0',nhanXet:'',ngay,ghiBoi:USER.email});
    });
  } else {
    rows.forEach(tr=>{
      const sid=tr.dataset.sid;
      const diem=tr.querySelector('.bd-diem')?.value?.trim();
      const nhanXet=tr.querySelector('.bd-nhanxet')?.value?.trim()||'';
      if(diem!==''&&diem!==undefined&&!isNaN(parseFloat(diem))) toSave.push({studentId:sid,loai,tenBai,diem,nhanXet,ngay,ghiBoi:USER.email});
    });
  }

  if(toSave.length===0){toast(isBT?'Chưa chọn học viên nào':'Chưa nhập điểm nào','error');return;}
  let ok=0;
  for(const item of toSave){ const r=await call({action:'addBangDiem',...item}); if(r.ok) ok++; }
  toast(`Đã lưu ${ok}/${toSave.length}`,'success');
  const lop=LOP_DATA.find(l=>l.lopId===LOP_DETAIL_ID);
  renderTabBangDiem(lop);
}

async function deleteBD(recordId){
  if(!confirm('Xóa bản ghi này?')) return;
  const r=await call({action:'deleteBangDiem',recordId});
  if(!r.ok){toast(r.error||'Lỗi khi xóa','error');return;}
  toast('Đã xóa','success');
  const lop=LOP_DATA.find(l=>l.lopId===LOP_DETAIL_ID);
  renderTabBangDiem(lop);
}

// ── TAI KHOAN ──
async function renderTaiKhoan(){
  if(USER.role!=='admin'){setContent('<div class="empty"><p>Không có quyền</p></div>');return;}
  setContent('<div class="empty">Đang tải...</div>');
  const r=await call({action:'getTaiKhoanList'});
  const list=r.ok?r.data:[];
  document.getElementById('btn-add').onclick=()=>openModalTK(null);
  document.getElementById('btn-add').textContent='+ Thêm tài khoản';
  setContent(`
    <div class="table-wrap" style="margin-bottom:14px;padding:14px 16px">
      <div style="font-size:13px;font-weight:600;color:#0d2d5e;margin-bottom:8px">🧪 Dữ liệu test</div>
      <div style="font-size:12px;color:#5a6478;margin-bottom:10px">Tự tạo/xóa nhanh 30 học viên + 30 phụ huynh + 5 giáo viên + 5 trợ giảng + 2 admin để test, dùng mẹo Gmail +alias (không cần tạo email thật). Dữ liệu tạo ra được đánh dấu riêng — nút "Xóa" chỉ xóa đúng phần này, không đụng dữ liệu thật.</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn btn-primary" onclick="openModalSeedTest()">🧪 Tạo dữ liệu test</button>
        <button class="btn btn-danger" onclick="clearTestData()">🗑️ Xóa dữ liệu test</button>
      </div>
    </div>
    <div class="table-wrap">
      <div class="table-toolbar"><span style="font-size:13px;font-weight:600">Danh sách tài khoản — ${list.length}</span></div>
      <table>
        <thead><tr><th>Họ tên</th><th>Email</th><th>Vai trò</th><th>Ngày tạo</th><th>Thao tác</th></tr></thead>
        <tbody>
          ${list.map(tk=>`<tr>
            <td><div style="display:flex;align-items:center;gap:7px"><div class="avatar" style="width:26px;height:26px;font-size:10px;background:#e8f0fb;color:#1a50a0">${ini(tk.hoTen)}</div><span style="font-weight:500">${tk.hoTen}</span></div></td>
            <td style="color:#5a6478;font-size:12px">${tk.email}</td>
            <td><span class="role-pill r-${tk.role}">${ROLES_VI[tk.role]||tk.role}</span></td>

            <td style="font-size:12px;color:#8a96a8">${fmtDate(tk.ngayTao)}</td>
            <td><div class="td-actions">
              <button class="btn btn-sm" onclick="openModalTK('${tk.email}','${tk.hoTen}','${tk.role}')">Sửa</button>
              ${tk.email!==USER.email?`<button class="btn btn-danger btn-sm" onclick="deleteTK('${tk.email}')">Xóa</button>`:''}
            </div></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `);
}

// ── DU LIEU TEST ──
function openModalSeedTest(){
  showModal('Tạo dữ liệu test',`
    <div class="form-row">
      <label>Email Gmail của bạn *</label>
      <input id="seed-email" placeholder="tenban@gmail.com" value="${USER.email.indexOf('+')===-1?USER.email:''}">
    </div>
    <div style="font-size:12px;color:#5a6478;margin:6px 0 12px">
      Hệ thống sẽ tự sinh các email kiểu <code>tenban+ph1@gmail.com</code>, <code>+gv1</code>, <code>+tg1</code>, <code>+ad1</code>...
      — tất cả đều gửi về đúng hộp thư Gmail này, dùng để đăng nhập test nhiều vai trò khác nhau.
    </div>
    <div class="form-row">
      <label>Lớp để gán 30 học viên vào</label>
      <select id="seed-lop">
        ${LOPS.map(l=>`<option value="${l}">${l}</option>`).join('')}
        <option value="" selected>+ Tự tạo "Lớp Test" mới</option>
      </select>
    </div>
    <div style="font-size:12px;color:#5a6478;margin-top:10px">Sẽ tạo: 30 học viên, 30 phụ huynh, 5 giáo viên, 5 trợ giảng, 2 admin.</div>
  `,async()=>{
    const baseEmail=document.getElementById('seed-email').value.trim();
    if(!baseEmail||baseEmail.indexOf('@')===-1){toast('Nhập email Gmail hợp lệ','error');return;}
    const lop=document.getElementById('seed-lop').value;
    const r=await call({action:'seedTestData',baseEmail,lop});
    closeModal();
    if(r.ok) toast(`Đã tạo ${r.data.hocVienCount} học viên + ${r.data.taiKhoanCount} tài khoản (lớp "${r.data.lop}")`,'success');
    else toast(r.error||'Lỗi khi tạo dữ liệu test','error');
    await loadLops();
    await refreshAllAccounts();
    renderTaiKhoan();
  });
}
async function clearTestData(){
  if(!confirm('Xóa toàn bộ dữ liệu test đã tạo (học viên, phụ huynh, giáo viên, trợ giảng, admin test)? Không thể hoàn tác.')) return;
  const r=await call({action:'clearTestData'});
  if(r.ok) toast(`Đã xóa ${r.data.hocVien} học viên, ${r.data.taiKhoan} tài khoản, ${r.data.lop} lớp test`,'success');
  else toast(r.error||'Lỗi khi xóa dữ liệu test','error');
  await loadLops();
  await refreshAllAccounts();
  renderTaiKhoan();
}
function openModalTK(email,hoTen,role){
  const isEdit=!!email;
  showModal(isEdit?'Sửa tài khoản':'Thêm tài khoản',`
    <div class="form-row"><label>Họ tên *</label><input id="f-hoTen" value="${hoTen||''}"></div>
    <div class="form-row"><label>Email Google *</label><input id="f-email" value="${email||''}" ${isEdit?'disabled':''}></div>
    <div class="form-row"><label>Vai trò *</label>
      <select id="f-role">
        <option value="admin" ${role==='admin'?'selected':''}>Admin</option>
        <option value="giaovien" ${role==='giaovien'?'selected':''}>Giáo viên</option>
        <option value="trogiang" ${role==='trogiang'?'selected':''}>Trợ giảng</option>
        <option value="quanly" ${role==='quanly'?'selected':''}>Quản lý</option>
        <option value="phuhuynh" ${role==='phuhuynh'?'selected':''}>Phụ huynh / Người giới thiệu</option>
      </select>
    </div>
    <div class="hint">
      <strong>Admin</strong>: toàn quyền &nbsp;|&nbsp;
      <strong>Giáo viên</strong>: thấy lớp được assign trong Lớp học &nbsp;|&nbsp;
      <strong>Quản lý</strong>: xem báo cáo, gửi thông báo &nbsp;|&nbsp;
      <strong>Phụ huynh</strong>: xem học viên mình quản lý
    </div>
  `,async()=>{
    const inputEmail=(document.getElementById('f-email').value||email||'').trim().toLowerCase();
    const body={newEmail:inputEmail,targetEmail:inputEmail,hoTen:document.getElementById('f-hoTen').value.trim(),role:document.getElementById('f-role').value};
    if(!inputEmail||!body.hoTen){toast('Nhập đầy đủ','error');return;}
    const r=await call({action:isEdit?'updateTaiKhoan':'addTaiKhoan',...body});
    if(!r.ok){toast(r.error||'Lỗi','error');return;}
    closeModal();toast(isEdit?'Đã cập nhật':'Đã thêm','success');
    await refreshAllAccounts();
    renderTaiKhoan();
  });
}
async function deleteTK(email){
  if(!confirm('Xóa tài khoản '+email+'?')) return;
  const r=await call({action:'deleteTaiKhoan',targetEmail:email});
  if(!r.ok){toast(r.error||'Lỗi khi xóa','error');return;}
  toast('Đã xóa','success');
  await refreshAllAccounts();
  renderTaiKhoan();
}

// ── HELPERS ──
function ini(name){return(name||'').split(' ').slice(-2).map(w=>w[0]||'').join('').toUpperCase()||'?';}
function fmtDate(s){if(!s)return '—';try{return new Date(s).toLocaleDateString('vi-VN');}catch{return s;}}
function todayStr(){return new Date().toISOString().slice(0,10);}
function diffDaysClient(a,b){return Math.round((new Date(b)-new Date(a))/(1000*60*60*24));}
function dateDiff(a,b){if(!a||!b)return 0;return Math.round((new Date(b)-new Date(a))/(86400000));}
function ddClass(tt){return{co_mat:'b-ok',vang_phep:'b-phep',vang_khong_phep:'b-vang',di_tre:'b-tre'}[tt]||'';}
function loaiClass(l){return{bai_tap:'b-phep',giua_ky:'b-warn1',cuoi_ky:'b-vang'}[l]||'';}
function ttClass(t){return{danghoc:'b-ok',nghi:'b-nghi',baoluu:'b-baoluu'}[t]||'';}
function setContent(h){document.getElementById('content').innerHTML=h;}

function showModal(title,body,onOk){
  document.getElementById('modal-title').textContent=title;
  document.getElementById('modal-body').innerHTML=body;
  document.getElementById('modal').style.display='flex';
  MODAL_CB=onOk;
}
function closeModal(){
  document.getElementById('modal').style.display='none';
  MODAL_CB=null;
  document.removeEventListener('keydown',_ddKeyHandler);
}
// Ham Luu dung chung cho ca bam nut chuot lan bam Enter — khoa nut trong luc dang luu,
// luon cho (await) va bat loi (try/catch/finally) day du, tranh truong hop bam Enter roi
// lo cham/bam ra ngoai popup trong luc dang gui du lieu len server khien bi dong popup
// giua chung ma chua kip luu xong.
let MODAL_SAVING=false;
async function runModalSave(){
  if(!MODAL_CB || MODAL_SAVING) return;
  MODAL_SAVING=true;
  const btn=document.getElementById('modal-ok');
  if(btn){ btn.disabled=true; btn.style.opacity='.6'; }
  try{ await MODAL_CB(); }
  catch(err){ console.error(err); toast('Có lỗi xảy ra: '+(err?.message||err),'error'); }
  finally{
    MODAL_SAVING=false;
    const btn2=document.getElementById('modal-ok');
    if(btn2){ btn2.disabled=false; btn2.style.opacity='1'; }
  }
}
function _ddKeyHandler(e){
  if(!document.getElementById('modal-tt-val')) return;
  // Bỏ qua khi đang gõ trong input/textarea
  if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)&&e.target.id!=='modal-note') return;
  const map={'p':'vang_phep','k':'vang_khong_phep','t':'di_tre','Enter':'save'};
  const action = map[e.key.toLowerCase()]||map[e.key];
  if(action==='save'){e.preventDefault();runModalSave();return;}
  if(action){e.preventDefault();selectTT(action);}
}
function toast(msg,type=''){
  const el=document.createElement('div');
  el.className='toast-item'+(type?' '+type:'');el.textContent=msg;
  document.getElementById('toast').appendChild(el);
  setTimeout(()=>el.remove(),3000);
}

// ── TUTORIAL BUBBLE ──
const TUTORIALS = {
  admin: {
    dashboard: [
      {s:'Bước 1/3', t:'Đây là Dashboard tổng quan. Bạn có thể xem số học viên, tỷ lệ chuyên cần, điểm trung bình và cảnh báo cần xử lý.'},
      {s:'Bước 2/3', t:'Nếu có lớp sắp đến kỳ kiểm tra (≤7 ngày), banner cảnh báo màu vàng sẽ xuất hiện ở đầu trang với chấm đỏ nhấp nháy trong sidebar.'},
      {s:'Bước 3/3', t:'Mỗi role (Admin, Giáo viên, Quản lý, Phụ huynh) sẽ thấy dashboard khác nhau phù hợp với công việc của mình.'},
    ],
    lophoc: [
      {s:'Bước 1/4', t:'Đây là danh sách các lớp học đang và đã có của trung tâm. Mỗi thẻ lớp hiện tiến độ khóa học và cảnh báo kiểm tra.'},
      {s:'Bước 2/4', t:'Nhấn "Thêm" để tạo lớp mới. Trong form tạo lớp, bạn có thể set nhiều buổi học (sáng/chiều/tối) với giáo viên/trợ giảng riêng cho từng buổi.'},
      {s:'Bước 3/4', t:'Nhấn "Vào lớp" để xem chi tiết: Tab Điểm danh (chọn ngày + buổi học → điểm danh từng học viên) và Tab Bảng điểm.'},
      {s:'Bước 4/4', t:'Nút "✉️ Gửi tin nhắn" cho phép admin/quản lý gửi thông báo đến phụ huynh của 1 lớp hoặc tất cả các lớp.'},
    ],
    hocvien: [
      {s:'Bước 1/3', t:'Trang Học viên quản lý thông tin chi tiết. Tab "Thông tin chung" xem theo trạng thái (tốt/cần theo dõi/cần liên hệ). Tab "Danh sách" xem bảng đầy đủ.'},
      {s:'Bước 2/3', t:'Trong bảng Danh sách, bạn có thể đánh dấu đã đóng tiền, đổi trạng thái (đang học/nghỉ/bảo lưu) trực tiếp không cần mở form.'},
      {s:'Bước 3/3', t:'Nút "✉️ Nhắn tin phụ huynh" trên từng học viên cho phép gửi tin nhắn riêng cho phụ huynh của học viên đó.'},
    ],
    taikhoan: [
      {s:'Bước 1/2', t:'Trang Tài khoản chỉ Admin thấy. Tại đây thêm tài khoản cho Giáo viên, Quản lý, Phụ huynh và cấp quyền tương ứng.'},
      {s:'Bước 2/2', t:'Giáo viên: chỉ thấy lớp được assign trong Lớp học. Quản lý: xem báo cáo, gửi tin nhắn. Phụ huynh: chỉ xem thông tin con mình.'},
    ],
  },
  giaovien: {
    dashboard: [
      {s:'Bước 1/2', t:'Dashboard hiện thông tin các lớp bạn đang phụ trách. Nếu có lớp sắp đến kỳ kiểm tra, bạn sẽ thấy cảnh báo tại đây.'},
      {s:'Bước 2/2', t:'Click vào tên lớp trong sidebar hoặc trong danh sách để vào điểm danh và nhập điểm cho lớp đó.'},
    ],
    lophoc: [
      {s:'Bước 1/3', t:'Đây là các lớp bạn được phân công phụ trách. Nhấn "Vào lớp" để thao tác.'},
      {s:'Bước 2/3', t:'Tab Điểm danh: chọn đúng ngày và buổi học (sáng/chiều/tối) trước khi điểm danh để tránh nhầm lẫn giữa các buổi.'},
      {s:'Bước 3/3', t:'Tab Bảng điểm: nhập điểm Giữa kỳ, Cuối kỳ cho cả lớp cùng lúc. Checkbox "Không làm BTVN" để ghi nhận theo từng buổi.'},
    ],
    hocvien: [
      {s:'Bước 1/2', t:'Xem thông tin học viên và liên hệ phụ huynh khi cần. Dùng nút "✉️ Nhắn tin" để gửi tin nhắn trực tiếp.'},
      {s:'Bước 2/2', t:'Cảnh báo màu cam/đỏ trên thẻ học viên cho thấy học viên đó đang có vấn đề về chuyên cần — cần chú ý liên hệ.'},
    ],
  },
  quanly: {
    dashboard: [
      {s:'Bước 1/2', t:'Dashboard hiện tổng quan toàn trung tâm: số học viên, chuyên cần, điểm số và cảnh báo. Dùng để theo dõi sức khỏe chung của trung tâm.'},
      {s:'Bước 2/2', t:'Khi có lớp sắp đến kỳ kiểm tra, hệ thống tự cảnh báo để bạn nhắc giáo viên chuẩn bị.'},
    ],
    lophoc: [
      {s:'Bước 1/2', t:'Xem tổng quan các lớp, tiến độ từng khóa học và cảnh báo kiểm tra. Dùng nút "✉️ Gửi tin nhắn" để thông báo cho phụ huynh theo lớp.'},
      {s:'Bước 2/2', t:'Chọn gửi tin cho 1 lớp cụ thể hoặc tất cả phụ huynh. Phụ huynh sẽ thấy tin nhắn trong Dashboard của họ.'},
    ],
  },
  phuhuynh: {
    dashboard: [
      {s:'Bước 1/3', t:'Đây là trang chính của bạn. Bạn có thể xem thông tin học tập của con mình: điểm số gần đây và tình trạng chuyên cần.'},
      {s:'Bước 2/3', t:'Phần "Tin nhắn từ trung tâm" hiện các thông báo từ giáo viên hoặc quản lý gửi đến bạn. Tin chưa đọc có viền xanh.'},
      {s:'Bước 3/3', t:'Nếu có cảnh báo chuyên cần (nghỉ quá nhiều), bạn sẽ nhận email tự động từ trung tâm.'},
    ],
  },
};
// Trợ giảng dùng chung hướng dẫn với Giáo viên (quyền hạn giống nhau)
TUTORIALS.trogiang = TUTORIALS.giaovien;

let TUT_STEP = 0;
let TUT_PAGE = '';
let TUT_STEPS = [];

function tutInit(page){
  if(localStorage.getItem('szm_tut_closed')==='1') return;
  const role = USER?.role || 'admin';
  const pageTuts = TUTORIALS[role]?.[page];
  if(!pageTuts||pageTuts.length===0) return;
  if(page===TUT_PAGE) return; // không reset nếu vẫn cùng trang
  TUT_PAGE = page;
  TUT_STEP = 0;
  TUT_STEPS = pageTuts;
  tutRender();
  const bubble = document.getElementById('tutorial-bubble');
  bubble.style.display = '';
  // Restore minimized state
  if(localStorage.getItem('szm_tut_min')==='1') tutMinimize();
}

function tutRender(){
  if(!TUT_STEPS.length) return;
  const step = TUT_STEPS[TUT_STEP];
  document.getElementById('tut-step-label').textContent = step.s;
  document.getElementById('tut-text').textContent = step.t;
  // Dots
  const dots = document.getElementById('tut-dots');
  dots.innerHTML = TUT_STEPS.map((_,i)=>`<div class="tut-dot ${i===TUT_STEP?'active':''}"></div>`).join('');
  document.getElementById('tut-prev').disabled = TUT_STEP===0;
  document.getElementById('tut-next').disabled = TUT_STEP===TUT_STEPS.length-1;
}

function tutNav(dir){
  TUT_STEP = Math.max(0, Math.min(TUT_STEPS.length-1, TUT_STEP+dir));
  tutRender();
}

function tutMinimize(){
  const bubble = document.getElementById('tutorial-bubble');
  const content = document.getElementById('tut-content');
  const icon = document.getElementById('tut-min-icon');
  bubble.classList.add('minimized');
  content.style.display='none';
  icon.style.display='flex';
  localStorage.setItem('szm_tut_min','1');
}

function tutExpand(){
  const bubble = document.getElementById('tutorial-bubble');
  const content = document.getElementById('tut-content');
  const icon = document.getElementById('tut-min-icon');
  bubble.classList.remove('minimized');
  content.style.display='';
  icon.style.display='none';
  localStorage.removeItem('szm_tut_min');
}

function tutClose(){
  document.getElementById('tutorial-bubble').style.display='none';
  localStorage.setItem('szm_tut_closed','1');
}

window.addEventListener('load',async ()=>{
  document.getElementById('login-btn').addEventListener('click',startGoogleLogin);
  document.getElementById('logout-btn').addEventListener('click',logout);
  document.getElementById('modal-cancel').addEventListener('click',()=>{ if(!MODAL_SAVING) closeModal(); });
  document.getElementById('modal-ok').addEventListener('click',runModalSave);
  document.getElementById('modal').addEventListener('click',e=>{if(e.target===e.currentTarget && !MODAL_SAVING)closeModal();});
  document.querySelectorAll('.nav-item[data-page]').forEach(el=>{el.addEventListener('click',()=>navTo(el.dataset.page));});

  // Nếu vừa đăng nhập gần đây (F5 lúc test) và token còn hạn thì vào thẳng app,
  // khỏi phải bấm đăng nhập lại. Access_token thường sống ~1 tiếng.
  const restored = await tryRestoreSession();
  if(restored) startApp();
});
