// ==========================================
// 福瑞斯特中小學 - 社團線上點名系統 (前端邏輯)
// ==========================================

const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyGrdJ8j-neGtzjsc4BXOVybWgBqtjjVsfKdxs2rh7spU6udfSXlj6grbstCaNK9XGR/exec"; 
let currentSignatureData = ""; // 儲存全域簽名圖片 Data URL

// 當網頁載入完成後，自動執行載入第一層選單
document.addEventListener("DOMContentLoaded", () => {
  fetchCategories();
});

// 1. 載入第一層選單 (學段 / 時間)
function fetchCategories() {
  const categorySelect = document.getElementById("categorySelect");

  fetch(`${GAS_WEB_APP_URL}?action=getCategories`)
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
      console.error("載入學段失敗:", err);
      categorySelect.innerHTML = '<option value="">-- 載入失敗，請檢查連線 --</option>';
    });
}

// 2. 載入第二層選單 (對應的社團)
function fetchClubCards() {
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

  clubSelectContainer.style.display = "block";
  clubSelect.innerHTML = '<option value="">-- 載入中... --</option>';
  studentSection.style.display = "none";
  signatureSection.style.display = "none";

  fetch(`${GAS_WEB_APP_URL}?action=getClubs&category=${encodeURIComponent(category)}`)
    .then(res => res.json())
    .then(clubs => {
      let html = '<option value="">-- 請選擇社團 --</option>';
      clubs.forEach(club => {
        html += `<option value="${club.name}">${club.name}</option>`;
      });
      clubSelect.innerHTML = html;
    })
    .catch(err => {
      console.error("載入社團失敗:", err);
      clubSelect.innerHTML = '<option value="">-- 載入失敗 --</option>';
    });
}

// 3. 載入學生名單
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
        html += `
          <div class="student-item" style="display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px dashed #e0e0e0; flex-wrap: nowrap; gap: 4px;">
            <div class="roll-id" style="display: flex; align-items: center; gap: 6px; min-width: 0; flex-shrink: 1;">
              <span class="seat" style="background-color: #f0ede6; color: #2e5138; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 13px; white-space: nowrap;">${s.seat}</span>
              <span class="name" style="font-size: 15px; font-weight: bold; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${s.name}</span>
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
      console.error(`第 ${retryCount + 1} 次載入學生失敗:`, err);
      if (retryCount < 2) {
        setTimeout(() => fetchStudents(retryCount + 1), 1200);
      } else {
        studentList.innerHTML = '<p style="text-align:center; color:var(--clay); padding:10px;">載入學生資料失敗，請重新切換社團或重新整理網頁。</p>';
      }
    });
}

// ==========================================
// 4. 全螢幕手寫簽名板邏輯
// ==========================================
let signaturePadCanvas, signaturePadCtx;
let isDrawing = false;

function initSignaturePad() {
  signaturePadCanvas = document.getElementById('modal-signature-pad');
  signaturePadCtx = signaturePadCanvas.getContext('2d');
  
  const container = document.getElementById('modal-canvas-container');
  // 修正 Canvas 解析度，避免畫出來的線條位置偏移
  signaturePadCanvas.width = container.clientWidth;
  signaturePadCanvas.height = container.clientHeight;
  
  signaturePadCtx.lineWidth = 4;
  signaturePadCtx.lineCap = 'round';
  signaturePadCtx.lineJoin = 'round';
  signaturePadCtx.strokeStyle = '#163C2C'; // 配合設計的深綠色墨水
  
  // 電腦滑鼠事件
  signaturePadCanvas.addEventListener('mousedown', startDrawing);
  signaturePadCanvas.addEventListener('mousemove', draw);
  signaturePadCanvas.addEventListener('mouseup', stopDrawing);
  signaturePadCanvas.addEventListener('mouseout', stopDrawing);
  
  // 手機觸控事件
  signaturePadCanvas.addEventListener('touchstart', handleTouchStart, {passive: false});
  signaturePadCanvas.addEventListener('touchmove', handleTouchMove, {passive: false});
  signaturePadCanvas.addEventListener('touchend', stopDrawing);
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
  e.preventDefault();
  isDrawing = true;
  const pos = getPos(e, true);
  signaturePadCtx.beginPath();
  signaturePadCtx.moveTo(pos.x, pos.y);
}

function handleTouchMove(e) {
  e.preventDefault();
  if (!isDrawing) return;
  const pos = getPos(e, true);
  signaturePadCtx.lineTo(pos.x, pos.y);
  signaturePadCtx.stroke();
}

function openSignatureModal() {
  document.getElementById('signatureModal').classList.add('active');
  document.body.classList.add('modal-open');
  // 延遲初始化以確保取得正確的視窗大小
  setTimeout(initSignaturePad, 100); 
}

function closeSignatureModal() {
  document.getElementById('signatureModal').classList.remove('active');
  document.body.classList.remove('modal-open');
}

function clearCanvas() {
  if(signaturePadCtx && signaturePadCanvas) {
     signaturePadCtx.clearRect(0, 0, signaturePadCanvas.width, signaturePadCanvas.height);
  }
}

function saveSignature() {
  const dataUrl = signaturePadCanvas.toDataURL('image/png');
  currentSignatureData = dataUrl;
  
  const previewImg = document.getElementById("signaturePreview");
  const previewBox = document.getElementById("signaturePreviewBox");
  
  previewImg.src = dataUrl;
  previewBox.style.display = "block";
  
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
    // 避免部分瀏覽器擋 CORS OPTIONS 請求，使用 text/plain
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  })
  .then(res => res.json())
  .then(data => {
    if (data.status === 'success') {
      alert("✅ 點名紀錄已成功送出！");
      btn.innerText = "確認送出點名";
      btn.disabled = false;
      // 成功後可以考慮重新載入名單或清空畫面
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
