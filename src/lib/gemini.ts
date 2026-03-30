import { GoogleGenAI, Type } from "@google/genai";
import { ExtractedProduct, SubmissionValidation } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const specSchema = {
  type: Type.OBJECT,
  properties: {
    productName: { type: Type.STRING, description: "제품명 (Product Name)" },
    modelName: { type: Type.STRING, description: "모델명 (Model Name/Number)" },
    manufacturer: { type: Type.STRING, description: "제조사 (Manufacturer)" },
    detailedItemName: { type: Type.STRING, description: "세부 품명 (Detailed Item Name)" },
    itemNumber: { type: Type.STRING, description: "번호 (공고번호, 물품분류번호 또는 세부품명번호)" },
    firstStageDocuments: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "1차 제출서류 목록 (1st Stage Submission Documents)"
    },
    specifications: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          key: { type: Type.STRING, description: "규격 항목 (예: 크기, 무게, 재질, 소비전력, 해상도 등). 최대한 표준화된 단어 사용." },
          value: { type: Type.STRING, description: "해당 규격의 값 (단위 포함)" }
        },
        required: ["key", "value"]
      },
      description: "제품의 상세 규격 (Specifications)"
    },
    features: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "제품의 주요 특징, 장점, 인증 내역 등 (Features & Certifications)"
    }
  },
  required: ["productName", "modelName", "manufacturer", "detailedItemName", "itemNumber", "firstStageDocuments", "specifications", "features"]
};

export async function extractSpecFromFile(
  fileBase64: string,
  mimeType: string,
  fileName: string
): Promise<ExtractedProduct> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: {
        parts: [
          {
            inlineData: {
              data: fileBase64,
              mimeType: mimeType,
            },
          },
          {
            text: `당신은 조달청 나라장터(KONEPS) 규격서 및 공고서 분석 전문가입니다. 
주어진 문서(이미지 또는 PDF)에서 제품의 핵심 규격 정보와 공고 정보를 추출하여 JSON 형식으로 반환하세요.
특히 '세부 품명', '번호(공고번호, 세부품명번호 등)', '1차 제출서류' 항목을 반드시 찾아서 추출해주세요.
비교를 용이하게 하기 위해 규격 항목(key)은 최대한 표준화된 명칭(예: 크기, 무게, 재질, 소비전력, 인증 등)을 사용하세요.
문서에 명시되지 않은 정보는 "확인 불가" 또는 빈 문자열로 두지 말고, 아예 항목에서 제외하거나 빈 배열로 두세요.`,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: specSchema,
        temperature: 0.1,
      },
    });

    const jsonStr = response.text?.trim() || "{}";
    const data = JSON.parse(jsonStr);

    return {
      id: crypto.randomUUID(),
      fileName,
      productName: data.productName || "알 수 없음",
      modelName: data.modelName || "알 수 없음",
      manufacturer: data.manufacturer || "알 수 없음",
      detailedItemName: data.detailedItemName || "알 수 없음",
      itemNumber: data.itemNumber || "알 수 없음",
      firstStageDocuments: data.firstStageDocuments || [],
      specifications: data.specifications || [],
      features: data.features || [],
    };
  } catch (error) {
    console.error("Error extracting spec:", error);
    throw new Error("규격서 분석 중 오류가 발생했습니다.");
  }
}

