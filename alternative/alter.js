let foodList = JSON.parse(localStorage.getItem('foodList') || '[]');
let ingredientList = JSON.parse(localStorage.getItem('ingredientList') || '[]');

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

window.addEventListener('DOMContentLoaded', () => {
  const foodInput = document.getElementById('foodInput');
  const ingredientInput = document.getElementById('ingredientInput');

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
