export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { foodList = [], ingredientList = [] } = req.body || {};

    const payload = {
      foodList,
      ingredientList,
      message: `입력된 식품: ${foodList.join(', ') || '없음'}\n피해야 할 성분: ${ingredientList.join(', ') || '없음'}`
    };

    return res.status(200).json(payload);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}
