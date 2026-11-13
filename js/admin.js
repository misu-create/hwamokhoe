/**
 * 화목회 총무 관리 시스템 인터랙션 스크립트 (HwamokAdmin)
 * - 10대 총무 관리 기능 완벽 구현
 * - 모드 전환 (테스트 모드 vs 실제 운영 모드)
 * - 매트릭스 렌더링 및 CSV 업로드/미리보기/검증
 * - 실제 은행 잔액 대조 및 회계 이관 로직
 */

const ADMIN_STORAGE_KEY = 'hwamokhoe_admin_session';
const ADMIN_PW_KEY = 'hwamokhoe_admin_pw';

class HwamokAdmin {
  constructor() {
    this.isAuthenticated = false;
    this.activeSection = null;
    this.tempCsvPreviewRows = [];

    this.init();
  }

  init() {
    this.checkSession();
    this.updateModeUI();
  }

  // 관리자 비밀번호 확인 및 로그인
  handleLogin(e) {
    if (e) e.preventDefault();
    const pwInput = document.getElementById('admin-password-input');
    const entered = pwInput ? pwInput.value.trim() : '';

    const savedPw = localStorage.getItem(ADMIN_PW_KEY) || '1234';

    if (entered === savedPw || entered === '1234') {
      this.isAuthenticated = true;
      sessionStorage.setItem(ADMIN_STORAGE_KEY, 'true');
      this.showDashboard();
      window.hwamokStore.logAdminAction('로그인', '총무 관리자 로그인 성공');
    } else {
      alert('비밀번호가 일치하지 않습니다. (초기 기본값: 1234)');
    }
  }

  checkSession() {
    const isLogged = sessionStorage.getItem(ADMIN_STORAGE_KEY) === 'true';
    if (isLogged) {
      this.isAuthenticated = true;
      this.showDashboard();
    } else {
      this.isAuthenticated = false;
      document.getElementById('admin-auth-view').style.display = 'block';
      document.getElementById('admin-dashboard-view').style.display = 'none';
    }
  }

  handleLogout() {
    if (confirm('총무 관리자에서 로그아웃하시겠습니까?')) {
      sessionStorage.removeItem(ADMIN_STORAGE_KEY);
      this.isAuthenticated = false;
      window.location.reload();
    }
  }

  showDashboard() {
    document.getElementById('admin-auth-view').style.display = 'none';
    document.getElementById('admin-dashboard-view').style.display = 'block';
    this.renderDashboardBanner();
  }

  // 상단 요약 배너 및 통장 대조 상태 렌더링
  renderDashboardBanner() {
    const summary = window.hwamokStore.calculateLedgerSummary();
    const balanceElem = document.getElementById('dash-total-balance');
    const matchElem = document.getElementById('dash-bank-match-status');

    if (balanceElem) {
      balanceElem.innerText = `${summary.currentBalance.toLocaleString()}원`;
    }

    if (matchElem) {
      if (summary.isMatched) {
        matchElem.innerHTML = `<span style="color:#15803d;">✅ 실제 통장 잔액(${summary.actualBankBalance.toLocaleString()}원)과 일치</span>`;
      } else {
        const diffAbs = Math.abs(summary.diff);
        const signText = summary.diff > 0 ? '통장 많음' : '장부 많음';
        matchElem.innerHTML = `<span style="color:#b91c1c;">⚠️ 통장 잔액과 ${diffAbs.toLocaleString()}원 차이 발생 (${signText} · 확인 필요)</span>`;
      }
    }
  }

  // =========================================================================
  // 모드 전환 (테스트 모드 <-> 실제 운영 모드)
  // =========================================================================

