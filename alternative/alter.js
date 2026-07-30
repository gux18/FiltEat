let foodList = JSON.parse(localStorage.getItem('foodList') || '[]');
let ingredientList = JSON.parse(localStorage.getItem('ingredientList') || '[]');
let buttonLockTimer = null;

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderFoodTags() {
  const container = document.getElementById('foodTags');
  if (!container) return;

  if (foodList.length === 0) {
    container.innerHTML = '<span class="muted">추가한 식품이 여기에 표시됩니다.</span>';
  } else {
    container.innerHTML = foodList.map((item, index) => {
      const safeItem = escapeHtml(item);
      return `
        <span class="tag-chip">
          <span>${safeItem}</span>
          <button type="button" class="tag-remove" onclick="removeFoodItem(${index})" aria-label="${safeItem} 삭제">×</button>
        </span>
      `;
    }).join('');
  }

  localStorage.setItem('foodList', JSON.stringify(foodList));
}

function renderIngredientTags() {
  const container = document.getElementById('ingredientTags');
  if (!container) return;

  if (ingredientList.length === 0) {
    container.innerHTML = '<span class="muted">추가한 성분이 여기에 표시됩니다.</span>';
  } else {
    container.innerHTML = ingredientList.map((item, index) => {
      const safeItem = escapeHtml(item);
      return `
        <span class="tag-chip">
          <span>${safeItem}</span>
          <button type="button" class="tag-remove" onclick="removeIngredientItem(${index})" aria-label="${safeItem} 삭제">×</button>
        </span>
      `;
    }).join('');
  }

  localStorage.setItem('ingredientList', JSON.stringify(ingredientList));
}

function addFoodItem() {
  const input = document.getElementById('foodInput');
  if (!input) return;

  const value = input.value.trim();
  if (!value) {
    input.focus();
    return;
  }

  if (!foodList.includes(value)) {
    foodList.push(value);
  }

  if (value.length > 30) {
    alert("30자 이내의 음식만 입력할 수 있습니다.");
    return;
  }

  input.value = '';
  renderFoodTags();
}

function removeFoodItem(index) {
  foodList.splice(index, 1);
  renderFoodTags();
}

function addIngredientItem() {
  const input = document.getElementById('ingredientInput');
  if (!input) return;

  const value = input.value.trim();
  if (!value) {
    input.focus();
    return;
  }

  if (!ingredientList.includes(value)) {
    ingredientList.push(value);
  }

  input.value = '';
  renderIngredientTags();
}

function removeIngredientItem(index) {
  ingredientList.splice(index, 1);
  renderIngredientTags();
}

function normalizeListValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function lockSubmitButton(sendBtn) {
  if (!sendBtn) return;

  sendBtn.disabled = true;
  sendBtn.textContent = '전송 중...';

  if (buttonLockTimer) {
    clearTimeout(buttonLockTimer);
  }

  buttonLockTimer = setTimeout(() => {
    sendBtn.disabled = false;
    sendBtn.textContent = 'AI에게 전송';
    buttonLockTimer = null;
  }, 5000);
}

async function submitAlternativeData() {
  const resultBox = document.getElementById('apiResult');
  const sendBtn = document.getElementById('sendBtn');

  if (foodList.length === 0 && ingredientList.length === 0) {
    alert('식품 또는 성분을 최소 1개 이상 입력해주세요.');
    return;
  }

  if (sendBtn) {
    lockSubmitButton(sendBtn);
  }

  if (resultBox) {
    resultBox.textContent = '전송 중...';
  }

  try {
    const requestBody = {
      foodList: normalizeListValue(foodList),
      ingredientList: normalizeListValue(ingredientList),
      foodInputText: normalizeListValue(foodList).join(', '),
      ingredientInputText: normalizeListValue(ingredientList).join(', ')
    };

    const response = await fetch('/api/alternative', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    let data = null;
    try {
      data = await response.json();
    } catch (parseError) {
      data = { message: await response.text() };
    }

    if (!response.ok) {
      throw new Error(data.error || data.message || '전송에 실패했습니다.');
    }

    if (resultBox) {
      const message = data.message || data.answer || '전송이 완료되었습니다.';
      const responseText = message;
      resultBox.innerHTML = escapeHtml(responseText).replace(/\n/g, '<br>');
    }
  } catch (error) {
    if (resultBox) {
      resultBox.textContent = '오류가 발생했습니다. 서버에 문제가 생겼을 수 있으니 잠시 후 다시 시도해주세요.';
    }
    console.error(error);
  } finally {
    if (sendBtn && !buttonLockTimer) {
      sendBtn.disabled = false;
      sendBtn.textContent = 'AI에게 전송';
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const foodInput = document.getElementById('foodInput');
  const ingredientInput = document.getElementById('ingredientInput');
  const sendBtn = document.getElementById('sendBtn');

  if (sendBtn) {
    sendBtn.addEventListener('click', submitAlternativeData);
  }

  if (foodInput) {
    foodInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        addFoodItem();
      }
    });
  }

  if (ingredientInput) {
    ingredientInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        addIngredientItem();
      }
    });
  }

  renderFoodTags();
  renderIngredientTags();
});
