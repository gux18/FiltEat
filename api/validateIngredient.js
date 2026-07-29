import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";

const router = express.Router();

const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY
);

router.post("/", async (req, res) => {
  try {
    const { text } = req.body;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash"
    });

    const prompt = `
너는 식품 성분 검사기다.
사용자가 입력한 단어가 아래 중 하나인지 판단해라.

- 음식
- 식재료
- 식품첨가물
- 향신료
- 알레르기 성분

맞으면 YES,
아니면 NO만 출력해라.

입력:
${text}
`;
    const result = await model.generateContent(prompt);

    const answer = result.response.text()
      .trim()
      .toUpperCase();

    res.json({valid: answer === "YES"});
    
  } catch (error) {
    console.error(error);
    res.status(500).json({
      valid: false
    });
  }
});
export default router;
