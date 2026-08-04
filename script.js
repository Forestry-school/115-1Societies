const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyGrdJ8j-neGtzjsc4BXOVybWgBqtjjVsfKdxs2rh7spU6udfSXlj6grbstCaNK9XGR/exec";

// 前端本機快取資料
let cachedClubsMap = {};
let cachedStudentsMap = {};

let currentSignatureData = "";
let canvas, ctx, isDrawing = false;

document.addEventListener("DOMContentLoaded", function() {
  loadInitialData();
  initCanvas();
});

// 1. 頁面載入時：一次抓完所有選項與名單 (只需等待一次)
function loadInitialData() {
  const categorySelect = document.getElementById("categorySelect");
  if (!categorySelect) return;
  categorySelect.innerHTML = '<option value="">資料載入中，請稍候...</option>';

  fetch(`${GAS_WEB_APP_URL}?action=initData`, { redirect: "follow" })
    .then(res => res.json())
    .then(data => {
      if (data && Array.isArray(data.categories)) {
        cachedClubsMap = data.clubsMap || {};
        cachedStudentsMap = data.studentsMap || {};

        categorySelect.innerHTML = '<option value="">請選擇學段 / 時間</option>';
        data.categories.forEach(cat => {
          categorySelect.innerHTML += `<option value="${cat}">${cat}</option>`;
        });
      } else {
        categorySelect.innerHTML = '<option value="">載入失敗</option>';
      }
    })
    .catch(err => {
      console.error(err);
      categorySelect.innerHTML = '<option value="">連線失敗，請檢查網路</option>';
    });
}

// 2. 切換第一層選單：零延遲呈現社團選單
function fetchClubCards() {
  const category = document.getElementById("categorySelect").value;
  const clubSelectContainer = document.getElementById("clubSelectContainer");
  const clubSelect = document.getElementById("clubSelect");
  
  if (document.getElementById("studentSection")) document.getElementById("studentSection").style.display = "none";
  if (document.getElementById("signatureSection")) document.getElementById("signatureSection").style.display = "none";

  currentSignatureData = "";
  if (document.getElementById("signaturePreviewBox")) {
    document.getElementById("signaturePreviewBox").style.display = "none";
  }

  if (!category) {
    if (clubSelectContainer) clubSelectContainer.style.display = "none";
    return;
  }

  // 從本機快取直接撈取
  const clubs = cachedClubsMap[category] || [];
  if (clubSelectContainer) clubSelectContainer.style.display = "block";

  if (clubs.length > 0) {
    let html = '<option value="">請選擇社團</option>';
    clubs.forEach(c => {
      html += `<option value="${c.id}">${c.name} (${c.id})</option>`;
    });
    clubSelect.innerHTML = html;
  } else {
    clubSelect.innerHTML = '<option value="">此學段暫無社團</option>';
  }
}

// 3. 切換第二層選單：瞬間帶出學生名單，同步向伺服器確認「當天是否有歷史簽名與點名紀錄」
function fetchStudents() {
  const clubSelect = document.getElementById("clubSelect");
  if (!clubSelect) return;
  const clubId = clubSelect.value;
  const studentSection = document.getElementById("studentSection");
  const signatureSection = document.getElementById("signatureSection");
  const studentList = document.getElementById("studentList");
  const editNotice = document.getElementById("editNotice");

  currentSignatureData = "";
  const previewBox = document.getElementById("signaturePreviewBox");
  if (previewBox) previewBox.style.display = "none";

  if (!clubId) {
    if (studentSection) studentSection.style.display = "none";
    if (signatureSection) signatureSection.style.display = "none";
    return;
  }

  // A. 瞬間渲染本地學生名單
  const localStudents = cachedStudentsMap[clubId] || [];
  if (localStudents.length === 0) {
    if (studentList) studentList.innerHTML = '<p style="text-align:center; color:var(--ink-soft); padding:10px;">此社團無學生名單。</p>';
    if (studentSection) studentSection.style.display = "block";
    if (signatureSection) signatureSection.style.display = "none";
    return;
  }

  renderStudentRows(localStudents, {});
  if (studentSection) studentSection.style.display = "block";
  if (signatureSection) signatureSection.style.display = "block";

  // B. 背景靜默查詢「今天是否已點名過/有簽名」
  fetch(`${GAS_WEB_APP_URL}?action=getStudents&clubId=${encodeURIComponent(clubId)}`, { redirect: "follow" })
    .then(res => res.json())
    .then(data => {
      const existingRecords = data.existingRecords || {};
      const existingSignature = data.existingSignature || "";

      if (Object.keys(existingRecords).length > 0) {
        if (editNotice) editNotice.style.display = "flex";
        renderStudentRows(localStudents, existingRecords);
      } else {
        if (editNotice) editNotice.style.display = "none";
      }

      if (existingSignature && existingSignature.length > 50) {
        currentSignatureData = existingSignature;
        const previewImg = document.getElementById("signaturePreview");
        if (previewImg) previewImg.src = existingSignature;
        if (previewBox) previewBox.style.display = "block";
      }
    })
    .catch(err => console.error("歷史紀錄查詢失敗", err));
}

