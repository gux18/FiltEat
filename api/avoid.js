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

		const systemInstruction = '사용자의 건강 상태에 따라 피해야 할 성분(재료)을 간결하게 추천하라. 불확실한 경우 유의사항을 함께 작성하라. 한국어로 답변하라.';
		const prompt = [
			'사용자 건강 정보:',
			`- 건강 상태: < ${conditions} >`,
			'\n요구사항: 해당 건강 상태와 연관되어 피해야 할 성분(예: 나트륨, 콜레스테롤, 특정 알레르기 유발 성분 등)을 3~7개 내외로 추천하라. 각 항목에 짧은 설명(이유 또는 유의사항)을 추가하라.'
		].join('\n');

		const response = await ai.models.generateContent({
			model: requestedModel,
			contents: prompt,
			config: {
				systemInstruction
			}
		});

		const answer = response.text?.trim() || '권장 결과를 생성하지 못했습니다.';

		return res.status(200).json({
			guideList: normalizedGuideValues,
			abnormalList,
			message: answer,
			answer
		});
	} catch (error) {
		console.error(error);
		return res.status(500).json({ error: error.message });
	}
}
