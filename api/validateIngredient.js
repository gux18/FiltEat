import { GoogleGenAI } from '@google/genai';
const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method Not Allowed"
    });
  }
  try {
    const { text } = req.body;
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash"
    });

    const prompt = `
입력된 단어가 음식, 식재료, 식품첨가물인지 판단하세요.
맞으면 YES
아니면 NO
YES 또는 NO만 출력하세요.
입력:
${text}
`;
    /*const result = await model.generateContent(prompt);

    const answer = result.response.text()
      .trim()
      .toUpperCase();

    res.status(200).json({
      valid: answer === "YES"
    });*/
    const result = await model.generateContent(prompt);
    console.log(result);
    const text = result.response.text();
    console.log(text);
    res.status(200).json({
      valid: text.includes("YES")
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      valid: false
    });
  }
}
