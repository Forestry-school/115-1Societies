// 請確保替換成你最新的 Apps Script /exec 部署網址
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyGrdJ8j-neGtzjsc4BXOVybWgBqtjjVsfKdxs2rh7spU6udfSXlj6grbstCaNK9XGR/exec";

document.addEventListener("DOMContentLoaded", function() {
  loadCategories();
});

// 1. 載入第一層：學段 / 時間選單
function loadCategories() {
  const categorySelect = document.getElementById("categorySelect");
  if (!categorySelect) return;
  
  categorySelect.innerHTML = '<option value="">-- 載入中... --</option>';

  fetch(`${GAS_WEB_APP_URL}?action=getCategories`, { redirect: "follow" })
    .then(res => res.json())
    .then(data => {
      if (data.status === "error") throw new Error(data.message);
      
      categorySelect.innerHTML = '<option value="">請選擇學段 / 時間</option>';
      data.forEach(cat => {
        categorySelect.innerHTML += `<option value="${cat}">${cat}</option>`;
      });
    })
    .catch(err => {
      console.error("載入學段失敗:", err);
      categorySelect.innerHTML = '<option value="">-- 載入失敗，點此重試 --</option>';
      categorySelect.onclick = () => { categorySelect.onclick = null; loadCategories(); };
    });
}

// 2. 選擇學段後，載入該學段的社團下拉選單 (或卡片)
function onCategoryChange() {
  const category = document.getElementById("categorySelect").value;
  const clubSelect = document.getElementById("clubSelect"); // 若是下拉選單
  const clubCardContainer = document.getElementById("clubCardContainer"); // 若是卡片容器

  if (!category) return;

  const url = `${GAS_WEB_APP_URL}?action=getClubs&category=${encodeURIComponent(category)}`;

  fetch(url, { redirect: "follow" })
    .then(res => res.json())
    .then(clubs => {
      if (clubs.status === "error") throw new Error(clubs.message);

      // 如果你的介面是用「下拉選單」選擇社團
      if (clubSelect) {
        clubSelect.innerHTML = '<option value="">請選擇社團</option>';
        clubs.forEach(c => {
          clubSelect.innerHTML += `<option value="${c.id}">${c.name} (${c.id})</option>`;
        });
      }

      // 如果你的介面是用「卡片」選擇社團
      if (clubCardContainer) {
        let html = "";
        clubs.forEach(c => {
          html += `
            <div class="club-card" onclick="selectClub('${c.id}', '${c.name}')">
              <div class="club-title">${c.name}</div>
              <div class="club-tag">${c.id}</div>
            </div>`;
        });
        clubCardContainer.innerHTML = html;
      }
    })
    .catch(err => {
      console.error("載入社團失敗:", err);
      alert("社團載入失敗，請確認網路或權限設定。");
    });
}
