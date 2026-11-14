/**
 * 과거 회비 매트릭스 및 CSV 임포트/익스포트 매니저 (CsvManager)
 * - 회원별 x 월별 납부 현황 매트릭스 테이블 동적 렌더링
 * - 5개 상태 뱃지 (납부완료, 미납, 일부납부, 확인필요, 대상아님)
 * - 셀 클릭 시 상세 수정 팝업 (대상월과 입금일 분리 보존)
 * - 표준 CSV 템플릿 생성 및 다운로드
 * - CSV 파싱, 회원 매핑, 중복 검사, 유효성 검증 및 일괄 임포트
 * - 회계 장부/회원명부/납부기록 CSV 내보내기
 */

class HwamokCsvManager {
  constructor(store) {
    this.store = store || window.hwamokStore;
  }

  // =========================================================================
  // 1. 회원별 x 월별 매트릭스 표 생성
  // =========================================================================

  renderMatrixTable(containerId, startMonth = '2026-05', endMonth = '2026-11') {
    const container = document.getElementById(containerId);
    if (!container) return;

    const data = this.store.getData();
    const members = data.members.filter(m => m.active);
    const months = this.generateMonthList(startMonth, endMonth);

    if (members.length === 0) {
      container.innerHTML = `
        <div style="padding:30px; text-align:center; color:#64748b; font-size:18px;">
          등록된 회원이 없습니다. [1. 회원 관리]에서 회원을 먼저 등록해주세요.
        </div>
      `;
      return;
    }

    let html = `
      <div class="matrix-legend">
        <div class="legend-item"><span class="matrix-cell status-paid">완료</span> 납부 완료 (초록)</div>
        <div class="legend-item"><span class="matrix-cell status-unpaid">미납</span> 미납 (빨강)</div>
        <div class="legend-item"><span class="matrix-cell status-partial">일부</span> 일부 납부 (노랑)</div>
        <div class="legend-item"><span class="matrix-cell status-check">확인</span> 확인 필요 (회색)</div>
        <div class="legend-item"><span class="matrix-cell status-na">해당없음</span> 대상 아님 (연회색)</div>
      </div>
      <div class="matrix-table-wrapper">
        <table class="matrix-table">
          <thead>
            <tr>
              <th style="min-width:110px;">회원명</th>
              ${months.map(m => `<th>${m.replace('-', '년 ')}월</th>`).join('')}
            </tr>
          </thead>
          <tbody>
    `;

    members.forEach(member => {
      html += `
        <tr>
          <td>
            <div style="font-weight:800; font-size:18px;">${member.name}</div>
            <div style="font-size:13px; color:#64748b;">${member.relation}</div>
          </td>
      `;

      months.forEach(month => {
        const record = data.feeRecords.find(
          r => r.memberId === member.id && r.targetMonth === month
        );

        let statusClass = 'status-unpaid';
        let statusText = '미납';
        let amount = 0;
        let paidAt = '-';

        if (record) {
          amount = record.amount || 0;
          paidAt = record.paidAt || '-';
          if (record.status === 'paid') {
            statusClass = 'status-paid';
            statusText = '완료';
          } else if (record.status === 'partial') {
            statusClass = 'status-partial';
            statusText = `${(amount / 10000).toFixed(1)}만`;
          } else if (record.status === 'check') {
            statusClass = 'status-check';
            statusText = '확인';
          } else if (record.status === 'na') {
            statusClass = 'status-na';
            statusText = '해당없음';
          } else if (record.status === 'cancelled') {
            statusClass = 'status-check';
            statusText = '취소됨';
          } else {
            statusClass = 'status-unpaid';
            statusText = '미납';
          }
        }

        html += `
          <td>
            <span class="matrix-cell ${statusClass}" 
                  onclick="window.hwamokCsv.openCellDetailModal('${member.id}', '${member.name}', '${month}', '${record ? record.id : ''}')"
                  title="${member.name} ${month} - 클릭하여 수정">
              ${statusText}
            </span>
          </td>
        `;
      });

      html += `</tr>`;
    });

    html += `
          </tbody>
        </table>
      </div>
      <p style="font-size:15px; color:#64748b; font-weight:600; text-align:right;">
        * 상태 뱃지를 터치하면 상세 기록 확인 및 납부 상태를 직접 변경할 수 있습니다.
      </p>
    `;

    container.innerHTML = html;
  }

