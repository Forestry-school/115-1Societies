// ==========================================
// 福瑞斯特中小學 - 社團線上點名系統 (前端邏輯)
// ==========================================

const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyGrdJ8j-neGtzjsc4BXOVybWgBqtjjVsfKdxs2rh7spU6udfSXlj6grbstCaNK9XGR/exec"; 
let currentSignatureData = ""; 
let signaturePadCanvas, signaturePadCtx;
let isDrawing = false;
let isSignatureInit = false; 

// 當網頁載入完成後，自動執行載入第一層選單
document.addEventListener("DOMContentLoaded", () => {
  fetchCategories();
});

// 1. 載入第一層選單 (學段 / 時間) - 增加自動重試機制
function fetchCategories(retryCount = 0) {
  const categorySelect = document.getElementById("categorySelect");

  if (retryCount > 0) {
    categorySelect.innerHTML = `<option value="">-- 重新連線中 (${retryCount}/3)... --</option>`;
  }

  fetch(`${GAS_WEB_APP_URL}?action=getCategories`, { redirect: "follow" })
    .then(res => res.json())
    .then(categories => {
      if (!categories || categories.length === 0) {
        categorySelect.innerHTML = '<option value="">-- 目前無資料 --</option>';
        return;
      }
      
      let html = '<option value="">-- 請選擇學段 / 時間 --</option>';
      categories.forEach(cat => {
        html += `<option value="${cat}">${cat}</option>`;
      });
      categorySelect.innerHTML = html;
    })
    .catch(err => {
      console.error(`第 ${retryCount + 1} 次載入學段失敗:`, err);
      if (retryCount < 2) {
        setTimeout(() => fetchCategories(retryCount + 1), 1500);
      } else {
        categorySelect.innerHTML = '<option value="">-- 載入失敗，請重新整理網頁 --</option>';
      }
    });
}

// 2. 載入第二層選單 (對應的社團) - 增加自動重試機制
function fetchClubCards(retryCount = 0) {
  const category = document.getElementById("categorySelect").value;
  const clubSelectContainer = document.getElementById("clubSelectContainer");
  const clubSelect = document.getElementById("clubSelect");
  const studentSection = document.getElementById("studentSection");
  const signatureSection = document.getElementById("signatureSection");

  if (!category) {
    clubSelectContainer.style.display = "none";
    studentSection.style.display = "none";
    signatureSection.style.display = "none";
    return;
  }

  if (retryCount === 0) {
    clubSelectContainer.style.display = "block";
    clubSelect.innerHTML = '<option value="">-- 載入中... --</option>';
    studentSection.style.display = "none";
    signatureSection.style.display = "none";
  } else {
    clubSelect.innerHTML = `<option value="">-- 重新連線中 (${retryCount}/3)... --</option>`;
  }

  fetch(`${GAS_WEB_APP_URL}?action=getClubs&category=${encodeURIComponent(category)}`, { redirect: "follow" })
    .then(res => res.json())
    .then(clubs => {
      let html = '<option value="">-- 請選擇社團 --</option>';
      clubs.forEach(club => {
        html += `<option value="${club.name}">${club.name}</option>`;
      });
      clubSelect.innerHTML = html;
    })
    .catch(err => {
      console.error(`第 ${retryCount + 1} 次載入社團失敗:`, err);
      if (retryCount < 2) {
        setTimeout(() => fetchClubCards(retryCount + 1), 1500);
      } else {
        clubSelect.innerHTML = '<option value="">-- 載入失敗，請重新選擇學段 --</option>';
      }
    });
}

