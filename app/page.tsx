'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Search, BookOpen, Volume2, Heart, RotateCcw, 
  ChevronLeft, ChevronRight, Star, Filter,
  Gamepad2, Cpu, Palette, Users, Building, DollarSign
} from 'lucide-react';
import { ComponentType } from 'react';

// 타입 정의
interface Category {
  id: number;
  name: string;
  name_en: string;
  icon: string;
  color: string;
}

interface SlangWord {
  id: number;
  word: string;
  pinyin: string;
  meaning: string;
  background: string;
  category_id: number;
  year: number;
  month: number;
  popularity_score: number;
  created_at: string;
  categories: Category;
}

interface Sentence {
  id: number;
  word_id: number;
  chinese_text: string;
  korean_translation: string;
  sentence_order: number;
  grammar_notes?: string;
  slang_words?: {
    word: string;
    meaning: string;
    categories: {
      name: string;
    };
  };
}

type StudyMode = 'browse' | 'study' | 'sentence';

// Supabase 클라이언트 초기화 (환경변수 사용)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase URL과 Key가 환경변수에 설정되지 않았습니다.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 카테고리 아이콘 매핑
const categoryIcons: Record<string, ComponentType<{ className?: string }>> = {
  'Gamepad2': Gamepad2,
  'Cpu': Cpu,
  'Palette': Palette,
  'Users': Users,
  'Building': Building,
  'DollarSign': DollarSign,
};

// 카테고리 색상 매핑 (Tailwind purging 방지)
const categoryColors: Record<string, string> = {
  'gaming': 'bg-purple-500',
  'tech': 'bg-blue-500',
  'culture': 'bg-pink-500',
  'society': 'bg-green-500',
  'politics': 'bg-red-500',
  'economy': 'bg-yellow-500',
};

