import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let body = req.body || {};
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (parseError) {
        body = {};
      }
    }

    const {
      foodList = [],
      ingredientList = [],
      foodInputText = '',
      ingredientInputText = ''
    } = body;

    const normalizedFoodValues = [foodInputText, ...foodList].filter(Boolean);
    const normalizedIngredientValues = [ingredientInputText, ...ingredientList].filter(Boolean);

    const desiredFood = normalizedFoodValues.join(', ') || '입력된 식품 없음';
    const avoidIngredients = normalizedIngredientValues.join(', ') || '없음';

    const systemInstruction = `입력받은 정보에서 ${avoidIngredients}를 포함하지 않는 ${desiredFood}과(와) 가장 유사한 것을 답변하라. 적절한 것이 없을 경우 찾지 못했다고 답변하라. 답변은 한국어로 짧고 명확하게 작성하라.`;
    const prompt = '입력된 정보에 맞는 식품이나 대체 식품을 하나 추천해라.';

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: prompt,
      config: {
        systemInstruction
      }
    });

    const answer = response.text?.trim() || '추천 결과를 생성하지 못했습니다.';

    return res.status(200).json({
      foodList: normalizedFoodValues,
      ingredientList: normalizedIngredientValues,
      message: answer
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}
