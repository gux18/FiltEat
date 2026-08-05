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

        const normalizeValues = (value) => {
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
        };

        const isAbnormalValue = (value) => {
            const trimmed = String(value || '').trim();
            if (!trimmed) return true;
            if (trimmed.length > 30) return true;
            const hasValidCharacters = /[가-힣a-zA-Z]/.test(trimmed);
            return !hasValidCharacters;
        };

        const filterAbnormalValues = (values) => (Array.isArray(values) ? values.filter((value) => !isAbnormalValue(value)) : []);
        const getAbnormalValues = (values) => (Array.isArray(values) ? values.filter((value) => isAbnormalValue(value)) : []);

        const requestedModel = typeof body.model === 'string' && body.model.trim()
            ? body.model.trim()
            : 'gemini-3-flash-preview';

        const rawGuideList = normalizeValues(body.guideList ?? body.healthList ?? body.guideInputText ?? body.healthText);
        const guideInputText = [body.guideInputText, body.healthText].find((v) => typeof v === 'string' && v.trim()) || '';

        const abnormalList = getAbnormalValues(rawGuideList.filter(Boolean));
        const normalizedGuideValues = [...new Set(filterAbnormalValues([guideInputText, ...rawGuideList].filter(Boolean)))];

        const conditions = normalizedGuideValues.join(', ') || '입력된 건강 상태 없음';

        const systemInstruction = '사용자의 건강 상태를 먼저 보정하고 정리한 뒤, 해당 건강 상태에서 피해야 할 성분을 추천하라. 한국어로 답변하라.';

        // JSON 형태의 correctedGuideList, avoidIngredients, answer를 함께 받도록 프롬프트 지정
        const prompt = [
            '사용자 건강 정보:',
            `- 건강 상태: < ${conditions} >`,
            '\n요구사항:',
            '1. 사용자 입력을 보정한 건강 상태 목록을 "correctedGuideList" 배열에 넣으세요. 비정상적이거나 의미 없는 항목은 제외하고, 결과 항목은 길이 30자 이내의 한글/영문 문자열만 포함하세요.',
            '2. 해당 건강 상태에서 피해야 할 주요 성분명만 짧은 단어로 추출하여 "avoidIngredients" 배열에 넣으세요 (3~7개).',
            '3. 상세 설명 및 유의사항은 "answer" 항목에 작성하세요.',
            '\n응답은 반드시 아래 JSON 형식으로만 답변하세요:',
            '{\n  "correctedGuideList": ["보정된 건강 상태1", "보정된 건강 상태2"],\n  "avoidIngredients": ["성분1", "성분2", "성분3"],\n  "answer": "상세 조언 텍스트..."\n}'
        ].join('\n');

        const response = await ai.models.generateContent({
            model: requestedModel,
            contents: prompt,
            config: {
                systemInstruction,
                responseMimeType: 'application/json'
            }
        });

        let responseJson = {};
        try {
            responseJson = JSON.parse(response.text?.trim() || '{}');
        } catch (e) {
            responseJson = {
                correctedGuideList: [],
                avoidIngredients: [],
                answer: response.text?.trim() || '권장 결과를 생성하지 못했습니다.'
            };
        }

        const correctedGuideList = Array.isArray(responseJson.correctedGuideList)
            ? responseJson.correctedGuideList
                .map(item => String(item).trim())
                .filter(item => item.length > 0 && item.length <= 30)
            : normalizedGuideValues;

        const avoidIngredients = Array.isArray(responseJson.avoidIngredients)
            ? responseJson.avoidIngredients.map(item => String(item).trim()).filter(item => item.length > 0 && item.length <= 30)
            : [];

        const answer = responseJson.answer || '권장 결과를 생성하지 못했습니다.';

        return res.status(200).json({
            guideList: normalizedGuideValues,
            correctedGuideList,
            abnormalList,
            avoidIngredients,
            message: answer,
            answer
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message });
    }
}