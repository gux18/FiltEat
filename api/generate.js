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
    const prompt = `
    다음 이미지에서 원재료 및 성분표 텍스트를 추출(OCR)하세요.
    그리고 추출된 텍스트 중 사용자의 [기피물질 목록]에 해당하거나 이를 포함하는 성분을 찾아내세요.
    
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
      model: 'gemini-2.5-flash',
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
                  reason: { type: Type.STRING, description: '검출 이유 또는 설명' }
                },
                required: ['ingredient', 'matchedAvoid']
              },
              description: '발견된 기피물질 목록'
            }
          },
          required: ['extractedText', 'detectedAvoids']
        }
      }
    });

    const result = JSON.parse(response.text);
    return res.status(200).json(result);

  } catch (error) {
    console.error('Gemini API Error:', error);
    return res.status(500).json({ error: 'AI 분석 중 오류가 발생했습니다.', details: error.message });
  }
}