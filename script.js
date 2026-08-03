// 指向 Google Apps Script Web App URL
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyGrdJ8j-neGtzjsc4BXOVybWgBqtjjVsfKdxs2rh7spU6udfSXlj6grbstCaNK9XGR/exec";

let currentStudents = [];
let selectedClubInfo = { id: "", name: "" };
let signaturePad = null;

document.addEventListener("DOMContentLoaded", () => {
  initSignaturePad();
  loadCategories();

  // 1. 監聽第一層選單
  document.getElementById("categorySelect").addEventListener("change", fetchClubCards);

  // 2. 監聽表單提交
  document.getElementById("rollcallForm").addEventListener("submit", handleFormSubmit);

  // 3. 監聽清除簽名
  document.getElementById("clearSigBtn").addEventListener("click", () => {
    if (signaturePad) signaturePad.clear();
  });
});

// 1. 載入學段選單
function loadCategories() {
  const categorySelect = document.getElementById("categorySelect");
  categorySelect.innerHTML = '<option value="">-- 載入中... --</option>';

  fetch(`${GAS_WEB_APP_URL}?action=getCategories`, { redirect: "follow" })
    .then(res => res.json())
    .then(data => {
      if (!Array.isArray(data) || data.length === 0) {
        categorySelect.innerHTML = '<option value="">-- 暫無資料 --</option>';
        return;
      }
      categorySelect.innerHTML = '<option value="">-- 請選擇學段 / 時間 --</option>';
      data.forEach(cat => {
        categorySelect.innerHTML += `<option value="${cat}">${cat}</option>`;
      });
    })
    .catch(err => {
      console.error(err);
      categorySelect.innerHTML = '<option value="">-- 載入失敗，請重新整理 --</option>';
    });
}

// 2. 選擇學段後生成社團「卡片」
function fetchClubCards() {
  const category = document.getElementById("categorySelect").value;
  const clubSection = document.getElementById("clubSection");
  const clubCardContainer = document.getElementById("clubCardContainer");

  hideRollcallSections();

  if (!category) {
    clubSection.style.display = "none";
    return;
  }

  clubSection.style.display = "block";
  clubCardContainer.innerHTML = '<p class="loading-text">載入社團卡片中...</p>';

  fetch(`${GAS_WEB_APP_URL}?action=getClubs&category=${encodeURIComponent(category)}`, { redirect: "follow" })
    .then(res => res.json())
    .then(clubs => {
      if (!Array.isArray(clubs) || clubs.length === 0) {
        clubCardContainer.innerHTML = '<p class="warning-text">此分類目前無對應社團。</p>';
        return;
      }

      let cardsHtml = "";
      clubs.forEach(c => {
        cardsHtml += `
          <div class="club-card" onclick="selectClubCard(this, '${c.id}', '${c.name}')">
            <div class="club-name">${c.name}</div>
            <div class="club-id">${c.id}</div>
          </div>
        `;
      });
      clubCardContainer.innerHTML = cardsHtml;
    })
    .catch(err => {
      console.error(err);
      clubCardContainer.innerHTML = '<p class="error-text">社團卡片載入失敗，請重新選擇學段。</p>';
    });
}

// 3. 點擊卡片動作
function selectClubCard(cardElement, clubId, clubName) {
  document.querySelectorAll(".club-card").forEach(c => c.classList.remove("active"));
  cardElement.classList.add("active");

  selectedClubInfo = { id: clubId, name: clubName };
  loadStudents(clubId, clubName);
}

// 4. 載入學生名單
function loadStudents(clubId, clubName) {
  const studentListContainer = document.getElementById("studentList");
  const rollcallSection = document.getElementById("rollcallSection");

  rollcallSection.style.display = "block";
  studentListContainer.innerHTML = `<p class="loading-text">載入【${clubName}】學生名單中...</p>`;

  rollcallSection.scrollIntoView({ behavior: 'smooth' });

  fetch(`${GAS_WEB_APP_URL}?action=getStudents&clubId=${encodeURIComponent(clubId)}`, { redirect: "follow" })
    .then(res => res.json())
    .then(data => {
      if (!data || !Array.isArray(data.students)) {
        studentListContainer.innerHTML = '<p class="error-text">學生名單載入失敗。</p>';
        return;
      }

      currentStudents = data.students;

      if (currentStudents.length === 0) {
        studentListContainer.innerHTML = '<p class="warning-text">這個社團目前沒有學生名單。</p>';
        document.getElementById("signatureSection").style.display = "none";
        return;
      }

      renderStudentList(data.students, data.existingRecords || {});
      document.getElementById("signatureSection").style.display = "block";
    })
    .catch(err => {
      console.error(err);
      studentListContainer.innerHTML = '<p class="error-text">載入學生名單連線失敗，請重試。</p>';
    });
}

// 5. 渲染學生列表表格
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

// 6. 提交點名紀錄
function handleFormSubmit(e) {
  e.preventDefault();

  if (!selectedClubInfo.id) {
    alert("請先選擇社團卡片！");
    return;
  }

  if (signaturePad && signaturePad.isEmpty()) {
    alert("請指導老師完成簽名再提交！");
    return;
  }

  const submitBtn = document.getElementById("submitBtn");
  submitBtn.disabled = true;
  submitBtn.innerText = "儲存中，請稍候...";

  const records = currentStudents.map((s, idx) => {
    const selectedRadio = document.querySelector(`input[name="status_${idx}"]:checked`);
    return {
      seat: s.seat,
      name: s.name,
      status: selectedRadio ? selectedRadio.value : "出席"
    };
  });

  const payload = {
    action: "saveRollcall",
    clubId: selectedClubInfo.id,
    clubName: selectedClubInfo.name,
    signature: signaturePad ? signaturePad.toDataURL() : "",
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
      console.error(err);
      submitBtn.disabled = false;
      submitBtn.innerText = "儲存點名紀錄";
      alert("儲存失敗，請檢查網路連線。");
    });
}

// 輔助函式
function hideRollcallSections() {
  document.getElementById("rollcallSection").style.display = "none";
  document.getElementById("signatureSection").style.display = "none";
}

function initSignaturePad() {
  const canvas = document.getElementById("signatureCanvas");
  if (!canvas || typeof SignaturePad === "undefined") return;

  function resizeCanvas() {
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext("2d").scale(ratio, ratio);
    if (signaturePad) signaturePad.clear();
  }

  window.addEventListener("resize", resizeCanvas);
  signaturePad = new SignaturePad(canvas, { backgroundColor: 'rgb(255, 255, 255)' });
  resizeCanvas();
}
