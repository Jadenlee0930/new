import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
  // CORS 처리 및 POST 요청 확인
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST 요청만 지원합니다.' });
  }

  // Gemini API 키 검증
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY 환경변수가 설정되지 않았습니다. Vercel Settings에서 등록해 주세요.' });
  }

  try {
    const { mode, category, image } = req.body;
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    let prompt = "";
    let contents = [];

    if (mode === 'ocr') {
      if (!image) {
        return res.status(400).json({ error: '이미지 데이터가 전달되지 않았습니다.' });
      }

      // Base64 이미지 헤더 제거 처리
      const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
      const imagePart = {
        inlineData: {
          data: base64Data,
          mimeType: 'image/jpeg'
        }
      };

      prompt = `이 이미지에서 고등학교 수능/내신 대비용 영어 단어를 추출해 줘.
      응답은 반드시 다른 설명이나 마크다운 없이 아래 JSON 배열 형식으로만 출력해 줘:
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
      // Preset 모드 (테마별 생성)
      prompt = `'${category}' 주제에 어울리는 고등학교 수능 및 내신 필수 영어 단어 5개를 선정해 줘.
      응답은 반드시 다른 설명이나 마크다운 없이 아래 JSON 배열 형식으로만 출력해 줘:
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

    // AI 결과 응답 수신
    const result = await model.generateContent(contents);
    const responseText = result.response.text();

    // JSON 본문 순수 파싱
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
}
