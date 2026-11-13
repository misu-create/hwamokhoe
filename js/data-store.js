/**
 * 화목회 통합 데이터 저장소 (DataStore)
 * - 테스트 모드 vs 실제 운영 모드 데이터 완벽 분리
 * - LocalStorage 영구 보존 + Firebase Firestore 연동 준비
 * - 회계 잔액 자동 계산 (A안: 전체 거래 이관, B안: 기준일 시작 잔액 + 이후 거래)
 * - 과거 미납 보존 및 대상 월/실제 입금일 분리
 */

const STORAGE_KEYS = {
  CURRENT_MODE: 'hwamokhoe_mode', // 'test' | 'prod'
  TEST_DATA: 'hwamokhoe_test_db_v1',
  PROD_DATA: 'hwamokhoe_prod_db_v1',
  AUTH_STATE: 'hwamokhoe_admin_auth',
  ADMIN_LOG: 'hwamokhoe_admin_audit_log'
};

// 기본 초기 테스트 데이터 (예시 데이터 - 시연 및 검증용)
const INITIAL_TEST_DATA = {
  settings: {
    siteTitle: '화목회',
    siteSubtitle: '우리 가족의 행복한 모임',
    monthlyFee: 20000,           // 월 기본 회비 20,000원
    dueDay: 10,                 // 매월 10일 납부
    migrationType: 'B',          // 'A': 전체내역 이관, 'B': 기준일 시작잔액
    migrationBaseDate: '2026-05-01', // 회계 이관 기준일
    openingBalance: 1200000,    // 기준일 시작 잔액
    actualBankBalance: 1460000, // 실제 통장 잔액
    graceMonths: 3,             // 미납 유예기간 (3개월)
    refundRate: 0.8,            // 탈퇴 시 환급율 (80%)
    rulesUpdatedDate: '2026-01-01',
    ruleNotes: '매월 10일 20,000원 납부. 불참 회원도 기본 권리 동등 인정.'
  },
  members: [
    { id: 'm1', name: '김장남', relation: '본인', phone: '010-1234-5678', active: true, joinedAt: '2025-01-01' },
    { id: 'm2', name: '이차남', relation: '형제·자매', phone: '010-2345-6789', active: true, joinedAt: '2025-01-01' },
    { id: 'm3', name: '박삼남', relation: '형제·자매', phone: '010-3456-7890', active: true, joinedAt: '2025-01-01' },
    { id: 'm4', name: '최사촌', relation: '사촌', phone: '010-4567-8901', active: true, joinedAt: '2025-03-01' },
    { id: 'm5', name: '정배우', relation: '배우자', phone: '010-5678-9012', active: true, joinedAt: '2025-01-01' },
    { id: 'm6', name: '강가족', relation: '형제·자매', phone: '010-6789-0123', active: true, joinedAt: '2025-01-01' }
  ],
  // 월별 납부 기록 (targetMonth: 'YYYY-MM', actualPayDate: 'YYYY-MM-DD')
  feeRecords: [
    { id: 'fr_1', memberId: 'm1', targetMonth: '2026-05', amount: 20000, status: 'paid', paidAt: '2026-05-10', note: '정상납부' },
    { id: 'fr_2', memberId: 'm2', targetMonth: '2026-05', amount: 20000, status: 'paid', paidAt: '2026-05-09', note: '정상납부' },
    { id: 'fr_3', memberId: 'm3', targetMonth: '2026-05', amount: 20000, status: 'paid', paidAt: '2026-05-10', note: '정상납부' },
    { id: 'fr_4', memberId: 'm4', targetMonth: '2026-05', amount: 20000, status: 'paid', paidAt: '2026-05-11', note: '정상납부' },
    { id: 'fr_5', memberId: 'm5', targetMonth: '2026-05', amount: 20000, status: 'paid', paidAt: '2026-05-10', note: '정상납부' },
    { id: 'fr_6', memberId: 'm6', targetMonth: '2026-05', amount: 20000, status: 'paid', paidAt: '2026-05-10', note: '정상납부' },

    { id: 'fr_7', memberId: 'm1', targetMonth: '2026-06', amount: 20000, status: 'paid', paidAt: '2026-06-10', note: '정상납부' },
    { id: 'fr_8', memberId: 'm2', targetMonth: '2026-06', amount: 0, status: 'unpaid', paidAt: null, note: '미납 (보존)' },
    { id: 'fr_9', memberId: 'm3', targetMonth: '2026-06', amount: 20000, status: 'paid', paidAt: '2026-06-10', note: '정상납부' },
    { id: 'fr_10', memberId: 'm4', targetMonth: '2026-06', amount: 20000, status: 'paid', paidAt: '2026-06-08', note: '정상납부' },
    { id: 'fr_11', memberId: 'm5', targetMonth: '2026-06', amount: 20000, status: 'paid', paidAt: '2026-06-10', note: '정상납부' },
    { id: 'fr_12', memberId: 'm6', targetMonth: '2026-06', amount: 20000, status: 'paid', paidAt: '2026-06-10', note: '정상납부' },

    { id: 'fr_13', memberId: 'm1', targetMonth: '2026-10', amount: 20000, status: 'paid', paidAt: '2026-10-10', note: '정상납부' },
    { id: 'fr_14', memberId: 'm2', targetMonth: '2026-10', amount: 20000, status: 'paid', paidAt: '2026-10-10', note: '정상납부' },
    { id: 'fr_15', memberId: 'm3', targetMonth: '2026-10', amount: 20000, status: 'paid', paidAt: '2026-10-10', note: '정상납부' },
    { id: 'fr_16', memberId: 'm4', targetMonth: '2026-10', amount: 20000, status: 'paid', paidAt: '2026-10-10', note: '정상납부' },
    { id: 'fr_17', memberId: 'm5', targetMonth: '2026-10', amount: 20000, status: 'paid', paidAt: '2026-10-10', note: '정상납부' },
    { id: 'fr_18', memberId: 'm6', targetMonth: '2026-10', amount: 20000, status: 'paid', paidAt: '2026-10-10', note: '정상납부' },

    { id: 'fr_19', memberId: 'm1', targetMonth: '2026-11', amount: 20000, status: 'paid', paidAt: '2026-11-10', note: '정상납부' },
    { id: 'fr_20', memberId: 'm2', targetMonth: '2026-11', amount: 20000, status: 'paid', paidAt: '2026-11-10', note: '정상납부' },
    { id: 'fr_21', memberId: 'm3', targetMonth: '2026-11', amount: 20000, status: 'paid', paidAt: '2026-11-09', note: '정상납부' },
    { id: 'fr_22', memberId: 'm4', targetMonth: '2026-11', amount: 0, status: 'unpaid', paidAt: null, note: '미납' },
    { id: 'fr_23', memberId: 'm5', targetMonth: '2026-11', amount: 20000, status: 'paid', paidAt: '2026-11-10', note: '정상납부' },
    { id: 'fr_24', memberId: 'm6', targetMonth: '2026-11', amount: 10000, status: 'partial', paidAt: '2026-11-10', note: '일부납부 (1만원 잔여)' }
  ],
  // 회계 장부 거래 내역 (수입: income, 지출: expense)
  transactions: [
    { id: 'tx_1', date: '2026-05-10', type: 'income', category: '회비수입', desc: '5월 정기 회비 입금 (6명)', amount: 120000, relatedFeeId: 'batch_5' },
    { id: 'tx_2', date: '2026-06-10', type: 'income', category: '회비수입', desc: '6월 정기 회비 입금 (5명)', amount: 100000, relatedFeeId: 'batch_6' },
    { id: 'tx_3', date: '2026-07-15', type: 'expense', category: '모임식대', desc: '초여름 가족 모임 식대 지원', amount: 80000, relatedFeeId: null },
    { id: 'tx_4', date: '2026-10-10', type: 'income', category: '회비수입', desc: '10월 정기 회비 입금 (6명)', amount: 120000, relatedFeeId: 'batch_10' },
    { id: 'tx_5', date: '2026-10-20', type: 'expense', category: '경조사', desc: '가족 경조사 화환 및 축하금', amount: 100000, relatedFeeId: null },
    { id: 'tx_6', date: '2026-11-10', type: 'income', category: '회비수입', desc: '11월 정기 회비 입금 (5명+일부)', amount: 110000, relatedFeeId: 'batch_11' }
  ],
  // 가족 모임 및 여행 계획
  events: [
    {
      id: 'ev_1',
      title: '2026년 송년 가족 모임',
      type: 'meeting',
      date: '2026-12-19',
      time: '오후 12:30',
      location: '서울 송파구 올림픽공원 한식당 (가원)',
      address: '서울시 송파구 위례성대로 123',
      description: '한 해를 마무리하며 전 가족이 모여 즐거운 식사와 담소를 나눕니다.',
      isNext: true
    },
    {
      id: 'ev_2',
      title: '2027년 봄 제주도 가족 여행 계획',
      type: 'trip',
      date: '2027-04-10 ~ 2027-04-12 (2박 3일)',
      time: '출발 시간 추후 공지',
      location: '제주특별자치도 서귀포시 일대',
      address: '제주 서귀포 리조트',
      description: '부모님 칠순 기념 전 가족 제주도 힐링 여행 일정입니다. 세부 숙소 및 렌터카 예약 진행 중.',
      isNext: false
    }
  ],
  // 공지사항
  notices: [
    {
      id: 'nt_1',
      category: 'fee',
      categoryName: '회비안내',
      title: '11월 정기 회비 납부 안내',
      date: '2026-11-01',
      content: '화목회 가족 여러분 안녕하십니까.\n11월 정기 회비(20,000원) 납부일은 11월 10일입니다.\n가족들의 건강과 행복을 기원하며 계좌로 입금 부탁드립니다.\n(입금계좌: 카카오뱅크 3333-01-2345678 김총무)',
      pinned: true
    },
    {
      id: 'nt_2',
      category: 'meeting',
      categoryName: '모임안내',
      title: '2026년 송년 가족 모임 일시 및 장소 확정',
      date: '2026-10-25',
      content: '올해 송년 모임은 12월 19일(토) 점심 12시 30분, 올림픽공원 앞 한식당에서 진행됩니다.\n주차 공간이 여유로우니 편하게 참석해 주시기 바랍니다.',
      pinned: false
    },
    {
      id: 'nt_3',
      category: 'trip',
      categoryName: '여행안내',
      title: '2027년 봄 가족 여행 사전 수요 조사',
      date: '2026-10-15',
      content: '내년 봄 제주도 2박 3일 여행 일정을 계획하고 있습니다.\n참석 희망 가족 인원을 11월 말까지 총무에게 알려주시면 항공권 및 숙소 예약에 큰 도움이 됩니다.',
      pinned: false
    }
  ],
  // 회칙 및 변경 이력
  rulesHistory: [
    { date: '2025-01-01', content: '화목회 창립 및 월 회비 20,000원 규정 제정', author: '초대 총무' },
    { date: '2026-05-01', content: '회계 이관 기준일 설정 및 장부 전산화 시작', author: '관리자' }
  ]
};

