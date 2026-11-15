export type PollTemplateId = 'food' | 'schedule' | 'hobby' | 'balance' | 'leader';

export interface PollTemplateChoice {
  title: string;
  party: string;
  subtitle: string;
}

export interface PollTemplatePreset {
  id: PollTemplateId;
  badge: string;
  label: string;
  pollTitle: string;
  pollDescription: string;
  choices: PollTemplateChoice[];
}

export const POLL_TEMPLATES: PollTemplatePreset[] = [
  {
    id: 'food',
    badge: '🍽️',
    label: '점심·회식 메뉴',
    pollTitle: '오늘 우리 팀 점심·회식 메뉴 대결',
    pollDescription: '모두가 만족할 최고의 한 끼를 민주적으로 결정합니다!',
    choices: [
      {
        title: '직화 숙성 삼겹살',
        party: '육즙폭발당',
        subtitle: '겉바속촉 불맛과 쌈 채소의 완벽한 조화',
      },
      {
        title: '얼큰 차돌 짬뽕',
        party: '얼큰한국물당',
        subtitle: '진한 불향 국물로 스트레스 한 방에 해소',
      },
      {
        title: '연어 아보카도 포케',
        party: '호불호제로당',
        subtitle: '오후 업무까지 가볍고 든든한 클린 식단',
      },
    ],
  },
  {
    id: 'schedule',
    badge: '📅',
    label: '모임 일정·장소',
    pollTitle: '이번 주 모임 최적 일정 · 장소 투표',
    pollDescription: '가장 많은 분들이 편하게 모일 수 있는 시간과 장소를 뽑아주세요.',
    choices: [
      {
        title: '금요일 저녁 7시 강남역',
        party: '불금사수당',
        subtitle: '한 주의 마무리를 접근성 좋은 핫플에서 신나게!',
      },
      {
        title: '토요일 오후 2시 성수동',
        party: '주말사수당',
        subtitle: '여유로운 주말 낮, 감성 카페와 맛집 탐방',
      },
      {
        title: '평일 점심 근처 식당·카페',
        party: '칼퇴보장당',
        subtitle: '저녁 개인 시간을 온전히 지키는 실속 모임',
      },
    ],
  },
  {
    id: 'hobby',
    badge: '📚',
    label: '독서·영화·취미',
    pollTitle: '이번 달 함께 즐길 문화 · 취미 선정',
    pollDescription: '다 같이 읽고 보고 경험할 이달의 베스트 콘텐츠를 투표합니다.',
    choices: [
      {
        title: '몰입감 넘치는 추리·스릴러',
        party: '몰입보장당',
        subtitle: '한 번 시작하면 시간 순삭되는 강렬한 전개',
      },
      {
        title: '마음 따뜻한 힐링 에세이·영화',
        party: '감성충전당',
        subtitle: '지친 일상에 잔잔한 여운과 위로를 선물',
      },
      {
        title: '요즘 핫한 화제의 베스트셀러',
        party: '트렌드선도당',
        subtitle: '모두가 이야기하는 대세 작품을 함께 정복',
      },
    ],
  },
  {
    id: 'balance',
    badge: '⚖️',
    label: '찬반·밸런스',
    pollTitle: '우리 팀 핵심 안건 찬반 · 밸런스 투표',
    pollDescription: '모두의 의견을 공정하게 수렴해 가장 합리적인 방향을 선택합니다.',
    choices: [
      {
        title: '적극 찬성 · 바로 추진',
        party: '적극추진당',
        subtitle: '망설임 없이 실행해 빠른 변화와 성과 창출',
      },
      {
        title: '신중 반대 · 현행 유지',
        party: '신중안정당',
        subtitle: '검증된 안정성과 기존 운영 효율을 최우선',
      },
      {
        title: '절충안 · 2주 시범 운영',
        party: '합리절충당',
        subtitle: '단기 테스트 후 장단점을 확인해 최종 확정',
      },
    ],
  },
  {
    id: 'leader',
    badge: '🏫',
    label: '임원·대표 선출',
    pollTitle: '우리 모임 대표 · 반장 선출 투표',
    pollDescription: '책임감 있고 소통 잘하는 우리의 대표를 공정하게 뽑아주세요.',
    choices: [
      {
        title: '든든한 추진력 리더 후보',
        party: '든든한일꾼당',
        subtitle: '약속한 공약은 끝까지 책임지고 완수하겠습니다',
      },
      {
        title: '다정하고 유쾌한 소통 후보',
        party: '소통왕당',
        subtitle: '작은 의견도 경청하고 즐거운 분위기를 만듭니다',
      },
      {
        title: '아이디어 뱅크 기획 후보',
        party: '창의혁신당',
        subtitle: '모임이 매번 기대되는 참신한 기획을 약속합니다',
      },
    ],
  },
];

