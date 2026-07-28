const { GoogleGenerativeAI } = require('@google/generative-ai');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST 요청만 지원합니다.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY 환경변수가 설정되지 않았습니다. Vercel Settings에서 등록해 주세요.' });
  }

  try {
    const { mode, category, image, seed } = req.body;
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // generationConfig에 temperature를 높여서 매번 다양한 단어가 생성되도록 설정
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-3.1-flash-lite',
      generationConfig: {
        temperature: 1.0, // 창의성 및 무작위성 극대화
      }
    });

    let prompt = "";
    let contents = [];

    if (mode === 'ocr') {
      if (!image) {
        return res.status(400).json({ error: '이미지 데이터가 전달되지 않았습니다.' });
      }

      const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
      const imagePart = {
        inlineData: {
          data: base64Data,
          mimeType: 'image/jpeg'
        }
      };

      prompt = `이 이미지에 보이는 영어 단어 및 주요 표제어를 **하나도 빠짐없이 모두** 추출해 줘. 
      단어가 많더라도 도중에 생략하거나 요약하지 말고 이미지 속 전체 단어 목록을 다 다뤄야 해.
      
      각 단어별로 품사, 정확한 한글 뜻, 그리고 수능/내신 수준의 유용한 영어 예문과 예문 해석을 함께 작성해 줘.
      
      응답은 반드시 다른 설명이나 마크다운 표현(예: \`\`\`json) 없이 아래 JSON 배열 형식만 출력해 줘:
      [
        {
          "word": "영어단어",
          "pos": "품사",
          "meaning": "한글 뜻",
          "exampleEn": "영어 예문",
          "exampleKo": "예문 한글 해석"
        }
      ]`;

      contents = [prompt, imagePart];

    } else {
      // 💡 매번 완전히 다른 단어가 강제로 나오도록 무작위 문자열 및 타임스탬프 시드 조합 적용
      const randomString = Math.random().toString(36).substring(2, 8);
      const timeSalt = Date.now().toString().slice(-5);
      const combinedSeed = seed || `${randomString}-${timeSalt}`;

      prompt = `[시스템 지시: 무작위성 최대화 및 중복 방지 절대 규칙]
      - 요청 주제: "${category}"
      - 무작위 해시 시드: ${combinedSeed}
      
      [매우 중요 규칙]
      - 이전에 흔히 출제되었던 뻔한 대표 단어들(subsequent, allocate, prevalent, implement 등)은 **절대 포함하지 마세요.**
      - 위의 해시 시드값 변화에 맞춰, 해당 주제 안에서도 **지금까지 다루지 않은 완전히 새롭고 신선한 고등학교 수능/내신 필수 영어 단어 10개**를 무작위로 엄선하여 구성해 주세요.

      응답은 반드시 다른 설명 없이 아래 JSON 배열 형식으로만 출력해 줘:
      [
        {
          "word": "영어단어",
          "pos": "품사",
          "meaning": "한글 뜻",
          "exampleEn": "영어 예문",
          "exampleKo": "예문 한글 해석"
        }
      ]`;

      contents = [prompt];
    }

    const result = await model.generateContent(contents);
    const responseText = result.response.text();

    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('AI 응답이 올바른 JSON 형식이 아닙니다.');
    }

    const parsedData = JSON.parse(jsonMatch[0]);

    return res.status(200).json({ result: parsedData });

  } catch (error) {
    console.error("Vercel Server Error:", error);
    const errorMessage = error.message || error.toString() || '알 수 없는 서버 오류';
    
    return res.status(500).json({
      error: `API 호출 실패: ${errorMessage}`
    });
  }
};