export async function extractSpecFromText(
  text: string,
  title: string
): Promise<ExtractedProduct> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: {
        parts: [
          {
            text: `당신은 조달청 나라장터(KONEPS) 규격서 및 공고서 분석 전문가입니다. 
다음 텍스트에서 제품의 핵심 규격 정보와 공고 정보를 추출하여 JSON 형식으로 반환하세요.
특히 '세부 품명', '번호(공고번호, 세부품명번호 등)', '1차 제출서류' 항목을 반드시 찾아서 추출해주세요.
비교를 용이하게 하기 위해 규격 항목(key)은 최대한 표준화된 명칭(예: 크기, 무게, 재질, 소비전력, 인증 등)을 사용하세요.
문서에 명시되지 않은 정보는 항목에서 제외하거나 빈 배열로 두세요.

[텍스트 시작]
${text}
[텍스트 종료]`,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: specSchema,
        temperature: 0.1,
      },
    });

    const jsonStr = response.text?.trim() || "{}";
    const data = JSON.parse(jsonStr);

    return {
      id: crypto.randomUUID(),
      fileName: title,
      productName: data.productName || "알 수 없음",
      modelName: data.modelName || "알 수 없음",
      manufacturer: data.manufacturer || "알 수 없음",
      detailedItemName: data.detailedItemName || "알 수 없음",
      itemNumber: data.itemNumber || "알 수 없음",
      firstStageDocuments: data.firstStageDocuments || [],
      specifications: data.specifications || [],
      features: data.features || [],
    };
  } catch (error) {
    console.error("Error extracting spec from text:", error);
    throw new Error("텍스트 분석 중 오류가 발생했습니다.");
  }
}

export async function compareProducts(products: ExtractedProduct[]): Promise<string> {
  try {
    const productsJson = JSON.stringify(
      products.map(p => ({
        제품명: p.productName,
        모델명: p.modelName,
        제조사: p.manufacturer,
        세부품명: p.detailedItemName,
        번호: p.itemNumber,
        "1차제출서류": p.firstStageDocuments,
        규격: p.specifications,
        특징: p.features
      })),
      null,
      2
    );

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: `당신은 조달청 나라장터(KONEPS) 제품 비교 분석 전문가입니다.
다음은 여러 제품의 추출된 규격 정보입니다. 이 제품들을 비교 분석하여, 각 제품의 장단점, 주요 차이점, 그리고 어떤 상황에서 어떤 제품을 선택하는 것이 좋은지 요약 보고서를 마크다운(Markdown) 형식으로 작성해주세요.
표(Table)를 적극적으로 활용하여 한눈에 비교하기 쉽게 만들어주세요.

[제품 정보]
${productsJson}`,
    });

    return response.text || "비교 결과를 생성할 수 없습니다.";
  } catch (error) {
    console.error("Error comparing products:", error);
    throw new Error("제품 비교 중 오류가 발생했습니다.");
  }
}

export async function validateSubmissionDocs(
  requiredDocs: string[],
  submittedFiles: string[]
): Promise<SubmissionValidation> {
  try {
    const validationSchema = {
      type: Type.OBJECT,
      properties: {
        status: { 
          type: Type.STRING, 
          description: "검증 결과 상태. 'pass' (모두 충족), 'fail' (대부분 누락), 'partial' (일부 누락)" 
        },
        missingDocs: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "제출되지 않은(누락된) 필수 서류 목록"
        },
        details: {
          type: Type.STRING,
          description: "검증 결과에 대한 상세한 설명 (어떤 서류가 어떤 파일로 대체되었는지, 무엇이 부족한지 등)"
        }
      },
      required: ["status", "missingDocs", "details"]
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: `당신은 조달청 나라장터(KONEPS) 서류 검토 전문가입니다.
다음은 공고서에서 요구하는 '1차 제출서류' 목록과 업체가 실제로 제출한 'ZIP 파일 내 파일명' 목록입니다.
파일명과 요구 서류명을 지능적으로 매칭하여(예: '사업자등록증명원'은 '사업자등록증' 요구를 충족함), 요구사항이 모두 충족되었는지 검증하고 JSON 형식으로 반환하세요.

[요구되는 1차 제출서류 목록]
${JSON.stringify(requiredDocs, null, 2)}

[업체가 제출한 파일명 목록]
${JSON.stringify(submittedFiles, null, 2)}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: validationSchema,
        temperature: 0.1,
      },
    });

    const jsonStr = response.text?.trim() || "{}";
    const data = JSON.parse(jsonStr);

    return {
      status: data.status as 'pass' | 'fail' | 'partial',
      missingDocs: data.missingDocs || [],
      details: data.details || "검증 세부 정보를 가져올 수 없습니다.",
    };
  } catch (error) {
    console.error("Error validating submission docs:", error);
    throw new Error("서류 검증 중 오류가 발생했습니다.");
  }
}