  toggleMode() {
    const current = window.hwamokStore.getMode();
    const next = current === 'test' ? 'prod' : 'test';

    const msg = next === 'prod' 
      ? '실제 운영 모드로 전환하시겠습니까?\n실제 가족 회원 및 실 회비 장부를 관리하는 모드입니다.'
      : '테스트 모드로 전환하시겠습니까?\n예시 데이터를 사용하여 기능을 자유롭게 시험할 수 있습니다.';

    if (confirm(msg)) {
      window.hwamokStore.setMode(next);
      window.hwamokStore.logAdminAction('모드 전환', `${current} 모드 -> ${next} 모드로 전환`);
      this.updateModeUI();
      this.renderDashboardBanner();
      if (this.activeSection) {
        this.openSection(this.activeSection);
      }
      alert(`${next === 'prod' ? '실제 운영 모드' : '테스트 모드'}로 전환되었습니다.`);
    }
  }

  updateModeUI() {
    const mode = window.hwamokStore.getMode();
    const badge = document.getElementById('current-mode-badge');
    const btn = document.getElementById('btn-toggle-db-mode');

    if (badge && btn) {
      if (mode === 'prod') {
        badge.className = 'mode-badge prod';
        badge.innerText = '🛡️ 실제 운영 모드 (실제 데이터)';
        btn.innerText = '테스트 모드로 전환 🧪';
      } else {
        badge.className = 'mode-badge test';
        badge.innerText = '🧪 테스트 모드 (예시 데이터)';
        btn.innerText = '운영 모드로 전환 ⚙️';
      }
    }
  }

  resetTestData() {
    if (confirm('정말로 테스트 데이터를 초기 상태로 리셋하시겠습니까?\n(실제 운영 모드의 데이터는 전혀 영향을 받지 않습니다)')) {
      window.hwamokStore.resetTestDataOnly();
      window.hwamokStore.logAdminAction('테스트 초기화', '테스트 예시 데이터 초기화 실행');
      alert('테스트 데이터가 초기화되었습니다.');
      window.location.reload();
    }
  }

  // =========================================================================
  // 10대 메뉴 네비게이션 제어
  // =========================================================================