// 초기 실제 운영 데이터 (빈 상태 시작)
const INITIAL_PROD_DATA = {
  settings: {
    siteTitle: '화목회',
    siteSubtitle: '우리 가족의 행복한 모임',
    monthlyFee: 20000,
    dueDay: 10,
    migrationType: 'B',
    migrationBaseDate: '2026-11-01',
    openingBalance: 0,
    actualBankBalance: 0,
    graceMonths: 3,
    refundRate: 0.8,
    rulesUpdatedDate: '2026-11-01',
    ruleNotes: '실제 운영 데이터 모드입니다. 회원을 등록하고 초기 잔액을 설정하세요.'
  },
  members: [],
  feeRecords: [],
  transactions: [],
  events: [],
  notices: [
    {
      id: 'nt_prod_1',
      category: 'fee',
      categoryName: '회비안내',
      title: '화목회 웹사이트 정식 오픈 안내',
      date: '2026-11-13',
      content: '화목회 가족 웹사이트가 정식 개설되었습니다.\n가족 여러분께서는 로그인 없이 언제든지 회비 현황, 장부, 모임 일정을 확인하실 수 있습니다.',
      pinned: true
    }
  ],
  rulesHistory: []
};

class HwamokhoeDataStore {
  constructor() {
    this.mode = localStorage.getItem(STORAGE_KEYS.CURRENT_MODE) || 'test';
    this.initDatabase();
  }