  // 월 목록 생성 ('2026-05' ~ '2026-11')
  generateMonthList(start, end) {
    const [sY, sM] = start.split('-').map(Number);
    const [eY, eM] = end.split('-').map(Number);
    const months = [];

    let curY = sY;
    let curM = sM;

    while (curY < eY || (curY === eY && curM <= eM)) {
      const mStr = curM < 10 ? '0' + curM : '' + curM;
      months.push(`${curY}-${mStr}`);
      curM++;
      if (curM > 12) {
        curM = 1;
        curY++;
      }
    }
    return months;
  }

  // =========================================================================
  // 2. 셀 클릭 시 상세 수정 팝업 모달
  // =========================================================================

  openCellDetailModal(memberId, memberName, month, recordId) {
    if (window.hwamokAdmin && typeof window.hwamokAdmin.openMatrixModal === 'function') {
      window.hwamokAdmin.openMatrixModal(memberId, memberName, month, recordId);
      return;
    }

    const data = this.store.getData();
    const record = recordId ? data.feeRecords.find(r => r.id === recordId) : null;
    const currentStatus = record ? record.status : 'unpaid';
    const currentAmount = record ? record.amount : (data.settings.monthlyFee || 20000);
    const currentPaidAt = record && record.paidAt ? record.paidAt : new Date().toISOString().slice(0, 10);
    const currentNote = record && record.note ? record.note : '';

    const existing = document.getElementById('cell-detail-modal');
    if (existing) existing.remove();

    const modalHtml = `
      <div id="cell-detail-modal" class="modal-overlay active">
        <div class="modal-box">
          <div class="modal-header">
            <h3 class="modal-title">${memberName} 님 (${month}) 회비 기록</h3>
            <button class="btn-close-modal" onclick="document.getElementById('cell-detail-modal').remove()">✕</button>
          </div>
          
          <div class="form-group">
            <label class="form-label">납부 대상 연월</label>
            <input type="text" class="form-control" value="${month}" readonly style="background-color:#f1f5f9;">
            <div class="form-help">실제 입금일과 별개로 해당 월의 미납/납부 여부가 보존됩니다.</div>
          </div>

          <div class="form-group">
            <label class="form-label">납부 상태</label>
            <select id="modal-status-select" class="form-control">
              <option value="paid" ${currentStatus === 'paid' ? 'selected' : ''}>🟢 납부 완료</option>
              <option value="unpaid" ${currentStatus === 'unpaid' ? 'selected' : ''}>🔴 미납 (미납 보존)</option>
              <option value="partial" ${currentStatus === 'partial' ? 'selected' : ''}>🟡 일부 납부</option>
              <option value="check" ${currentStatus === 'check' ? 'selected' : ''}>⚪ 확인 필요</option>
              <option value="na" ${currentStatus === 'na' ? 'selected' : ''}>⚫ 대상 아님 (가입 전 등)</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">납부 금액 (원)</label>
            <input type="number" id="modal-amount-input" class="form-control" value="${currentAmount}" step="1000">
          </div>

          <div class="form-group">
            <label class="form-label">실제 입금일 (통장 입금일)</label>
            <input type="date" id="modal-paidat-input" class="form-control" value="${currentPaidAt}">
          </div>

          <div class="form-group">
            <label class="form-label">메모 / 비고</label>
            <input type="text" id="modal-note-input" class="form-control" value="${currentNote}" placeholder="예: 카카오뱅크 입금, 과거 미납분 납부">
          </div>

          <button id="btn-save-cell-record" class="btn-primary-action">저장하기</button>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('btn-save-cell-record').onclick = () => {
      const newStatus = document.getElementById('modal-status-select').value;
      const newAmount = Number(document.getElementById('modal-amount-input').value) || 0;
      const newPaidAt = document.getElementById('modal-paidat-input').value;
      const newNote = document.getElementById('modal-note-input').value;

      this.saveSingleCellRecord({
        memberId,
        targetMonth: month,
        status: newStatus,
        amount: newAmount,
        paidAt: newStatus === 'unpaid' ? null : newPaidAt,
        note: newNote
      });

      document.getElementById('cell-detail-modal').remove();
      this.renderMatrixTable('matrix-container');
    };
  }

  saveSingleCellRecord({ memberId, targetMonth, status, amount, paidAt, note }) {
    const data = this.store.getData();
    const index = data.feeRecords.findIndex(r => r.memberId === memberId && r.targetMonth === targetMonth);

    if (index >= 0) {
      data.feeRecords[index] = {
        ...data.feeRecords[index],
        status,
        amount,
        paidAt,
        note
      };
    } else {
      data.feeRecords.push({
        id: 'fr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        memberId,
        targetMonth,
        status,
        amount,
        paidAt,
        note
      });
    }

    this.store.saveData(data);
    this.store.logAdminAction('회비 기록 수정', `${targetMonth} 기록 수정 (${status}, ${amount}원)`);
  }

  // =========================================================================
  // 3. CSV 템플릿 다운로드 및 업로드/검증
  // =========================================================================

  // 표준 CSV 템플릿 다운로드
  downloadSampleCsv() {
    const data = this.store.getData();
    const members = data.members.filter(m => m.active);
    const sampleMembers = members.length > 0 ? members : [
      { name: '김장남' }, { name: '이차남' }, { name: '박삼남' }
    ];

    let csvContent = '\uFEFF'; // UTF-8 BOM (엑셀 한글 깨짐 방지)
    csvContent += '회원명,대상연월,납부상태,납부금액,실제입금일,비고\n';

    sampleMembers.forEach(m => {
      csvContent += `${m.name},2026-05,완료,20000,2026-05-10,정상납부\n`;
      csvContent += `${m.name},2026-06,완료,20000,2026-06-10,정상납부\n`;
    });
    csvContent += '이차남,2026-07,미납,0,,미납보존\n';
    csvContent += '박삼남,2026-07,일부,10000,2026-07-12,1만원잔여\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `화목회_과거회비_표준양식.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  // 업로드된 CSV 파일 파싱 및 유효성 검사
  parseAndValidateCsv(file, onPreview) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
      if (lines.length <= 1) {
        alert('CSV 파일에 유효한 데이터가 없습니다.');
        return;
      }

      const data = this.store.getData();
      const existingMembers = data.members;

      const previewRows = [];
      let validCount = 0;
      let errorCount = 0;

      // 헤더 제외
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
        if (parts.length < 3) continue;

        const [name, targetMonth, statusStr, amountStr, paidAtStr, noteStr] = parts;
        const member = existingMembers.find(m => m.name === name);

        let error = null;
        if (!member) {
          error = `회원 [${name}] 미등록`;
        } else if (!/^\d{4}-\d{2}$/.test(targetMonth)) {
          error = `대상연월 형식 오류 (예: 2026-05)`;
        }

        // 상태 정규화
        let status = 'unpaid';
        if (statusStr === '완료' || statusStr === '납부' || statusStr === 'paid') status = 'paid';
        else if (statusStr === '일부' || statusStr === 'partial') status = 'partial';
        else if (statusStr === '확인' || statusStr === 'check') status = 'check';
        else if (statusStr === '해당없음' || statusStr === 'na') status = 'na';

        const amount = Number(amountStr) || (status === 'paid' ? 20000 : 0);

        if (error) {
          errorCount++;
        } else {
          validCount++;
        }

        previewRows.push({
          memberId: member ? member.id : null,
          name,
          targetMonth,
          status,
          statusStr,
          amount,
          paidAt: paidAtStr || null,
          note: noteStr || '',
          error
        });
      }

