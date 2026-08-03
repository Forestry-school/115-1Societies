// Apps Script API 網址
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyGrdJ8j-neGtzjsc4BXOVybWgBqtjjVsfKdxs2rh7spU6udfSXlj6grbstCaNK9XGR/exec";

let currentSignatureData = "";
let canvas, ctx, isDrawing = false;

document.addEventListener("DOMContentLoaded", function() {
  loadCategories();
  initCanvas();
});

// 1. 載入第一層選單：學段 / 時間
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
      categorySelect.innerHTML = '<option value="">網路連線失敗</option>';
    });
}

// 2. 選擇學段後載入社團
function fetchClubCards() {
  const category = document.getElementById("categorySelect").value;
  const clubSelectContainer = document.getElementById("clubSelectContainer");
  const clubSelect = document.getElementById("clubSelect");
  
  document.getElementById("studentSection").style.display = "none";
  document.getElementById("signatureSection").style.display = "none";

  if (!category) {
    clubSelectContainer.style.display = "none";
    return;
  }

  clubSelectContainer.style.display = "block";
  clubSelect.innerHTML = '<option value="">載入社團中...</option>';

  fetch(`${GAS_WEB_APP_URL}?action=getClubs&category=${encodeURIComponent(category)}`, { redirect: "follow" })
    .then(res => res.json())
    .then(clubs => {
      if (Array.isArray(clubs) && clubs.length > 0) {
        clubSelect.innerHTML = '<option value="">請選擇社團</option>';
        clubs.forEach(c => {
          clubSelect.innerHTML += `<option value="${c.id}">${c.name} (${c.id})</option>`;
        });
      } else {
        clubSelect.innerHTML = '<option value="">此學段無社團</option>';
      }
    })
    .catch(err => {
      console.error(err);
      clubSelect.innerHTML = '<option value="">社團載入失敗</option>';
    });
}

// 3. 選擇社團後載入學生名單 (完美套用繪本風清單結構)
function fetchStudents() {
  const clubSelect = document.getElementById("clubSelect");
  const clubId = clubSelect.value;
  const studentSection = document.getElementById("studentSection");
  const signatureSection = document.getElementById("signatureSection");
  const studentList = document.getElementById("studentList");
  const editNotice = document.getElementById("editNotice");

  if (!clubId) {
    studentSection.style.display = "none";
    signatureSection.style.display = "none";
    return;
  }

  studentList.innerHTML = '<p style="text-align:center; padding:20px; color:var(--ink-soft);">載入學生名單中...</p>';
  studentSection.style.display = "block";

  fetch(`${GAS_WEB_APP_URL}?action=getStudents&clubId=${encodeURIComponent(clubId)}`, { redirect: "follow" })
    .then(res => res.json())
    .then(data => {
      const students = data.students || [];
      const existingRecords = data.existingRecords || {};
      const existingSignature = data.existingSignature || "";

      if (students.length === 0) {
        studentList.innerHTML = '<p style="text-align:center; padding:20px; color:var(--ink-soft);">此社團無學生名單。</p>';
        signatureSection.style.display = "none";
        return;
      }

      // 是否提示已點過名
      editNotice.style.display = Object.keys(existingRecords).length > 0 ? "flex" : "none";

      // 動態生成手繪風橫條
      let html = "";
      students.forEach(s => {
        const status = existingRecords[s.seat] || "出席";
        html += `
          <div>
            <div class="roll-id">
              <span class="seat">${s.seat}</span>
              <span class="name">${s.name}</span>
            </div>
            <div class="status-btn-group">
              <input type="radio" id="st_${s.seat}_1" name="status_${s.seat}" value="出席" ${status === '出席' ? 'checked' : ''}>
              <label for="st_${s.seat}_1">出席</label>

              <input type="radio" id="st_${s.seat}_2" name="status_${s.seat}" value="請假" ${status === '請假' ? 'checked' : ''}>
              <label for="st_${s.seat}_2">請假</label>

              <input type="radio" id="st_${s.seat}_3" name="status_${s.seat}" value="缺席" ${status === '缺席' ? 'checked' : ''}>
              <label for="st_${s.seat}_3">缺席</label>
            </div>
          </div>
        `;
      });
      studentList.innerHTML = html;

      // 復原老師簽名
      if (existingSignature) {
        currentSignatureData = existingSignature;
        const previewBox = document.getElementById("signaturePreviewBox");
        const img = document.getElementById("signaturePreview");
        img.src = existingSignature;
        previewBox.style.display = "block";
      }

      signatureSection.style.display = "block";
    })
    .catch(err => {
      console.error(err);
      studentList.innerHTML = '<p style="text-align:center; color:var(--clay);">學生名單載入失敗</p>';
    });
}

// 4. 手寫簽名板控制 (適應手機與電腦)
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
    canvas.height = container.clientHeight || 250;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#2E5138"; // 深綠色筆觸
  }, 100);
}

function closeSignatureModal() {
  document.getElementById("signatureModal").classList.remove("active");
  document.body.classList.remove("modal-open");
}

function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function saveSignature() {
  currentSignatureData = canvas.toDataURL("image/png");
  const previewBox = document.getElementById("signaturePreviewBox");
  const img = document.getElementById("signaturePreview");
  img.src = currentSignatureData;
  previewBox.style.display = "block";
  closeSignatureModal();
}

// 5. 點名結果送出
function submitRollcall() {
  const clubSelect = document.getElementById("clubSelect");
  const clubId = clubSelect.value;
  const clubName = clubSelect.options[clubSelect.selectedIndex].text;

  if (!clubId) {
    alert("請先選擇社團！");
    return;
  }

  if (!currentSignatureData) {
    alert("請完成指導老師簽名！");
    return;
  }

  const studentRows = document.querySelectorAll("#studentList > div");
  const records = [];

  studentRows.forEach(row => {
    const seat = row.querySelector(".seat").innerText.trim();
    const name = row.querySelector(".name").innerText.trim();
    const checkedRadio = row.querySelector('input[type="radio"]:checked');
    const status = checkedRadio ? checkedRadio.value : "出席";

    records.push({ seat, name, status });
  });

  const payload = {
    action: "saveRollcall",
    clubId: clubId,
    clubName: clubName,
    signature: currentSignatureData,
    records: records
  };

  const btn = event.target;
  btn.innerText = "儲存中...";
  btn.disabled = true;

  fetch(GAS_WEB_APP_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify(payload)
  })
    .then(res => res.json())
    .then(res => {
      btn.innerText = "確認送出點名";
      btn.disabled = false;
      if (res.status === "success") {
        alert("🎉 點名成功儲存！");
      } else {
        alert("儲存失敗: " + res.message);
      }
    })
    .catch(err => {
      btn.innerText = "確認送出點名";
      btn.disabled = false;
      console.error(err);
      alert("儲存出錯，請檢查網路連線。");
    });
}