  // 데이터베이스 초기화
  initDatabase() {
    if (!localStorage.getItem(STORAGE_KEYS.TEST_DATA)) {
      localStorage.setItem(STORAGE_KEYS.TEST_DATA, JSON.stringify(INITIAL_TEST_DATA));
    }
    if (!localStorage.getItem(STORAGE_KEYS.PROD_DATA)) {
      localStorage.setItem(STORAGE_KEYS.PROD_DATA, JSON.stringify(INITIAL_PROD_DATA));
    }
  }

  // 현재 모드 반환 ('test' | 'prod')
  getMode() {
    return this.mode;
  }

  // 모드 전환
  setMode(mode) {
    if (mode === 'test' || mode === 'prod') {
      this.mode = mode;
      localStorage.setItem(STORAGE_KEYS.CURRENT_MODE, mode);
    }
  }

  // 현재 활성 데이터 가져오기
  getData() {
    const key = this.mode === 'prod' ? STORAGE_KEYS.PROD_DATA : STORAGE_KEYS.TEST_DATA;
    const raw = localStorage.getItem(key);
    try {
      return JSON.parse(raw) || (this.mode === 'prod' ? INITIAL_PROD_DATA : INITIAL_TEST_DATA);
    } catch (e) {
      console.error('Data parse error:', e);
      return this.mode === 'prod' ? INITIAL_PROD_DATA : INITIAL_TEST_DATA;
    }
  }

