import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY});
export default async function handler(req, res) {
  
  try {
    const { text } = req.body;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `
사용자가 입력한 단어가 음식, 식재료, 식품첨가물인지 판단하세요.
맞으면 YES,
아니면 NO만 출력하세요.
입력:
${text}
`
    });
    const answer = response.text
      .trim()
      .toUpperCase();
    res.status(200).json({valid: answer === "YES"});
    
  } catch(error) {
    console.error(error);
    res.status(500).json({error: error.message});
  }
}
