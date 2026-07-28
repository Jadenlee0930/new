} catch (error) {
    console.error("Vercel Server Error:", error);
    
    // Google API 및 서버의 실제 에러 메시지를 클라이언트로 직접 전달
    const errorMessage = error.message || error.toString() || '알 수 없는 오류';
    
    return res.status(500).json({
      error: `API 호출 실패: ${errorMessage}`
    });
  }
};
