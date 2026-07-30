import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { foodList = [], ingredientList = [] } = req.body || {};

    const desiredFood = foodList.join(', ') || '입력된 식품 없음';
    const avoidIngredients = ingredientList.join(', ') || '없음';

    const prompt = `입력받은 정보에서 ${avoidIngredients}를 포함하지 않는 ${desiredFood}와 가장 유사한 식품이나 대체 식품을 하나 추천하라. 적절한 것이 없다면 찾지 못했다고 답변하라. 답변은 한국어로 짧고 명확하게 작성하라.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: prompt
    });

    const answer = response.text?.trim() || '추천 결과를 생성하지 못했습니다.';

    return res.status(200).json({
      foodList,
      ingredientList,
      message: answer
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}