  // 데이터 저장
  saveData(data) {
    const key = this.mode === 'prod' ? STORAGE_KEYS.PROD_DATA : STORAGE_KEYS.TEST_DATA;
    localStorage.setItem(key, JSON.stringify(data));
  }

  // 테스트 데이터만 초기화 (운영 데이터는 절대 건드리지 않음)
  resetTestDataOnly() {
    localStorage.setItem(STORAGE_KEYS.TEST_DATA, JSON.stringify(INITIAL_TEST_DATA));
  }

  // =========================================================================
  // 회계 잔액 계산 엔진 (A안 / B안 완벽 지원 및 은행 잔액 대조)
  // =========================================================================

  calculateLedgerSummary() {
    const data = this.getData();
    const settings = data.settings;
    const migrationType = settings.migrationType || 'B';
    const baseDate = settings.migrationBaseDate || '2026-05-01';
    const openingBalance = Number(settings.openingBalance) || 0;
    const actualBankBalance = Number(settings.actualBankBalance) || 0;

    let postIncome = 0;
    let postExpense = 0;

    data.transactions.forEach(tx => {
      const txDate = tx.date;
      const amount = Number(tx.amount) || 0;

      if (migrationType === 'B') {
        // B안: 기준일 이후의 거래만 잔액에 가감
        if (txDate >= baseDate) {
          if (tx.type === 'income') postIncome += amount;
          if (tx.type === 'expense') postExpense += amount;
        }
      } else {
        // A안: 전체 거래 합산
        if (tx.type === 'income') postIncome += amount;
        if (tx.type === 'expense') postExpense += amount;
      }
    });

    // 현재 계산 잔액 = 시작 잔액 + 기준일 이후 수입 - 기준일 이후 지출
    const currentBalance = openingBalance + postIncome - postExpense;
    const diff = actualBankBalance - currentBalance;
    const isMatched = diff === 0;

    return {
      migrationType,
      baseDate,
      openingBalance,
      postIncome,
      postExpense,
      currentBalance,
      actualBankBalance,
      diff,
      isMatched, // true: 일치, false: 확인 필요
      totalTransactionsCount: data.transactions.length
    };
  }

  // =========================================================================
  // 월별 회비 현황 통계 (일반 가족용: 개인 성명 익명화)
  // =========================================================================

  getMonthFeeSummary(yearMonth) {
    // yearMonth: 'YYYY-MM'
    const data = this.getData();
    const monthlyFee = data.settings.monthlyFee || 20000;
    const activeMembers = data.members.filter(m => m.active);
    const totalExpectedCount = activeMembers.length;
    const totalExpectedAmount = totalExpectedCount * monthlyFee;

    // 해당 월의 납부 기록 추출
    const records = data.feeRecords.filter(r => r.targetMonth === yearMonth);

    let paidCount = 0;
    let unpaidCount = 0;
    let actualPaidAmount = 0;

    // 회원별 납부 상태 맵핑
    activeMembers.forEach(member => {
      const rec = records.find(r => r.memberId === member.id);
      if (rec) {
        if (rec.status === 'paid') {
          paidCount++;
          actualPaidAmount += Number(rec.amount) || monthlyFee;
        } else if (rec.status === 'partial') {
          actualPaidAmount += Number(rec.amount) || 0;
          unpaidCount++;
        } else if (rec.status === 'unpaid') {
          unpaidCount++;
        } else {
          // check or na
          unpaidCount++;
        }
      } else {
        // 기록이 아예 없으면 미납 대상
        unpaidCount++;
      }
    });

    const totalUnpaidAmount = Math.max(0, totalExpectedAmount - actualPaidAmount);

    return {
      yearMonth,
      monthlyFee,
      totalExpectedCount,
      paidCount,
      unpaidCount,
      totalExpectedAmount,
      actualPaidAmount,
      totalUnpaidAmount
    };
  }

