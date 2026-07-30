import { GoogleGenAI } from "@google/genai";
import { db } from "../firebaseAdmin.js";

const ai = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY});

export default async function handler(req, res) {
  try {
    const text = req.body.text.trim().replace(/\s+/g," ");
    
    if (/^[A-Za-z]+$/.test(text)) {
      return res.status(200).json({ valid:false });
    }

    const doc = await db.collection("ingredientCache").doc(text).get();
    if (doc.exists) {
        return res.json({valid:doc.data().valid});
    }
    
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: `
      사용자가 입력한 단어가 음식, 식재료, 식품첨가물인지 판단하세요.
      맞으면 YES,
      아니면 NO만 출력하세요.
      입력:
      ${text}
    `});
    
    const answer = response.text.trim().toUpperCase().replace(".", "").split(/\s+/)[0];
    await db.collection("ingredientCache").doc(text).set({answer});
    res.status(200).json({valid:answer === "YES"});
  } catch(error) {
    console.error(error);
    res.status(500).json({error:error.message});
  }
}
