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
      // 취소(cancelled) 처리된 거래는 회계 잔액 계산에서 완전 제외
      if (tx.status === 'cancelled') return;

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
      totalTransactionsCount: data.transactions.filter(t => t.status !== 'cancelled').length
    };
  }

  // =========================================================================
  // 월별 회비 현황 통계 (일반 가족용: 개인 성명 익명화)
  // =========================================================================

  getMonthFeeSummary(yearMonth) {
    // yearMonth: 'YYYY-MM'
    const data = this.getData();
    const monthlyFee = data.settings.monthlyFee || 20000;
    // 탈퇴 회원이나 비활성 회원, 회비 비대상자는 납부 대상 인원에서 제외
    const activeMembers = data.members.filter(m => (m.active !== false) && (m.status !== 'withdrawn') && (m.status !== 'inactive') && (m.isFeeTarget !== false));
    const totalExpectedCount = activeMembers.length;
    const totalExpectedAmount = totalExpectedCount * monthlyFee;

    // 해당 월의 납부 기록 추출 (취소된 거래 제외)
    const records = data.feeRecords.filter(r => r.targetMonth === yearMonth && r.status !== 'cancelled');

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
      note: note || '',
      status: 'active'
    };
    data.transactions.unshift(tx);
    this.saveData(data);
    this.logAdminAction('지출 등록', `[지출 ID: ${tx.id}] ${desc} (${Number(amount).toLocaleString()}원) 등록`, { targetId: tx.id, targetType: 'expense' });
    return { success: true, tx };
  }

  // 지출 수정
  updateExpense({ id, date, category, desc, amount, note }) {
    const data = this.getData();
    const tx = data.transactions.find(t => t.id === id);
    if (!tx) return { success: false, message: '지출 거래를 찾을 수 없습니다.' };

    const oldAmount = tx.amount;
    const oldDesc = tx.desc;

    tx.date = date || tx.date;
    tx.category = category || tx.category;
    tx.desc = desc || tx.desc;
    tx.amount = Number(amount);
    tx.note = note !== undefined ? note : (tx.note || '');

    this.saveData(data);
    this.logAdminAction('지출 수정', `[지출 ID: ${id}] ${tx.desc} 수정 (기존: ${oldAmount.toLocaleString()}원 ➔ 변경: ${Number(amount).toLocaleString()}원)`, { targetId: id, targetType: 'expense' });
    return { success: true, tx };
  }

  // 지출 취소 (장부 잔액에서 제외)
  cancelExpense(id, reason = '총무 지출 취소') {
    const data = this.getData();
    const tx = data.transactions.find(t => t.id === id);
    if (!tx) return { success: false, message: '지출 거래를 찾을 수 없습니다.' };

    const oldAmount = tx.amount;
    tx.status = 'cancelled';
    tx.cancelledAt = new Date().toISOString();
    tx.cancelReason = reason;

    this.saveData(data);
    this.logAdminAction('지출 취소', `[지출 ID: ${id}] ${tx.desc} (${oldAmount.toLocaleString()}원) 거래 취소 (사유: ${reason})`, { targetId: id, targetType: 'expense' });
    return { success: true, tx };
  }

  // 지출 취소 복구
  restoreExpense(id) {
    const data = this.getData();
    const tx = data.transactions.find(t => t.id === id);
    if (!tx) return false;

    tx.status = 'active';
    delete tx.cancelledAt;
    delete tx.cancelReason;

    this.saveData(data);
    this.logAdminAction('지출 복구', `[지출 ID: ${id}] ${tx.desc} 지출 거래 복구`, { targetId: id, targetType: 'expense' });
    return true;
  }

  // =========================================================================
  // 회비 수정 / 취소 / 복구
  // =========================================================================

  // 회비 기록 수정 (금액, 연월, 입금일, 상태, 메모)
  updateFeePayment({ id, memberId, targetMonth, amount, paidAt, note, status }) {
    const data = this.getData();
    const recIndex = data.feeRecords.findIndex(r => r.id === id);
    if (recIndex < 0) return { success: false, message: '회비 기록을 찾을 수 없습니다.' };

    const oldRec = data.feeRecords[recIndex];
    const member = data.members.find(m => m.id === (memberId || oldRec.memberId));
    const memberName = member ? member.name : '회원';
    const newAmount = Number(amount);
    const newStatus = status || (newAmount >= (data.settings.monthlyFee || 20000) ? 'paid' : (newAmount > 0 ? 'partial' : 'unpaid'));

    const updatedRec = {
      ...oldRec,
      memberId: memberId || oldRec.memberId,
      targetMonth: targetMonth || oldRec.targetMonth,
      amount: newAmount,
      paidAt: paidAt || oldRec.paidAt,
      status: newStatus,
      note: note !== undefined ? note : (oldRec.note || '')
    };
    data.feeRecords[recIndex] = updatedRec;

    // 연결된 장부 거래 내역 동기화
    const tx = data.transactions.find(t => t.relatedFeeId && (t.relatedFeeId === id || t.relatedFeeId.includes(id)));
    if (tx) {
      tx.date = paidAt || tx.date;
      tx.amount = newAmount;
      tx.desc = `${memberName} (${updatedRec.targetMonth} 회비)`;
      if (newStatus === 'cancelled') {
        tx.status = 'cancelled';
      } else {
        tx.status = 'active';
      }
    }

    this.saveData(data);
    this.logAdminAction('회비 수정', `[회비 ID: ${id}] ${memberName} ${updatedRec.targetMonth} 회비 수정 (${oldRec.amount.toLocaleString()}원 ➔ ${newAmount.toLocaleString()}원, 상태: ${newStatus})`, { targetId: id, targetType: 'fee' });
    return { success: true, record: updatedRec };
  }

  // 회비 입금 취소 (장부 잔액 및 납부 통계에서 제외)
  cancelFeePayment(id, reason = '총무 거래 취소') {
    const data = this.getData();
    const rec = data.feeRecords.find(r => r.id === id);
    if (!rec) return { success: false, message: '회비 기록을 찾을 수 없습니다.' };

    const member = data.members.find(m => m.id === rec.memberId);
    const memberName = member ? member.name : '회원';
    const oldAmount = rec.amount;

    rec.status = 'cancelled';
    rec.cancelledAt = new Date().toISOString();
    rec.cancelReason = reason;

    // 연결된 장부 거래도 취소 처리
    const tx = data.transactions.find(t => t.relatedFeeId && (t.relatedFeeId === id || t.relatedFeeId.includes(id)));
    if (tx) {
      tx.status = 'cancelled';
      tx.cancelledAt = new Date().toISOString();
      tx.cancelReason = reason;
    }

    this.saveData(data);
    this.logAdminAction('회비 취소', `[회비 ID: ${id}] ${memberName} ${rec.targetMonth} 회비 (${Number(oldAmount).toLocaleString()}원) 거래 취소 처리 (사유: ${reason})`, { targetId: id, targetType: 'fee' });
    return { success: true, memberName, targetMonth: rec.targetMonth };
  }

  // 회비 취소 복구
  restoreFeePayment(id) {
    const data = this.getData();
    const rec = data.feeRecords.find(r => r.id === id);
    if (!rec) return false;

    const member = data.members.find(m => m.id === rec.memberId);
    const memberName = member ? member.name : '회원';
    rec.status = rec.amount >= (data.settings.monthlyFee || 20000) ? 'paid' : (rec.amount > 0 ? 'partial' : 'unpaid');
    delete rec.cancelledAt;
    delete rec.cancelReason;

    const tx = data.transactions.find(t => t.relatedFeeId && (t.relatedFeeId === id || t.relatedFeeId.includes(id)));
    if (tx) {
      tx.status = 'active';
      delete tx.cancelledAt;
      delete tx.cancelReason;
    }

    this.saveData(data);
    this.logAdminAction('회비 복구', `[회비 ID: ${id}] ${memberName} ${rec.targetMonth} 회비 거래 복구`, { targetId: id, targetType: 'fee' });
    return true;
  }

  // =========================================================================
  // 회원 추가 / 수정 / 삭제 / 상태변경
  // =========================================================================

  saveMember({ id, name, relation, phone, active, status, isFeeTarget, joinedAt, feeStartMonth, customFee, note }) {
    const data = this.getData();
    const isAct = status ? (status === 'active') : (active !== false);
    const memberStatus = status || (isAct ? 'active' : 'inactive');

    if (id) {
      const index = data.members.findIndex(m => m.id === id);
      if (index >= 0) {
        const oldMember = data.members[index];
        data.members[index] = {
          ...oldMember,
          name: (name || '').trim(),
          relation: relation || oldMember.relation || '가족',
          phone: phone || '',
          active: isAct,
          status: memberStatus,
          isFeeTarget: isFeeTarget !== false,
          joinedAt: joinedAt || oldMember.joinedAt || new Date().toISOString().slice(0, 10),
          feeStartMonth: feeStartMonth || oldMember.feeStartMonth || '2025-01',
          customFee: customFee ? Number(customFee) : undefined,
          note: note !== undefined ? note : (oldMember.note || '')
        };
        this.saveData(data);
        this.logAdminAction('회원 수정', `[회원 ID: ${id}] ${name} 회원 정보 수정 (상태: ${memberStatus})`, { targetId: id, targetType: 'member' });
        return data.members[index];
      }
    } else {
      const newMember = {
        id: 'm_' + Date.now(),
        name: (name || '').trim(),
        relation: relation || '가족',
        phone: phone || '',
        active: isAct,
        status: memberStatus,
        isFeeTarget: isFeeTarget !== false,
        joinedAt: joinedAt || new Date().toISOString().slice(0, 10),
        feeStartMonth: feeStartMonth || '2025-01',
        customFee: customFee ? Number(customFee) : undefined,
        note: note || ''
      };
      data.members.push(newMember);
      this.saveData(data);
      this.logAdminAction('회원 등록', `[회원 ID: ${newMember.id}] ${name} 신규 회원 등록`, { targetId: newMember.id, targetType: 'member' });
      return newMember;
    }
  }

  // 회원 삭제 검사 및 처리
  deleteMember(id) {
    const data = this.getData();
    const member = data.members.find(m => m.id === id);
    if (!member) return { success: false, reason: 'not_found' };

    // 회비 납부 기록(취소되지 않은 납부액 > 0) 검사
    const paidRecords = data.feeRecords.filter(r => r.memberId === id && r.status !== 'cancelled' && Number(r.amount) > 0);
    if (paidRecords.length > 0) {
      return {
        success: false,
        reason: 'has_records',
        count: paidRecords.length,
        memberName: member.name
      };
    }

    // 기록이 없는 회원은 완전 삭제
    data.members = data.members.filter(m => m.id !== id);
    data.feeRecords = data.feeRecords.filter(r => r.memberId !== id);
    this.saveData(data);
    this.logAdminAction('회원 삭제', `[회원 ID: ${id}] ${member.name} 회원 완전 삭제 (납부기록 없음)`, { targetId: id, targetType: 'member' });
    return { success: true, memberName: member.name };
  }

  // 회원 상태 변경 (활동 / 비활성 / 탈퇴)
  updateMemberStatus(id, newStatus, reason = '') {
    const data = this.getData();
    const member = data.members.find(m => m.id === id);
    if (!member) return false;

    const oldStatus = member.status || (member.active ? 'active' : 'inactive');
    member.status = newStatus;
    member.active = (newStatus === 'active');
    if (reason) member.statusReason = reason;

    this.saveData(data);
    this.logAdminAction('회원 상태변경', `[회원 ID: ${id}] ${member.name} 상태 변경: ${oldStatus} ➔ ${newStatus} (사유: ${reason || '총무 설정'})`, { targetId: id, targetType: 'member' });
    return true;
  }

  // =========================================================================
  // 공지사항 등록 / 수정 / 삭제
  // =========================================================================

  saveNotice({ id, category, categoryName, title, content, pinned }) {
    const data = this.getData();
    const today = new Date().toISOString().slice(0, 10);
    if (id) {
      const index = data.notices.findIndex(n => n.id === id);
      if (index >= 0) {
        data.notices[index] = { ...data.notices[index], category, categoryName, title, content, pinned: !!pinned };
        this.saveData(data);
        this.logAdminAction('공지 수정', `[공지 ID: ${id}] 공지사항 [${title}] 수정`, { targetId: id, targetType: 'notice' });
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
      this.logAdminAction('공지 등록', `[공지 ID: ${newNotice.id}] 공지사항 [${title}] 등록`, { targetId: newNotice.id, targetType: 'notice' });
      return newNotice;
    }
  }

  deleteNotice(id) {
    const data = this.getData();
    const notice = data.notices.find(n => n.id === id);
    if (!notice) return false;
    data.notices = data.notices.filter(n => n.id !== id);
    this.saveData(data);
    this.logAdminAction('공지 삭제', `[공지 ID: ${id}] 공지사항 [${notice.title}] 삭제`, { targetId: id, targetType: 'notice' });
    return true;
  }

  // =========================================================================
  // 모임 등록 / 수정 / 삭제
  // =========================================================================

  saveEvent({ id, title, type, date, time, location, address, description, isNext }) {
    const data = this.getData();
    if (isNext) {
      data.events.forEach(ev => ev.isNext = false);
    }
    if (id) {
      const index = data.events.findIndex(e => e.id === id);
      if (index >= 0) {
        data.events[index] = { ...data.events[index], title, type, date, time, location, address, description, isNext: !!isNext };
        this.saveData(data);
        this.logAdminAction('모임 수정', `[모임 ID: ${id}] 모임 [${title}] 수정`, { targetId: id, targetType: 'event' });
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
      this.logAdminAction('모임 등록', `[모임 ID: ${newEvent.id}] 모임 [${title}] 등록`, { targetId: newEvent.id, targetType: 'event' });
      return newEvent;
    }
  }

  deleteEvent(id) {
    const data = this.getData();
    const ev = data.events.find(e => e.id === id);
    if (!ev) return false;

    data.events = data.events.filter(e => e.id !== id);
    this.saveData(data);
    this.logAdminAction('모임 삭제', `[모임 ID: ${id}] 모임 일정 [${ev.title}] 삭제`, { targetId: id, targetType: 'event' });
    return true;
  }

  // =========================================================================
  // 초기 잔액 및 이관 설정
  // =========================================================================

  saveMigrationSettings({ migrationType, migrationBaseDate, openingBalance, actualBankBalance }) {
    return this.saveMigrationSettingsWithReason({
      migrationType,
      migrationBaseDate,
      openingBalance,
      actualBankBalance,
      reason: '총무 이관 설정 저장'
    });
  }

  saveMigrationSettingsWithReason({ migrationType, migrationBaseDate, openingBalance, actualBankBalance, reason }) {
    const data = this.getData();
    const oldOpening = data.settings.openingBalance || 0;
    const newOpening = Number(openingBalance) || 0;
    const diff = newOpening - oldOpening;

    data.settings.migrationType = migrationType;
    data.settings.migrationBaseDate = migrationBaseDate;
    data.settings.openingBalance = newOpening;
    data.settings.actualBankBalance = Number(actualBankBalance) || 0;
    data.settings.migrationReason = reason || '초기 잔액 정정';
    data.settings.migrationUpdatedAt = new Date().toISOString();

    this.saveData(data);
    this.logAdminAction('초기 잔액 변경', `초기 잔액 정정: ${oldOpening.toLocaleString()}원 ➔ ${newOpening.toLocaleString()}원 (차액: ${diff >= 0 ? '+' : ''}${diff.toLocaleString()}원, 사유: ${reason || '총무 정정'})`, { targetId: 'settings_migration', targetType: 'migration' });
    return { success: true, diff, oldOpening, newOpening };
  }

  // =========================================================================
  // 회칙 및 유예기간/환급율/경조사 기준
  // =========================================================================

  saveRulesSettings({ monthlyFee, dueDay, graceMonths, refundRate, ruleNotes, familyEventSupport, effectiveDate, agreedTerms }) {
    const data = this.getData();
    data.settings.monthlyFee = Number(monthlyFee) || 20000;
    data.settings.dueDay = Number(dueDay) || 10;
    data.settings.graceMonths = Number(graceMonths) || 3;
    data.settings.refundRate = Number(refundRate) || 0.8;
    data.settings.ruleNotes = ruleNotes || '';
    data.settings.familyEventSupport = familyEventSupport || '';
    data.settings.effectiveDate = effectiveDate || new Date().toISOString().slice(0, 10);
    data.settings.agreedTerms = agreedTerms || '';
    data.settings.rulesUpdatedDate = new Date().toISOString().slice(0, 10);

    const historyEntry = {
      date: new Date().toISOString().slice(0, 10),
      effectiveDate: data.settings.effectiveDate,
      content: `월 회비 ${Number(monthlyFee).toLocaleString()}원, 납부일 ${dueDay}일, 유예 ${graceMonths}개월, 환급율 ${Math.round(refundRate * 100)}% 개정 (적용 시작일: ${data.settings.effectiveDate})${familyEventSupport ? ' | 경조사: ' + familyEventSupport : ''}`,
      author: '총무'
    };
    data.rulesHistory = data.rulesHistory || [];
    data.rulesHistory.unshift(historyEntry);

    this.saveData(data);
    this.logAdminAction('회칙 변경', `회칙 개정: 월회비 ${Number(monthlyFee).toLocaleString()}원, 적용일: ${data.settings.effectiveDate}`, { targetId: 'settings_rules', targetType: 'rules' });
    return { success: true };
  }

  // =========================================================================
  // 탈퇴 / 해산 정산 기록 관리
  // =========================================================================

  saveSettlementRecord({ id, type, memberId, memberName, totalPaid, refundRate, calculatedAmount, actualPaidAmount, settledAt, status, note }) {
    const data = this.getData();
    data.settlements = data.settlements || [];

    if (id) {
      const idx = data.settlements.findIndex(s => s.id === id);
      if (idx >= 0) {
        data.settlements[idx] = {
          ...data.settlements[idx],
          type,
          memberId,
          memberName,
          totalPaid: Number(totalPaid),
          refundRate: Number(refundRate),
          calculatedAmount: Number(calculatedAmount),
          actualPaidAmount: Number(actualPaidAmount),
          settledAt: settledAt || new Date().toISOString().slice(0, 10),
          status: status || 'draft',
          note: note || ''
        };
        this.saveData(data);
        this.logAdminAction('정산 수정', `[정산 ID: ${id}] ${memberName} ${type === 'refund' ? '탈퇴 환급' : '해산 분배'} 정산 수정 (상태: ${status})`, { targetId: id, targetType: 'settlement' });
        return data.settlements[idx];
      }
    } else {
      const newSettlement = {
        id: 'st_' + Date.now(),
        type: type || 'refund',
        memberId,
        memberName,
        totalPaid: Number(totalPaid) || 0,
        refundRate: Number(refundRate) || 0.8,
        calculatedAmount: Number(calculatedAmount) || 0,
        actualPaidAmount: Number(actualPaidAmount) || 0,
        settledAt: settledAt || new Date().toISOString().slice(0, 10),
        status: status || 'draft', // 'draft': 초안(수정가능), 'confirmed': 지급완료(수정불가)
        note: note || ''
      };
      data.settlements.unshift(newSettlement);
      this.saveData(data);
      this.logAdminAction('정산 등록', `[정산 ID: ${newSettlement.id}] ${memberName} ${newSettlement.type === 'refund' ? '탈퇴 환급' : '해산 분배'} 정산 등록 (${newSettlement.calculatedAmount.toLocaleString()}원, 상태: ${newSettlement.status})`, { targetId: newSettlement.id, targetType: 'settlement' });
      return newSettlement;
    }
  }

  cancelSettlementRecord(id, reason = '총무 정산 취소') {
    const data = this.getData();
    data.settlements = data.settlements || [];
    const st = data.settlements.find(s => s.id === id);
    if (!st) return false;

    st.status = 'cancelled';
    st.cancelledAt = new Date().toISOString();
    st.cancelReason = reason;
    this.saveData(data);
    this.logAdminAction('정산 취소', `[정산 ID: ${id}] ${st.memberName} 정산 기록 취소 (사유: ${reason})`, { targetId: id, targetType: 'settlement' });
    return true;
  }

  // =========================================================================
  // 전체 데이터베이스 백업 및 복원
  // =========================================================================

  exportBackupJson() {
    const data = this.getData();
    const backupObj = {
      format: 'hwamokhoe_backup_v1',
      mode: this.mode,
      exportedAt: new Date().toISOString(),
      data
    };
    return JSON.stringify(backupObj, null, 2);
  }

  importBackupJson(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed || !parsed.data) {
        throw new Error('유효하지 않은 화목회 백업 파일 형식입니다.');
      }
      const data = parsed.data;
      if (!data.settings || !Array.isArray(data.members)) {
        throw new Error('백업 데이터의 필수 구조(settings, members)가 올바르지 않습니다.');
      }
      this.saveData(data);
      this.logAdminAction('데이터 복원', `백업 파일로부터 전체 데이터베이스 복원 완료 (내보낸 일시: ${parsed.exportedAt || '알 수 없음'})`, { targetId: 'system_backup', targetType: 'system' });
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // =========================================================================
  // 총무 관리자 감사 로그
  // =========================================================================

  logAdminAction(action, detail, meta = {}) {
    const logs = JSON.parse(localStorage.getItem(STORAGE_KEYS.ADMIN_LOG) || '[]');
    logs.unshift({
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      timestamp: new Date().toISOString(),
      action,
      detail,
      targetId: meta.targetId || null,
      targetType: meta.targetType || null,
      mode: this.mode
    });
    // 최근 250건 보관
    if (logs.length > 250) logs.pop();
    localStorage.setItem(STORAGE_KEYS.ADMIN_LOG, JSON.stringify(logs));
  }

  getAdminLogs(filterType = 'all') {
    const logs = JSON.parse(localStorage.getItem(STORAGE_KEYS.ADMIN_LOG) || '[]');
    if (filterType === 'all') return logs;
    return logs.filter(l => l.targetType === filterType || (l.action && l.action.includes(filterType)));
  }

  getItemHistory(targetId) {
    const logs = this.getAdminLogs('all');
    return logs.filter(l => l.targetId === targetId || (l.detail && l.detail.includes(targetId)));
  }
}

// 싱글톤 인스턴스 전역 노출
window.hwamokStore = new HwamokhoeDataStore();
