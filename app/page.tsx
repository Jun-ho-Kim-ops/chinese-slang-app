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
}

type StudyMode = 'browse' | 'study' | 'quiz';

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
  const [sentences, setSentences] = useState<Sentence[]>([]);

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

  // 검색 및 필터링
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

  // 로컬스토리지에서 즐겨찾기 로드
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
  }, []);

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
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = 0.8;
      speechSynthesis.speak(utterance);
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
      {/* 헤더 */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <BookOpen className="w-8 h-8 text-purple-600" />
              <h1 className="text-2xl font-bold text-gray-800">중국어 신조어 사전</h1>
              <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                {filteredWords.length}개 단어
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
                학습모드
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
              placeholder="단어, 병음, 의미로 검색..."
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
              return (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.name_en)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                    selectedCategory === category.name_en
                      ? `${category.color} text-white`
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
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          speakChinese(word.word);
                        }}
                        className="p-1 text-gray-400 hover:text-purple-600 transition-colors"
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
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
        ) : (
          /* 학습 모드 */
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
                    <button
                      onClick={() => speakChinese(currentWord.word)}
                      className="p-3 bg-purple-100 text-purple-600 rounded-full hover:bg-purple-200 transition-colors"
                    >
                      <Volume2 className="w-6 h-6" />
                    </button>
                  </div>
                  <p className="text-2xl text-gray-600">{currentWord.pinyin}</p>
                  
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
        )}

        {/* 단어 상세 모달 */}
        {selectedWord && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center space-x-3">
                    <h2 className="text-3xl font-bold text-gray-800">{selectedWord.word}</h2>
                    <button
                      onClick={() => speakChinese(selectedWord.word)}
                      className="p-2 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-200 transition-colors"
                    >
                      <Volume2 className="w-5 h-5" />
                    </button>
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
                              <button
                                onClick={() => speakChinese(sentence.chinese_text)}
                                className="p-1.5 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors flex-shrink-0 mt-0.5"
                                title="예문 듣기"
                              >
                                <Volume2 className="w-4 h-4" />
                              </button>
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

        {filteredWords.length === 0 && !loading && (
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