interface KeywordRule {
  keywords: string[];
  parties: string[];
  slogans: string[];
}

const KEYWORD_RULES: KeywordRule[] = [
  {
    keywords: [
      '고기',
      '삼겹',
      '목살',
      '소고기',
      '한우',
      '갈비',
      '스테이크',
      '돈가스',
      '돈까스',
      '치킨',
      '닭',
      '족발',
      '보쌈',
      '버거',
      '곱창',
      '막창',
      '양꼬치',
    ],
    parties: ['육즙폭발당', '고기사랑당', '단백질충전당', '불판수호당', '호불호제로당'],
    slogans: [
      '입안 가득 터지는 육즙으로 오늘의 피로를 단번에 녹여드립니다!',
      '고기는 언제나 옳다! 모두가 환호하는 실패 없는 메인 픽',
      '든든한 단백질 충전으로 오후 에너지까지 완벽하게 책임집니다',
    ],
  },
  {
    keywords: [
      '찌개',
      '국밥',
      '탕',
      '전골',
      '짬뽕',
      '마라',
      '라면',
      '우동',
      '쌀국수',
      '칼국수',
      '순두부',
      '부대',
      '김치',
      '된장',
      '매운',
      '떡볶이',
    ],
    parties: ['얼큰한국물당', '국물끝판당', '해장완벽당', '따끈소울당', '호불호제로당'],
    slogans: [
      '진하고 뜨끈한 국물 한 숟가락으로 속까지 든든하게 채워드립니다!',
      '한국인의 소울푸드! 한 번 맛보면 멈출 수 없는 깊은 풍미',
      '얼큰하고 개운한 맛으로 스트레스와 피로를 깔끔히 날려줍니다',
    ],
  },
  {
    keywords: [
      '초밥',
      '스시',
      '회',
      '연어',
      '포케',
      '샐러드',
      '파스타',
      '피자',
      '리조또',
      '브런치',
      '샌드위치',
      '타코',
      '덮밥',
    ],
    parties: ['신선미식당', '가볍고든든당', '호불호제로당', '취향저격당', '감성한접시당'],
    slogans: [
      '신선한 재료와 산뜻한 밸런스로 부담 없이 즐기는 완벽한 한 끼!',
      '비주얼도 맛도 만점! 깔끔하게 기분 전환하기 좋은 메뉴',
      '속 편하고 든든하게, 모두가 만족하는 세련된 식사 선택',
    ],
  },
  {
    keywords: [
      '커피',
      '카페',
      '아아',
      '라떼',
      '디저트',
      '케이크',
      '빵',
      '베이커리',
      '빙수',
      '아이스크림',
      '티',
      '차',
      '음료',
      '와플',
    ],
    parties: ['카페인충전당', '당충전완료당', '달콤한휴식당', '분위기맛집당', '여유만끽당'],
    slogans: [
      '향긋한 한 잔과 달콤한 여유로 완벽한 리프레시 타임을 선물합니다!',
      '당 충전 100%! 나른한 오후에 활력과 미소를 되찾아드립니다',
      '대화도 휴식도 술술 풀리는 최고의 감성 충전 타임',
    ],
  },
  {
    keywords: [
      '토요일',
      '일요일',
      '주말',
      '금요일',
      '불금',
      '저녁',
      '밤',
      '강남',
      '성수',
      '홍대',
      '을지로',
      '잠실',
      '여의도',
      '판교',
      '역',
    ],
    parties: ['주말사수당', '불금사수당', '접근성최고당', '황금시간당', '모임대성공당'],
    slogans: [
      '모두의 이동 동선과 컨디션을 세심하게 배려한 최적의 일정·장소!',
      '참석률 100% 도전! 부담 없이 모여 즐겁게 소통할 수 있는 베스트 픽',
      '접근성과 분위기를 모두 잡아 모임 만족도를 최고로 끌어올립니다',
    ],
  },
  {
    keywords: [
      '평일',
      '월요일',
      '화요일',
      '수요일',
      '목요일',
      '점심',
      '오전',
      '아침',
      '칼퇴',
      '온라인',
      '줌',
      '비대면',
      '재택',
    ],
    parties: ['칼퇴보장당', '실속일정당', '부담제로당', '워라밸사수당', '효율최고당'],
    slogans: [
      '개인 저녁 시간은 온전히 지키면서 알차게 모이는 실속 선택!',
      '이동 부담은 줄이고 참여 효율은 높이는 스마트한 일정입니다',
      '일과 휴식의 균형을 지켜주는 모두가 반기는 합리적 시간대',
    ],
  },
  {
    keywords: [
      '독서',
      '책',
      '소설',
      '에세이',
      '추리',
      '영화',
      '드라마',
      '넷플',
      '전시',
      '공연',
      '게임',
      '보드게임',
      '러닝',
      '등산',
      '캠핑',
      '여행',
    ],
    parties: ['몰입보장당', '감성충전당', '꿀잼보장당', '취향저격당', '트렌드선도당'],
    slogans: [
      '함께 보고 느끼고 이야기 나눌수록 재미가 배가 되는 몰입 경험!',
      '지루할 틈 없는 전개와 깊은 여운으로 모임 분위기를 확 살립니다',
      '입문자부터 마니아까지 누구나 즐겁게 공감할 수 있는 추천 콘텐츠',
    ],
  },
  {
    keywords: ['찬성', '추진', '도입', '시행', '시작', '찬', '좋아', '동의', '진행', '확대'],
    parties: ['적극추진당', '즉시실행당', '변화선도당', '신속결정당', '미래도약당'],
    slogans: [
      '더 나은 변화와 발전을 위해 지금 바로 과감하게 실행합시다!',
      '구성원의 공감을 바탕으로 긍정적 변화를 만들어가는 선택입니다',
      '망설임보다 행동으로! 확실한 추진력으로 기대에 보답합니다',
    ],
  },
  {
    keywords: ['반대', '유지', '보류', '기존', '절충', '시범', '테스트', '신중', '연기', '축소'],
    parties: ['신중안정당', '합리절충당', '검증우선당', '균형수호당', '현실대안당'],
    slogans: [
      '충분한 검토와 검증을 우선시하는 가장 현실적이고 안전한 대안!',
      '무리한 변화보다 안정적인 운영과 균형을 지켜내는 현명한 판단',
      '장단점을 꼼꼼히 따져 모두의 부담과 리스크를 최소화합니다',
    ],
  },
  {
    keywords: [
      '대표',
      '반장',
      '회장',
      '총무',
      '팀장',
      '리더',
      '임원',
      '후보',
      '소통',
      '기획',
      '일꾼',
      '봉사',
    ],
    parties: ['소통왕당', '든든한일꾼당', '책임완수당', '창의혁신당', '원팀화합당'],
    slogans: [
      '작은 목소리도 놓치지 않고 끝까지 책임감 있게 챙기겠습니다!',
      '유쾌하고 투명한 소통으로 모두가 참여하고 싶은 모임을 만듭니다',
      '말보다 실천으로! 믿고 맡길 수 있는 든든한 대표가 되겠습니다',
    ],
  },
];

