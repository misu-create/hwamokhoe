/**
 * 화목회 가족 웹사이트 메인 애플리케이션 (HwamokApp)
 * - 50~70대 시니어 중심 1탭 1화면 전환
 * - 각 화면별 따뜻하고 감성적인 비주얼 배너 동적 제어
 * - 실시간 데이터 렌더링 (회비, 장부, 모임, 공지)
 * - 자동 D-Day 및 회비 월별 통계 계산
 */

class HwamokApp {
  constructor() {
    this.currentView = 'home';
    const today = new Date();
    const curY = today.getFullYear();
    const curM = today.getMonth() + 1;
    this.feeSelectedMonth = `${curY}-${curM < 10 ? '0' + curM : curM}`;
    
    this.ledgerFilter = 'all';
    this.noticeFilter = 'all';
    this.activeNoticeForModal = null;

    this.init();
  }

  init() {
    this.updateModeBanner();
    this.renderHome();
    this.setupEventListeners();
  }

  updateModeBanner() {
    const banner = document.getElementById('notice-mode-banner');
    if (!banner) return;
    const mode = window.hwamokStore.getMode();
    if (mode === 'prod') {
      banner.style.display = 'none';
    } else {
      banner.style.display = 'flex';
      banner.innerHTML = `<span>🌿 현재 <b>시범 화면</b>으로 둘러보실 수 있습니다.</span><span style="font-size:14px; opacity:0.9;">(총무 관리에서 실제 운영 모드 전환 가능)</span>`;
    }
  }

