// ==========================================
// 1. 設定與全域變數
// ==========================================
// ⚠️ 請確認下方 URL 為您 Apps Script 最新部署的 Web App URL
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyGrdJ8j-neGtzjsc4BXOVybWgBqtjjVsfKdxs2rh7spU6udfSXlj6grbstCaNK9XGR/exec";

let currentStudents = []; // 儲存當前社團的學生名單
let signaturePad = null;  // 簽名板實例

// ==========================================
// 2. 初始化頁面
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  initSignaturePad();
  loadCategories();

  // 監聽第一層選單：學段 / 時間
  document.getElementById("categorySelect").addEventListener("change", filterClubs);

  // 監聽第二層選單：社團
  document.getElementById("clubSelect").addEventListener("change", loadStudents);

  // 監聽表單送出（儲存點名）
  document.getElementById("rollcallForm").addEventListener("submit", handleFormSubmit);

  // 監聽清除簽名按鈕
  document.getElementById("clearSigBtn").addEventListener("click", () => {
    if (signaturePad) signaturePad.clear();
  });
});

// ==========================================
// 3. 簽名板初始化
// ==========================================
function initSignaturePad() {
  const canvas = document.getElementById("signatureCanvas");
  if (!canvas) return;

  // 動態調整 Canvas 寬度
  function resizeCanvas() {
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext("2d").scale(ratio, ratio);
    if (signaturePad) signaturePad.clear();
  }

  window.addEventListener("resize", resizeCanvas);
  
  // 使用 SignaturePad 函式庫 (網頁 HTML 需引入 signature_pad.umd.js)
  if (typeof SignaturePad !== "undefined") {
    signaturePad = new SignaturePad(canvas, {
      backgroundColor: 'rgb(255, 255, 255)',
      penColor: 'rgb(0, 0, 0)'
    });
    resizeCanvas();
  }
}

// ==========================================
// 4. 載入第一層選單 (學段 / 時間)
// ==========================================
function loadCategories() {
  const categorySelect = document.getElementById("categorySelect");
  categorySelect.innerHTML = '<option value="">-- 載入中... --</option>';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  fetch(`${GAS_WEB_APP_URL}?action=getCategories`, { 
    redirect: "follow",
    signal: controller.signal 
  })
    .then(res => res.json())
    .then(data => {
      clearTimeout(timeoutId);
      if (!Array.isArray(data) || data.length === 0) {
        categorySelect.innerHTML = '<option value="">-- 暫無學段資料 --</option>';
        return;
      }

      categorySelect.innerHTML = '<option value="">-- 請選擇學段 / 時間 --</option>';
      data.forEach(cat => {
        categorySelect.innerHTML += `<option value="${cat}">${cat}</option>`;
      });
    })
    .catch(err => {
      clearTimeout(timeoutId);
      console.error("載入學段失敗:", err);
      categorySelect.innerHTML = '<option value="">-- 載入失敗，請重新整理 --</option>';
    });
}