const TEMPLATE_FALLBACK_POOLS: Record<
  PollTemplateId | 'default',
  { parties: string[]; slogans: string[] }
> = {
  food: {
    parties: ['육즙폭발당', '얼큰한국물당', '호불호제로당', '가성비최고당', '행복한끼당'],
    slogans: [
      '모두의 입맛을 사로잡는 실패 없는 오늘의 강력 추천 메뉴!',
      '맛과 가성비를 모두 잡은 든든하고 만족스러운 한 끼 선택',
      '먹고 나면 기분까지 좋아지는 우리 팀 최고의 미식 픽',
    ],
  },
  schedule: {
    parties: ['칼퇴보장당', '주말사수당', '황금일정당', '접근성최고당', '만장일치당'],
    slogans: [
      '모두가 가장 편하게 참석해 즐겁게 어울릴 수 있는 베스트 일정!',
      '시간 부담과 이동 피로를 모두 낮춘 센스 있는 모임 약속',
      '참석률과 만족도를 동시에 잡는 최적의 타이밍과 장소',
    ],
  },
  hobby: {
    parties: ['몰입보장당', '감성충전당', '트렌드선도당', '꿀잼보장당', '취향저격당'],
    slogans: [
      '함께 즐기면 즐거움이 두 배가 되는 이번 달 강력 추천 PICK!',
      '일상의 피로를 씻어주고 신선한 영감을 주는 최고의 문화 경험',
      '모임 후 수다 꽃이 피어날 수 있는 매력 만점 콘텐츠',
    ],
  },
  balance: {
    parties: ['적극추진당', '합리절충당', '신중안정당', '소신투표당', '균형감각당'],
    slogans: [
      '우리 모임에 가장 실질적인 도움이 되는 균형 잡힌 합리적 대안!',
      '장단점을 꼼꼼히 따져 내린 모두가 납득할 수 있는 최선의 선택',
      '현재 상황과 미래 효율을 모두 고려한 현명한 의사결정',
    ],
  },
  leader: {
    parties: ['소통왕당', '든든한일꾼당', '책임완수당', '창의혁신당', '신뢰가득당'],
    slogans: [
      '구성원 한 분 한 분의 의견을 경청하고 끝까지 책임지겠습니다!',
      '활기차고 화목한 분위기를 이끌어갈 준비된 소통형 리더',
      '약속한 일은 반드시 해내는 믿음직한 우리의 대표 후보',
    ],
  },
  default: {
    parties: ['호불호제로당', '소통왕당', '칼퇴보장당', '몰입보장당', '만장일치당'],
    slogans: [
      '누구나 고개를 끄덕일 수 있는 가장 합리적이고 매력적인 선택!',
      '모두의 만족도를 높여줄 센스 있고 실속 있는 강력 추천안',
      '고민을 끝내고 즐거움을 시작하게 해줄 오늘의 베스트 픽',
    ],
  },
};