  // 화면 전환 (SPA) 및 감성 배너 동적 갱신
  switchView(viewName) {
    this.currentView = viewName;
    const views = document.querySelectorAll('.view-section');
    views.forEach(v => v.classList.remove('active'));

    const target = document.getElementById(`view-${viewName}`);
    if (target) {
      target.classList.add('active');
    }

    const subNav = document.getElementById('sub-nav-bar');
    const screenTitle = document.getElementById('current-screen-name');
    const heroBanner = document.getElementById('main-hero-banner');
    const heroTag = document.getElementById('hero-tag-text');
    const heroTitle = document.getElementById('hero-title-text');
    const heroSub = document.getElementById('hero-sub-text');
    const heroDesc = document.getElementById('hero-desc-text');

    // 화면별 감성 배너 설정
    const bannerThemes = {
      home: {
        bannerClass: 'hero-banner home-banner',
        tag: '🌸 우리 가족의 행복한 모임',
        title: '화목회',
        sub: '함께 모이고, 함께 나누는 가족 공간',
        desc: '정다운 온기와 사랑이 가득한 우리 가족만의 따뜻한 보금자리입니다.',
        navTitle: '화목회'
      },
      fee: {
        bannerClass: 'hero-banner fee-banner',
        tag: '🌱 투명하고 든든한 살림살이',
        title: '가족 회비 현황',
        sub: '정성으로 모이는 소중한 가족 기금',
        desc: '가족 모두의 정성이 모여 화목한 만남과 따뜻한 행사를 만들어갑니다.',
        navTitle: '📊 회비 현황'
      },
      ledger: {
        bannerClass: 'hero-banner ledger-banner',
        tag: '📒 정직하고 투명한 살림 기록',
        title: '화목회 회계 장부',
        sub: '가족 회비 수입과 지출 내역',
        desc: '한 푼도 헛되지 않도록 투명하고 정갈하게 기록하여 관리합니다.',
        navTitle: '📒 회계 장부'
      },
      meeting: {
        bannerClass: 'hero-banner meeting-banner',
        tag: '🎉 설레는 만남과 행복한 여행',
        title: '정다운 가족 모임',
        sub: '보고 싶은 가족들과 함께하는 날',
        desc: '정겨운 웃음과 따뜻한 이야기가 꽃피는 행복한 모임 일정입니다.',
        navTitle: '🎉 가족 모임'
      },
      notice: {
        bannerClass: 'hero-banner notice-banner-hero',
        tag: '💌 정다운 가족 편지와 소식',
        title: '가족 공지사항',
        sub: '가족에게 전하는 따뜻한 알림',
        desc: '기쁜 소식과 중요 일정을 가족 모두에게 소중히 전달합니다.',
        navTitle: '📢 공지 사항'
      }
    };

    const curTheme = bannerThemes[viewName] || bannerThemes.home;

    if (heroBanner) heroBanner.className = curTheme.bannerClass;
    if (heroTag) heroTag.innerText = curTheme.tag;
    if (heroTitle) heroTitle.innerText = curTheme.title;
    if (heroSub) heroSub.innerText = curTheme.sub;
    if (heroDesc) heroDesc.innerText = curTheme.desc;

    if (viewName === 'home') {
      subNav.style.display = 'none';
      this.renderHome();
    } else {
      subNav.style.display = 'flex';
      if (screenTitle) screenTitle.innerText = curTheme.navTitle;

      if (viewName === 'fee') this.renderFeeStatus();
      if (viewName === 'ledger') this.renderLedger();
      if (viewName === 'meeting') this.renderMeetings();
      if (viewName === 'notice') this.renderNotices();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // =========================================================================
  // 1. 홈 화면 렌더링
  // =========================================================================
  renderHome() {
    const summary = window.hwamokStore.calculateLedgerSummary();
    const balanceElem = document.getElementById('home-total-balance');
    if (balanceElem) {
      balanceElem.innerText = `${summary.currentBalance.toLocaleString()}원`;
    }

    // 최근 공지 1건 요약
    const data = window.hwamokStore.getData();
    const noticeElem = document.getElementById('home-recent-notice-title');
    if (noticeElem && data.notices.length > 0) {
      const latest = data.notices[0];
      noticeElem.innerText = `[${latest.categoryName || '소식'}] ${latest.title}`;
    } else if (noticeElem) {
      noticeElem.innerText = '등록된 최근 가족 소식이 없습니다.';
    }
  }

  // =========================================================================
  // 2. 회비 현황 렌더링
  // =========================================================================
  renderFeeStatus() {
    const summary = window.hwamokStore.getMonthFeeSummary(this.feeSelectedMonth);
    const [year, month] = this.feeSelectedMonth.split('-');

    const monthElem = document.getElementById('fee-current-month');
    if (monthElem) {
      monthElem.innerText = `${year}년 ${Number(month)}월`;
    }

    const paidCountElem = document.getElementById('fee-paid-count');
    if (paidCountElem) paidCountElem.innerText = `${summary.paidCount}명`;

    const unpaidCountElem = document.getElementById('fee-unpaid-count');
    if (unpaidCountElem) unpaidCountElem.innerText = `${summary.unpaidCount}명`;

    const stdAmountElem = document.getElementById('fee-standard-amount');
    if (stdAmountElem) stdAmountElem.innerText = `${summary.monthlyFee.toLocaleString()}원`;

    const expectedElem = document.getElementById('fee-expected-amount');
    if (expectedElem) expectedElem.innerText = `${summary.totalExpectedAmount.toLocaleString()}원 (${summary.totalExpectedCount}명 기준)`;

    const actualElem = document.getElementById('fee-actual-amount');
    if (actualElem) actualElem.innerText = `${summary.actualPaidAmount.toLocaleString()}원`;

    const unpaidAmountElem = document.getElementById('fee-unpaid-amount');
    if (unpaidAmountElem) unpaidAmountElem.innerText = `${summary.totalUnpaidAmount.toLocaleString()}원`;
  }

  changeFeeMonth(delta) {
    const [yStr, mStr] = this.feeSelectedMonth.split('-');
    let y = Number(yStr);
    let m = Number(mStr) + delta;

    if (m > 12) {
      m = 1;
      y++;
    } else if (m < 1) {
      m = 12;
      y--;
    }

    this.feeSelectedMonth = `${y}-${m < 10 ? '0' + m : m}`;
    this.renderFeeStatus();
  }

  shareCurrentFee() {
    window.hwamokShare.share('fee', { yearMonth: this.feeSelectedMonth });
  }

  // =========================================================================
  // 3. 회계 장부 렌더링
  // =========================================================================
  renderLedger() {
    const summary = window.hwamokStore.calculateLedgerSummary();
    const balanceElem = document.getElementById('ledger-total-balance');
    if (balanceElem) {
      balanceElem.innerText = `${summary.currentBalance.toLocaleString()}원`;
    }

    const data = window.hwamokStore.getData();
    const container = document.getElementById('ledger-list-container');
    if (!container) return;

    let txList = [...data.transactions];
    if (this.ledgerFilter !== 'all') {
      txList = txList.filter(t => t.type === this.ledgerFilter);
    }

    if (txList.length === 0) {
      container.innerHTML = `
        <div style="padding:30px; text-align:center; color:#78716c; font-size:18px;">
          해당 입출금 내역이 없습니다.
        </div>
      `;
      return;
    }

    let html = '';
    txList.forEach(t => {
      const isIncome = t.type === 'income';
      const sign = isIncome ? '+' : '-';
      const amountClass = isIncome ? 'income' : 'expense';

      html += `
        <div class="ledger-item">
          <div class="ledger-left">
            <span class="ledger-date">${t.date}</span>
            <span class="ledger-desc">${t.desc}</span>
            ${t.note ? `<span style="font-size:14px; color:#a8a29e; margin-top:2px;">비고: ${t.note}</span>` : ''}
          </div>
          <div class="ledger-right">
            <div class="ledger-amount ${amountClass}">${sign}${Number(t.amount).toLocaleString()}원</div>
            <span class="ledger-category">${t.category || (isIncome ? '수입' : '지출')}</span>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  filterLedger(type, buttonElem) {
    this.ledgerFilter = type;
    const tabs = document.querySelectorAll('.btn-ledger-tab');
    tabs.forEach(t => t.classList.remove('active'));
    if (buttonElem) buttonElem.classList.add('active');
    this.renderLedger();
  }

  // =========================================================================
  // 4. 가족 모임 및 여행 렌더링 (초대장 느낌)
  // =========================================================================
  renderMeetings() {
    const data = window.hwamokStore.getData();
    const nextEvent = data.events.find(e => e.isNext) || data.events[0];

    const titleElem = document.getElementById('next-meeting-title');
    const dateElem = document.getElementById('next-meeting-date');
    const timeElem = document.getElementById('next-meeting-time');
    const locElem = document.getElementById('next-meeting-loc');
    const bannerElem = document.getElementById('next-meeting-banner');

    if (nextEvent) {
      titleElem.innerText = nextEvent.title;
      dateElem.innerText = nextEvent.date;
      timeElem.innerText = nextEvent.time || '시간 추후 안내';
      locElem.innerText = `${nextEvent.location} ${nextEvent.address ? `(${nextEvent.address})` : ''}`;

      // D-Day 계산
      const ddayBadge = bannerElem.querySelector('.event-dday-badge');
      if (ddayBadge && nextEvent.date) {
        const eventDateStr = nextEvent.date.slice(0, 10);
        const eventDate = new Date(eventDateStr);
        const now = new Date();
        const diffDays = Math.ceil((eventDate - now) / (1000 * 60 * 60 * 24));
        if (diffDays > 0) {
          ddayBadge.innerText = `D-${diffDays} (기다려지는 날)`;
        } else if (diffDays === 0) {
          ddayBadge.innerText = `🎉 D-DAY (오늘 모입니다!)`;
        } else {
          ddayBadge.innerText = `행복했던 모임`;
        }
      }
    } else {
      titleElem.innerText = '예정된 다음 모임이 없습니다.';
      dateElem.innerText = '-';
      timeElem.innerText = '-';
      locElem.innerText = '-';
    }

    // 전체 일정 타임라인 렌더링
    const container = document.getElementById('meeting-timeline-container');
    if (!container) return;

    if (data.events.length === 0) {
      container.innerHTML = `
        <div style="padding:24px; text-align:center; color:#78716c; font-size:18px;">
          등록된 모임 및 여행 일정이 없습니다.
        </div>
      `;
      return;
    }

    let html = '';
    data.events.forEach(ev => {
      html += `
        <div class="timeline-item">
          <div class="timeline-date">🗓️ ${ev.date} ${ev.time ? `· ${ev.time}` : ''}</div>
          <div class="timeline-title">${ev.title}</div>
          <div class="timeline-body">
            <div>📍 <b>모이는 장소:</b> ${ev.location}</div>
            ${ev.description ? `<div style="margin-top:6px; color:#57534e;">📝 ${ev.description}</div>` : ''}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  // =========================================================================
  // 5. 공지사항 렌더링 및 모달
  // =========================================================================
  renderNotices() {
    const data = window.hwamokStore.getData();
    const container = document.getElementById('notice-list-container');
    if (!container) return;

    let list = [...data.notices];
    if (this.noticeFilter !== 'all') {
      list = list.filter(n => n.category === this.noticeFilter);
    }

    if (list.length === 0) {
      container.innerHTML = `
        <div style="padding:30px; text-align:center; color:#78716c; font-size:18px;">
          해당 분류의 가족 소식이 없습니다.
        </div>
      `;
      return;
    }

    let html = '';
    list.forEach(n => {
      const badgeClass = n.category || 'fee';
      html += `
        <div class="notice-card-item" onclick="window.hwamokApp.openNoticeModal('${n.id}')">
          <span class="notice-badge ${badgeClass}">${n.categoryName || '소식'}</span>
          ${n.pinned ? `<span style="font-size:13px; font-weight:800; color:#dc2626; margin-left:6px;">📌 꼭 읽어보세요</span>` : ''}
          <h3 class="notice-item-title">${n.title}</h3>
          <p class="notice-item-snippet">${n.content.slice(0, 75)}${n.content.length > 75 ? '...' : ''}</p>
          <span class="notice-item-date">${n.date} · 총무 올림</span>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  filterNotices(category, buttonElem) {
    this.noticeFilter = category;
    const chips = document.querySelectorAll('.btn-category-chip');
    chips.forEach(c => c.classList.remove('active'));
    if (buttonElem) buttonElem.classList.add('active');
    this.renderNotices();
  }

  openNoticeModal(noticeId) {
    const data = window.hwamokStore.getData();
    const notice = data.notices.find(n => n.id === noticeId);
    if (!notice) return;

    this.activeNoticeForModal = notice;
    document.getElementById('modal-notice-title').innerText = notice.title;

    // 카테고리 배지 표시
    const catBadgeElem = document.getElementById('modal-notice-category-badge');
    if (catBadgeElem) {
      const catLabel = window.hwamokShare ? window.hwamokShare.getNoticeCategoryLabel(notice) : (notice.categoryName || '가족 소식');
      const badgeClass = notice.category || 'fee';
      catBadgeElem.innerHTML = `<span class="notice-badge ${badgeClass}" style="font-size:14px; padding:4px 12px; font-weight:700;">${catLabel}</span>`;
    }

    document.getElementById('modal-notice-date').innerText = `등록일: ${notice.date} · 총무 올림`;
    document.getElementById('modal-notice-body').innerText = notice.content;

    // 카카오톡 피드 카드 공유 버튼
    const btnShareCard = document.getElementById('btn-modal-share-card');
    if (btnShareCard) {
      btnShareCard.onclick = () => {
        window.hwamokShare.share('notice', { notice });
      };
    }

    // 공지 전문 복사 버튼 (가족 단톡방 붙여넣기용)
    const btnCopyFull = document.getElementById('btn-modal-copy-full');
    if (btnCopyFull) {
      btnCopyFull.onclick = () => {
        window.hwamokShare.copyNoticeFullText(notice);
      };
    }

    // 하위 호환: 혹시 기존 버튼이 남아있을 경우
    const modalShareBtn = document.getElementById('btn-modal-share');
    if (modalShareBtn) {
      modalShareBtn.onclick = () => {
        window.hwamokShare.share('notice', { notice });
      };
    }

    document.getElementById('notice-detail-modal').classList.add('active');
  }

  closeNoticeModal() {
    document.getElementById('notice-detail-modal').classList.remove('active');
    this.activeNoticeForModal = null;
  }

  // 홈 화면 추가(PWA) 가이드 모달 제어
  openPwaGuideModal() {
    const modal = document.getElementById('pwa-guide-modal');
    if (modal) modal.classList.add('active');
  }

  closePwaGuideModal() {
    const modal = document.getElementById('pwa-guide-modal');
    if (modal) modal.classList.remove('active');
  }

  setupEventListeners() {
    // URL 쿼리 파라미터(?notice=ID) 및 해시(#view-fee, #notice-1 등) 접속 시 자동 화면 전환 & 공지 모달 오픈
    const handleUrlRoute = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const noticeId = urlParams.get('notice');
      const hash = window.location.hash.replace('#', '');

      if (noticeId) {
        this.switchView('notice');
        setTimeout(() => {
          this.openNoticeModal(noticeId);
        }, 80);
        return;
      }

      if (hash.startsWith('notice-')) {
        this.switchView('notice');
        setTimeout(() => {
          this.openNoticeModal(hash);
        }, 80);
        return;
      }

      if (hash.startsWith('view-')) {
        const view = hash.replace('view-', '');
        this.switchView(view);
      }
    };

    handleUrlRoute();

    window.addEventListener('hashchange', handleUrlRoute);

    window.addEventListener('popstate', (e) => {
      if (e.state && e.state.view) {
        this.switchView(e.state.view);
      } else {
        this.switchView('home');
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.hwamokApp = new HwamokApp();
});