// ==========================================
// 5. 根據選取的學段，載入第二層社團名單
// ==========================================
function filterClubs() {
  const category = document.getElementById("categorySelect").value;
  const clubSelect = document.getElementById("clubSelect");

  if (!category) {
    clubSelect.innerHTML = '<option value="">-- 請先選擇學段 --</option>';
    clubSelect.disabled = true;
    hideSections();
    return;
  }

  clubSelect.innerHTML = '<option value="">-- 載入社團名單中... --</option>';
  clubSelect.disabled = true;
  hideSections();

  // 設定 15 秒 Timeout 逾時防護
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  fetch(`${GAS_WEB_APP_URL}?action=getClubs&category=${encodeURIComponent(category)}`, { 
    redirect: "follow",
    signal: controller.signal 
  })
    .then(res => res.json())
    .then(clubs => {
      clearTimeout(timeoutId);

      if (!Array.isArray(clubs)) {
        alert("讀取社團資料格式錯誤，請重試");
        clubSelect.innerHTML = '<option value="">-- 載入失敗 --</option>';
        return;
      }

      if (clubs.length === 0) {
        clubSelect.innerHTML = '<option value="">-- 此分類無對應社團 --</option>';
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
      clearTimeout(timeoutId);
      console.error("載入社團失敗:", err);
      alert("連線較慢或失敗，請重新切換一次學段選項！");
      clubSelect.innerHTML = '<option value="">-- 載入失敗，請重試 --</option>';
    });
}

// ==========================================
// 6. 載入學生名單與舊點名紀錄
// ==========================================
function loadStudents() {
  const clubId = document.getElementById("clubSelect").value;
  const studentListContainer = document.getElementById("studentList");

  if (!clubId) {
    hideSections();
    return;
  }

  studentListContainer.innerHTML = '<p class="loading-text">載入學生名單中...</p>';
  document.getElementById("rollcallSection").style.display = "block";

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  fetch(`${GAS_WEB_APP_URL}?action=getStudents&clubId=${encodeURIComponent(clubId)}`, { 
    redirect: "follow",
    signal: controller.signal 
  })
    .then(res => res.json())
    .then(data => {
      clearTimeout(timeoutId);

      if (!data || !Array.isArray(data.students)) {
        studentListContainer.innerHTML = '<p class="error-text">載入學生名單失敗，請確認資料結構。</p>';
        return;
      }

      currentStudents = data.students;

      if (currentStudents.length === 0) {
        studentListContainer.innerHTML = '<p class="warning-text">這個社團目前沒有學生名單。</p>';
        document.getElementById("signatureSection").style.display = "none";
        return;
      }

      // 渲染學生名單表格
      renderStudentList(data.students, data.existingRecords || {});

      // 顯示簽名區塊
      document.getElementById("signatureSection").style.display = "block";
    })
    .catch(err => {
      clearTimeout(timeoutId);
      console.error("載入學生失敗:", err);
      studentListContainer.innerHTML = '<p class="error-text">載入學生名單失敗，請確認網路連線並重試。</p>';
    });
}

// ==========================================
// 7. 渲染學生點名列表
// ==========================================
function renderStudentList(students, existingRecords) {
  const container = document.getElementById("studentList");
  let html = `
    <table class="rollcall-table">
      <thead>
        <tr>
          <th>座號/班級</th>
          <th>姓名</th>
          <th>出席狀況</th>
        </tr>
      </thead>
      <tbody>
  `;

  students.forEach((s, idx) => {
    // 預設狀態：若今日已有舊紀錄就用舊紀錄，否則預設為「出席」
    const status = existingRecords[s.seat] || "出席";

    html += `
      <tr>
        <td>${s.seat}</td>
        <td><strong>${s.name}</strong></td>
        <td>
          <label><input type="radio" name="status_${idx}" value="出席" ${status === '出席' ? 'checked' : ''}> 出席</label>
          <label><input type="radio" name="status_${idx}" value="缺席" ${status === '缺席' ? 'checked' : ''}> 缺席</label>
          <label><input type="radio" name="status_${idx}" value="事假" ${status === '事假' ? 'checked' : ''}> 事假</label>
          <label><input type="radio" name="status_${idx}" value="病假" ${status === '病假' ? 'checked' : ''}> 病假</label>
        </td>
      </tr>
    `;
  });

  html += '</tbody></table>';
  container.innerHTML = html;
}

// ==========================================
// 8. 表單提交 (寫入 Google 試算表)
// ==========================================
function handleFormSubmit(e) {
  e.preventDefault();

  const clubSelect = document.getElementById("clubSelect");
  const clubId = clubSelect.value;
  const clubName = clubSelect.options[clubSelect.selectedIndex].text;

  if (!clubId) {
    alert("請先選擇社團！");
    return;
  }

  if (signaturePad && signaturePad.isEmpty()) {
    alert("請先完成指導老師簽名！");
    return;
  }

  const submitBtn = document.getElementById("submitBtn");
  submitBtn.disabled = true;
  submitBtn.innerText = "儲存中，請稍候...";

  // 收集學生點名狀態
  const records = currentStudents.map((s, idx) => {
    const selectedRadio = document.querySelector(`input[name="status_${idx}"]:checked`);
    return {
      seat: s.seat,
      name: s.name,
      status: selectedRadio ? selectedRadio.value : "出席"
    };
  });

  // 取得簽名 Base64 圖片
  const signatureData = signaturePad ? signaturePad.toDataURL() : "";

  const payload = {
    action: "saveRollcall",
    clubId: clubId,
    clubName: clubName,
    signature: signatureData,
    records: records
  };

  fetch(GAS_WEB_APP_URL, {
    method: "POST",
    redirect: "follow",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  })
    .then(res => res.json())
    .then(data => {
      submitBtn.disabled = false;
      submitBtn.innerText = "儲存點名紀錄";

      if (data.status === "success") {
        alert("點名紀錄與簽名已成功儲存！");
      } else {
        alert("儲存失敗：" + (data.message || "未知錯誤"));
      }
    })
    .catch(err => {
      console.error("提交錯誤:", err);
      submitBtn.disabled = false;
      submitBtn.innerText = "儲存點名紀錄";
      alert("儲存失敗，請檢查網路連線後重試！");
    });
}

// 輔助：隱藏下方的點名與簽名區
function hideSections() {
  document.getElementById("rollcallSection").style.display = "none";
  document.getElementById("signatureSection").style.display = "none";
}