// 3. 載入學生名單 - 套用蠟筆手繪感底圖 (已移除重複社團名稱)
function fetchStudents(retryCount = 0) {
  const category = document.getElementById("categorySelect").value;
  const clubId = document.getElementById("clubSelect").value;
  const studentSection = document.getElementById("studentSection");
  const signatureSection = document.getElementById("signatureSection");
  const studentList = document.getElementById("studentList");
  const editNotice = document.getElementById("editNotice");
  const previewBox = document.getElementById("signaturePreviewBox");

  currentSignatureData = "";
  if (previewBox) previewBox.style.display = "none";

  if (!clubId) {
    studentSection.style.display = "none";
    signatureSection.style.display = "none";
    return;
  }

  studentSection.style.display = "block";
  studentList.innerHTML = retryCount > 0 
    ? `<p style="text-align:center; color:var(--ink-soft); padding:10px;">系統讀取中 (${retryCount}/3)...</p>`
    : '<p style="text-align:center; color:var(--ink-soft); padding:10px;">載入學生名單中...</p>';

  const targetUrl = `${GAS_WEB_APP_URL}?action=getStudents&clubId=${encodeURIComponent(clubId)}&category=${encodeURIComponent(category)}`;

  fetch(targetUrl, { redirect: "follow" })
    .then(res => res.text())
    .then(text => {
      const data = JSON.parse(text);
      if (data.error) throw new Error("後端錯誤: " + data.error);

      const students = data.students || [];
      const existingRecords = data.existingRecords || {};
      const existingSignature = data.existingSignature || "";

      if (students.length === 0) {
        studentList.innerHTML = '<p style="text-align:center; color:var(--ink-soft); padding:10px;">此社團無學生名單。</p>';
        signatureSection.style.display = "none";
        return;
      }

      if (editNotice) editNotice.style.display = Object.keys(existingRecords).length > 0 ? "flex" : "none";

      let html = "";
      students.forEach((s, idx) => {
        const status = existingRecords[s.seat] || "出席";
        // 蠟筆手繪感 UI 區塊 (乾淨版：只留座號與姓名)
        html += `
          <div class="student-item" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; margin-bottom: 12px; background-color: var(--forest-soft); border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px; flex-wrap: wrap; gap: 4px;">
            <div class="roll-id" style="display: flex; align-items: baseline; gap: 8px; min-width: 0; flex-shrink: 1;">
              <!-- 顯示座號 -->
              <span class="seat" style="color: var(--ink); font-weight: 900; font-size: 1rem;">${s.seat}</span>
              <!-- 顯示姓名 -->
              <span class="name" style="font-size: 1rem; font-weight: bold; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${s.name}</span>
            </div>
            
            <div class="status-btn-group" style="display: flex; gap: 3px; flex-shrink: 0;">
              <input type="radio" id="st_${idx}_1" name="status_${idx}" value="出席" ${status === '出席' ? 'checked' : ''}>
              <label for="st_${idx}_1" style="padding: 4px 8px; font-size: 13px;">出席</label>

              <input type="radio" id="st_${idx}_2" name="status_${idx}" value="請假" ${status === '請假' ? 'checked' : ''}>
              <label for="st_${idx}_2" style="padding: 4px 8px; font-size: 13px;">請假</label>

              <input type="radio" id="st_${idx}_3" name="status_${idx}" value="缺席" ${status === '缺席' ? 'checked' : ''}>
              <label for="st_${idx}_3" style="padding: 4px 8px; font-size: 13px;">缺席</label>
            </div>
          </div>
        `;
      });
      studentList.innerHTML = html;

      if (existingSignature && existingSignature.length > 50) {
        currentSignatureData = existingSignature;
        const previewImg = document.getElementById("signaturePreview");
        if (previewImg) previewImg.src = existingSignature;
        if (previewBox) previewBox.style.display = "block";
      }

      signatureSection.style.display = "block";
    })
    .catch(err => {
      console.error(`載入學生失敗:`, err);
      studentList.innerHTML = '<p style="text-align:center; color:var(--clay); padding:10px;">載入資料失敗，請切換社團或重新整理網頁。</p>';
    });
}

// ==========================================
// 4. 全螢幕手寫簽名板邏輯
// ==========================================
function initSignaturePad() {
  signaturePadCanvas = document.getElementById('modal-signature-pad');
  if (!signaturePadCanvas) return;
  
  signaturePadCtx = signaturePadCanvas.getContext('2d');
  const container = document.getElementById('modal-canvas-container');
  
  // 修正 Canvas 解析度
  signaturePadCanvas.width = container.clientWidth || 300;
  signaturePadCanvas.height = container.clientHeight || 200;
  
  signaturePadCtx.lineWidth = 4;
  signaturePadCtx.lineCap = 'round';
  signaturePadCtx.lineJoin = 'round';
  signaturePadCtx.strokeStyle = '#163C2C'; 
  
  if (!isSignatureInit) {
    signaturePadCanvas.addEventListener('mousedown', startDrawing);
    signaturePadCanvas.addEventListener('mousemove', draw);
    signaturePadCanvas.addEventListener('mouseup', stopDrawing);
    signaturePadCanvas.addEventListener('mouseout', stopDrawing);
    
    signaturePadCanvas.addEventListener('touchstart', handleTouchStart, {passive: false});
    signaturePadCanvas.addEventListener('touchmove', handleTouchMove, {passive: false});
    signaturePadCanvas.addEventListener('touchend', stopDrawing);
    
    isSignatureInit = true;
  }
}

