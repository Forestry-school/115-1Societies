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
