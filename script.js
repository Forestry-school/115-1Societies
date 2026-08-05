// 這裡已經換成你提供的 GAS 網址
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyGrdJ8j-neGtzjsc4BXOVybWgBqtjjVsfKdxs2rh7spU6udfSXlj6grbstCaNK9XGR/exec"; 

// 當網頁載入完成後，自動執行載入第一層選單（學段/時間）
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

  // 如果使用者選回空值，則隱藏下方的所有區塊
  if (!category) {
    clubSelectContainer.style.display = "none";
    studentSection.style.display = "none";
    signatureSection.style.display = "none";
    return;
  }

  // 顯示第二層選單，並呈現載入中狀態
  clubSelectContainer.style.display = "block";
  clubSelect.innerHTML = '<option value="">-- 載入中... --</option>';
  
  // 隱藏學生與簽名區塊，直到選擇了社團
  studentSection.style.display = "none";
  signatureSection.style.display = "none";

  fetch(`${GAS_WEB_APP_URL}?action=getClubs&category=${encodeURIComponent(category)}`)
    .then(res => res.json())
    .then(clubs => {
      let html = '<option value="">-- 請選擇社團 --</option>';
      clubs.forEach(club => {
        // 根據你的 code.gs，回傳的物件為 {id: name, name: name}
        html += `<option value="${club.name}">${club.name}</option>`;
      });
      clubSelect.innerHTML = html;
    })
    .catch(err => {
      console.error("載入社團失敗:", err);
      clubSelect.innerHTML = '<option value="">-- 載入失敗 --</option>';
    });
}

// ==========================================
// 下方保留你原本的 fetchStudents 以及其他函數
// function fetchStudents(retryCount = 0) { ... }
// ==========================================
// 3. 載入學生名單 (同時帶入 category 與 clubId)
function fetchStudents(retryCount = 0) {
  const category = document.getElementById("categorySelect").value;
  const clubId = document.getElementById("clubSelect").value;
  const studentSection = document.getElementById("studentSection");
  const signatureSection = document.getElementById("signatureSection");
  const studentList = document.getElementById("studentList");
  const editNotice = document.getElementById("editNotice");

  currentSignatureData = "";
  const previewBox = document.getElementById("signaturePreviewBox");
  if (previewBox) previewBox.style.display = "none";

  if (!clubId) {
    studentSection.style.display = "none";
    signatureSection.style.display = "none";
    return;
  }

  studentSection.style.display = "block";
  if (retryCount > 0) {
    studentList.innerHTML = `<p style="text-align:center; color:var(--ink-soft); padding:10px;">系統讀取中 (${retryCount}/3)...</p>`;
  } else {
    studentList.innerHTML = '<p style="text-align:center; color:var(--ink-soft); padding:10px;">載入學生名單中...</p>';
  }

  // 關鍵修改：將 category 一併傳送給後端做比對
  const targetUrl = `${GAS_WEB_APP_URL}?action=getStudents&clubId=${encodeURIComponent(clubId)}&category=${encodeURIComponent(category)}`;

  fetch(targetUrl, { redirect: "follow" })
    .then(res => res.text())
    .then(text => {
      const data = JSON.parse(text);
      if (data.error) {
        throw new Error("後端錯誤: " + data.error);
      }

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
      } else {
        currentSignatureData = "";
        if (previewBox) previewBox.style.display = "none";
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