function getPos(evt, isTouch = false) {
  const rect = signaturePadCanvas.getBoundingClientRect();
  const clientX = isTouch ? evt.touches[0].clientX : evt.clientX;
  const clientY = isTouch ? evt.touches[0].clientY : evt.clientY;
  return { x: clientX - rect.left, y: clientY - rect.top };
}

function startDrawing(e) {
  isDrawing = true;
  const pos = getPos(e);
  signaturePadCtx.beginPath();
  signaturePadCtx.moveTo(pos.x, pos.y);
}

function draw(e) {
  if (!isDrawing) return;
  const pos = getPos(e);
  signaturePadCtx.lineTo(pos.x, pos.y);
  signaturePadCtx.stroke();
}

function stopDrawing() {
  isDrawing = false;
}

function handleTouchStart(e) {
  if (e.cancelable) e.preventDefault();
  isDrawing = true;
  const pos = getPos(e, true);
  signaturePadCtx.beginPath();
  signaturePadCtx.moveTo(pos.x, pos.y);
}

function handleTouchMove(e) {
  if (e.cancelable) e.preventDefault();
  if (!isDrawing) return;
  const pos = getPos(e, true);
  signaturePadCtx.lineTo(pos.x, pos.y);
  signaturePadCtx.stroke();
}

function openSignatureModal() {
  try {
    const modal = document.getElementById('signatureModal');
    if (modal) {
      modal.style.display = 'flex';
      modal.classList.add('active'); 
      document.body.classList.add('modal-open');
      setTimeout(initSignaturePad, 150); 
    } else {
      alert("錯誤：找不到 signatureModal 元素！");
    }
  } catch (err) {
    alert("開啟失敗: " + err.message);
  }
}

function closeSignatureModal() {
  const modal = document.getElementById('signatureModal');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.remove('active');
  }
  document.body.classList.remove('modal-open');
}

function clearCanvas() {
  if(signaturePadCtx && signaturePadCanvas) {
     signaturePadCtx.clearRect(0, 0, signaturePadCanvas.width, signaturePadCanvas.height);
  }
}

function saveSignature() {
  if (!signaturePadCanvas) return;
  const dataUrl = signaturePadCanvas.toDataURL('image/png');
  currentSignatureData = dataUrl;
  
  const previewImg = document.getElementById("signaturePreview");
  const previewBox = document.getElementById("signaturePreviewBox");
  
  if (previewImg && previewBox) {
    previewImg.src = dataUrl;
    previewBox.style.display = "block";
  }
  
  closeSignatureModal();
}

// ==========================================
// 5. 送出點名資料
// ==========================================
function submitRollcall(btn) {
  const clubId = document.getElementById("clubSelect").value;
  if (!clubId) {
    alert("請先選擇社團！");
    return;
  }
  
  if (!currentSignatureData || currentSignatureData.length < 50) {
    alert("請先由指導老師簽名確認！");
    return;
  }

  const studentItems = document.querySelectorAll('.student-item');
  let records = [];
  
  studentItems.forEach((item, idx) => {
    const seat = item.querySelector('.seat').innerText;
    const name = item.querySelector('.name').innerText;
    const statusNode = item.querySelector(`input[name="status_${idx}"]:checked`);
    const status = statusNode ? statusNode.value : "出席";
    
    records.push({ seat: seat, name: name, status: status });
  });

  btn.disabled = true;
  btn.innerText = "資料傳送中...";

  const payload = {
    action: 'saveRollcall',
    clubName: clubId,
    signature: currentSignatureData,
    records: records
  };

  fetch(GAS_WEB_APP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  })
  .then(res => res.json())
  .then(data => {
    if (data.status === 'success') {
      alert("✅ 點名紀錄已成功送出！");
      btn.innerText = "確認送出點名";
      btn.disabled = false;
    } else {
      alert("❌ 送出失敗：" + (data.message || "未知錯誤"));
      btn.innerText = "確認送出點名";
      btn.disabled = false;
    }
  })
  .catch(err => {
    console.error(err);
    alert("❌ 網路連線錯誤，請稍後再試！");
    btn.innerText = "確認送出點名";
    btn.disabled = false;
  });
}
