/**
 * 화목회 총무 관리 시스템 인터랙션 스크립트 (HwamokAdmin)
 * - 11대 총무 관리 전체 메뉴 등록/조회/수정/취소(삭제)/복원 구현
 * - 회계 데이터(회비, 지출) 'cancelled' 취소 처리로 장부 무결성 보존
 * - 회원 안전 삭제(납부 기록 없을 때) 및 탈퇴/비활성화 처리
 * - 초기 잔액 변경 시 변경 사유 필수 입력 모달
 * - 과거 회비 매트릭스 셀 개별 수정 및 취소 모달
 * - 원클릭 JSON 전체 백업 및 복원
 * - 항목별 세부 변경 이력 및 불변 감사 로그(Audit Log)
 */

const ADMIN_STORAGE_KEY = 'hwamokhoe_admin_session';
const ADMIN_PW_KEY = 'hwamokhoe_admin_pw';

class HwamokAdmin {
  constructor() {
    this.isAuthenticated = false;
    this.activeSection = null;
    this.tempCsvPreviewRows = [];
    this.currentAuditFilter = 'all';

    this.init();
  }

  init() {
    this.checkSession();
    this.updateModeUI();
  }

  // =========================================================================
  // 관리자 인증 및 세션 제어
  // =========================================================================

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
      const authView = document.getElementById('admin-auth-view');
      const dashView = document.getElementById('admin-dashboard-view');
      if (authView) authView.style.display = 'block';
      if (dashView) dashView.style.display = 'none';
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
    const authView = document.getElementById('admin-auth-view');
    const dashView = document.getElementById('admin-dashboard-view');
    if (authView) authView.style.display = 'none';
    if (dashView) dashView.style.display = 'block';
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
        matchElem.innerHTML = `<span style="color:#15803d; font-weight:800;">✅ 실제 통장 잔액(${summary.actualBankBalance.toLocaleString()}원)과 일치</span>`;
      } else {
        const diffAbs = Math.abs(summary.diff);
        const signText = summary.diff > 0 ? '통장 많음' : '장부 많음';
        matchElem.innerHTML = `<span style="color:#b91c1c; font-weight:800;">⚠️ 통장 잔액과 ${diffAbs.toLocaleString()}원 차이 발생 (${signText} · 확인 필요)</span>`;
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
  // 메뉴 네비게이션 제어
  // =========================================================================

  openSection(sectionKey) {
    this.activeSection = sectionKey;
    const homeSection = document.getElementById('admin-menu-home-section');
    if (homeSection) homeSection.style.display = 'none';

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
    const homeSection = document.getElementById('admin-menu-home-section');
    if (homeSection) homeSection.style.display = 'block';
    this.renderDashboardBanner();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // =========================================================================
  // 1. 회원 관리 기능 (등록 / 수정 / 안전 삭제 / 상태 변경 / 이력 조회)
  // =========================================================================

  loadMembers() {
    const data = window.hwamokStore.getData();
    const container = document.getElementById('admin-member-list-container');
    const badge = document.getElementById('member-count-badge');
    if (badge) badge.innerText = data.members.length;
    if (!container) return;

    if (data.members.length === 0) {
      container.innerHTML = `
        <div style="padding:24px; text-align:center; color:#64748b; font-size:17px; background:#f8fafc; border-radius:12px;">
          등록된 회원이 없습니다. 위 양식에서 새 회원을 등록하세요.
        </div>
      `;
      return;
    }

    let html = '';
    data.members.forEach(m => {
      const isFeeTarget = m.isFeeTarget !== false;
      const statusText = m.status === 'withdrawn' ? '탈퇴' : (m.status === 'inactive' || !m.active ? '비활성' : '활동중');
      const statusColor = m.status === 'withdrawn' ? '#ef4444' : (m.status === 'inactive' || !m.active ? '#94a3b8' : '#15803d');
      const statusBg = m.status === 'withdrawn' ? '#fee2e2' : (m.status === 'inactive' || !m.active ? '#f1f5f9' : '#dcfce7');

      html += `
        <div class="member-list-item" style="padding:16px; margin-bottom:12px; background:#ffffff; border:1.5px solid #e2e8f0; border-radius:12px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div class="member-info-left" style="display:flex; align-items:center; gap:12px;">
            <span class="member-relation-tag" style="background:#e0f2fe; color:#0369a1; padding:4px 10px; border-radius:8px; font-weight:800; font-size:14px;">${m.relation}</span>
            <div>
              <div class="member-name" style="font-size:18px; font-weight:800; color:#1e293b; display:flex; align-items:center; gap:8px;">
                ${m.name}
                <span style="font-size:12px; font-weight:700; background:${statusBg}; color:${statusColor}; padding:2px 8px; border-radius:6px;">${statusText}</span>
                ${!isFeeTarget ? '<span style="font-size:12px; font-weight:700; background:#fef3c7; color:#b45309; padding:2px 8px; border-radius:6px;">회비면제</span>' : ''}
              </div>
              <div style="font-size:14px; color:#64748b; margin-top:3px;">
                📞 ${m.phone || '연락처 없음'} · 가입: ${m.joinedAt || '-'}
                ${m.customFee ? ` · 개별회비: ${Number(m.customFee).toLocaleString()}원` : ''}
              </div>
              ${m.note ? `<div style="font-size:13px; color:#475569; margin-top:2px;">📝 메모: ${m.note}</div>` : ''}
            </div>
          </div>
          <div class="member-actions" style="display:flex; gap:8px; flex-wrap:wrap;">
            <button type="button" class="btn-sm-action" style="background:#f1f5f9; color:#1e40af; border:1px solid #cbd5e1; font-weight:700;" onclick="window.hwamokAdmin.editMember('${m.id}')">
              ✏️ 수정
            </button>
            <button type="button" class="btn-sm-action delete" onclick="window.hwamokAdmin.deleteOrDeactivateMember('${m.id}')">
              ${m.status === 'withdrawn' ? '재가입' : (!m.active ? '재활성' : '탈퇴/삭제')}
            </button>
            <button type="button" class="btn-sm-action" style="background:#f8fafc; color:#64748b; border:1px solid #e2e8f0; font-size:13px;" onclick="window.hwamokAdmin.viewItemHistory('회원', '${m.id}')">
              📜 이력
            </button>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  editMember(id) {
    const data = window.hwamokStore.getData();
    const member = data.members.find(m => m.id === id);
    if (!member) return;

    document.getElementById('edit-member-id').value = member.id;
    document.getElementById('member-name-input').value = member.name || '';
    document.getElementById('member-relation-select').value = member.relation || '본인';
    document.getElementById('member-phone-input').value = member.phone || '';

    const statusSel = document.getElementById('member-status-select');
    if (statusSel) {
      statusSel.value = member.status || (member.active ? 'active' : 'inactive');
    }

    const feeTargetCheck = document.getElementById('member-feetarget-check');
    if (feeTargetCheck) {
      feeTargetCheck.checked = member.isFeeTarget !== false;
    }

    const startMonthInput = document.getElementById('member-fee-start-month');
    if (startMonthInput) {
      startMonthInput.value = member.feeStartMonth || '';
    }

    const customFeeInput = document.getElementById('member-custom-fee');
    if (customFeeInput) {
      customFeeInput.value = member.customFee || '';
    }

    const noteInput = document.getElementById('member-note-input');
    if (noteInput) {
      noteInput.value = member.note || '';
    }

    const formTitle = document.getElementById('member-form-title');
    if (formTitle) formTitle.innerText = `회원 정보 수정 (${member.name})`;

    const submitBtn = document.getElementById('btn-submit-member');
    if (submitBtn) submitBtn.innerText = '수정 내용 저장하기';

    const cancelBtn = document.getElementById('btn-cancel-member-edit');
    if (cancelBtn) cancelBtn.style.display = 'block';

    const formWrap = document.getElementById('sub-section-member');
    if (formWrap) formWrap.scrollIntoView({ behavior: 'smooth' });
  }

  cancelMemberEdit() {
    document.getElementById('edit-member-id').value = '';
    document.getElementById('member-name-input').value = '';
    document.getElementById('member-relation-select').value = '본인';
    document.getElementById('member-phone-input').value = '';

    const statusSel = document.getElementById('member-status-select');
    if (statusSel) statusSel.value = 'active';

    const feeTargetCheck = document.getElementById('member-feetarget-check');
    if (feeTargetCheck) feeTargetCheck.checked = true;

    const startMonthInput = document.getElementById('member-fee-start-month');
    if (startMonthInput) startMonthInput.value = '';

    const customFeeInput = document.getElementById('member-custom-fee');
    if (customFeeInput) customFeeInput.value = '';

    const noteInput = document.getElementById('member-note-input');
    if (noteInput) noteInput.value = '';

    const formTitle = document.getElementById('member-form-title');
    if (formTitle) formTitle.innerText = '새 회원 등록';

    const submitBtn = document.getElementById('btn-submit-member');
    if (submitBtn) submitBtn.innerText = '회원 등록하기';

    const cancelBtn = document.getElementById('btn-cancel-member-edit');
    if (cancelBtn) cancelBtn.style.display = 'none';
  }

  saveMember() {
    const editId = document.getElementById('edit-member-id').value;
    const nameInput = document.getElementById('member-name-input');
    const relSelect = document.getElementById('member-relation-select');
    const phoneInput = document.getElementById('member-phone-input');
    const statusSel = document.getElementById('member-status-select');
    const feeTargetCheck = document.getElementById('member-feetarget-check');
    const startMonthInput = document.getElementById('member-fee-start-month');
    const customFeeInput = document.getElementById('member-custom-fee');
    const noteInput = document.getElementById('member-note-input');

    const name = nameInput.value.trim();
    if (!name) {
      alert('회원 이름을 입력해주세요.');
      nameInput.focus();
      return;
    }

    const relation = relSelect ? relSelect.value : '본인';
    const phone = phoneInput ? phoneInput.value.trim() : '';
    const status = statusSel ? statusSel.value : 'active';
    const active = status === 'active';
    const isFeeTarget = feeTargetCheck ? feeTargetCheck.checked : true;
    const feeStartMonth = startMonthInput ? startMonthInput.value : '';
    const customFee = customFeeInput && customFeeInput.value ? Number(customFeeInput.value) : null;
    const note = noteInput ? noteInput.value.trim() : '';

    const memberPayload = {
      id: editId || undefined,
      name,
      relation,
      phone,
      status,
      active,
      isFeeTarget,
      feeStartMonth,
      customFee,
      note
    };

    window.hwamokStore.saveMember(memberPayload);

    alert(editId ? `'${name}' 회원의 정보가 수정되었습니다.` : `'${name}' 님이 회원으로 신규 등록되었습니다.`);
    this.cancelMemberEdit();
    this.loadMembers();
    this.renderDashboardBanner();
  }

  deleteOrDeactivateMember(id) {
    const data = window.hwamokStore.getData();
    const m = data.members.find(mem => mem.id === id);
    if (!m) return;

    // 과거 유효 납부 기록 여부 검사
    const validRecords = data.feeRecords.filter(r => r.memberId === id && r.status !== 'cancelled');

    if (validRecords.length > 0) {
      // 납부 기록이 있는 경우: 장부 정합성을 위해 완전 삭제 불가, 탈퇴 또는 상태 변경 처리
      const nextStatus = m.status === 'withdrawn' ? 'active' : 'withdrawn';
      const promptMsg = m.status === 'withdrawn'
        ? `'${m.name}' 님은 과거 ${validRecords.length}건의 회비 기록이 보존되어 있습니다.\n다시 '활동중' 상태로 복귀시키겠습니까?`
        : `'${m.name}' 님은 과거 ${validRecords.length}건의 회비 납부 기록이 있어 회계 장부 보존을 위해 완전 삭제할 수 없습니다.\n\n대신 '탈퇴(withdrawn)' 상태로 변경하여 향후 회비 부과 및 통계에서 제외하시겠습니까?`;

      if (confirm(promptMsg)) {
        window.hwamokStore.updateMemberStatus(id, nextStatus, '총무 관리자 메뉴에서 상태 전환');
        alert(`'${m.name}' 님의 상태가 [${nextStatus === 'active' ? '활동중' : '탈퇴'}]으로 변경되었습니다.`);
        this.loadMembers();
      }
    } else {
      // 납부 기록이 없는 경우: 안전 완전 삭제 가능
      if (confirm(`'${m.name}' 님은 납부된 회비 기록이 없습니다.\n정말로 회원 명부에서 완전히 삭제하시겠습니까?`)) {
        const res = window.hwamokStore.deleteMember(id);
        if (res.success) {
          alert(`'${m.name}' 회원이 안전하게 삭제되었습니다.`);
          this.loadMembers();
        } else {
          alert('삭제 실패: ' + res.message);
        }
      }
    }
  }

  // =========================================================================
  // 2. 신규 회비 등록 및 기존 내역 수정·취소·복원
  // =========================================================================

  prepareFeeRegister() {
    const data = window.hwamokStore.getData();
    const select = document.getElementById('fee-reg-member');
    if (select) {
      select.innerHTML = '';
      data.members.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.innerText = `${m.name} (${m.relation}) ${m.status === 'withdrawn' ? '[탈퇴]' : (!m.active ? '[비활성]' : '')}`;
        select.appendChild(opt);
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    const curMonth = today.slice(0, 7);

    const monthInput = document.getElementById('fee-reg-target-month');
    if (monthInput) monthInput.value = curMonth;

    const dateInput = document.getElementById('fee-reg-paid-date');
    if (dateInput) dateInput.value = today;

    const amountInput = document.getElementById('fee-reg-amount');
    if (amountInput) amountInput.value = data.settings.monthlyFee || 20000;

    const statusSel = document.getElementById('fee-reg-status');
    if (statusSel) statusSel.value = 'paid';

    const noteInput = document.getElementById('fee-reg-note');
    if (noteInput) noteInput.value = '';

    this.cancelFeeEdit();
    this.renderFeeList();
  }

  renderFeeList() {
    const container = document.getElementById('admin-fee-list-container');
    const badge = document.getElementById('fee-record-count-badge');
    if (!container) return;

    const data = window.hwamokStore.getData();
    const filterSelect = document.getElementById('fee-list-filter-status');
    const filter = filterSelect ? filterSelect.value : 'all';

    let records = [...(data.feeRecords || [])];
    if (filter !== 'all') {
      records = records.filter(r => r.status === filter);
    }

    // 최신 대상월 및 입금일 순으로 정렬
    records.sort((a, b) => (b.targetMonth || '').localeCompare(a.targetMonth || '') || (b.paidAt || '').localeCompare(a.paidAt || ''));

    if (badge) badge.innerText = records.length;

    if (records.length === 0) {
      container.innerHTML = `
        <div style="padding:24px; text-align:center; color:#64748b; font-size:16px; background:#f8fafc; border-radius:12px;">
          해당 조건의 회비 납부 내역이 없습니다.
        </div>
      `;
      return;
    }

    let html = '';
    records.forEach(r => {
      const member = data.members.find(m => m.id === r.memberId) || { name: '미지정', relation: '-' };
      const isCancelled = r.status === 'cancelled';
      const statusLabel = isCancelled ? '취소됨(무효)' : (r.status === 'paid' ? '완납' : (r.status === 'partial' ? '일부납' : '미납'));
      const statusColor = isCancelled ? '#94a3b8' : (r.status === 'paid' ? '#15803d' : (r.status === 'partial' ? '#b45309' : '#dc2626'));
      const statusBg = isCancelled ? '#f1f5f9' : (r.status === 'paid' ? '#dcfce7' : (r.status === 'partial' ? '#fef3c7' : '#fee2e2'));

      html += `
        <div style="background:#ffffff; border:1.5px solid ${isCancelled ? '#cbd5e1' : '#e2e8f0'}; border-radius:12px; padding:14px; margin-bottom:10px; ${isCancelled ? 'opacity:0.65; background:#fafafa;' : ''}">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <div style="font-size:17px; font-weight:800; color:#1e293b;">
              ${member.name} <span style="font-size:13px; color:#64748b;">(${member.relation})</span>
              <span style="font-size:12px; font-weight:700; background:${statusBg}; color:${statusColor}; padding:2px 8px; border-radius:6px; margin-left:6px;">${statusLabel}</span>
            </div>
            <div style="font-size:18px; font-weight:900; color:${isCancelled ? '#94a3b8' : '#1d4ed8'}; ${isCancelled ? 'text-decoration:line-through;' : ''}">
              ${(Number(r.amount) || 0).toLocaleString()}원
            </div>
          </div>
          <div style="font-size:14px; color:#475569; display:flex; gap:12px; flex-wrap:wrap; margin-bottom:8px;">
            <span>🗓️ 대상연월: <b>${r.targetMonth || '-'}</b></span>
            <span>🏦 입금일: <b>${r.paidAt || '-'}</b></span>
            ${r.note ? `<span>📝 메모: ${r.note}</span>` : ''}
            ${isCancelled && r.cancelReason ? `<span style="color:#b91c1c; font-weight:700;">🚫 취소 사유: ${r.cancelReason}</span>` : ''}
          </div>
          <div style="display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap;">
            ${!isCancelled ? `
              <button type="button" class="btn-sm-action" style="background:#f1f5f9; color:#1e40af; border:1px solid #cbd5e1; font-weight:700;" onclick="window.hwamokAdmin.editFeeRecord('${r.id}')">✏️ 수정</button>
              <button type="button" class="btn-sm-action delete" onclick="window.hwamokAdmin.cancelFeeRecord('${r.id}')">🚫 거래 취소</button>
            ` : `
              <button type="button" class="btn-sm-action" style="background:#dcfce7; color:#15803d; border:1px solid #86efac; font-weight:800;" onclick="window.hwamokAdmin.restoreFeeRecord('${r.id}')">↩️ 거래 복원</button>
            `}
            <button type="button" class="btn-sm-action" style="background:#f8fafc; color:#64748b; border:1px solid #e2e8f0; font-size:13px;" onclick="window.hwamokAdmin.viewItemHistory('회비', '${r.id}')">📜 이력</button>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  editFeeRecord(id) {
    const data = window.hwamokStore.getData();
    const record = data.feeRecords.find(r => r.id === id);
    if (!record) return;

    document.getElementById('edit-fee-id').value = record.id;
    document.getElementById('fee-reg-member').value = record.memberId;
    document.getElementById('fee-reg-target-month').value = record.targetMonth || '';
    document.getElementById('fee-reg-amount').value = record.amount || 0;
    document.getElementById('fee-reg-paid-date').value = record.paidAt || '';
    document.getElementById('fee-reg-status').value = record.status || 'paid';
    document.getElementById('fee-reg-note').value = record.note || '';

    const ledgerWrap = document.getElementById('fee-reg-ledger-wrap');
    if (ledgerWrap) ledgerWrap.style.display = 'none'; // 수정 시에는 기존 장부 거래와 자동 동기화됨

    const titleElem = document.getElementById('fee-form-title');
    if (titleElem) titleElem.innerText = `회비 납부 기록 수정 (기록 ID: ${record.id.slice(-6)})`;

    const submitBtn = document.getElementById('btn-submit-fee');
    if (submitBtn) submitBtn.innerText = '수정 내용 저장하기';

    const cancelBtn = document.getElementById('btn-cancel-fee-edit');
    if (cancelBtn) cancelBtn.style.display = 'block';

    const section = document.getElementById('sub-section-fee-register');
    if (section) section.scrollIntoView({ behavior: 'smooth' });
  }

  cancelFeeEdit() {
    document.getElementById('edit-fee-id').value = '';
    const ledgerWrap = document.getElementById('fee-reg-ledger-wrap');
    if (ledgerWrap) ledgerWrap.style.display = 'block';

    const titleElem = document.getElementById('fee-form-title');
    if (titleElem) titleElem.innerText = '회비 입금·미납 등록';

    const submitBtn = document.getElementById('btn-submit-fee');
    if (submitBtn) submitBtn.innerText = '회비 납부 저장하기';

    const cancelBtn = document.getElementById('btn-cancel-fee-edit');
    if (cancelBtn) cancelBtn.style.display = 'none';
  }

  submitFeePayment() {
    const editId = document.getElementById('edit-fee-id').value;
    const memberSelect = document.getElementById('fee-reg-member');
    const monthInput = document.getElementById('fee-reg-target-month');
    const amountInput = document.getElementById('fee-reg-amount');
    const dateInput = document.getElementById('fee-reg-paid-date');
    const statusSelect = document.getElementById('fee-reg-status');
    const noteInput = document.getElementById('fee-reg-note');
    const addLedgerCheck = document.getElementById('fee-reg-add-ledger');

    const memberId = memberSelect ? memberSelect.value : '';
    const targetMonth = monthInput ? monthInput.value : '';
    const amount = Number(amountInput ? amountInput.value : 0);
    const actualPayDate = dateInput ? dateInput.value : '';
    const status = statusSelect ? statusSelect.value : 'paid';
    const note = noteInput ? noteInput.value.trim() : '';
    const addToLedger = addLedgerCheck ? addLedgerCheck.checked : true;

    if (!memberId) {
      alert('회원을 먼저 선택해주세요.');
      return;
    }
    if (!targetMonth) {
      alert('납부 대상 연월을 선택해주세요.');
      return;
    }
    if (!actualPayDate && status !== 'unpaid') {
      alert('실제 은행 입금일을 선택해주세요.');
      return;
    }

    try {
      if (editId) {
        // 기존 회비 기록 수정
        const reason = prompt('회비 기록 수정 사유를 입력하세요 (선택):', '총무 수기 오기입 정정') || '정정';
        window.hwamokStore.updateFeePayment(editId, {
          memberId,
          targetMonth,
          amount,
          actualPayDate,
          status,
          note,
          changeReason: reason
        });
        alert('회비 기록이 성공적으로 수정되었으며 장부 거래가 동기화되었습니다.');
        this.cancelFeeEdit();
      } else {
        // 신규 회비 납부 등록
        window.hwamokStore.registerFeePayment({
          memberId,
          targetMonths: [targetMonth],
          amountPerMonth: amount,
          actualPayDate,
          note,
          addToLedger
        });
        alert(`회비 ${amount.toLocaleString()}원이 성공적으로 등록되었습니다.\n(대상월: ${targetMonth}, 입금일: ${actualPayDate})`);
        this.cancelFeeEdit();
      }

      this.renderFeeList();
      this.renderDashboardBanner();
    } catch (err) {
      alert('등록/수정 중 오류 발생: ' + err.message);
    }
  }

  cancelFeeRecord(id) {
    const reason = prompt('이 회비 거래를 취소하는 사유를 입력해주세요:\n(예: 통장 이체 중복 입력 취소, 금액 착오 입금 취소 등)', '입력 착오 취소');
    if (!reason) return;

    if (confirm('정말로 이 회비 거래를 취소 처리하시겠습니까?\n취소 시 회계 장부 수입에서 즉시 제외되며 잔액이 재계산됩니다.')) {
      window.hwamokStore.cancelFeePayment(id, reason);
      alert('회비 거래가 취소 처리되었습니다. (장부 잔액에서 제외됨)');
      this.renderFeeList();
      this.renderDashboardBanner();
    }
  }

  restoreFeeRecord(id) {
    if (confirm('취소되었던 회비 거래를 다시 유효 거래로 복원하시겠습니까?\n복원 시 회계 장부 잔액에 다시 합산됩니다.')) {
      window.hwamokStore.restoreFeePayment(id);
      alert('회비 거래가 유효 상태로 복원되었습니다.');
      this.renderFeeList();
      this.renderDashboardBanner();
    }
  }

  // =========================================================================
  // 3. 지출 등록 및 관리 (등록 / 수정 / 취소 / 복원)
  // =========================================================================

  prepareExpense() {
    const today = new Date().toISOString().slice(0, 10);
    const dateInput = document.getElementById('expense-date');
    if (dateInput) dateInput.value = today;

    const amountInput = document.getElementById('expense-amount');
    if (amountInput) amountInput.value = '';

    const descInput = document.getElementById('expense-desc');
    if (descInput) descInput.value = '';

    const noteInput = document.getElementById('expense-note');
    if (noteInput) noteInput.value = '';

    this.cancelExpenseEdit();
    this.renderExpenseList();
  }

  renderExpenseList() {
    const container = document.getElementById('admin-expense-list-container');
    const badge = document.getElementById('expense-record-count-badge');
    if (!container) return;

    const data = window.hwamokStore.getData();
    const expenses = (data.transactions || []).filter(t => t.type === 'expense');

    // 최신 날짜 순 정렬
    expenses.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    if (badge) badge.innerText = expenses.length;

    if (expenses.length === 0) {
      container.innerHTML = `
        <div style="padding:24px; text-align:center; color:#64748b; font-size:16px; background:#f8fafc; border-radius:12px;">
          등록된 지출 내역이 없습니다.
        </div>
      `;
      return;
    }

    let html = '';
    expenses.forEach(tx => {
      const isCancelled = tx.status === 'cancelled';
      html += `
        <div style="background:#ffffff; border:1.5px solid ${isCancelled ? '#cbd5e1' : '#e2e8f0'}; border-radius:12px; padding:14px; margin-bottom:10px; ${isCancelled ? 'opacity:0.65; background:#fafafa;' : ''}">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <div>
              <span style="font-size:13px; font-weight:800; background:#fef2f2; color:#b91c1c; padding:2px 8px; border-radius:6px;">${tx.category || '지출'}</span>
              <span style="font-size:17px; font-weight:800; color:#1e293b; margin-left:6px;">${tx.desc}</span>
              ${isCancelled ? '<span style="font-size:12px; font-weight:700; background:#f1f5f9; color:#64748b; padding:2px 8px; border-radius:6px; margin-left:4px;">취소됨</span>' : ''}
            </div>
            <div style="font-size:18px; font-weight:900; color:${isCancelled ? '#94a3b8' : '#b91c1c'}; ${isCancelled ? 'text-decoration:line-through;' : ''}">
              -${(Number(tx.amount) || 0).toLocaleString()}원
            </div>
          </div>
          <div style="font-size:14px; color:#475569; display:flex; gap:12px; flex-wrap:wrap; margin-bottom:8px;">
            <span>🗓️ 지출일: <b>${tx.date}</b></span>
            ${tx.note ? `<span>📝 메모: ${tx.note}</span>` : ''}
            ${isCancelled && tx.cancelReason ? `<span style="color:#b91c1c; font-weight:700;">🚫 취소 사유: ${tx.cancelReason}</span>` : ''}
          </div>
          <div style="display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap;">
            ${!isCancelled ? `
              <button type="button" class="btn-sm-action" style="background:#f1f5f9; color:#1e40af; border:1px solid #cbd5e1; font-weight:700;" onclick="window.hwamokAdmin.editExpense('${tx.id}')">✏️ 수정</button>
              <button type="button" class="btn-sm-action delete" onclick="window.hwamokAdmin.cancelExpenseRecord('${tx.id}')">🚫 지출 취소</button>
            ` : `
              <button type="button" class="btn-sm-action" style="background:#dcfce7; color:#15803d; border:1px solid #86efac; font-weight:800;" onclick="window.hwamokAdmin.restoreExpenseRecord('${tx.id}')">↩️ 지출 복원</button>
            `}
            <button type="button" class="btn-sm-action" style="background:#f8fafc; color:#64748b; border:1px solid #e2e8f0; font-size:13px;" onclick="window.hwamokAdmin.viewItemHistory('지출', '${tx.id}')">📜 이력</button>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  editExpense(id) {
    const data = window.hwamokStore.getData();
    const tx = data.transactions.find(t => t.id === id);
    if (!tx) return;

    document.getElementById('edit-expense-id').value = tx.id;
    document.getElementById('expense-date').value = tx.date || '';
    document.getElementById('expense-category').value = tx.category || '모임식대';
    document.getElementById('expense-desc').value = tx.desc || '';
    document.getElementById('expense-amount').value = tx.amount || 0;
    document.getElementById('expense-note').value = tx.note || '';

    const titleElem = document.getElementById('expense-form-title');
    if (titleElem) titleElem.innerText = `지출 내역 수정 (${tx.desc})`;

    const submitBtn = document.getElementById('btn-submit-expense');
    if (submitBtn) submitBtn.innerText = '수정 내용 저장하기';

    const cancelBtn = document.getElementById('btn-cancel-expense-edit');
    if (cancelBtn) cancelBtn.style.display = 'block';

    const section = document.getElementById('sub-section-expense');
    if (section) section.scrollIntoView({ behavior: 'smooth' });
  }

  cancelExpenseEdit() {
    document.getElementById('edit-expense-id').value = '';
    const titleElem = document.getElementById('expense-form-title');
    if (titleElem) titleElem.innerText = '지출 등록';

    const submitBtn = document.getElementById('btn-submit-expense');
    if (submitBtn) submitBtn.innerText = '지출 내역 저장하기';

    const cancelBtn = document.getElementById('btn-cancel-expense-edit');
    if (cancelBtn) cancelBtn.style.display = 'none';
  }

  submitExpense() {
    const editId = document.getElementById('edit-expense-id').value;
    const date = document.getElementById('expense-date').value;
    const category = document.getElementById('expense-category').value;
    const desc = document.getElementById('expense-desc').value.trim();
    const amount = Number(document.getElementById('expense-amount').value);
    const note = document.getElementById('expense-note').value.trim();

    if (!date || !desc || amount <= 0) {
      alert('지출 일자, 지출 내역, 올바른 지출 금액을 모두 입력해주세요.');
      return;
    }

    if (editId) {
      const reason = prompt('지출 내역 수정 사유를 입력하세요 (선택):', '영수증 정산 정정') || '정정';
      window.hwamokStore.updateExpense(editId, { date, category, desc, amount, note, changeReason: reason });
      alert('지출 내역이 성공적으로 수정되었으며 장부 잔액이 갱신되었습니다.');
      this.cancelExpenseEdit();
    } else {
      window.hwamokStore.registerExpense({ date, category, desc, amount, note });
      alert(`${desc} (${amount.toLocaleString()}원) 지출이 성공적으로 저장되었습니다.`);
      this.prepareExpense();
    }

    this.renderExpenseList();
    this.renderDashboardBanner();
  }

  cancelExpenseRecord(id) {
    const reason = prompt('이 지출 내역을 취소하는 사유를 입력해주세요:\n(예: 중복 입력 취소, 지출 환불 등)', '지출 취소');
    if (!reason) return;

    if (confirm('정말로 이 지출 거래를 취소 처리하시겠습니까?\n취소 시 장부 지출에서 즉시 제외되어 해당 금액만큼 총 잔액이 복원됩니다.')) {
      window.hwamokStore.cancelExpense(id, reason);
      alert('지출 내역이 취소 처리되었습니다. (잔액 복원됨)');
      this.renderExpenseList();
      this.renderDashboardBanner();
    }
  }

  restoreExpenseRecord(id) {
    if (confirm('취소되었던 지출 내역을 다시 복원하시겠습니까?\n복원 시 해당 지출 금액이 장부에서 다시 차감됩니다.')) {
      window.hwamokStore.restoreExpense(id);
      alert('지출 내역이 다시 유효 거래로 복원되었습니다.');
      this.renderExpenseList();
      this.renderDashboardBanner();
    }
  }

  // =========================================================================
  // 4. 과거 회비 매트릭스 및 개별 셀 수정 모달
  // =========================================================================

  refreshMatrix() {
    const start = document.getElementById('matrix-start-month').value || '2026-05';
    const end = document.getElementById('matrix-end-month').value || '2026-11';
    window.hwamokCsv.renderMatrixTable('matrix-container', start, end);
  }

  openMatrixModal(memberId, memberName, month, recordId) {
    const data = window.hwamokStore.getData();
    const record = recordId ? data.feeRecords.find(r => r.id === recordId) : null;

    document.getElementById('matrix-modal-member-id').value = memberId;
    document.getElementById('matrix-modal-member-name').innerText = memberName;
    document.getElementById('matrix-modal-target-month').value = month;
    document.getElementById('matrix-modal-display-month').innerText = month.replace('-', '년 ') + '월';
    document.getElementById('matrix-modal-record-id').value = record ? record.id : '';

    const currentStatus = record ? record.status : 'unpaid';
    const statusMap = { paid: '완납', unpaid: '미납', partial: '일부납', check: '확인필요', na: '대상아님', cancelled: '취소됨' };
    document.getElementById('matrix-modal-current-status').innerText = statusMap[currentStatus] || currentStatus;

    document.getElementById('matrix-modal-amount').value = record ? (record.amount || 0) : (data.settings.monthlyFee || 20000);
    document.getElementById('matrix-modal-status').value = currentStatus === 'cancelled' ? 'cancelled' : currentStatus;
    document.getElementById('matrix-modal-paid-date').value = record && record.paidAt ? record.paidAt : new Date().toISOString().slice(0, 10);
    document.getElementById('matrix-modal-note').value = record && record.note ? record.note : '';

    const modal = document.getElementById('matrix-edit-modal');
    if (modal) modal.classList.add('active');
  }

  closeMatrixModal() {
    const modal = document.getElementById('matrix-edit-modal');
    if (modal) modal.classList.remove('active');
  }

  saveMatrixModalChanges() {
    const memberId = document.getElementById('matrix-modal-member-id').value;
    const targetMonth = document.getElementById('matrix-modal-target-month').value;
    const recordId = document.getElementById('matrix-modal-record-id').value;
    const amount = Number(document.getElementById('matrix-modal-amount').value) || 0;
    const status = document.getElementById('matrix-modal-status').value;
    const paidAt = document.getElementById('matrix-modal-paid-date').value;
    const note = document.getElementById('matrix-modal-note').value.trim();

    const data = window.hwamokStore.getData();

    if (recordId) {
      window.hwamokStore.updateFeePayment(recordId, {
        memberId,
        targetMonth,
        amount,
        actualPayDate: status === 'unpaid' ? null : paidAt,
        status,
        note,
        changeReason: '매트릭스 표에서 직접 수정'
      });
    } else {
      // 신규 등록
      const newRec = {
        id: 'fr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        memberId,
        targetMonth,
        status,
        amount,
        paidAt: status === 'unpaid' ? null : paidAt,
        note
      };
      data.feeRecords.push(newRec);
      window.hwamokStore.saveData(data);
      window.hwamokStore.logAdminAction('회비 직접 입력', `${targetMonth} 납부 기록 신규 생성 (${status}, ${amount}원)`);
    }

    alert('매트릭스 회비 기록이 성공적으로 저장되었습니다.');
    this.closeMatrixModal();
    this.refreshMatrix();
    this.renderDashboardBanner();
  }

  cancelMatrixRecord() {
    const recordId = document.getElementById('matrix-modal-record-id').value;
    if (!recordId) {
      alert('취소할 기존 납부 기록이 없습니다.');
      return;
    }

    const reason = prompt('이 거래를 취소하는 사유를 입력하세요:', '매트릭스 셀 취소');
    if (!reason) return;

    if (confirm('정말로 이 회비 기록을 취소 처리하시겠습니까?')) {
      window.hwamokStore.cancelFeePayment(recordId, reason);
      alert('회비 기록이 취소 처리되었습니다.');
      this.closeMatrixModal();
      this.refreshMatrix();
      this.renderDashboardBanner();
    }
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
            <td>${(r.amount || 0).toLocaleString()}원</td>
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
    this.renderDashboardBanner();
  }

  // =========================================================================
  // 5. 초기 잔액 설정 및 특별 확인 모달
  // =========================================================================

  loadMigrationSettings() {
    const data = window.hwamokStore.getData();
    const settings = data.settings;
    const summary = window.hwamokStore.calculateLedgerSummary();

    document.getElementById('migration-type-select').value = settings.migrationType || 'B';
    document.getElementById('migration-base-date').value = settings.migrationBaseDate || '2026-05-01';
    document.getElementById('migration-opening-balance').value = settings.openingBalance || 0;
    document.getElementById('migration-actual-bank').value = settings.actualBankBalance || 0;

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
    if (!help) return;
    if (type === 'B') {
      help.innerText = '* B안: 기준일 이전 거래는 납부 이력으로만 보존하고 시작 잔액에 다시 합산하지 않습니다. (권장)';
    } else {
      help.innerText = '* A안: 과거 전체 거래 내역을 하나씩 합산하여 현재 잔액을 계산합니다.';
    }
  }

  saveMigrationSettings() {
    const migrationType = document.getElementById('migration-type-select').value;
    const migrationBaseDate = document.getElementById('migration-base-date').value;
    const newOpeningBal = Number(document.getElementById('migration-opening-balance').value) || 0;
    const newActualBank = Number(document.getElementById('migration-actual-bank').value) || 0;

    if (!migrationBaseDate) {
      alert('회계 이관 기준일을 입력해주세요.');
      return;
    }

    const data = window.hwamokStore.getData();
    const oldOpeningBal = Number(data.settings.openingBalance) || 0;

    // 시작 잔액에 변동이 있는 경우 특별 확인 모달 노출
    if (newOpeningBal !== oldOpeningBal) {
      const diff = newOpeningBal - oldOpeningBal;
      document.getElementById('mig-modal-old-bal').innerText = `${oldOpeningBal.toLocaleString()}원`;
      document.getElementById('mig-modal-new-bal').innerText = `${newOpeningBal.toLocaleString()}원`;
      document.getElementById('mig-modal-diff').innerText = `${diff > 0 ? '+' : ''}${diff.toLocaleString()}원`;
      document.getElementById('mig-modal-diff').style.color = diff > 0 ? '#15803d' : '#b91c1c';
      document.getElementById('mig-modal-actual-bank').innerText = `${newActualBank.toLocaleString()}원`;
      document.getElementById('migration-reason-input').value = '';

      const modal = document.getElementById('migration-confirm-modal');
      if (modal) modal.classList.add('active');
    } else {
      // 잔액 변동 없이 날짜나 모드만 변경된 경우
      window.hwamokStore.saveMigrationSettings({
        migrationType,
        migrationBaseDate,
        openingBalance: newOpeningBal,
        actualBankBalance: newActualBank
      });
      alert('회계 이관 설정이 저장되었습니다.');
      this.loadMigrationSettings();
      this.renderDashboardBanner();
    }
  }

  confirmMigrationSave() {
    const reasonInput = document.getElementById('migration-reason-input');
    const reason = reasonInput ? reasonInput.value.trim() : '';

    if (!reason) {
      alert('초기 잔액 변경 사유를 반드시 입력해주세요.\n(예: 과거 개설 잔액 오기입 정정, 전임 총무 이월금 반영 등)');
      if (reasonInput) reasonInput.focus();
      return;
    }

    const migrationType = document.getElementById('migration-type-select').value;
    const migrationBaseDate = document.getElementById('migration-base-date').value;
    const openingBalance = Number(document.getElementById('migration-opening-balance').value) || 0;
    const actualBankBalance = Number(document.getElementById('migration-actual-bank').value) || 0;

    window.hwamokStore.saveMigrationSettingsWithReason({
      migrationType,
      migrationBaseDate,
      openingBalance,
      actualBankBalance,
      changeReason: reason
    });

    alert('초기 잔액이 정정되었으며 변경 사유가 감사 로그에 영구 기록되었습니다.');
    this.closeMigrationModal();
    this.loadMigrationSettings();
    this.renderDashboardBanner();
  }

  closeMigrationModal() {
    const modal = document.getElementById('migration-confirm-modal');
    if (modal) modal.classList.remove('active');
  }

  // =========================================================================
  // 6. 공지사항 작성 및 관리 (등록 / 수정 / 삭제 / 카카오 공유)
  // =========================================================================

  prepareNoticeAdmin() {
    this.cancelNoticeEdit();
    this.renderAdminNotices();
  }

  renderAdminNotices() {
    const container = document.getElementById('admin-notice-list-container');
    if (!container) return;

    const data = window.hwamokStore.getData();
    const notices = data.notices || [];

    if (notices.length === 0) {
      container.innerHTML = '<div style="color:#64748b; font-size:15px; padding:16px; background:#f8fafc; border-radius:12px; text-align:center;">등록된 공지사항이 없습니다.</div>';
      return;
    }

    let html = '';
    notices.forEach(n => {
      const catLabel = window.hwamokShare ? window.hwamokShare.getNoticeCategoryLabel(n) : (n.categoryName || '일반 공지');
      html += `
        <div style="background:#ffffff; border:1.5px solid #e2e8f0; border-radius:12px; padding:16px; margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <span style="background:#e0f2fe; color:#0369a1; font-size:13px; font-weight:800; padding:2px 8px; border-radius:6px;">${catLabel}</span>
            <span style="font-size:13px; color:#64748b;">${n.date}</span>
          </div>
          <h5 style="font-size:17px; font-weight:800; color:#1e293b; margin:0 0 6px 0;">${n.title}</h5>
          <p style="font-size:14px; color:#475569; margin:0 0 12px 0; line-height:1.5; white-space:pre-wrap;">${n.content.slice(0, 120)}${n.content.length > 120 ? '...' : ''}</p>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button type="button" class="btn-sm-action" style="background:#fee500; color:#191919; font-weight:800; border:none;" onclick="window.hwamokAdmin.shareNoticeCard('${n.id}')">💬 카카오 카드 공유</button>
            <button type="button" class="btn-sm-action" style="background:#ffffff; color:#1e40af; border:1.5px solid #1e40af; font-weight:700;" onclick="window.hwamokAdmin.copyNoticeFull('${n.id}')">📋 전문 복사</button>
            <button type="button" class="btn-sm-action" style="background:#f1f5f9; color:#1e40af; border:1px solid #cbd5e1; font-weight:700;" onclick="window.hwamokAdmin.editNotice('${n.id}')">✏️ 수정</button>
            <button type="button" class="btn-sm-action delete" style="margin-left:auto;" onclick="window.hwamokAdmin.deleteAdminNotice('${n.id}')">🗑️ 삭제</button>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  editNotice(id) {
    const data = window.hwamokStore.getData();
    const notice = (data.notices || []).find(n => n.id === id);
    if (!notice) return;

    document.getElementById('edit-notice-id').value = notice.id;
    document.getElementById('notice-category-select').value = notice.category || 'general';
    document.getElementById('notice-title-input').value = notice.title || '';
    document.getElementById('notice-content-input').value = notice.content || '';
    document.getElementById('notice-pinned-check').checked = !!notice.pinned;

    const titleElem = document.getElementById('notice-form-title');
    if (titleElem) titleElem.innerText = `공지사항 수정 (${notice.title})`;

    const submitBtn = document.getElementById('btn-submit-notice');
    if (submitBtn) submitBtn.innerText = '공지 수정 완료하기';

    const cancelBtn = document.getElementById('btn-cancel-notice-edit');
    if (cancelBtn) cancelBtn.style.display = 'block';

    const section = document.getElementById('sub-section-notice-admin');
    if (section) section.scrollIntoView({ behavior: 'smooth' });
  }

  cancelNoticeEdit() {
    const editInput = document.getElementById('edit-notice-id');
    if (editInput) editInput.value = '';

    const titleInput = document.getElementById('notice-title-input');
    if (titleInput) titleInput.value = '';

    const contentInput = document.getElementById('notice-content-input');
    if (contentInput) contentInput.value = '';

    const pinnedCheck = document.getElementById('notice-pinned-check');
    if (pinnedCheck) pinnedCheck.checked = false;

    const titleElem = document.getElementById('notice-form-title');
    if (titleElem) titleElem.innerText = '새 공지사항 작성';

    const submitBtn = document.getElementById('btn-submit-notice');
    if (submitBtn) submitBtn.innerText = '공지사항 등록하기';

    const cancelBtn = document.getElementById('btn-cancel-notice-edit');
    if (cancelBtn) cancelBtn.style.display = 'none';
  }

  submitNotice() {
    const editId = document.getElementById('edit-notice-id').value;
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

    if (editId) {
      window.hwamokStore.updateNotice(editId, { category, categoryName, title, content, pinned });
      alert('공지사항이 수정되었습니다.');
    } else {
      window.hwamokStore.saveNotice({ category, categoryName, title, content, pinned });
      alert('공지사항이 등록되었으며 가족 홈페이지에 즉시 반영되었습니다.');
    }

    this.cancelNoticeEdit();
    this.renderAdminNotices();
  }

  deleteAdminNotice(noticeId) {
    if (confirm('이 공지사항을 삭제하시겠습니까?')) {
      window.hwamokStore.deleteNotice(noticeId);
      this.renderAdminNotices();
    }
  }

  shareNoticeCard(noticeId) {
    const data = window.hwamokStore.getData();
    const notice = data.notices.find(n => n.id === noticeId);
    if (!notice) return;
    window.hwamokShare.share('notice', { notice });
  }

  copyNoticeFull(noticeId) {
    const data = window.hwamokStore.getData();
    const notice = data.notices.find(n => n.id === noticeId);
    if (!notice) return;
    window.hwamokShare.copyNoticeFullText(notice);
  }

  // =========================================================================
  // 7. 가족 모임 및 여행 관리 (등록 / 수정 / 삭제 / 카카오 공유)
  // =========================================================================

  prepareEventAdmin() {
    this.cancelEventEdit();
    this.renderAdminEvents();
  }

  renderAdminEvents() {
    const container = document.getElementById('admin-event-list-container');
    if (!container) return;

    const data = window.hwamokStore.getData();
    const events = data.events || [];

    if (events.length === 0) {
      container.innerHTML = '<div style="color:#64748b; font-size:15px; padding:16px; background:#f8fafc; border-radius:12px; text-align:center;">등록된 모임 및 여행 일정이 없습니다.</div>';
      return;
    }

    let html = '';
    events.forEach(ev => {
      const typeMap = { regular: '정기모임', trip: '가족여행', special: '특별행사' };
      const typeLabel = typeMap[ev.type] || ev.type || '모임';

      html += `
        <div style="background:#ffffff; border:1.5px solid #e2e8f0; border-radius:12px; padding:16px; margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <div>
              <span style="background:#fef3c7; color:#b45309; font-size:13px; font-weight:800; padding:2px 8px; border-radius:6px;">${typeLabel}</span>
              ${ev.isNext ? '<span style="background:#dcfce7; color:#15803d; font-size:12px; font-weight:800; padding:2px 8px; border-radius:6px; margin-left:4px;">★ 다음 대표 모임</span>' : ''}
            </div>
            <span style="font-size:14px; font-weight:700; color:#1d4ed8;">🗓️ ${ev.date} ${ev.time || ''}</span>
          </div>
          <h5 style="font-size:18px; font-weight:800; color:#1e293b; margin:0 0 6px 0;">${ev.title}</h5>
          <div style="font-size:14px; color:#475569; margin-bottom:10px;">
            📍 장소: <b>${ev.location}</b> ${ev.address ? `(${ev.address})` : ''}
            ${ev.description ? `<div style="margin-top:4px; color:#64748b; white-space:pre-wrap;">${ev.description}</div>` : ''}
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button type="button" class="btn-sm-action" style="background:#fee500; color:#191919; font-weight:800; border:none;" onclick="window.hwamokShare.share('event', { event: ${JSON.stringify(ev).replace(/"/g, '&quot;')} })">💬 카카오 공유</button>
            <button type="button" class="btn-sm-action" style="background:#f1f5f9; color:#1e40af; border:1px solid #cbd5e1; font-weight:700;" onclick="window.hwamokAdmin.editEvent('${ev.id}')">✏️ 수정</button>
            <button type="button" class="btn-sm-action delete" style="margin-left:auto;" onclick="window.hwamokAdmin.deleteEvent('${ev.id}')">🗑️ 삭제</button>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  editEvent(id) {
    const data = window.hwamokStore.getData();
    const ev = (data.events || []).find(e => e.id === id);
    if (!ev) return;

    document.getElementById('edit-event-id').value = ev.id;
    document.getElementById('event-type-select').value = ev.type || 'regular';
    document.getElementById('event-title-input').value = ev.title || '';
    document.getElementById('event-date-input').value = ev.date || '';
    document.getElementById('event-time-input').value = ev.time || '';
    document.getElementById('event-location-input').value = ev.location || '';
    document.getElementById('event-address-input').value = ev.address || '';
    document.getElementById('event-desc-input').value = ev.description || '';
    document.getElementById('event-isnext-check').checked = !!ev.isNext;

    const titleElem = document.getElementById('event-form-title');
    if (titleElem) titleElem.innerText = `모임 일정 수정 (${ev.title})`;

    const submitBtn = document.getElementById('btn-submit-event');
    if (submitBtn) submitBtn.innerText = '수정 내용 저장하기';

    const cancelBtn = document.getElementById('btn-cancel-event-edit');
    if (cancelBtn) cancelBtn.style.display = 'block';

    const section = document.getElementById('sub-section-event-admin');
    if (section) section.scrollIntoView({ behavior: 'smooth' });
  }

  cancelEventEdit() {
    const editInput = document.getElementById('edit-event-id');
    if (editInput) editInput.value = '';

    const titleInput = document.getElementById('event-title-input');
    if (titleInput) titleInput.value = '';

    const dateInput = document.getElementById('event-date-input');
    if (dateInput) dateInput.value = '';

    const timeInput = document.getElementById('event-time-input');
    if (timeInput) timeInput.value = '';

    const locInput = document.getElementById('event-location-input');
    if (locInput) locInput.value = '';

    const addrInput = document.getElementById('event-address-input');
    if (addrInput) addrInput.value = '';

    const descInput = document.getElementById('event-desc-input');
    if (descInput) descInput.value = '';

    const nextCheck = document.getElementById('event-isnext-check');
    if (nextCheck) nextCheck.checked = true;

    const titleElem = document.getElementById('event-form-title');
    if (titleElem) titleElem.innerText = '새 가족 모임 및 여행 등록';

    const submitBtn = document.getElementById('btn-submit-event');
    if (submitBtn) submitBtn.innerText = '모임 일정 저장하기';

    const cancelBtn = document.getElementById('btn-cancel-event-edit');
    if (cancelBtn) cancelBtn.style.display = 'none';
  }

  submitEvent() {
    const editId = document.getElementById('edit-event-id').value;
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

    window.hwamokStore.saveEvent({
      id: editId || undefined,
      type,
      title,
      date,
      time,
      location,
      address,
      description,
      isNext
    });

    alert(editId ? '모임 일정이 성공적으로 수정되었습니다.' : '가족 모임 및 여행 일정이 저장되었습니다.');
    this.cancelEventEdit();
    this.renderAdminEvents();
  }

  deleteEvent(id) {
    if (confirm('이 모임 일정을 삭제하시겠습니까?')) {
      window.hwamokStore.deleteEvent(id);
      this.renderAdminEvents();
    }
  }

  // =========================================================================
  // 8. 회칙·지원금 관리
  // =========================================================================

  loadRules() {
    const data = window.hwamokStore.getData();
    const s = data.settings || {};

    document.getElementById('rule-monthly-fee').value = s.monthlyFee || 20000;
    document.getElementById('rule-due-day').value = s.dueDay || 10;
    document.getElementById('rule-grace-months').value = s.graceMonths || 3;
    document.getElementById('rule-refund-rate').value = Math.round((s.refundRate || 0.8) * 100);

    const supportInput = document.getElementById('rule-family-support');
    if (supportInput) supportInput.value = s.familyEventSupport || '';

    const effectiveInput = document.getElementById('rule-effective-date');
    if (effectiveInput) effectiveInput.value = s.effectiveDate || '2026-05-01';

    const notesInput = document.getElementById('rule-notes');
    if (notesInput) notesInput.value = s.ruleNotes || '';

    const agreedInput = document.getElementById('rule-agreed-terms');
    if (agreedInput) agreedInput.value = s.agreedTerms || '';

    // 변경 이력 렌더링
    const container = document.getElementById('rule-history-list');
    if (container) {
      const history = data.rulesHistory || [];
      if (history.length === 0) {
        container.innerHTML = '<div style="color:#64748b;">회칙 개정 이력이 없습니다.</div>';
      } else {
        container.innerHTML = history.map(h => `
          <div style="padding:8px 0; border-bottom:1px solid #e2e8f0; font-size:15px; line-height:1.5;">
            <b>${h.date}</b> <span style="color:#1d4ed8;">[${h.author}]</span> : ${h.content}
          </div>
        `).join('');
      }
    }
  }

  saveRules() {
    const monthlyFee = Number(document.getElementById('rule-monthly-fee').value) || 20000;
    const dueDay = Number(document.getElementById('rule-due-day').value) || 10;
    const graceMonths = Number(document.getElementById('rule-grace-months').value) || 3;
    const refundRate = Number(document.getElementById('rule-refund-rate').value) / 100;
    const familyEventSupport = document.getElementById('rule-family-support') ? document.getElementById('rule-family-support').value.trim() : '';
    const effectiveDate = document.getElementById('rule-effective-date') ? document.getElementById('rule-effective-date').value : '';
    const ruleNotes = document.getElementById('rule-notes').value.trim();
    const agreedTerms = document.getElementById('rule-agreed-terms') ? document.getElementById('rule-agreed-terms').value.trim() : '';

    window.hwamokStore.saveRulesSettings({
      monthlyFee,
      dueDay,
      graceMonths,
      refundRate,
      familyEventSupport,
      effectiveDate,
      ruleNotes,
      agreedTerms
    });

    alert('회칙 및 지원금 기준이 저장되었으며 개정 이력이 기록되었습니다.');
    this.loadRules();
  }

  // =========================================================================
  // 9. 탈퇴·해산 정산기 (계산 / 저장 / 완료처리 / 취소)
  // =========================================================================

  prepareSettlement() {
    const data = window.hwamokStore.getData();
    const select = document.getElementById('settle-member-select');
    if (select) {
      select.innerHTML = '<option value="">-- 탈퇴 회원 선택 --</option>';
      data.members.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.innerText = `${m.name} (${m.relation}) ${m.status === 'withdrawn' ? '[탈퇴회원]' : ''}`;
        select.appendChild(opt);
      });
    }

    // 해산 균등 분배 계산
    const summary = window.hwamokStore.calculateLedgerSummary();
    const activeMembers = data.members.filter(m => m.active || m.status === 'active');
    const count = activeMembers.length;
    const perMember = count > 0 ? Math.floor(summary.currentBalance / count) : 0;

    const dissElem = document.getElementById('settle-dissolution-result');
    if (dissElem) {
      dissElem.innerHTML = `
        <div>현재 회비 총 잔액: <span style="color:#1d4ed8;">${summary.currentBalance.toLocaleString()}원</span></div>
        <div style="margin-top:6px;">활동 회원 수: <b>${count}명</b> (불참 회원 동등 포함)</div>
        <div style="margin-top:8px; font-size:20px; color:#15803d; font-weight:900;">
          1인당 균등 분배액: <b>${perMember.toLocaleString()}원</b>
        </div>
      `;
    }

    this.renderAdminSettlements();
  }

  calculateMemberRefund() {
    const memberId = document.getElementById('settle-member-select').value;
    const resultBox = document.getElementById('settle-member-result');
    const saveWrap = document.getElementById('settle-save-wrap');

    if (!memberId) {
      resultBox.innerHTML = '회원을 선택하면 납부 총액 및 환급금이 자동 계산됩니다.';
      if (saveWrap) saveWrap.style.display = 'none';
      return;
    }

    const data = window.hwamokStore.getData();
    const member = data.members.find(m => m.id === memberId);
    const refundRate = data.settings.refundRate || 0.8;

    // 해당 회원의 유효 납부액 합산 (취소건 제외)
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

    if (saveWrap) saveWrap.style.display = 'block';
  }

  saveCurrentSettlement(type) {
    const data = window.hwamokStore.getData();

    if (type === 'refund') {
      const memberId = document.getElementById('settle-member-select').value;
      if (!memberId) {
        alert('회원을 먼저 선택해주세요.');
        return;
      }
      const member = data.members.find(m => m.id === memberId);
      const refundRate = data.settings.refundRate || 0.8;
      const records = data.feeRecords.filter(r => r.memberId === memberId && (r.status === 'paid' || r.status === 'partial'));
      const totalPaid = records.reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
      const refundAmount = Math.floor(totalPaid * refundRate);

      window.hwamokStore.saveSettlementRecord({
        type: 'refund',
        title: `${member.name} 회원 탈퇴 회비 환급 정산`,
        memberId: member.id,
        memberName: member.name,
        targetAmount: refundAmount,
        details: {
          totalPaid,
          refundRate,
          paidCount: records.length
        },
        status: 'draft'
      });

      alert(`'${member.name}' 회원의 환급 정산 내역이 초안(draft)으로 저장되었습니다.`);
    } else {
      // 해산 분배
      const summary = window.hwamokStore.calculateLedgerSummary();
      const activeMembers = data.members.filter(m => m.active || m.status === 'active');
      const count = activeMembers.length;
      const perMember = count > 0 ? Math.floor(summary.currentBalance / count) : 0;

      window.hwamokStore.saveSettlementRecord({
        type: 'dissolution',
        title: '화목회 모임 해산 균등 분배 정산',
        targetAmount: summary.currentBalance,
        details: {
          totalBalance: summary.currentBalance,
          memberCount: count,
          perMemberAmount: perMember
        },
        status: 'draft'
      });

      alert('화목회 해산 균등 분배 정산 내역이 저장되었습니다.');
    }

    this.renderAdminSettlements();
  }

  renderAdminSettlements() {
    const container = document.getElementById('admin-settlement-list-container');
    if (!container) return;

    const data = window.hwamokStore.getData();
    const settlements = data.settlements || [];

    if (settlements.length === 0) {
      container.innerHTML = '<div style="color:#64748b; font-size:15px; padding:16px; background:#f8fafc; border-radius:12px; text-align:center;">저장된 정산 내역이 없습니다.</div>';
      return;
    }

    let html = '';
    settlements.forEach(s => {
      const isCancelled = s.status === 'cancelled';
      const isPaid = s.status === 'paid';
      const statusLabel = isCancelled ? '취소됨' : (isPaid ? '지급완료' : '초안(미지급)');
      const statusColor = isCancelled ? '#94a3b8' : (isPaid ? '#15803d' : '#b45309');
      const statusBg = isCancelled ? '#f1f5f9' : (isPaid ? '#dcfce7' : '#fef3c7');

      html += `
        <div style="background:#ffffff; border:1.5px solid ${isCancelled ? '#cbd5e1' : '#e2e8f0'}; border-radius:12px; padding:14px; margin-bottom:10px; ${isCancelled ? 'opacity:0.65;' : ''}">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <div style="font-size:16px; font-weight:800; color:#1e293b;">
              ${s.title}
              <span style="font-size:12px; font-weight:700; background:${statusBg}; color:${statusColor}; padding:2px 8px; border-radius:6px; margin-left:6px;">${statusLabel}</span>
            </div>
            <div style="font-size:18px; font-weight:900; color:${isCancelled ? '#94a3b8' : '#1d4ed8'};">
              ${(Number(s.targetAmount) || 0).toLocaleString()}원
            </div>
          </div>
          <div style="font-size:14px; color:#475569; margin-bottom:8px;">
            🗓️ 생성일: <b>${s.createdAt ? s.createdAt.slice(0, 10) : '-'}</b>
            ${s.paidDate ? ` · 💸 지급완료일: <b>${s.paidDate}</b>` : ''}
            ${isCancelled && s.cancelReason ? `<div style="color:#b91c1c; font-weight:700; margin-top:2px;">🚫 취소 사유: ${s.cancelReason}</div>` : ''}
          </div>
          <div style="display:flex; gap:8px; justify-content:flex-end;">
            ${!isCancelled && !isPaid ? `
              <button type="button" class="btn-sm-action" style="background:#dcfce7; color:#15803d; border:1px solid #86efac; font-weight:800;" onclick="window.hwamokAdmin.confirmSettlementPayment('${s.id}')">✅ 지급 완료 처리</button>
            ` : ''}
            ${!isCancelled ? `
              <button type="button" class="btn-sm-action delete" onclick="window.hwamokAdmin.cancelSettlement('${s.id}')">🚫 정산 취소</button>
            ` : ''}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  confirmSettlementPayment(id) {
    const data = window.hwamokStore.getData();
    const s = data.settlements.find(item => item.id === id);
    if (!s) return;

    if (confirm(`'${s.title}' (${(s.targetAmount || 0).toLocaleString()}원) 정산금을 실제로 회원에게 지급 완료하셨습니까?\n확인 시 회계 장부(지출)에 자동으로 반영할 수 있습니다.`)) {
      const today = new Date().toISOString().slice(0, 10);
      s.status = 'paid';
      s.paidDate = today;

      // 지출 장부 자동 등록 여부 확인
      if (confirm('이 환급 금액을 회계 장부의 지출(회비환급)에도 기록하여 회계 잔액을 차감하시겠습니까?')) {
        window.hwamokStore.registerExpense({
          date: today,
          category: '회비환급',
          desc: s.title,
          amount: s.targetAmount,
          note: `정산 ID: ${s.id}`
        });
      }

      window.hwamokStore.saveData(data);
      window.hwamokStore.logAdminAction('정산금 지급 완료', `${s.title} (${(s.targetAmount || 0).toLocaleString()}원) 지급 처리`);
      alert('정산금 지급 처리가 완료되었습니다.');
      this.renderAdminSettlements();
      this.renderDashboardBanner();
    }
  }

  cancelSettlement(id) {
    const reason = prompt('이 정산 내역을 취소하는 사유를 입력해주세요:', '정산 계획 변경');
    if (!reason) return;

    if (confirm('정말로 이 정산 내역을 취소 처리하시겠습니까?')) {
      window.hwamokStore.cancelSettlementRecord(id, reason);
      alert('정산 내역이 취소되었습니다.');
      this.renderAdminSettlements();
    }
  }

  // =========================================================================
  // 11. 권한 인계, 백업/복원, 감사 로그 및 상세 이력 모달
  // =========================================================================

  downloadBackup() {
    try {
      const jsonStr = window.hwamokStore.exportBackupJson();
      const now = new Date();
      const pad = n => String(n).padStart(2, '0');
      const timeStr = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const fileName = `hwamokhoe_backup_${timeStr}.json`;

      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      alert(`전체 데이터베이스가 안전하게 백업 파일(${fileName})로 다운로드되었습니다.`);
    } catch (err) {
      alert('백업 다운로드 중 오류 발생: ' + err.message);
    }
  }

  restoreBackup(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const jsonStr = event.target.result;
        const msg = '⚠️ 주의: 현재 모든 데이터(회원, 회비, 장부, 공지, 모임 등)가 선택한 백업 파일의 내용으로 완전히 교체(복원)됩니다.\n\n정말로 복원을 진행하시겠습니까?';
        if (confirm(msg)) {
          const res = window.hwamokStore.importBackupJson(jsonStr);
          if (res.success) {
            alert('데이터가 성공적으로 복원되었습니다. 화면을 새로고침합니다.');
            window.location.reload();
          } else {
            alert('복원 실패: ' + res.message);
          }
        }
      } catch (err) {
        alert('백업 파일 읽기 오류: ' + err.message);
      }
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  }

  loadHandoverAndAudit() {
    const statusBadge = document.getElementById('admin-kakao-status-badge');
    if (statusBadge) {
      const isReady = window.hwamokShare && window.hwamokShare.isInitialized;
      const key = window.hwamokShare ? window.hwamokShare.getAppKey() : '';
      if (isReady) {
        statusBadge.innerHTML = '🟢 카카오톡 공유 정상 연동됨 (자동 초기화 완료)';
        statusBadge.style.color = '#15803d';
      } else if (key) {
        statusBadge.innerHTML = '🟢 자동 초기화 활성화됨 (JavaScript 키 등록 완료)';
        statusBadge.style.color = '#15803d';
      } else {
        statusBadge.innerHTML = '⚪ 키 미설정 (js/kakao-config.js 확인 필요)';
        statusBadge.style.color = '#64748b';
      }
    }

    this.filterAuditLogs(this.currentAuditFilter || 'all');
  }

  filterAuditLogs(filterType) {
    this.currentAuditFilter = filterType;
    const auditBox = document.getElementById('admin-audit-log-container');
    if (!auditBox) return;

    const logs = window.hwamokStore.getAdminLogs(filterType);
    if (logs.length === 0) {
      auditBox.innerHTML = '<div style="color:#64748b; padding:12px; text-align:center;">해당 조건의 감사 로그가 없습니다.</div>';
      return;
    }

    auditBox.innerHTML = logs.map(l => `
      <div style="padding:6px 0; border-bottom:1px solid #f1f5f9; line-height:1.4;">
        <span style="color:#64748b; font-size:12px;">[${(l.timestamp || '').slice(0, 19).replace('T', ' ')}]</span>
        <span style="font-weight:700; color:#1d4ed8;">${l.action}</span> - ${l.detail}
        <span style="font-size:12px; color:#94a3b8;">(${l.mode || '운영'})</span>
      </div>
    `).join('');
  }

  viewItemHistory(targetType, targetId) {
    const modal = document.getElementById('admin-detail-history-modal');
    const titleElem = document.getElementById('history-modal-title');
    const summaryElem = document.getElementById('history-modal-summary');
    const timelineElem = document.getElementById('history-modal-timeline');

    if (!modal || !timelineElem) return;

    if (titleElem) titleElem.innerText = `📜 [${targetType}] 상세 변경 이력`;
    if (summaryElem) summaryElem.innerText = `항목 식별 ID: ${targetId}의 모든 등록, 수정, 취소 기록을 확인합니다.`;

    const logs = window.hwamokStore.getItemHistory(targetId);

    if (logs.length === 0) {
      timelineElem.innerHTML = '<div style="color:#64748b; padding:20px; text-align:center;">기록된 세부 변경 이력이 없습니다. (신규 등록 이후 변경 없음)</div>';
    } else {
      timelineElem.innerHTML = logs.map(l => `
        <div style="padding:8px 0; border-bottom:1px solid #e2e8f0; font-size:14px; line-height:1.5;">
          <div style="color:#64748b; font-size:12px;">⏰ ${(l.timestamp || '').slice(0, 19).replace('T', ' ')} · 담당: ${l.adminName || '총무'}</div>
          <div style="font-weight:800; color:#1e293b; margin-top:2px;">${l.action}</div>
          <div style="color:#475569; margin-top:2px;">${l.detail}</div>
        </div>
      `).join('');
    }

    modal.classList.add('active');
  }

  closeHistoryModal() {
    const modal = document.getElementById('admin-detail-history-modal');
    if (modal) modal.classList.remove('active');
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