  // =========================================================================
  // 신규 회비 등록 (중복 방지, 장부 동시 반영, 다중납부/부분납부 지원)
  // =========================================================================

  registerFeePayment({ memberId, targetMonths, amountPerMonth, actualPayDate, note, addToLedger = true }) {
    const data = this.getData();
    const member = data.members.find(m => m.id === memberId);
    if (!member) throw new Error('회원을 찾을 수 없습니다.');

    const createdRecordIds = [];
    let totalIncomeToAdd = 0;

    targetMonths.forEach(targetMonth => {
      // 기존 기록이 있는지 확인 (중복 등록 검사)
      const existingIndex = data.feeRecords.findIndex(
        r => r.memberId === memberId && r.targetMonth === targetMonth
      );

      const status = amountPerMonth >= (data.settings.monthlyFee || 20000) ? 'paid' : (amountPerMonth > 0 ? 'partial' : 'unpaid');
      const recId = 'fr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);

      if (existingIndex >= 0) {
        // 기존 기록 갱신 (예: 미납이었던 것을 납부로 업데이트)
        data.feeRecords[existingIndex] = {
          ...data.feeRecords[existingIndex],
          amount: amountPerMonth,
          status: status,
          paidAt: actualPayDate,
          note: note || (status === 'paid' ? '완납' : '부분납부')
        };
        createdRecordIds.push(data.feeRecords[existingIndex].id);
      } else {
        // 신규 등록
        const newRecord = {
          id: recId,
          memberId: member.id,
          targetMonth: targetMonth,
          amount: amountPerMonth,
          status: status,
          paidAt: actualPayDate,
          note: note || (status === 'paid' ? '정상납부' : '부분납부')
        };
        data.feeRecords.push(newRecord);
        createdRecordIds.push(recId);
      }

      totalIncomeToAdd += Number(amountPerMonth);
    });

    // 회계 장부에 동시 반영 (옵션, 중복 계산 방지)
    if (addToLedger && totalIncomeToAdd > 0) {
      const monthStr = targetMonths.join(', ');
      const tx = {
        id: 'tx_' + Date.now(),
        date: actualPayDate,
        type: 'income',
        category: '회비수입',
        desc: `${member.name} (${monthStr} 회비)`,
        amount: totalIncomeToAdd,
        relatedFeeId: createdRecordIds.join(',')
      };
      data.transactions.unshift(tx);
    }

    this.saveData(data);
    this.logAdminAction('회비 등록', `${member.name} 회비 ${totalIncomeToAdd.toLocaleString()}원 등록 (${targetMonths.join(', ')})`);
    return { success: true, count: targetMonths.length, totalAmount: totalIncomeToAdd };
  }

  // 지출 등록
  registerExpense({ date, category, desc, amount, note }) {
    const data = this.getData();
    const tx = {
      id: 'tx_' + Date.now(),
      date,
      type: 'expense',
      category: category || '모임지출',
      desc,
      amount: Number(amount) || 0,
      note: note || ''
    };
    data.transactions.unshift(tx);
    this.saveData(data);
    this.logAdminAction('지출 등록', `${desc} ${Number(amount).toLocaleString()}원 지출 등록`);
    return { success: true, tx };
  }

  // 회원 추가 / 수정
  saveMember({ id, name, relation, phone, active }) {
    const data = this.getData();
    if (id) {
      const index = data.members.findIndex(m => m.id === id);
      if (index >= 0) {
        data.members[index] = { ...data.members[index], name, relation, phone, active };
        this.saveData(data);
        this.logAdminAction('회원 수정', `${name} 회원 정보 수정`);
        return data.members[index];
      }
    } else {
      const newMember = {
        id: 'm_' + Date.now(),
        name,
        relation: relation || '가족',
        phone: phone || '',
        active: active !== false,
        joinedAt: new Date().toISOString().slice(0, 10)
      };
      data.members.push(newMember);
      this.saveData(data);
      this.logAdminAction('회원 등록', `${name} 신규 회원 등록`);
      return newMember;
    }
  }