// 渲染學生 DOM 列表
function renderStudentRows(students, existingRecords) {
  const studentList = document.getElementById("studentList");
  if (!studentList) return;
  let html = "";
  students.forEach((s, idx) => {
    const status = existingRecords[s.seat] || "出席";
    html += `
      <div class="roll-item">
        <div class="roll-id">
          <span class="seat">${s.seat}</span>
          <span class="name">${s.name}</span>
        </div>
        <div class="status-btn-group">
          <input type="radio" id="st_${idx}_1" name="status_${idx}" value="出席" ${status === '出席' ? 'checked' : ''}>
          <label for="st_${idx}_1">出席</label>

          <input type="radio" id="st_${idx}_2" name="status_${idx}" value="請假" ${status === '請假' ? 'checked' : ''}>
          <label for="st_${idx}_2">請假</label>

          <input type="radio" id="st_${idx}_3" name="status_${idx}" value="缺席" ${status === '缺席' ? 'checked' : ''}>
          <label for="st_${idx}_3">缺席</label>
        </div>
      </div>
    `;
  });
  studentList.innerHTML = html;
}

// 4. 手寫板與簽名按鈕對應邏輯
function initCanvas() {
  canvas = document.getElementById("modal-signature-pad");
  if (!canvas) return;
  ctx = canvas.getContext("2d");

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function startDraw(e) {
    isDrawing = true;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  function draw(e) {
    if (!isDrawing) return;
    e.preventDefault();
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  }

  function stopDraw() { isDrawing = false; }

  canvas.addEventListener("mousedown", startDraw);
  canvas.addEventListener("mousemove", draw);
  canvas.addEventListener("mouseup", stopDraw);

  canvas.addEventListener("touchstart", startDraw, { passive: false });
  canvas.addEventListener("touchmove", draw, { passive: false });
  canvas.addEventListener("touchend", stopDraw);
}

function openSignatureModal() {
  const modal = document.getElementById("signatureModal");
  if (modal) modal.classList.add("active");
  document.body.classList.add("modal-open");
  
  setTimeout(() => {
    const container = document.getElementById("modal-canvas-container");
    if (container && canvas) {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#2E5138";
      clearCanvas();
    }
  }, 100);
}

function closeSignatureModal() {
  const modal = document.getElementById("signatureModal");
  if (modal) modal.classList.remove("active");
  document.body.classList.remove("modal-open");
}

function clearCanvas() {
  if (ctx && canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

function saveSignature() {
  if (!canvas) return;
  const blank = document.createElement('canvas');
  blank.width = canvas.width;
  blank.height = canvas.height;

  if (canvas.toDataURL() === blank.toDataURL()) {
    alert("簽名檔為空白，請在手寫板上完成簽名後再點選確定！");
    return;
  }

  currentSignatureData = canvas.toDataURL("image/png");
  const previewImg = document.getElementById("signaturePreview");
  const previewBox = document.getElementById("signaturePreviewBox");

  if (previewImg) previewImg.src = currentSignatureData;
  if (previewBox) previewBox.style.display = "block";
  
  closeSignatureModal();
}

// 5. 送出點名按鈕觸發
function submitRollcall(btnBtn) {
  const clubSelect = document.getElementById("clubSelect");
  if (!clubSelect) return;
  const clubId = clubSelect.value;
  const clubName = clubSelect.options[clubSelect.selectedIndex].text;

  if (!clubId) {
    alert("請先選擇社團！");
    return;
  }

  if (!currentSignatureData || currentSignatureData.length < 50) {
    alert("請點擊步驟 3 的按鈕完成指導老師手寫簽名！");
    return;
  }

  const rows = document.querySelectorAll("#studentList .roll-item");
  const records = [];

  rows.forEach(row => {
    const seat = row.querySelector(".seat") ? row.querySelector(".seat").innerText.trim() : "";
    const name = row.querySelector(".name") ? row.querySelector(".name").innerText.trim() : "";
    const checkedRadio = row.querySelector('input[type="radio"]:checked');
    const status = checkedRadio ? checkedRadio.value : "出席";

    if (seat) {
      records.push({ seat, name, status });
    }
  });

  const payload = {
    action: "saveRollcall",
    clubId: clubId,
    clubName: clubName,
    signature: currentSignatureData,
    records: records
  };

  const originalText = btnBtn ? btnBtn.innerText : "確認無誤，送出點名紀錄";
  if (btnBtn) {
    btnBtn.innerText = "儲存中...";
    btnBtn.disabled = true;
  }

  fetch(GAS_WEB_APP_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify(payload)
  })
    .then(res => res.json())
    .then(res => {
      if (btnBtn) {
        btnBtn.innerText = originalText;
        btnBtn.disabled = false;
      }
      if (res.status === "success") {
        alert("🎉 點名紀錄與簽名已成功儲存！");
      } else {
        alert("儲存失敗：" + res.message);
      }
    })
    .catch(err => {
      if (btnBtn) {
        btnBtn.innerText = originalText;
        btnBtn.disabled = false;
      }
      console.error(err);
      alert("儲存出錯，請檢查網路連線。");
    });
}