      onPreview({ previewRows, validCount, errorCount });
    };

    reader.readAsText(file, 'UTF-8');
  }

  // 미리보기 후 최종 일괄 저장 (중복 방지 적용)
  commitCsvImport(previewRows) {
    const data = this.store.getData();
    let imported = 0;

    previewRows.forEach(row => {
      if (row.error || !row.memberId) return;

      const existingIndex = data.feeRecords.findIndex(
        r => r.memberId === row.memberId && r.targetMonth === row.targetMonth
      );

      const recordItem = {
        id: existingIndex >= 0 ? data.feeRecords[existingIndex].id : 'fr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        memberId: row.memberId,
        targetMonth: row.targetMonth,
        status: row.status,
        amount: row.amount,
        paidAt: row.paidAt,
        note: row.note || 'CSV 일괄 이관'
      };

      if (existingIndex >= 0) {
        data.feeRecords[existingIndex] = recordItem;
      } else {
        data.feeRecords.push(recordItem);
      }
      imported++;
    });

    this.store.saveData(data);
    this.store.logAdminAction('과거 회비 CSV 이관', `${imported}건의 회비 기록 성공적 이관`);
    return imported;
  }

  // =========================================================================
  // 4. 전체 자료 다운로드 (CSV 내보내기)
  // =========================================================================

  // 회계 장부 CSV 다운로드
  exportLedgerCsv() {
    const data = this.store.getData();
    let csv = '\uFEFF거래일자,구분,분류,내역,금액,상태,취소사유,비고\n';
    data.transactions.forEach(t => {
      const typeStr = t.type === 'income' ? '수입' : '지출';
      const statusStr = t.status === 'cancelled' ? '취소됨' : '정상';
      csv += `${t.date},${typeStr},${t.category},"${t.desc.replace(/"/g, '""')}",${t.amount},${statusStr},"${(t.cancelReason || '').replace(/"/g, '""')}","${(t.note || '').replace(/"/g, '""')}"\n`;
    });
    this.downloadBlob(csv, `화목회_회계장부_${new Date().toISOString().slice(0, 10)}.csv`);
  }

  // 회원 명부 CSV 다운로드
  exportMembersCsv() {
    const data = this.store.getData();
    let csv = '\uFEFF회원ID,이름,가족관계,연락처,상태,회비부과대상,가입일자,비고\n';
    data.members.forEach(m => {
      const statusStr = m.status === 'withdrawn' ? '탈퇴' : (!m.active ? '비활성' : '활동');
      const targetStr = m.isFeeTarget !== false ? '부과대상' : '면제/제외';
      csv += `${m.id},${m.name},${m.relation},${m.phone || '-'},${statusStr},${targetStr},${m.joinedAt || '-'},"${(m.note || '').replace(/"/g, '""')}"\n`;
    });
    this.downloadBlob(csv, `화목회_회원명부_${new Date().toISOString().slice(0, 10)}.csv`);
  }

  // 회비 납부 기록 전체 CSV 다운로드
  exportFeeRecordsCsv() {
    const data = this.store.getData();
    let csv = '\uFEFF회원명,가족관계,대상연월,상태,납부금액,실제입금일,취소사유,비고\n';
    data.feeRecords.forEach(r => {
      const member = data.members.find(m => m.id === r.memberId);
      const name = member ? member.name : '알수없음';
      const rel = member ? member.relation : '-';
      const statusStr = r.status === 'cancelled' ? '취소됨' : (r.status === 'paid' ? '완납' : (r.status === 'partial' ? '일부납' : '미납'));
      csv += `${name},${rel},${r.targetMonth},${statusStr},${r.amount},${r.paidAt || '-'},"${(r.cancelReason || '').replace(/"/g, '""')}","${(r.note || '').replace(/"/g, '""')}"\n`;
    });
    this.downloadBlob(csv, `화목회_전체납부기록_${new Date().toISOString().slice(0, 10)}.csv`);
  }

  downloadBlob(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
}

window.hwamokCsv = new HwamokCsvManager();