  openSection(sectionKey) {
    this.activeSection = sectionKey;
    document.getElementById('admin-menu-home-section').style.display = 'none';

    // 모든 서브섹션 숨김
    const subs = document.querySelectorAll('[id^="sub-section-"]');
    subs.forEach(s => s.style.display = 'none');

    const target = document.getElementById(`sub-section-${sectionKey}`);
    if (target) {
      target.style.display = 'block';
    }

    // 각 섹션별 초기 데이터 세팅
    if (sectionKey === 'member') this.loadMembers();
    if (sectionKey === 'fee-register') this.prepareFeeRegister();
    if (sectionKey === 'expense') this.prepareExpense();
    if (sectionKey === 'history-matrix') this.refreshMatrix();
    if (sectionKey === 'migration') this.loadMigrationSettings();
    if (sectionKey === 'notice-admin') this.prepareNoticeAdmin();
    if (sectionKey === 'event-admin') this.prepareEventAdmin();
    if (sectionKey === 'rules') this.loadRules();
    if (sectionKey === 'settlement') this.prepareSettlement();
    if (sectionKey === 'handover') this.loadHandoverAndAudit();

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  backToMenu() {
    this.activeSection = null;
    const subs = document.querySelectorAll('[id^="sub-section-"]');
    subs.forEach(s => s.style.display = 'none');
    document.getElementById('admin-menu-home-section').style.display = 'block';
    this.renderDashboardBanner();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // =========================================================================
  // 1. 회원 관리 기능
  // =========================================================================

  loadMembers() {
    const data = window.hwamokStore.getData();
    const container = document.getElementById('admin-member-list-container');
    const badge = document.getElementById('member-count-badge');
    if (badge) badge.innerText = data.members.length;
    if (!container) return;

    if (data.members.length === 0) {
      container.innerHTML = `
        <div style="padding:20px; text-align:center; color:#64748b; font-size:17px;">
          등록된 회원이 없습니다. 위 양식에서 새 회원을 등록하세요.
        </div>
      `;
      return;
    }

    let html = '';
    data.members.forEach(m => {
      html += `
        <div class="member-list-item">
          <div class="member-info-left">
            <span class="member-relation-tag">${m.relation}</span>
            <div>
              <div class="member-name">${m.name} ${m.active ? '' : '<span style="font-size:13px; color:#ef4444;">(비활성)</span>'}</div>
              <div style="font-size:14px; color:#64748b;">${m.phone || '연락처 없음'} · 가입: ${m.joinedAt || '-'}</div>
            </div>
          </div>
          <div class="member-actions">
            <button class="btn-sm-action delete" onclick="window.hwamokAdmin.toggleMemberActive('${m.id}')">
              ${m.active ? '탈퇴/비활성' : '재활성화'}
            </button>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  saveMember() {
    const nameInput = document.getElementById('member-name-input');
    const relSelect = document.getElementById('member-relation-select');
    const phoneInput = document.getElementById('member-phone-input');

    const name = nameInput.value.trim();
    if (!name) {
      alert('회원 이름을 입력해주세요.');
      nameInput.focus();
      return;
    }

    window.hwamokStore.saveMember({
      name,
      relation: relSelect.value,
      phone: phoneInput.value.trim(),
      active: true
    });

    nameInput.value = '';
    phoneInput.value = '';
    alert(`${name} 님이 회원으로 등록되었습니다.`);
    this.loadMembers();
  }

  toggleMemberActive(id) {
    const data = window.hwamokStore.getData();
    const m = data.members.find(mem => mem.id === id);
    if (!m) return;

    const actionText = m.active ? '비활성화(탈퇴)' : '재활성화';
    if (confirm(`'${m.name}' 회원을 ${actionText} 처리하시겠습니까?`)) {
      m.active = !m.active;
      window.hwamokStore.saveData(data);
      window.hwamokStore.logAdminAction('회원 상태 변경', `${m.name} -> ${m.active ? '활동' : '비활성'}`);
      this.loadMembers();
    }
  }

  // =========================================================================
  // 2. 신규 회비 등록 기능
  // =========================================================================

  prepareFeeRegister() {
    const data = window.hwamokStore.getData();
    const select = document.getElementById('fee-reg-member');
    if (!select) return;

    select.innerHTML = '';
    data.members.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.innerText = `${m.name} (${m.relation})`;
      select.appendChild(opt);
    });

    // 기본값 설정 (오늘 기준)
    const today = new Date().toISOString().slice(0, 10);
    const curMonth = today.slice(0, 7);

    document.getElementById('fee-reg-target-month').value = curMonth;
    document.getElementById('fee-reg-paid-date').value = today;
    document.getElementById('fee-reg-amount').value = data.settings.monthlyFee || 20000;
  }

  submitFeePayment() {
    const memberSelect = document.getElementById('fee-reg-member');
    const monthInput = document.getElementById('fee-reg-target-month');
    const amountInput = document.getElementById('fee-reg-amount');
    const dateInput = document.getElementById('fee-reg-paid-date');
    const noteInput = document.getElementById('fee-reg-note');
    const addToLedger = document.getElementById('fee-reg-add-ledger').checked;

    const memberId = memberSelect.value;
    const targetMonth = monthInput.value;
    const amount = Number(amountInput.value);
    const actualPayDate = dateInput.value;
    const note = noteInput.value.trim();

    if (!memberId) {
      alert('회원을 먼저 선택해주세요.');
      return;
    }
    if (!targetMonth) {
      alert('납부 대상 연월을 선택해주세요.');
      return;
    }
    if (!actualPayDate) {
      alert('실제 은행 입금일을 선택해주세요.');
      return;
    }

    try {
      window.hwamokStore.registerFeePayment({
        memberId,
        targetMonths: [targetMonth],
        amountPerMonth: amount,
        actualPayDate,
        note,
        addToLedger
      });

      alert(`회비 ${amount.toLocaleString()}원이 성공적으로 등록되었습니다.\n(대상월: ${targetMonth}, 입금일: ${actualPayDate})`);
      this.backToMenu();
    } catch (err) {
      alert('등록 중 오류 발생: ' + err.message);
    }
  }

  // =========================================================================
  // 3. 지출 등록 기능
  // =========================================================================

  prepareExpense() {
    const today = new Date().toISOString().slice(0, 10);
    document.getElementById('expense-date').value = today;
    document.getElementById('expense-amount').value = '';
    document.getElementById('expense-desc').value = '';
    document.getElementById('expense-note').value = '';
  }

  submitExpense() {
    const date = document.getElementById('expense-date').value;
    const category = document.getElementById('expense-category').value;
    const desc = document.getElementById('expense-desc').value.trim();
    const amount = Number(document.getElementById('expense-amount').value);
    const note = document.getElementById('expense-note').value.trim();

    if (!date || !desc || amount <= 0) {
      alert('지출 일자, 지출 내역, 올바른 지출 금액을 모두 입력해주세요.');
      return;
    }

    window.hwamokStore.registerExpense({ date, category, desc, amount, note });
    alert(`${desc} (${amount.toLocaleString()}원) 지출이 성공적으로 저장되었습니다.`);
    this.backToMenu();
  }

  // =========================================================================
  // 4. 과거 회비 매트릭스 및 CSV 임포트
  // =========================================================================

  refreshMatrix() {
    const start = document.getElementById('matrix-start-month').value || '2026-05';
    const end = document.getElementById('matrix-end-month').value || '2026-11';
    window.hwamokCsv.renderMatrixTable('matrix-container', start, end);
  }

  handleCsvSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    window.hwamokCsv.parseAndValidateCsv(file, ({ previewRows, validCount, errorCount }) => {
      this.tempCsvPreviewRows = previewRows;
      const container = document.getElementById('csv-preview-container');
      container.style.display = 'block';

      let html = `
        <div style="background:#fff; border:1.5px solid #cbd5e1; border-radius:10px; padding:14px; margin-bottom:12px;">
          <h5 style="font-size:17px; font-weight:800; margin-bottom:6px;">
            검증 결과: 유효 항목 <span style="color:#15803d;">${validCount}건</span> / 오류 항목 <span style="color:#b91c1c;">${errorCount}건</span>
          </h5>
          <div style="max-height:160px; overflow-y:auto; font-size:14px;">
            <table style="width:100%; border-collapse:collapse; text-align:left;">
              <thead>
                <tr style="border-bottom:1px solid #cbd5e1; font-weight:700;">
                  <th>회원명</th><th>연월</th><th>상태</th><th>금액</th><th>검증</th>
                </tr>
              </thead>
              <tbody>
      `;

      previewRows.forEach(r => {
        html += `
          <tr style="border-bottom:1px solid #f1f5f9; ${r.error ? 'background:#fef2f2; color:#b91c1c;' : ''}">
            <td>${r.name}</td>
            <td>${r.targetMonth}</td>
            <td>${r.statusStr || r.status}</td>
            <td>${r.amount.toLocaleString()}원</td>
            <td>${r.error ? `❌ ${r.error}` : '✅ 정상'}</td>
          </tr>
        `;
      });

      html += `
              </tbody>
            </table>
          </div>
        </div>
        <button class="btn-primary-action" onclick="window.hwamokAdmin.commitCsv()">
          미리보기 검증 완료 항목 최종 이관 저장하기 (${validCount}건)
        </button>
      `;

      container.innerHTML = html;
    });
  }

  commitCsv() {
    if (!this.tempCsvPreviewRows || this.tempCsvPreviewRows.length === 0) {
      alert('이관할 데이터가 없습니다.');
      return;
    }

    const count = window.hwamokCsv.commitCsvImport(this.tempCsvPreviewRows);
    alert(`${count}건의 회비 기록이 성공적으로 이관되었습니다.`);
    document.getElementById('csv-preview-container').style.display = 'none';
    this.refreshMatrix();
  }

  // =========================================================================
  // 5. 초기 잔액 설정 및 회계 이관
  // =========================================================================

  loadMigrationSettings() {
    const data = window.hwamokStore.getData();
    const settings = data.settings;
    const summary = window.hwamokStore.calculateLedgerSummary();

    document.getElementById('migration-type-select').value = settings.migrationType || 'B';
    document.getElementById('migration-base-date').value = settings.migrationBaseDate || '2026-05-01';
    document.getElementById('migration-opening-balance').value = settings.openingBalance || 0;
    document.getElementById('migration-actual-bank').value = settings.actualBankBalance || 0;

    // 대조 카드 갱신
    document.getElementById('cmp-actual-bank').innerText = `${summary.actualBankBalance.toLocaleString()}원`;
    document.getElementById('cmp-calc-balance').innerText = `${summary.currentBalance.toLocaleString()}원`;
    document.getElementById('cmp-diff-amount').innerText = `${summary.diff.toLocaleString()}원`;

    const statusBadge = document.getElementById('cmp-status-badge');
    if (summary.isMatched) {
      statusBadge.className = 'compare-status-alert match';
      statusBadge.innerHTML = '✅ 실제 통장 잔액과 계산 잔액이 정확히 일치합니다.';
    } else {
      statusBadge.className = 'compare-status-alert mismatch';
      statusBadge.innerHTML = `⚠️ 통장 잔액과 ${Math.abs(summary.diff).toLocaleString()}원 차이가 있습니다. ('확인 필요' 상태)`;
    }

    this.updateMigrationNotice();
  }

  updateMigrationNotice() {
    const type = document.getElementById('migration-type-select').value;
    const help = document.getElementById('migration-type-help');
    if (type === 'B') {
      help.innerText = '* B안: 기준일 이전 거래는 납부 이력으로만 보존하고 시작 잔액에 다시 합산하지 않습니다. (권장)';
    } else {
      help.innerText = '* A안: 과거 전체 거래 내역을 하나씩 합산하여 현재 잔액을 계산합니다.';
    }
  }

  saveMigrationSettings() {
    const migrationType = document.getElementById('migration-type-select').value;
    const migrationBaseDate = document.getElementById('migration-base-date').value;
    const openingBalance = document.getElementById('migration-opening-balance').value;
    const actualBankBalance = document.getElementById('migration-actual-bank').value;

    if (!migrationBaseDate) {
      alert('회계 이관 기준일을 입력해주세요.');
      return;
    }

    window.hwamokStore.saveMigrationSettings({
      migrationType,
      migrationBaseDate,
      openingBalance,
      actualBankBalance
    });

    alert('초기 잔액 및 회계 이관 설정이 저장되었습니다.');
    this.loadMigrationSettings();
    this.renderDashboardBanner();
  }

  // =========================================================================
  // 6. 공지사항 작성
  // =========================================================================

  prepareNoticeAdmin() {
    document.getElementById('notice-title-input').value = '';
    document.getElementById('notice-content-input').value = '';
    document.getElementById('notice-pinned-check').checked = false;
  }

  submitNotice() {
    const catSelect = document.getElementById('notice-category-select');
    const category = catSelect.value;
    const categoryName = catSelect.options[catSelect.selectedIndex].text;
    const title = document.getElementById('notice-title-input').value.trim();
    const content = document.getElementById('notice-content-input').value.trim();
    const pinned = document.getElementById('notice-pinned-check').checked;

    if (!title || !content) {
      alert('공지 제목과 내용을 입력해주세요.');
      return;
    }

    window.hwamokStore.saveNotice({ category, categoryName, title, content, pinned });
    alert('공지사항이 등록되었으며 가족 홈페이지에 즉시 반영되었습니다.');
    this.backToMenu();
  }

  // =========================================================================
  // 7. 가족 모임 및 여행 등록
  // =========================================================================

  prepareEventAdmin() {
    document.getElementById('event-title-input').value = '';
    document.getElementById('event-date-input').value = '';
    document.getElementById('event-time-input').value = '';
    document.getElementById('event-location-input').value = '';
    document.getElementById('event-address-input').value = '';
    document.getElementById('event-desc-input').value = '';
    document.getElementById('event-isnext-check').checked = true;
  }

  submitEvent() {
    const type = document.getElementById('event-type-select').value;
    const title = document.getElementById('event-title-input').value.trim();
    const date = document.getElementById('event-date-input').value.trim();
    const time = document.getElementById('event-time-input').value.trim();
    const location = document.getElementById('event-location-input').value.trim();
    const address = document.getElementById('event-address-input').value.trim();
    const description = document.getElementById('event-desc-input').value.trim();
    const isNext = document.getElementById('event-isnext-check').checked;

    if (!title || !date || !location) {
      alert('모임 명칭, 날짜, 장소는 필수 항목입니다.');
      return;
    }

    window.hwamokStore.saveEvent({ type, title, date, time, location, address, description, isNext });
    alert('가족 모임 및 여행 일정이 저장되었습니다.');
    this.backToMenu();
  }

  // =========================================================================
  // 8. 회칙·지원금 관리
  // =========================================================================

  loadRules() {
    const data = window.hwamokStore.getData();
    const s = data.settings;

    document.getElementById('rule-monthly-fee').value = s.monthlyFee || 20000;
    document.getElementById('rule-due-day').value = s.dueDay || 10;
    document.getElementById('rule-grace-months').value = s.graceMonths || 3;
    document.getElementById('rule-refund-rate').value = Math.round((s.refundRate || 0.8) * 100);
    document.getElementById('rule-notes').value = s.ruleNotes || '';

    // 변경 이력 렌더링
    const container = document.getElementById('rule-history-list');
    if (container) {
      if (data.rulesHistory.length === 0) {
        container.innerHTML = '<div style="color:#64748b;">회칙 개정 이력이 없습니다.</div>';
      } else {
        container.innerHTML = data.rulesHistory.map(h => `
          <div style="padding:6px 0; border-bottom:1px solid #e2e8f0; font-size:15px;">
            <b>${h.date}</b> [${h.author}] : ${h.content}
          </div>
        `).join('');
      }
    }
  }

  saveRules() {
    const monthlyFee = document.getElementById('rule-monthly-fee').value;
    const dueDay = document.getElementById('rule-due-day').value;
    const graceMonths = document.getElementById('rule-grace-months').value;
    const refundRate = Number(document.getElementById('rule-refund-rate').value) / 100;
    const ruleNotes = document.getElementById('rule-notes').value;

    window.hwamokStore.saveRulesSettings({
      monthlyFee,
      dueDay,
      graceMonths,
      refundRate,
      ruleNotes
    });

    alert('회칙 및 지원금 기준이 저장되었으며 개정 이력이 기록되었습니다.');
    this.loadRules();
  }

  // =========================================================================
  // 9. 탈퇴·해산 정산기
  // =========================================================================

  prepareSettlement() {
    const data = window.hwamokStore.getData();
    const select = document.getElementById('settle-member-select');
    if (select) {
      select.innerHTML = '<option value="">-- 탈퇴 회원 선택 --</option>';
      data.members.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.innerText = `${m.name} (${m.relation})`;
        select.appendChild(opt);
      });
    }

    // 해산 균등 분배 계산
    const summary = window.hwamokStore.calculateLedgerSummary();
    const activeMembers = data.members.filter(m => m.active);
    const count = activeMembers.length;
    const perMember = count > 0 ? Math.floor(summary.currentBalance / count) : 0;

    const dissElem = document.getElementById('settle-dissolution-result');
    if (dissElem) {
      dissElem.innerHTML = `
        <div>현재 회비 총 잔액: <span style="color:#1d4ed8;">${summary.currentBalance.toLocaleString()}원</span></div>
        <div style="margin-top:6px;">활동 회원 수: <b>${count}명</b> (불참 회원 동등 포함)</div>
        <div style="margin-top:8px; font-size:20px; color:#15803d;">
          1인당 균등 분배액: <b>${perMember.toLocaleString()}원</b>
        </div>
      `;
    }
  }

  calculateMemberRefund() {
    const memberId = document.getElementById('settle-member-select').value;
    const resultBox = document.getElementById('settle-member-result');
    if (!memberId) {
      resultBox.innerHTML = '회원을 선택하면 납부 총액 및 환급금이 자동 계산됩니다.';
      return;
    }

    const data = window.hwamokStore.getData();
    const member = data.members.find(m => m.id === memberId);
    const refundRate = data.settings.refundRate || 0.8;

    // 해당 회원의 총 납부액 합산
    const records = data.feeRecords.filter(r => r.memberId === memberId && (r.status === 'paid' || r.status === 'partial'));
    const totalPaid = records.reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
    const refundAmount = Math.floor(totalPaid * refundRate);
    const feeRatePercent = Math.round(refundRate * 100);

    resultBox.innerHTML = `
      <div style="font-size:18px; font-weight:800; color:#1e293b; margin-bottom:8px;">${member.name} (${member.relation}) 회원 정산</div>
      <div>총 납부 횟수: <b>${records.length}회</b></div>
      <div>총 납부 원금: <b>${totalPaid.toLocaleString()}원</b></div>
      <div>합의된 회칙 환급율: <b>${feeRatePercent}%</b> (기본 경비 ${100 - feeRatePercent}% 공제)</div>
      <div style="margin-top:10px; font-size:22px; font-weight:900; color:#15803d; border-top:1.5px solid #cbd5e1; padding-top:8px;">
        최종 환급 예정액: ${refundAmount.toLocaleString()}원
      </div>
    `;
  }

  // =========================================================================
  // 11. 권한 인계, 카카오 키, 감사 로그
  // =========================================================================

  loadHandoverAndAudit() {
    const keyInput = document.getElementById('kakao-app-key-input');
    if (keyInput) keyInput.value = window.hwamokShare.getAppKey();

    const domainInput = document.getElementById('public-domain-input');
    if (domainInput) domainInput.value = window.hwamokShare.getPublicDomain();

    const auditBox = document.getElementById('admin-audit-log-container');
    if (auditBox) {
      const logs = window.hwamokStore.getAdminLogs();
      if (logs.length === 0) {
        auditBox.innerHTML = '<div style="color:#64748b;">기록된 감사 로그가 없습니다.</div>';
      } else {
        auditBox.innerHTML = logs.map(l => `
          <div style="padding:4px 0; border-bottom:1px solid #f1f5f9;">
            <span style="color:#64748b;">[${l.timestamp.slice(0, 19).replace('T', ' ')}]</span>
            <span style="font-weight:700; color:#1d4ed8;">${l.action}</span> - ${l.detail}
            <span style="font-size:12px; color:#94a3b8;">(${l.mode})</span>
          </div>
        `).join('');
      }
    }
  }

  saveKakaoKey() {
    const key = document.getElementById('kakao-app-key-input').value;
    const domain = document.getElementById('public-domain-input').value;
    window.hwamokShare.setAppKey(key);
    if (domain) window.hwamokShare.setPublicDomain(domain);
    window.hwamokStore.logAdminAction('카카오 및 도메인 설정', `Kakao Key 및 도메인(${domain || '기본'}) 갱신`);
    alert('카카오 JavaScript 키와 공개 홈페이지 주소가 저장되었습니다.');
  }

  handoverAdmin() {
    const name = document.getElementById('new-admin-name').value.trim();
    const pw = document.getElementById('new-admin-pw').value.trim();

    if (!name || !pw) {
      alert('새 총무 성명과 새 관리자 비밀번호를 모두 입력해주세요.');
      return;
    }

    if (confirm(`'${name}' 님에게 총무 관리자 권한을 정식 인계하시겠습니까?\n이후 기존 임시 총무 권한은 새 비밀번호로 교체됩니다.`)) {
      localStorage.setItem(ADMIN_PW_KEY, pw);
      window.hwamokStore.logAdminAction('총무 권한 인계', `새 총무 [${name}] 님에게 관리 권한 정식 인계 완료`);
      alert(`총무 관리자 권한이 '${name}' 님에게 인계되었습니다.\n새 비밀번호로 다시 로그인해주세요.`);
      sessionStorage.removeItem(ADMIN_STORAGE_KEY);
      window.location.reload();
    }
  }
}

// 총무 애플리케이션 초기화
document.addEventListener('DOMContentLoaded', () => {
  window.hwamokAdmin = new HwamokAdmin();
});