export default function ChineseSlangApp() {
  const [words, setWords] = useState<SlangWord[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filteredWords, setFilteredWords] = useState<SlangWord[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [currentWordIndex, setCurrentWordIndex] = useState<number>(0);
  const [showMeaning, setShowMeaning] = useState<boolean>(false);
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState<boolean>(true);
  const [studyMode, setStudyMode] = useState<StudyMode>('browse');
  const [selectedWord, setSelectedWord] = useState<SlangWord | null>(null);
  
  // 음성 지원 확인
  const [voiceSupported, setVoiceSupported] = useState<boolean>(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  
  // 문장 학습 모드 상태
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [allSentences, setAllSentences] = useState<Sentence[]>([]);
  const [filteredSentences, setFilteredSentences] = useState<Sentence[]>([]);
  const [sentenceMode, setSentenceMode] = useState<'cn-to-kr' | 'kr-to-cn'>('cn-to-kr');
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState<number>(0);
  const [userAnswer, setUserAnswer] = useState<string>('');
  const [showAnswer, setShowAnswer] = useState<boolean>(false);
  const [showGrammar, setShowGrammar] = useState<boolean>(false);
  const [sentenceProgress, setSentenceProgress] = useState<Set<number>>(new Set());

  // 데이터 로드
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (): Promise<void> => {
    try {
      setLoading(true);
      
      // 카테고리 로드
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('*')
        .order('id');

      if (categoriesError) throw categoriesError;
      setCategories(categoriesData || []);

      // 신조어 로드
      const { data: wordsData, error: wordsError } = await supabase
        .from('slang_words')
        .select(`
          *,
          categories (
            name,
            name_en,
            icon,
            color
          )
        `)
        .order('popularity_score', { ascending: false });

      if (wordsError) throw wordsError;
      setWords(wordsData || []);
      setFilteredWords(wordsData || []);
      
    } catch (error) {
      console.error('데이터 로드 오류:', error);
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      alert('데이터를 불러오는 중 오류가 발생했습니다: ' + errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 모든 문장 로드 (문장 학습모드용)
  const loadAllSentences = async (): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from('sentences')
        .select(`
          *,
          slang_words (
            word,
            meaning,
            categories (
              name
            )
          )
        `)
        .order('id');

      if (error) throw error;
      setAllSentences(data || []);
    } catch (error) {
      console.error('모든 문장 로드 오류:', error);
    }
  };

  // 카테고리 영어명을 한국어명으로 변환
  const getCategoryName = (nameEn: string): string => {
    const categoryMap: Record<string, string> = {
      'gaming': '게임',
      'tech': 'IT',
      'culture': '문화',
      'society': '사회',
      'politics': '정치',
      'economy': '경제'
    };
    return categoryMap[nameEn] || '';
  };

  // 문장 필터링 로직
  useEffect(() => {
    if (allSentences.length === 0) return;
    
    let filtered = allSentences;
    
    // 카테고리 필터링
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(sentence => 
        sentence.slang_words?.categories?.name === getCategoryName(selectedCategory)
      );
    }
    
    // 검색어 필터링
    if (searchTerm) {
      filtered = filtered.filter(sentence =>
        sentence.chinese_text.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sentence.korean_translation.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sentence.slang_words?.word.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    setFilteredSentences(filtered);
    setCurrentSentenceIndex(0); // 필터링 후 첫 번째 문장으로 이동
  }, [allSentences, selectedCategory, searchTerm]);

  // 문장 학습모드 진입 시 모든 문장 로드
  useEffect(() => {
    if (studyMode === 'sentence') {
      loadAllSentences();
    }
  }, [studyMode]);

  // 특정 단어의 예문 로드
  const loadSentences = async (wordId: number): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from('sentences')
        .select('*')
        .eq('word_id', wordId)
        .order('sentence_order');

      if (error) throw error;
      setSentences(data || []);
    } catch (error) {
      console.error('예문 로드 오류:', error);
    }
  };

  // 검색 및 필터링 (단어)
  useEffect(() => {
    let filtered = words;

    // 카테고리 필터
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(word => 
        word.categories.name_en === selectedCategory
      );
    }

    // 검색어 필터
    if (searchTerm) {
      filtered = filtered.filter(word =>
        word.word.toLowerCase().includes(searchTerm.toLowerCase()) ||
        word.pinyin.toLowerCase().includes(searchTerm.toLowerCase()) ||
        word.meaning.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredWords(filtered);
    setCurrentWordIndex(0);
  }, [selectedCategory, searchTerm, words]);

  // 즐겨찾기 토글
  const toggleFavorite = (wordId: number): void => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(wordId)) {
      newFavorites.delete(wordId);
    } else {
      newFavorites.add(wordId);
    }
    setFavorites(newFavorites);
    localStorage.setItem('chineseSlangFavorites', JSON.stringify(Array.from(newFavorites)));
  };

  // 음성 지원 확인
  useEffect(() => {
    if ('speechSynthesis' in window) {
      const checkVoices = () => {
        const voices = speechSynthesis.getVoices();
        const chineseVoices = voices.filter(voice => 
          voice.lang.includes('zh') || 
          voice.lang.includes('cmn') ||
          voice.name.includes('Chinese')
        );
        setAvailableVoices(chineseVoices);
        setVoiceSupported(chineseVoices.length > 0);
      };

      // 음성 로드 완료 후 확인
      speechSynthesis.addEventListener('voiceschanged', checkVoices);
      checkVoices(); // 즉시 확인

      return () => {
        speechSynthesis.removeEventListener('voiceschanged', checkVoices);
      };
    }
  }, []);

  // 로컬스토리지에서 즐겨찾기 및 문장 진도 로드
  useEffect(() => {
    const savedFavorites = localStorage.getItem('chineseSlangFavorites');
    if (savedFavorites) {
      try {
        const parsedFavorites = JSON.parse(savedFavorites) as number[];
        setFavorites(new Set(parsedFavorites));
      } catch (error) {
        console.error('즐겨찾기 로드 오류:', error);
      }
    }

    const savedProgress = localStorage.getItem('sentenceProgress');
    if (savedProgress) {
      try {
        const parsedProgress = JSON.parse(savedProgress) as number[];
        setSentenceProgress(new Set(parsedProgress));
      } catch (error) {
        console.error('문장 진도 로드 오류:', error);
      }
    }
  }, []);

  // 문장 학습 완료 표시
  const markSentenceCompleted = (sentenceId: number) => {
    const newProgress = new Set(sentenceProgress);
    newProgress.add(sentenceId);
    setSentenceProgress(newProgress);
    localStorage.setItem('sentenceProgress', JSON.stringify(Array.from(newProgress)));
  };

  // 현재 단어
  const currentWord = filteredWords[currentWordIndex];

  // 다음/이전 단어
  const nextWord = (): void => {
    setCurrentWordIndex((prev) => 
      prev < filteredWords.length - 1 ? prev + 1 : 0
    );
    setShowMeaning(false);
  };

  const prevWord = (): void => {
    setCurrentWordIndex((prev) => 
      prev > 0 ? prev - 1 : filteredWords.length - 1
    );
    setShowMeaning(false);
  };

  // 단어 클릭 시 상세 보기
  const handleWordClick = async (word: SlangWord): Promise<void> => {
    setSelectedWord(word);
    await loadSentences(word.id);
  };

  // TTS 기능 (브라우저 지원)
  const speakChinese = (text: string): void => {
    if ('speechSynthesis' in window) {
      // 기존 음성 중지
      speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      
      // 여러 중국어 언어 코드 시도
      const chineseLanguages = ['zh-CN', 'zh-TW', 'zh-HK', 'cmn-Hans-CN', 'cmn-Hant-TW'];
      
      const voices = speechSynthesis.getVoices();
      let selectedVoice = null;
      
      // 중국어 음성 찾기 (여러 조건으로)
      for (const lang of chineseLanguages) {
        selectedVoice = voices.find(voice => voice.lang === lang);
        if (selectedVoice) break;
      }
      
      // 이름으로 중국어 음성 찾기
      if (!selectedVoice) {
        selectedVoice = voices.find(voice => 
          voice.name.toLowerCase().includes('chinese') ||
          voice.name.toLowerCase().includes('mandarin') ||
          voice.name.toLowerCase().includes('cantonese')
        );
      }
      
      if (selectedVoice) {
        utterance.voice = selectedVoice;
        utterance.lang = selectedVoice.lang;
      } else {
        utterance.lang = 'zh-CN';
      }
      
      utterance.rate = 0.8;
      utterance.volume = 1;
      utterance.pitch = 1;
      
      // 성공/실패 처리
      utterance.onstart = () => {
        console.log('TTS 시작:', text);
      };
      
      utterance.onerror = (event) => {
        console.warn('TTS 오류:', event);
        if (event.error === 'not-allowed') {
          alert('음성 권한이 필요합니다. 브라우저 설정에서 음성 권한을 허용해주세요.');
        } else {
          alert(`음성 재생 실패: Edge 브라우저에서 시도해보세요.`);
        }
      };
      
      utterance.onend = () => {
        console.log('TTS 완료');
      };
      
      try {
        speechSynthesis.speak(utterance);
      } catch (error) {
        console.error('TTS 실행 오류:', error);
        alert('음성 기능을 사용할 수 없습니다. Microsoft Edge 브라우저를 사용해주세요.');
      }
    } else {
      alert('이 브라우저는 음성 기능을 지원하지 않습니다.');
    }
  };

  // 모달 닫기 이벤트 핸들러
  const handleModalClose = (e: React.MouseEvent): void => {
    e.stopPropagation();
    setSelectedWord(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
      
      {/* 헤더 */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <BookOpen className="w-8 h-8 text-purple-600" />
              <h1 className="text-2xl font-bold text-gray-800">중국어 신조어 사전</h1>
              <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                {studyMode === 'sentence' ? filteredSentences.length : filteredWords.length}개 
                {studyMode === 'sentence' ? '문장' : '단어'}
              </span>
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={() => setStudyMode('browse')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  studyMode === 'browse'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                둘러보기
              </button>
              <button
                onClick={() => setStudyMode('study')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  studyMode === 'study'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                단어학습
              </button>
              <button
                onClick={() => setStudyMode('sentence')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  studyMode === 'sentence'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                문장연습
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* 검색 및 필터 */}
        <div className="mb-6 space-y-4">
          {/* 검색바 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder={studyMode === 'sentence' ? '문장, 단어로 검색...' : '단어, 병음, 의미로 검색...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
            />
          </div>

          {/* 카테고리 필터 */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Filter className="w-4 h-4" />
              <span>전체</span>
            </button>
            
            {categories.map((category) => {
              const IconComponent = categoryIcons[category.icon] || Users;
              const colorClass = categoryColors[category.name_en] || 'bg-gray-500';
              return (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.name_en)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                    selectedCategory === category.name_en
                      ? `${colorClass} text-white`
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <IconComponent className="w-4 h-4" />
                  <span>{category.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 음성 기능 안내 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start space-x-3">
            <Volume2 className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">🔊 음성 기능 안내</p>
              <p>중국어 발음은 <strong>Microsoft Edge 브라우저</strong>에서 가장 잘 작동합니다. 
              Chrome이나 Safari에서는 음성이 나오지 않을 수 있어요.</p>
              {!voiceSupported && (
                <p className="mt-1 text-orange-600">
                  ⚠️ 현재 브라우저에서는 중국어 음성을 지원하지 않습니다.
                </p>
              )}
            </div>
          </div>
        </div>

        {studyMode === 'browse' ? (
          /* 단어 그리드 뷰 */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredWords.map((word) => {
              const IconComponent = categoryIcons[word.categories.icon] || Users;
              const colorClass = categoryColors[word.categories.name_en] || 'bg-gray-500';
              return (
                <div
                  key={word.id}
                  onClick={() => handleWordClick(word)}
                  className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className={`flex items-center space-x-2 px-3 py-1 rounded-lg ${colorClass}`}>
                      <IconComponent className="w-4 h-4 text-white" />
                      <span className="text-white text-sm">{word.categories.name}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(word.id);
                      }}
                      className={`p-1 rounded transition-colors ${
                        favorites.has(word.id)
                          ? 'text-red-500'
                          : 'text-gray-400 hover:text-red-500'
                      }`}
                    >
                      <Heart className={`w-5 h-5 ${favorites.has(word.id) ? 'fill-current' : ''}`} />
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <h3 className="text-2xl font-bold text-gray-800">{word.word}</h3>
                      {voiceSupported ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            speakChinese(word.word);
                          }}
                          className="p-1 text-gray-400 hover:text-purple-600 transition-colors"
                          title="발음 듣기"
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400 ml-2" title="이 브라우저에서는 중국어 음성을 지원하지 않습니다">
                          🔇
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600">{word.pinyin}</p>
                    <p className="text-gray-800 font-medium">{word.meaning}</p>
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <span>{word.year}년 {word.month}월</span>
                      <div className="flex items-center space-x-1">
                        <Star className="w-4 h-4 text-yellow-500 fill-current" />
                        <span>{word.popularity_score}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : studyMode === 'study' ? (
          /* 단어 학습 모드 */
          currentWord && (
            <div className="max-w-2xl mx-auto">
              <div className="bg-white rounded-2xl p-8 shadow-lg">
                {/* 진행률 */}
                <div className="mb-6">
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>{currentWordIndex + 1} / {filteredWords.length}</span>
                    <span>{Math.round(((currentWordIndex + 1) / filteredWords.length) * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-purple-600 h-2 rounded-full transition-all"
                      style={{ width: `${((currentWordIndex + 1) / filteredWords.length) * 100}%` }}
                    ></div>
                  </div>
                </div>

                {/* 카테고리 */}
                <div className="flex items-center justify-between mb-6">
                  <div className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${categoryColors[currentWord.categories.name_en] || 'bg-gray-500'}`}>
                    {React.createElement(categoryIcons[currentWord.categories.icon] || Users, {
                      className: "w-5 h-5 text-white"
                    })}
                    <span className="text-white">{currentWord.categories.name}</span>
                  </div>
                  <button
                    onClick={() => toggleFavorite(currentWord.id)}
                    className={`p-2 rounded-lg transition-colors ${
                      favorites.has(currentWord.id)
                        ? 'text-red-500 bg-red-50'
                        : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                    }`}
                  >
                    <Heart className={`w-6 h-6 ${favorites.has(currentWord.id) ? 'fill-current' : ''}`} />
                  </button>
                </div>

                {/* 단어 */}
                <div className="text-center space-y-4 mb-8">
                  <div className="flex items-center justify-center space-x-3">
                    <h2 className="text-6xl font-bold text-gray-800">{currentWord.word}</h2>
                    {voiceSupported && (
                      <button
                        onClick={() => speakChinese(currentWord.word)}
                        className="p-3 bg-purple-100 text-purple-600 rounded-full hover:bg-purple-200 transition-colors"
                        title="발음 듣기"
                      >
                        <Volume2 className="w-6 h-6" />
                      </button>
                    )}
                  </div>
                  <p className="text-2xl text-gray-600">{currentWord.pinyin}</p>
                  {!voiceSupported && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-2">
                      <p className="text-sm text-yellow-800">
                        💡 <strong>발음 팁:</strong> {currentWord.pinyin} 
                        {currentWord.word === '硬控' && ' → "잉콩"'}
                        {currentWord.word === 'yyds' && ' → "용위안더션"'}
                        {currentWord.word === '破防' && ' → "뽀팡"'}
                        {currentWord.word === 'city不city' && ' → "시티 부 시티"'}
                        {currentWord.word === '996' && ' → "지우지우리우"'}
                        {currentWord.word === '社恐' && ' → "셔콩"'}
                        {currentWord.word === '韭菜' && ' → "지우차이"'}
                      </p>
                    </div>
                  )}
                  
                  {showMeaning ? (
                    <div className="space-y-4 animate-fadeIn">
                      <p className="text-xl text-gray-800 font-medium">{currentWord.meaning}</p>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-gray-700 leading-relaxed">{currentWord.background}</p>
                      </div>
                      <div className="flex items-center justify-center space-x-4 text-sm text-gray-500">
                        <span>{currentWord.year}년 {currentWord.month}월 등장</span>
                        <div className="flex items-center space-x-1">
                          <Star className="w-4 h-4 text-yellow-500 fill-current" />
                          <span>인기도 {currentWord.popularity_score}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowMeaning(true)}
                      className="bg-purple-600 text-white px-8 py-3 rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      의미 보기
                    </button>
                  )}
                </div>

                {/* 네비게이션 */}
                <div className="flex justify-between items-center">
                  <button
                    onClick={prevWord}
                    className="flex items-center space-x-2 px-6 py-3 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                    <span>이전</span>
                  </button>

                  <button
                    onClick={() => setShowMeaning(false)}
                    className="p-3 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <RotateCcw className="w-5 h-5" />
                  </button>

                  <button
                    onClick={nextWord}
                    className="flex items-center space-x-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    <span>다음</span>
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          )
        ) : studyMode === 'sentence' ? (
          /* 문장 연습 모드 */
          filteredSentences.length > 0 && (
            <div className="max-w-4xl mx-auto">
              <div className="bg-white rounded-2xl p-8 shadow-lg">
                {/* 문장 연습 헤더 */}
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-gray-800">문장 연습</h2>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setSentenceMode('cn-to-kr')}
                        className={`px-4 py-2 rounded-lg transition-colors ${
                          sentenceMode === 'cn-to-kr'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        중→한
                      </button>
                      <button
                        onClick={() => setSentenceMode('kr-to-cn')}
                        className={`px-4 py-2 rounded-lg transition-colors ${
                          sentenceMode === 'kr-to-cn'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        한→중
                      </button>
                    </div>
                  </div>
                  
                  {/* 진행률 */}
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>{currentSentenceIndex + 1} / {filteredSentences.length}</span>
                    <span>완료: {sentenceProgress.size}개 ({Math.round((sentenceProgress.size / filteredSentences.length) * 100)}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${((currentSentenceIndex + 1) / filteredSentences.length) * 100}%` }}
                    ></div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
                    <div
                      className="bg-green-500 h-1 rounded-full transition-all"
                      style={{ width: `${(sentenceProgress.size / filteredSentences.length) * 100}%` }}
                    ></div>
                  </div>
                </div>

                {/* 문장 카드 */}
                {filteredSentences[currentSentenceIndex] && (
                  <div className="space-y-6">
                    {/* 출제 문장 */}
                    <div className="bg-gray-50 rounded-lg p-6">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-gray-600">
                          {sentenceMode === 'cn-to-kr' ? '중국어를 한국어로 번역하세요' : '한국어를 중국어로 번역하세요'}
                        </span>
                        {voiceSupported && sentenceMode === 'cn-to-kr' && (
                          <button
                            onClick={() => speakChinese(filteredSentences[currentSentenceIndex].chinese_text)}
                            className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                            title="발음 듣기"
                          >
                            <Volume2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                      <p className="text-2xl font-medium text-gray-800">
                        {sentenceMode === 'cn-to-kr' 
                          ? filteredSentences[currentSentenceIndex].chinese_text
                          : filteredSentences[currentSentenceIndex].korean_translation
                        }
                      </p>
                    </div>

                    {/* 답안 입력 */}
                    <div className="space-y-4">
                      <label className="block text-sm font-medium text-gray-700">
                        {sentenceMode === 'cn-to-kr' ? '한국어 번역:' : '중국어 번역:'}
                      </label>
                      <textarea
                        value={userAnswer}
                        onChange={(e) => setUserAnswer(e.target.value)}
                        placeholder={sentenceMode === 'cn-to-kr' ? '한국어로 번역해보세요...' : '중국어로 번역해보세요...'}
                        className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        rows={3}
                        disabled={showAnswer}
                      />
                    </div>

                    {/* 정답 및 해설 */}
                    {showAnswer && (
                      <div className="space-y-4">
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <h4 className="font-medium text-green-800 mb-2">✅ 정답</h4>
                          <p className="text-green-700">
                            {sentenceMode === 'cn-to-kr' 
                              ? filteredSentences[currentSentenceIndex].korean_translation
                              : filteredSentences[currentSentenceIndex].chinese_text
                            }
                          </p>
                        </div>

                        {/* 문법 설명 */}
                        {filteredSentences[currentSentenceIndex].grammar_notes && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-medium text-blue-800">📚 문법 포인트</h4>
                              <button
                                onClick={() => setShowGrammar(!showGrammar)}
                                className="text-blue-600 hover:text-blue-700 text-sm"
                              >
                                {showGrammar ? '숨기기' : '보기'}
                              </button>
                            </div>
                            {showGrammar && (
                              <p className="text-blue-700 text-sm leading-relaxed">
                                {filteredSentences[currentSentenceIndex].grammar_notes}
                              </p>
                            )}
                          </div>
                        )}

                        {/* 관련 단어 정보 */}
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                          <h4 className="font-medium text-purple-800 mb-2">💡 관련 단어</h4>
                          <p className="text-purple-700">
                            <span className="font-medium">{filteredSentences[currentSentenceIndex].slang_words?.word}</span> - 
                            <span className="ml-1">{filteredSentences[currentSentenceIndex].slang_words?.meaning}</span>
                          </p>
                        </div>
                      </div>
                    )}

                    {/* 컨트롤 버튼 */}
                    <div className="flex justify-between items-center pt-4">
                      <button
                        onClick={() => {
                          const newIndex = currentSentenceIndex > 0 ? currentSentenceIndex - 1 : filteredSentences.length - 1;
                          setCurrentSentenceIndex(newIndex);
                          setUserAnswer('');
                          setShowAnswer(false);
                          setShowGrammar(false);
                        }}
                        className="flex items-center space-x-2 px-6 py-3 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        <ChevronLeft className="w-5 h-5" />
                        <span>이전</span>
                      </button>

                      <div className="flex space-x-3">
                        {!showAnswer ? (
                          <button
                            onClick={() => setShowAnswer(true)}
                            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            disabled={!userAnswer.trim()}
                          >
                            정답 확인
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => {
                                setShowAnswer(false);
                                setShowGrammar(false);
                                setUserAnswer('');
                              }}
                              className="px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                            >
                              다시 시도
                            </button>
                            <button
                              onClick={() => {
                                markSentenceCompleted(filteredSentences[currentSentenceIndex].id);
                                const newIndex = currentSentenceIndex < filteredSentences.length - 1 ? currentSentenceIndex + 1 : 0;
                                setCurrentSentenceIndex(newIndex);
                                setUserAnswer('');
                                setShowAnswer(false);
                                setShowGrammar(false);
                              }}
                              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                            >
                              다음 문장
                            </button>
                          </>
                        )}
                      </div>

                      <button
                        onClick={() => {
                          const newIndex = currentSentenceIndex < filteredSentences.length - 1 ? currentSentenceIndex + 1 : 0;
                          setCurrentSentenceIndex(newIndex);
                          setUserAnswer('');
                          setShowAnswer(false);
                          setShowGrammar(false);
                        }}
                        className="flex items-center space-x-2 px-6 py-3 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        <span>건너뛰기</span>
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        ) : null}

        {/* 단어 상세 모달 */}
        {selectedWord && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center space-x-3">
                    <h2 className="text-3xl font-bold text-gray-800">{selectedWord.word}</h2>
                    {voiceSupported && (
                      <button
                        onClick={() => speakChinese(selectedWord.word)}
                        className="p-2 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-200 transition-colors"
                        title="발음 듣기"
                      >
                        <Volume2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                  <button
                    onClick={handleModalClose}
                    className="text-gray-400 hover:text-gray-600 text-2xl leading-none transition-colors"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-4">
                  <p className="text-xl text-gray-600">{selectedWord.pinyin}</p>
                  <p className="text-lg font-medium text-gray-800">{selectedWord.meaning}</p>
                  
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-800 mb-2">배경</h4>
                    <p className="text-gray-700 leading-relaxed">{selectedWord.background}</p>
                  </div>

                  {sentences.length > 0 && (
                    <div className="bg-blue-50 rounded-lg p-4">
                      <h4 className="font-medium text-gray-800 mb-3">예문</h4>
                      <div className="space-y-3">
                        {sentences.map((sentence) => (
                          <div key={sentence.id} className="border-l-4 border-blue-400 pl-4">
                            <div className="flex items-start space-x-2">
                              <div className="flex-1">
                                <p className="text-gray-800 mb-1">{sentence.chinese_text}</p>
                                <p className="text-gray-600 text-sm">{sentence.korean_translation}</p>
                              </div>
                              {voiceSupported && (
                                <button
                                  onClick={() => speakChinese(sentence.chinese_text)}
                                  className="p-1.5 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors flex-shrink-0 mt-0.5"
                                  title="예문 듣기"
                                >
                                  <Volume2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-sm text-gray-500 pt-4 border-t">
                    <span>{selectedWord.year}년 {selectedWord.month}월</span>
                    <div className="flex items-center space-x-1">
                      <Star className="w-4 h-4 text-yellow-500 fill-current" />
                      <span>인기도 {selectedWord.popularity_score}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 검색 결과 없음 */}
        {((studyMode === 'sentence' && filteredSentences.length === 0) || 
          (studyMode !== 'sentence' && filteredWords.length === 0)) && !loading && (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <Search className="w-16 h-16 mx-auto" />
            </div>
            <h3 className="text-xl font-medium text-gray-600 mb-2">검색 결과가 없습니다</h3>
            <p className="text-gray-500">다른 검색어나 카테고리를 시도해보세요.</p>
          </div>
        )}
      </div>
    </div>
  );
}
