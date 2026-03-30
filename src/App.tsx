import React, { useState, useRef } from 'react';
import { Upload, FileText, Trash2, Plus, CheckCircle, AlertCircle, Loader2, BarChart2, Info, FileArchive, Check, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import JSZip from 'jszip';
import { ExtractedProduct } from './types';
import { extractSpecFromFile, extractSpecFromText, compareProducts, validateSubmissionDocs } from './lib/gemini';
import { fileToBase64, cn } from './lib/utils';

type TabType = 'compare' | 'validate';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('compare');
  
  const [products, setProducts] = useState<ExtractedProduct[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [validatingProductId, setValidatingProductId] = useState<string | null>(null);
  const [comparisonSummary, setComparisonSummary] = useState<string | null>(null);
  
  const [textInput, setTextInput] = useState('');
  const [textTitle, setTextTitle] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const [activeZipProductId, setActiveZipProductId] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsExtracting(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const base64 = await fileToBase64(file);
        const extracted = await extractSpecFromFile(base64, file.type, file.name);
        setProducts(prev => [...prev, extracted]);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : '파일 분석 중 오류가 발생했습니다.');
    } finally {
      setIsExtracting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleTextSubmit = async () => {
    if (!textInput.trim()) return;
    
    setIsExtracting(true);
    try {
      const extracted = await extractSpecFromText(textInput, textTitle || '텍스트 입력 규격서');
      setProducts(prev => [...prev, extracted]);
      setTextInput('');
      setTextTitle('');
    } catch (error) {
      alert(error instanceof Error ? error.message : '텍스트 분석 중 오류가 발생했습니다.');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleRemoveProduct = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
    if (products.length <= 2) {
      setComparisonSummary(null);
    }
  };

  const handleCompare = async () => {
    if (products.length < 2) {
      alert('비교할 제품이 2개 이상 필요합니다.');
      return;
    }
    
    setIsComparing(true);
    try {
      const summary = await compareProducts(products);
      setComparisonSummary(summary);
    } catch (error) {
      alert(error instanceof Error ? error.message : '비교 중 오류가 발생했습니다.');
    } finally {
      setIsComparing(false);
    }
  };

  const triggerZipUpload = (productId: string) => {
    setActiveZipProductId(productId);
    if (zipInputRef.current) {
      zipInputRef.current.click();
    }
  };

  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeZipProductId) return;

    const product = products.find(p => p.id === activeZipProductId);
    if (!product) return;

    if (!product.firstStageDocuments || product.firstStageDocuments.length === 0) {
      alert('이 제품에는 요구되는 1차 제출서류 목록이 없습니다.');
      return;
    }

    setValidatingProductId(activeZipProductId);
    try {
      const zip = new JSZip();
      const loadedZip = await zip.loadAsync(file);
      
      // Extract file names, ignoring directories and hidden files like __MACOSX
      const fileNames = Object.keys(loadedZip.files).filter(name => 
        !loadedZip.files[name].dir && !name.includes('__MACOSX') && !name.startsWith('.')
      );

      if (fileNames.length === 0) {
        throw new Error('ZIP 파일이 비어있거나 유효한 파일이 없습니다.');
      }

      const validationResult = await validateSubmissionDocs(product.firstStageDocuments, fileNames);
      
      setProducts(prev => prev.map(p => 
        p.id === activeZipProductId 
          ? { ...p, submissionValidation: validationResult }
          : p
      ));

    } catch (error) {
      alert(error instanceof Error ? error.message : 'ZIP 파일 분석 중 오류가 발생했습니다.');
    } finally {
      setValidatingProductId(null);
      setActiveZipProductId(null);
      if (zipInputRef.current) {
        zipInputRef.current.value = '';
      }
    }
  };

  // Extract all unique spec keys for the table
  const allSpecKeys = Array.from(
    new Set(
      products.flatMap(p => p.specifications.map(s => s.key))
    )
  );

  const renderCompareView = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left Column: Input Area */}
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            규격서 업로드
          </h2>
          
          <div className="space-y-4">
            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">파일(PDF, 이미지)</label>
              <div 
                className={cn(
                  "border-2 border-dashed rounded-xl p-6 text-center transition-colors",
                  isExtracting ? "border-slate-300 bg-slate-50" : "border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50 cursor-pointer"
                )}
                onClick={() => !isExtracting && fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*,application/pdf" 
                  multiple 
                  onChange={handleFileUpload}
                  disabled={isExtracting}
                />
                {isExtracting ? (
                  <div className="flex flex-col items-center gap-2 text-slate-500">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                    <span className="text-sm font-medium">AI가 규격서를 분석 중입니다...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-slate-500">
                    <Upload className="w-8 h-8 text-indigo-500" />
                    <span className="text-sm font-medium">클릭하여 파일 선택</span>
                    <span className="text-xs">PDF, JPG, PNG 지원</span>
                  </div>
                )}
              </div>
            </div>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-2 text-xs text-slate-500">또는 텍스트 직접 입력</span>
              </div>
            </div>

            {/* Text Input */}
            <div className="space-y-3">
              <input
                type="text"
                placeholder="제품명 또는 식별자 (선택)"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={textTitle}
                onChange={(e) => setTextTitle(e.target.value)}
                disabled={isExtracting}
              />
              <textarea
                placeholder="규격서 내용을 여기에 붙여넣으세요..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm h-32 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                disabled={isExtracting}
              />
              <button
                onClick={handleTextSubmit}
                disabled={isExtracting || !textInput.trim()}
                className="w-full bg-slate-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {isExtracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                텍스트로 추가하기
              </button>
            </div>
          </div>
        </div>

        {/* Product List Summary */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              분석된 제품 ({products.length})
            </h2>
          </div>
          
          {products.length === 0 ? (
            <div className="text-center py-6 text-sm text-slate-500 bg-slate-50 rounded-lg border border-slate-100">
              아직 추가된 제품이 없습니다.
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {products.map((product) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 truncate" title={product.productName}>
                        {product.productName}
                      </p>
                      <p className="text-xs text-slate-500 truncate" title={product.modelName}>
                        {product.modelName} | {product.manufacturer}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemoveProduct(product.id)}
                      className="ml-2 p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      title="삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          <button
            onClick={handleCompare}
            disabled={products.length < 2 || isComparing}
            className="w-full mt-6 bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            {isComparing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                AI 비교 분석 중...
              </>
            ) : (
              <>
                <BarChart2 className="w-4 h-4" />
                선택된 제품 비교하기
              </>
            )}
          </button>
        </div>
      </div>

      {/* Right Column: Comparison Table & Summary */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* AI Summary */}
        {comparisonSummary && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 shadow-sm"
          >
            <h2 className="text-lg font-bold text-indigo-900 mb-4 flex items-center gap-2">
              <BarChart2 className="w-5 h-5" />
              AI 종합 비교 분석
            </h2>
            <div className="prose prose-sm prose-indigo max-w-none">
              <ReactMarkdown>{comparisonSummary}</ReactMarkdown>
            </div>
          </motion.div>
        )}

        {/* Detailed Table */}
        {products.length > 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <h2 className="text-lg font-semibold text-slate-900">상세 규격 비교표</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 font-medium w-48 bg-slate-100 sticky left-0 z-10 border-r border-slate-200">
                      비교 항목
                    </th>
                    {products.map((product) => (
                      <th key={product.id} className="px-6 py-4 font-medium min-w-[200px] border-r border-slate-200 last:border-r-0 align-top">
                        <div className="text-slate-900 font-bold text-base mb-1">{product.productName}</div>
                        <div className="text-slate-500 font-normal">{product.modelName}</div>
                        <div className="text-slate-400 font-normal text-xs mt-1 mb-3">{product.manufacturer}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900 bg-slate-50 sticky left-0 z-10 border-r border-slate-200">
                      세부 품명
                    </td>
                    {products.map((product) => (
                      <td key={`${product.id}-detailedItemName`} className="px-6 py-4 text-slate-700 border-r border-slate-200 last:border-r-0">
                        {product.detailedItemName}
                      </td>
                    ))}
                  </tr>
                  <tr className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900 bg-slate-50 sticky left-0 z-10 border-r border-slate-200">
                      번호
                    </td>
                    {products.map((product) => (
                      <td key={`${product.id}-itemNumber`} className="px-6 py-4 text-slate-700 border-r border-slate-200 last:border-r-0">
                        {product.itemNumber}
                      </td>
                    ))}
                  </tr>
                  <tr className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900 bg-slate-50 sticky left-0 z-10 border-r border-slate-200 align-top">
                      1차 제출서류
                    </td>
                    {products.map((product) => (
                      <td key={`${product.id}-firstStageDocs`} className="px-6 py-4 text-slate-700 border-r border-slate-200 last:border-r-0 align-top">
                        <ul className="list-disc list-inside space-y-1">
                          {product.firstStageDocuments.map((doc, idx) => (
                            <li key={idx} className="text-sm">{doc}</li>
                          ))}
                        </ul>
                        {product.firstStageDocuments.length === 0 && <span className="text-slate-300">-</span>}
                      </td>
                    ))}
                  </tr>
                  {allSpecKeys.map((key) => (
                    <tr key={key} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900 bg-slate-50 sticky left-0 z-10 border-r border-slate-200">
                        {key}
                      </td>
                      {products.map((product) => {
                        const spec = product.specifications.find(s => s.key === key);
                        return (
                          <td key={`${product.id}-${key}`} className="px-6 py-4 text-slate-700 border-r border-slate-200 last:border-r-0">
                            {spec ? spec.value : <span className="text-slate-300">-</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  
                  {/* Features Row */}
                  <tr className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900 bg-slate-50 sticky left-0 z-10 border-r border-slate-200 align-top">
                      주요 특징 및 인증
                    </td>
                    {products.map((product) => (
                      <td key={`${product.id}-features`} className="px-6 py-4 text-slate-700 border-r border-slate-200 last:border-r-0 align-top">
                        <ul className="list-disc list-inside space-y-1">
                          {product.features.map((feature, idx) => (
                            <li key={idx} className="text-sm">{feature}</li>
                          ))}
                        </ul>
                        {product.features.length === 0 && <span className="text-slate-300">-</span>}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
            <AlertCircle className="w-12 h-12 mb-4 text-slate-300" />
            <p className="text-lg font-medium text-slate-600">비교할 제품이 없습니다</p>
            <p className="text-sm mt-1">좌측에서 규격서를 업로드하거나 텍스트를 입력해주세요.</p>
          </div>
        )}

      </div>
    </div>
  );

  const renderValidateView = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold text-slate-900 mb-2 flex items-center gap-2">
          <FileArchive className="w-6 h-6 text-indigo-600" />
          제출 서류 검증
        </h2>
        <p className="text-slate-600">
          분석된 각 품목별로 업체가 제출한 ZIP 파일을 업로드하여, 공고서에서 요구한 1차 제출서류가 모두 포함되어 있는지 AI가 검증합니다.
        </p>
      </div>

      {products.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
          <AlertCircle className="w-12 h-12 mb-4 text-slate-300" />
          <p className="text-lg font-medium text-slate-600">분석된 제품이 없습니다</p>
          <p className="text-sm mt-1">먼저 '규격 분석' 탭에서 규격서를 업로드해주세요.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {products.map(product => (
            <div key={product.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
              <div className="p-5 border-b border-slate-100 bg-slate-50">
                <h3 className="text-lg font-bold text-slate-900">{product.productName}</h3>
                <p className="text-sm text-slate-500 mt-1">{product.modelName} | {product.manufacturer}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                    세부품명: {product.detailedItemName}
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                    번호: {product.itemNumber}
                  </span>
                </div>
              </div>
              
              <div className="p-5 flex-1 flex flex-col">
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-slate-900 mb-2">요구되는 1차 제출서류</h4>
                  {product.firstStageDocuments.length > 0 ? (
                    <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
                      {product.firstStageDocuments.map((doc, idx) => (
                        <li key={idx}>{doc}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-400 italic">요구되는 서류가 없습니다.</p>
                  )}
                </div>

                <div className="mt-auto pt-4 border-t border-slate-100">
                  {validatingProductId === product.id ? (
                    <div className="flex flex-col items-center justify-center py-6 text-indigo-600 bg-indigo-50 rounded-xl border border-indigo-100">
                      <Loader2 className="w-8 h-8 animate-spin mb-2" />
                      <span className="text-sm font-medium">AI가 서류를 검증하고 있습니다...</span>
                    </div>
                  ) : product.submissionValidation ? (
                    <div className="space-y-4">
                      <div className={cn(
                        "flex items-center justify-between p-4 rounded-xl border",
                        product.submissionValidation.status === 'pass' ? "bg-emerald-50 border-emerald-200" :
                        product.submissionValidation.status === 'partial' ? "bg-amber-50 border-amber-200" :
                        "bg-red-50 border-red-200"
                      )}>
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "p-2 rounded-full",
                            product.submissionValidation.status === 'pass' ? "bg-emerald-100 text-emerald-600" :
                            product.submissionValidation.status === 'partial' ? "bg-amber-100 text-amber-600" :
                            "bg-red-100 text-red-600"
                          )}>
                            {product.submissionValidation.status === 'pass' ? <CheckCircle className="w-6 h-6" /> :
                             product.submissionValidation.status === 'partial' ? <AlertCircle className="w-6 h-6" /> :
                             <X className="w-6 h-6" />}
                          </div>
                          <div>
                            <p className={cn(
                              "font-bold",
                              product.submissionValidation.status === 'pass' ? "text-emerald-800" :
                              product.submissionValidation.status === 'partial' ? "text-amber-800" :
                              "text-red-800"
                            )}>
                              {product.submissionValidation.status === 'pass' ? '모든 서류 충족' :
                               product.submissionValidation.status === 'partial' ? '일부 서류 누락' : '다수 서류 미흡'}
                            </p>
                          </div>
                        </div>
                        <button 
                          onClick={() => triggerZipUpload(product.id)}
                          className="text-sm px-3 py-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
                        >
                          다시 검사
                        </button>
                      </div>

                      {product.submissionValidation.status !== 'pass' && product.submissionValidation.missingDocs.length > 0 && (
                        <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                          <h5 className="text-sm font-bold text-red-800 mb-2">누락된 서류</h5>
                          <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                            {product.submissionValidation.missingDocs.map((doc, i) => (
                              <li key={i}>{doc}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <h5 className="text-sm font-bold text-slate-800 mb-2">AI 검증 상세</h5>
                        <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                          {product.submissionValidation.details}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => triggerZipUpload(product.id)}
                      disabled={product.firstStageDocuments.length === 0}
                      className="w-full flex flex-col items-center justify-center gap-3 py-8 px-4 border-2 border-dashed border-slate-300 rounded-xl hover:border-indigo-400 hover:bg-indigo-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:border-slate-300 group"
                    >
                      <div className="p-3 bg-slate-100 rounded-full group-hover:bg-indigo-100 transition-colors">
                        <FileArchive className="w-6 h-6 text-slate-500 group-hover:text-indigo-600" />
                      </div>
                      <div className="text-center">
                        <span className="block text-sm font-medium text-slate-700 group-hover:text-indigo-700">
                          업체 제출서류 ZIP 파일 업로드
                        </span>
                        <span className="block text-xs text-slate-500 mt-1">
                          클릭하여 파일을 선택하세요
                        </span>
                      </div>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <BarChart2 className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">나라장터 규격서 분석기</h1>
          </div>
          
          <div className="flex items-center bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('compare')}
              className={cn(
                "px-4 py-1.5 text-sm font-medium rounded-md transition-colors",
                activeTab === 'compare' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
              )}
            >
              규격 분석
            </button>
            <button
              onClick={() => setActiveTab('validate')}
              className={cn(
                "px-4 py-1.5 text-sm font-medium rounded-md transition-colors",
                activeTab === 'validate' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
              )}
            >
              서류 검증
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hidden ZIP input */}
        <input 
          type="file" 
          ref={zipInputRef} 
          className="hidden" 
          accept=".zip,application/zip" 
          onChange={handleZipUpload}
        />

        {activeTab === 'compare' ? renderCompareView() : renderValidateView()}
      </main>
    </div>
  );
}
