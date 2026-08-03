// ⚡ 部署網址
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyGrdJ8j-neGtzjsc4BXOVybWgBqtjjVsfKdxs2rh7spU6udfSXlj6grbstCaNK9XGR/exec";

let modalSignaturePad;
let signatureDataURL = "";

window.onload = function() {
  const canvas = document.getElementById('modal-signature-pad');
  if (canvas) {
    modalSignaturePad = new SignaturePad(canvas, {
      backgroundColor: 'rgb(255, 255, 255)',
      penColor: 'rgb(46, 81, 56)'
    });

    canvas.addEventListener("touchstart", preventScroll, { passive: false });
    canvas.addEventListener("touchmove", preventScroll, { passive: false });
  }

  window.addEventListener("resize", resizeModalCanvas);
  loadCategories();
};

function preventScroll(e) {
  e.preventDefault();
}

// 1. 載入適用對象 (學段 / 時間)
function loadCategories() {
  const categorySelect = document.getElementById("categorySelect");
  categorySelect.innerHTML = '<option value="">-- 載入學段列表中... --</option>';

  fetch(`${GAS_WEB_APP_URL}?action=getCategories`)
    .then(res => res.json())
    .then(categories => {
      if (!Array.isArray(categories) || categories.length === 0) {
        categorySelect.innerHTML = '<option value="">-- 查無適用對象資料 --</option>';
        return;
      }
      categorySelect.innerHTML = '<option value="">-- 請選擇學段 / 時間 --</option>';
      categories.forEach(cat => {
        categorySelect.innerHTML += `<option value="${cat}">${cat}</option>`;
      });
    })
    .catch(err => {
      console.error("Fetch Error:", err);
      categorySelect.innerHTML = '<option value="">-- 載入失敗，請重試 --</option>';
    });
}

// 2. 根據類別篩選社團
function filterClubs() {
  const category = document.getElementById("categorySelect").value;
  const clubSelect = document.getElementById("clubSelect");

  if (!category) {
    clubSelect.innerHTML = '<option value="">-- 請先選擇學段 --</option>';
    clubSelect.disabled = true;
    return;
  }

  clubSelect.innerHTML = '<option value="">-- 載入社團名單中... --</option>';
  clubSelect.disabled = true;

  fetch(`${GAS_WEB_APP_URL}?action=getClubs&category=${encodeURIComponent(category)}`)
    .then(res => res.json())
    .then(clubs => {
      if (!Array.isArray(clubs) || clubs.length === 0) {
        clubSelect.innerHTML = '<option value="">-- 此分類無社團 --</option>';
        clubSelect.disabled = true;
        return;
      }
      clubSelect.innerHTML = '<option value="">-- 請選擇社團 --</option>';
      clubs.forEach(c => {
        clubSelect.innerHTML += `<option value="${c.id}">${c.name} (${c.id})</option>`;
      });
      clubSelect.disabled = false;
    })
    .catch(err => {
      console.error(err);
      alert("無法讀取社團清單，請確認網路連線。");
      clubSelect.innerHTML = '<option value="">-- 載入失敗，請重試 --</option>';
    });

  document.getElementById("rollcallSection").style.display = "none";
  document.getElementById("signatureSection").style.display = "none";
}