  // 공지사항 등록 / 수정
  saveNotice({ id, category, categoryName, title, content, pinned }) {
    const data = this.getData();
    const today = new Date().toISOString().slice(0, 10);
    if (id) {
      const index = data.notices.findIndex(n => n.id === id);
      if (index >= 0) {
        data.notices[index] = { ...data.notices[index], category, categoryName, title, content, pinned };
        this.saveData(data);
        this.logAdminAction('공지 수정', `공지사항 [${title}] 수정`);
        return data.notices[index];
      }
    } else {
      const newNotice = {
        id: 'nt_' + Date.now(),
        category,
        categoryName: categoryName || '일반공지',
        title,
        content,
        date: today,
        pinned: !!pinned
      };
      data.notices.unshift(newNotice);
      this.saveData(data);
      this.logAdminAction('공지 등록', `공지사항 [${title}] 등록`);
      return newNotice;
    }
  }

  // 모임 등록 / 수정
  saveEvent({ id, title, type, date, time, location, address, description, isNext }) {
    const data = this.getData();
    if (isNext) {
      data.events.forEach(ev => ev.isNext = false);
    }
    if (id) {
      const index = data.events.findIndex(e => e.id === id);
      if (index >= 0) {
        data.events[index] = { ...data.events[index], title, type, date, time, location, address, description, isNext };
        this.saveData(data);
        this.logAdminAction('모임 수정', `모임 [${title}] 수정`);
        return data.events[index];
      }
    } else {
      const newEvent = {
        id: 'ev_' + Date.now(),
        title,
        type: type || 'meeting',
        date,
        time,
        location,
        address,
        description,
        isNext: !!isNext
      };
      data.events.unshift(newEvent);
      this.saveData(data);
      this.logAdminAction('모임 등록', `모임 [${title}] 등록`);
      return newEvent;
    }
  }

  // 초기 잔액 및 이관 설정 저장
  saveMigrationSettings({ migrationType, migrationBaseDate, openingBalance, actualBankBalance }) {
    const data = this.getData();
    data.settings.migrationType = migrationType;
    data.settings.migrationBaseDate = migrationBaseDate;
    data.settings.openingBalance = Number(openingBalance) || 0;
    data.settings.actualBankBalance = Number(actualBankBalance) || 0;
    this.saveData(data);
    this.logAdminAction('회계 이관 설정', `이관방식: ${migrationType}안, 기준일: ${migrationBaseDate}, 시작잔액: ${openingBalance}`);
  }

  // 회칙 및 유예기간/환급율 저장
  saveRulesSettings({ monthlyFee, dueDay, graceMonths, refundRate, ruleNotes }) {
    const data = this.getData();
    data.settings.monthlyFee = Number(monthlyFee) || 20000;
    data.settings.dueDay = Number(dueDay) || 10;
    data.settings.graceMonths = Number(graceMonths) || 3;
    data.settings.refundRate = Number(refundRate) || 0.8;
    data.settings.ruleNotes = ruleNotes || '';
    data.settings.rulesUpdatedDate = new Date().toISOString().slice(0, 10);

    data.rulesHistory.unshift({
      date: new Date().toISOString().slice(0, 10),
      content: `월 회비 ${monthlyFee}원, ${dueDay}일 납부, 유예 ${graceMonths}개월, 환급율 ${Math.round(refundRate * 100)}% 갱신`,
      author: '총무'
    });

    this.saveData(data);
    this.logAdminAction('회칙 변경', `월회비 ${monthlyFee}원, 유예 ${graceMonths}개월 등 회칙 개정`);
  }

  // 총무 관리자 감사 로그
  logAdminAction(action, detail) {
    const logs = JSON.parse(localStorage.getItem(STORAGE_KEYS.ADMIN_LOG) || '[]');
    logs.unshift({
      timestamp: new Date().toISOString(),
      action,
      detail,
      mode: this.mode
    });
    // 최근 100건 보관
    if (logs.length > 100) logs.pop();
    localStorage.setItem(STORAGE_KEYS.ADMIN_LOG, JSON.stringify(logs));
  }

  getAdminLogs() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.ADMIN_LOG) || '[]');
  }
}

// 싱글톤 인스턴스 전역 노출
window.hwamokStore = new HwamokhoeDataStore();
