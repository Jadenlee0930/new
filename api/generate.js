import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { mode, category, image } = req.body;
    let prompt = "";
    let count = 10; // 기본 개수 10개

    if (mode === 'ocr') {
      prompt = `
        첨부된 단어장 이미지에서 영단어들을 추출해줘. 
        고등학교 1학년 수준에 맞춰 아래의 JSON 배열 형식으로만 응답해줘. (다른 설명이나 백틱 절대 금지)
        [
          {
            "word": "영어단어",
            "pos": "품사",
            "meaning": "뜻",
            "exampleEn": "영어 예문",
            "exampleKo": "한국어 해석"
          }
        ]
      `;
    } else {
      // 1. 입력된 텍스트에서 숫자 추출 (예: "30개" -> 30)
      const match = category ? category.match(/(\d+)\s*개/) : null;
      count = match ? parseInt(match[1]) : 10;

      prompt = `
        너는 전문 영어 단어장 생성기야.
        주제/요청사항: "${category}"
        
        [지침]
        1. 위 주제에 맞는 고등학교 1학년 수준의 영단어를 **정확히 ${count}개** 생성해라.
        2. 반드시 아래의 JSON 배열 형식으로만 응답해라. (마크다운 백틱 \`\`\`json 등이나 다른 잡담 절대 금지)
        
        [
          {
            "word": "영어단어",
            "pos": "품사",
            "meaning": "뜻",
            "exampleEn": "영어 예문",
            "exampleKo": "한국어 해석"
          }
        ]
      `;
    }

    let contents = [prompt];
    if (mode === 'ocr' && image) {
      const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
      contents.push({
        inlineData: {
          data: base64Data,
          mimeType: 'image/jpeg'
        }
      });
    }

    // 단어 개수가 많을 경우 토큰 제한을 넉넉히 주어 잘림 방지
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: contents,
      config: {
        maxOutputTokens: count > 15 ? 4000 : 2000,
        temperature: 0.7,
      }
    });

    let rawText = response.text.trim();
    // 마크다운 코드 블록 제거
    rawText = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '');

    const words = JSON.parse(rawText);
    return res.status(200).json({ result: words });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || '서버 오류 발생' });
  }
}