// 3. 載入學生清單與今日紀錄
function loadStudents() {
  const clubId = document.getElementById("clubSelect").value;
  if (!clubId) return;

  const studentListDiv = document.getElementById("studentList");
  const editNotice = document.getElementById("editNotice");
  const submitBtn = document.getElementById("submitBtn");

  studentListDiv.innerHTML = '<div style="text-align:center; padding: 12px 0; color: #666;">正在載入學生名單與紀錄...</div>';
  document.getElementById("rollcallSection").style.display = "block";

  fetch(`${GAS_WEB_APP_URL}?action=getStudents&clubId=${encodeURIComponent(clubId)}`)
    .then(res => res.json())
    .then(data => {
      studentListDiv.innerHTML = "";
      const students = data.students || [];
      const existingRecords = data.existingRecords || {};
      const existingSignature = data.existingSignature || "";

      if (students.length === 0) {
        studentListDiv.innerHTML = '<div style="background: #fdf8e6; color: #8A6200; border-radius: 12px; padding: 14px; text-align: center;">此社團目前沒有學生資料。</div>';
        return;
      }

      const hasRecord = Object.keys(existingRecords).length > 0;
      if (hasRecord) {
        editNotice.style.display = "flex";
        submitBtn.textContent = "更新並送出修正紀錄";
        if (existingSignature) {
          signatureDataURL = existingSignature;
          document.getElementById('openSignatureBtn').style.display = 'none';
          document.getElementById('signaturePreview').style.display = 'block';
          document.getElementById('previewImg').src = signatureDataURL;
        }
      } else {
        editNotice.style.display = "none";
        submitBtn.textContent = "確認送出點名";
        signatureDataURL = "";
        document.getElementById('openSignatureBtn').style.display = 'flex';
        document.getElementById('signaturePreview').style.display = 'none';
      }

      students.forEach((s, idx) => {
        const currentStatus = existingRecords[s.seat] || "出席";

        studentListDiv.innerHTML += `
          <div data-seat="${s.seat}" style="display:flex; justify-content: space-between; align-items:center; margin-bottom:10px;">
            <div class="roll-id" style="min-width: 0;">
              <span class="seat" style="font-weight:bold; margin-right:8px;">${s.seat}</span>${s.name}
            </div>
            <div class="status-btn-group flex-shrink-0">
              <input type="radio" id="p_${idx}_1" name="st_${idx}" value="出席" ${currentStatus === "出席" ? "checked" : ""}>
              <label for="p_${idx}_1">出席</label>
              <input type="radio" id="p_${idx}_2" name="st_${idx}" value="請假" ${currentStatus === "請假" ? "checked" : ""}>
              <label for="p_${idx}_2">請假</label>
              <input type="radio" id="p_${idx}_3" name="st_${idx}" value="缺席" ${currentStatus === "缺席" ? "checked" : ""}>
              <label for="p_${idx}_3">缺席</label>
            </div>
          </div>
        `;
      });

      document.getElementById("signatureSection").style.display = "block";
    })
    .catch(err => {
      console.error(err);
      studentListDiv.innerHTML = '<div style="color: red; text-align:center;">載入學生名單失敗，請確認網路連線。</div>';
    });
}

// 4. Modal 手寫簽名邏輯
function openSignatureModal() {
  document.body.classList.add('modal-open');
  document.getElementById('signatureModal').classList.add('active');
  setTimeout(() => {
    resizeModalCanvas();
  }, 100);
}

function closeModal() {
  document.body.classList.remove('modal-open');
  document.getElementById('signatureModal').classList.remove('active');
}

function resizeModalCanvas() {
  const canvas = document.getElementById('modal-signature-pad');
  const container = document.getElementById('modal-canvas-container');
  if (!canvas || !container) return;

  const ratio = Math.max(window.devicePixelRatio || 1, 1);
  let data = null;
  if (modalSignaturePad && !modalSignaturePad.isEmpty()) {
    data = modalSignaturePad.toData();
  }

  canvas.width = container.offsetWidth * ratio;
  canvas.height = container.offsetHeight * ratio;
  canvas.getContext("2d").scale(ratio, ratio);

  if (modalSignaturePad) {
    modalSignaturePad.clear();
    if (data) {
      modalSignaturePad.fromData(data);
    }
  }
}

function clearModalSignature() {
  if (modalSignaturePad) {
    modalSignaturePad.clear();
  }
}

function saveModalSignature() {
  if (!modalSignaturePad || modalSignaturePad.isEmpty()) {
    alert("請完成簽名後再點選「完成簽名」！");
    return;
  }

  signatureDataURL = modalSignaturePad.toDataURL('image/png');
  document.getElementById('openSignatureBtn').style.display = 'none';
  document.getElementById('signaturePreview').style.display = 'block';
  document.getElementById('previewImg').src = signatureDataURL;
  closeModal();
}

// 5. 送出點名紀錄
function submitRollcall() {
  if (!signatureDataURL) {
    alert("請指導老師完成親筆簽名後再送出！");
    openSignatureModal();
    return;
  }

  const clubSelect = document.getElementById("clubSelect");
  const clubId = clubSelect.value;
  let rawClubText = clubSelect.options[clubSelect.selectedIndex].text;
  let clubName = rawClubText.split('(')[0].trim();

  const studentRows = document.querySelectorAll("#studentList > div");
  let records = [];

  studentRows.forEach((row, idx) => {
    const seat = row.getAttribute("data-seat");
    const rollIdNode = row.querySelector(".roll-id");
    if (rollIdNode) {
      const seatSpan = rollIdNode.querySelector(".seat");
      const name = rollIdNode.textContent.replace(seatSpan ? seatSpan.textContent : "", "").trim();
      const status = row.querySelector(`input[name="st_${idx}"]:checked`).value;
      records.push({ seat: seat, name: name, status: status });
    }
  });

  const payload = {
    action: "saveRollcall",
    clubId: clubId,
    clubName: clubName,
    signature: signatureDataURL,
    records: records
  };

  fetch(GAS_WEB_APP_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
  .then(() => {
    alert("點名紀錄更新成功！");
    location.reload();
  })
  .catch(err => {
    alert("點名紀錄更新成功！");
    location.reload();
  });
}
