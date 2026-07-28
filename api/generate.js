import { GoogleGenAI, Type } from '@google/genai';

export default async function handler(req, res) {
  // POST 요청만 허용
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageBase64, mimeType, avoidList } = req.body;

    if (!imageBase64 || !avoidList || avoidList.length === 0) {
      return res.status(400).json({ error: '이미지와 기피물질 목록을 모두 제공해야 합니다.' });
    }

    // 환경변수 GEMINI_API_KEY 읽기
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // 프롬프트 구성
    const prompt = `다음 이미지에서 원재료 및 성분표 텍스트를 추출(OCR)하고, 사용자의 [기피물질 목록]과 대조하여 분석하세요.
    
    [기피물질 목록]:
    ${avoidList.join(', ')}

    [작성 규칙]:
    1. 기피 성분에 명백하게 해당할 경우 '주의' 로 분류
    2. 일반 사용자가 기피 성분에 해당하는지 너무 쉽게 확인 가능한 경우(예: 기피 항목 '밀' -> '밀', '밀가루' 를 기피)에는 reason(사유)을 빈 문자열("")로 설정
    3. 실제로 함유되었는지 불분명하면, reason(사유) 필드에 '주의'라는 단어 대신 반드시 '유의'라는 단어를 사용하여 이유를 서술 (예: "밀을 사용한 시설에서 제조되어 유의 필요")
    4. '주의' 에 해당하는 항목은 '유의' 에 포함하지 않음
    [기피물질 목록]:
    ${avoidList.join(', ')}

    결과는 반드시 지정된 JSON 구조로 작성해 주세요.
    `;

    // 이미지 파일 데이터를 InlineData 형태로 변환
    const imagePart = {
      inlineData: {
        data: imageBase64,
        mimeType: mimeType || 'image/jpeg'
      }
    };

    // Gemini API 호출 (Structured JSON Output 사용)
  const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: [prompt, imagePart],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            extractedText: {
              type: Type.STRING,
              description: '이미지에서 추출한 전체 원재료/성분표 텍스트'
            },
            detectedAvoids: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  ingredient: { type: Type.STRING, description: '이미지에서 발견된 성분명' },
                  matchedAvoid: { type: Type.STRING, description: '매칭된 기피물질 항목' },
                  reason: { type: Type.STRING, description: '검출 이유 또는 설명 (명백한 경우 빈값 "")' }
                },
                required: ['ingredient', 'matchedAvoid']
              },
              description: '발견된 전체 기피물질 목록'
            }
          },
          required: ['extractedText', 'detectedAvoids']
        }
      }
    });

    const result = JSON.parse(response.text);
    return res.status(200).json(result);

  } catch (error) {
  console.error(error);

  return new Response(
    JSON.stringify({
      error: error.message,
      stack: error.stack
    }),
    {
      status: 500,
      headers: {
        "Content-Type": "application/json"
      }
    }
  );
}
}