function findMatchedRule(title: string): KeywordRule | null {
  const normalized = title.trim().toLowerCase();
  if (!normalized) return null;

  for (const rule of KEYWORD_RULES) {
    if (rule.keywords.some((kw) => normalized.includes(kw))) {
      return rule;
    }
  }
  return null;
}

/**
 * Returns 4~5 witty recommended party name chips based on candidate name & template category
 */
export function getPartySuggestionsForCandidate(
  title: string,
  templateId: PollTemplateId | null,
  candidateIndex: number = 0
): string[] {
  const matched = findMatchedRule(title);
  const templatePool = TEMPLATE_FALLBACK_POOLS[templateId || 'default'];

  const combined: string[] = [];
  if (matched) {
    combined.push(...matched.parties);
  }
  for (const p of templatePool.parties) {
    if (!combined.includes(p)) {
      combined.push(p);
    }
  }
  for (const p of TEMPLATE_FALLBACK_POOLS.default.parties) {
    if (!combined.includes(p)) {
      combined.push(p);
    }
  }

  // Slightly rotate secondary fallback order per row index if no exact keyword matched
  if (!matched && combined.length > 0 && candidateIndex > 0) {
    const shift = candidateIndex % combined.length;
    const rotated = [...combined.slice(shift), ...combined.slice(0, shift)];
    return rotated.slice(0, 5);
  }

  return combined.slice(0, 5);
}

/**
 * Generates a smart witty party name + 1-line slogan for a candidate
 */
export function generateSmartPartyAndSlogan(
  title: string,
  templateId: PollTemplateId | null,
  candidateIndex: number = 0,
  variation: number = 0
): { party: string; slogan: string } {
  const matched = findMatchedRule(title);
  const templatePool = TEMPLATE_FALLBACK_POOLS[templateId || 'default'];

  const partyPool = matched ? matched.parties : templatePool.parties;
  const sloganPool = matched ? matched.slogans : templatePool.slogans;

  const party = partyPool[(candidateIndex + variation) % partyPool.length];
  const baseSlogan = sloganPool[(candidateIndex + variation) % sloganPool.length];

  const cleanTitle = title.trim();
  const isGenericTitle =
    !cleanTitle || /^선택지\s*\d+$/i.test(cleanTitle) || /^후보\s*\d+$/i.test(cleanTitle);

  if (!isGenericTitle && variation % 2 === 1 && !baseSlogan.includes(cleanTitle)) {
    return {
      party,
      slogan: `'${cleanTitle}' — ${baseSlogan}`,
    };
  }

  return {
    party,
    slogan: baseSlogan,
  };
}
