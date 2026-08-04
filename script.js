const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyGrdJ8j-neGtzjsc4BXOVybWgBqtjjVsfKdxs2rh7spU6udfSXlj6grbstCaNK9XGR/exec";

let currentSignatureData = "";
let canvas, ctx, isDrawing = false;

document.addEventListener("DOMContentLoaded", function() {
  loadCategories();
  initCanvas();
});

// 1. 載入第一層選單
function loadCategories() {
  const categorySelect = document.getElementById("categorySelect");
  fetch(`${GAS_WEB_APP_URL}?action=getCategories`, { redirect: "follow" })
    .then(res => res.json())
    .then(data => {
      if (Array.isArray(data)) {
        categorySelect.innerHTML = '<option value="">請選擇學段 / 時間</option>';
        data.forEach(cat => {
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

// 2. 載入第二層社團下拉選單
function fetchClubCards() {
  const category = document.getElementById("categorySelect").value;
  const clubSelectContainer = document.getElementById("clubSelectContainer");
  const clubSelect = document.getElementById("clubSelect");
  
  document.getElementById("studentSection").style.display = "none";
  document.getElementById("signatureSection").style.display = "none";

  // 重置簽名紀錄
  currentSignatureData = "";
  if (document.getElementById("signaturePreviewBox")) {
    document.getElementById("signaturePreviewBox").style.display = "none";
  }

  if (!category) {
    clubSelectContainer.style.display = "none";
    return;
  }

  clubSelectContainer.style.display = "block";
  clubSelect.innerHTML = '<option value="">載入中...</option>';

  fetch(`${GAS_WEB_APP_URL}?action=getClubs&category=${encodeURIComponent(category)}`, { redirect: "follow" })
    .then(res => res.json())
    .then(clubs => {
      if (Array.isArray(clubs) && clubs.length > 0) {
        clubSelect.innerHTML = '<option value="">請選擇社團</option>';
        clubs.forEach(c => {
          clubSelect.innerHTML += `<option value="${c.id}">${c.name} (${c.id})</option>`;
        });
      } else {
        clubSelect.innerHTML = '<option value="">此學段暫無社團</option>';
      }
    })
    .catch(err => {
      console.error(err);
      clubSelect.innerHTML = '<option value="">社團載入失敗</option>';
    });
}

// 3. 載入學生名單與當日歷史簽名
function fetchStudents() {
  const clubId = document.getElementById("clubSelect").value;
  const studentSection = document.getElementById("studentSection");
  const signatureSection = document.getElementById("signatureSection");
  const studentList = document.getElementById("studentList");
  const editNotice = document.getElementById("editNotice");

  // 切換社團時先清空簽名狀態
  currentSignatureData = "";
  const previewBox = document.getElementById("signaturePreviewBox");
  if (previewBox) previewBox.style.display = "none";

  if (!clubId) {
    studentSection.style.display = "none";
    signatureSection.style.display = "none";
    return;
  }

  studentList.innerHTML = '<p style="text-align:center; color:var(--ink-soft); padding:10px;">載入學生名單中...</p>';
  studentSection.style.display = "block";

  fetch(`${GAS_WEB_APP_URL}?action=getStudents&clubId=${encodeURIComponent(clubId)}`, { redirect: "follow" })
    .then(res => res.json())
    .then(data => {
      const students = data.students || [];
      const existingRecords = data.existingRecords || {};
      const existingSignature = data.existingSignature || "";

      if (students.length === 0) {
        studentList.innerHTML = '<p style="text-align:center; color:var(--ink-soft); padding:10px;">此社團無學生名單。</p>';
        signatureSection.style.display = "none";
        return;
      }

      if (editNotice) {
        editNotice.style.display = Object.keys(existingRecords).length > 0 ? "flex" : "none";
      }

      let html = "";
      students.forEach((s, idx) => {
        const status = existingRecords[s.seat] || "出席";
        html += `
          <div>
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

      // 載入「當日」已儲存的歷史簽名
      if (existingSignature && existingSignature.length > 50) {
        currentSignatureData = existingSignature;
        const previewImg = document.getElementById("signaturePreview");
        if (previewImg) previewImg.src = existingSignature;
        if (previewBox) previewBox.style.display = "block";
      } else {
        currentSignatureData = "";
        if (previewBox) previewBox.style.display = "none";
      }

      signatureSection.style.display = "block";
    })
    .catch(err => {
      console.error(err);
      studentList.innerHTML = '<p style="text-align:center; color:var(--clay); padding:10px;">載入學生資料失敗</p>';
    });
}

// 4. 全螢幕手寫板邏輯
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
  document.getElementById("signatureModal").classList.add("active");
  document.body.classList.add("modal-open");
  
  setTimeout(() => {
    const container = document.getElementById("modal-canvas-container");
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#2E5138";

    // 開啟手寫板時先清空畫布，供當天重新繪寫簽名
    clearCanvas();
  }, 100);
}

function closeSignatureModal() {
  document.getElementById("signatureModal").classList.remove("active");
  document.body.classList.remove("modal-open");
}

function clearCanvas() {
  if (ctx && canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

function saveSignature() {
  // 防呆檢查：判斷畫布是否全然空白
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

// 5. 送出點名
function submitRollcall(btnBtn) {
  const clubSelect = document.getElementById("clubSelect");
  const clubId = clubSelect.value;
  const clubName = clubSelect.options[clubSelect.selectedIndex].text;

  if (!clubId) {
    alert("請先選擇社團！");
    return;
  }

  // 嚴格驗證簽名長度 (防止誤傳空白)
  if (!currentSignatureData || currentSignatureData.length < 50) {
    alert("請點擊步驟 3 的按鈕完成指導老師手寫簽名！");
    return;
  }

  const rows = document.querySelectorAll("#studentList > div");
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

  const originalText = btnBtn.innerText;
  btnBtn.innerText = "儲存中...";
  btnBtn.disabled = true;

  fetch(GAS_WEB_APP_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify(payload)
  })
    .then(res => res.json())
    .then(res => {
      btnBtn.innerText = originalText;
      btnBtn.disabled = false;
      if (res.status === "success") {
        alert("🎉 點名紀錄與簽名已成功儲存！");
      } else {
        alert("儲存失敗：" + res.message);
      }
    })
    .catch(err => {
      btnBtn.innerText = originalText;
      btnBtn.disabled = false;
      console.error(err);
      alert("儲存出錯，請檢查網路連線。");
    });
}
