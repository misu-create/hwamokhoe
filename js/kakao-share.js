/**
 * 카카오톡 가족 초대 및 공유 엔진 (Kakao JavaScript SDK 연동 & Web Share API & 링크 복사 Fallback)
 * 
 * [5대 공유 기능 구분]
 * ① invite  : 가족 초대하기 (메인 환영 초대장 및 홈페이지 바로가기)
 * ② fee     : 회비 현황 공유 (월별 수납 현황 요약, 익명 통계)
 * ③ ledger  : 회계장부 공유 (수입, 지출, 잔액 요약)
 * ④ meeting : 가족 모임 공유 (모임 일시, 장소, 세부 안내)
 * ⑤ notice  : 공지사항 공유 (공식 카드 공유 및 공지 전문 복사 2종 지원)
 * 
 * [공식 도메인 및 주소]
 * - 도메인: https://misu-create.github.io
 * - 홈페이지: https://misu-create.github.io/hwamokhoe/
 */

const KAKAO_STORAGE_KEY = 'hwamokhoe_kakao_js_key';
const DEFAULT_PUBLIC_URL = 'https://misu-create.github.io/hwamokhoe/';

class HwamokKakaoShare {
  constructor() {
    this.isSdkInitialized = false;
    this.initKakao();
  }

  // 효과적인 JavaScript 키 획득 (1순위: kakao-config.js, 2순위: localStorage 마이그레이션)
  getEffectiveKey() {
    if (window.HWAMOK_KAKAO_CONFIG && window.HWAMOK_KAKAO_CONFIG.JAVASCRIPT_KEY && window.HWAMOK_KAKAO_CONFIG.JAVASCRIPT_KEY.trim()) {
      return window.HWAMOK_KAKAO_CONFIG.JAVASCRIPT_KEY.trim();
    }
    const saved = localStorage.getItem(KAKAO_STORAGE_KEY);
    if (saved && saved.trim()) {
      return saved.trim();
    }
    return '';
  }

  initKakao() {
    if (!window.Kakao) {
      console.warn('[화목회] Kakao SDK 스크립트가 아직 로드되지 않았습니다.');
      return;
    }

    // 중복 초기화 방지
    if (window.Kakao.isInitialized()) {
      this.isSdkInitialized = true;
      return;
    }

    const appKey = this.getEffectiveKey();
    if (appKey && appKey.length > 0) {
      try {
        window.Kakao.init(appKey);
        this.isSdkInitialized = window.Kakao.isInitialized();
        console.log('[화목회] Kakao SDK 자동 초기화 완료:', this.isSdkInitialized);
      } catch (e) {
        console.warn('[화목회] Kakao SDK 초기화 알림:', e);
        this.isSdkInitialized = false;
      }
    } else {
      console.info('[화목회] Kakao JavaScript 키 설정 대기 (링크 복사 모드로 안전 작동)');
      this.isSdkInitialized = false;
    }
  }

  getAppKey() {
    return this.getEffectiveKey();
  }

  setAppKey(key) {
    if (key && key.trim()) {
      localStorage.setItem(KAKAO_STORAGE_KEY, key.trim());
      this.initKakao();
    }
  }

  // 실제 외부 접속 가능한 HTTPS 절대 주소 계산 (GitHub Pages 기준 통일)
  getCanonicalUrl(hashPath = '', queryParams = '') {
    const base = (window.HWAMOK_KAKAO_CONFIG && window.HWAMOK_KAKAO_CONFIG.SITE_URL)
      ? window.HWAMOK_KAKAO_CONFIG.SITE_URL
      : DEFAULT_PUBLIC_URL;

    let url = base.endsWith('/') ? base : base + '/';

    if (queryParams) {
      url += (url.includes('?') ? '&' : '?') + queryParams;
    }
    if (hashPath) {
      url += (hashPath.startsWith('#') ? hashPath : '#' + hashPath);
    }
    return url;
  }

  // 대표 이미지 절대 HTTPS URL 계산 (1200x630 규격)
  getRepresentativeImageUrl() {
    if (window.HWAMOK_KAKAO_CONFIG && window.HWAMOK_KAKAO_CONFIG.OG_IMAGE_URL) {
      return window.HWAMOK_KAKAO_CONFIG.OG_IMAGE_URL;
    }
    return 'https://misu-create.github.io/hwamokhoe/assets/og-image.png';
  }

  // 공지 분류(카테고리) 정확한 한글 라벨 추출
  getNoticeCategoryLabel(notice) {
    if (!notice) return '일반 공지';
    if (notice.categoryName) {
      const name = notice.categoryName.trim();
      if (name.includes('모임')) return '가족 모임 안내';
      if (name.includes('여행')) return '여행 안내';
      if (name.includes('회비')) return '회비 납부 안내';
      if (name.includes('경조')) return '경조사 안내';
      return name;
    }
    const catMap = {
      meeting: '가족 모임 안내',
      trip: '여행 안내',
      fee: '회비 납부 안내',
      family: '경조사 안내',
      general: '일반 공지'
    };
    return catMap[notice.category] || '일반 공지';
  }

  // =========================================================================
  // 1. 카카오톡 공식 카드 공유 (sendDefault)
  // =========================================================================
  share(type = 'invite', extraData = {}) {
    const siteUrl = this.getCanonicalUrl();
    const imageUrl = this.getRepresentativeImageUrl();

    let title = '화목회에 초대합니다!';
    let description = '우리 가족의 행복한 모임, 화목회입니다.\n\n가족 회비와 모임 일정, 공지사항을 편리하게 확인할 수 있습니다.\n\n홈페이지에 로그인하지 않아도 바로 이용할 수 있습니다.';
    let buttonTitle = '화목회 홈페이지 바로가기';
    let targetUrl = siteUrl;

    // ① 가족 초대하기 (기본)
    if (type === 'invite') {
      title = '화목회에 초대합니다!';
      description = '우리 가족의 행복한 모임, 화목회입니다.\n\n가족 회비와 모임 일정, 공지사항을 편리하게 확인할 수 있습니다.\n\n홈페이지에 로그인하지 않아도 바로 이용할 수 있습니다.';
      buttonTitle = '화목회 홈페이지 바로가기';
      targetUrl = siteUrl;
    }
    // ② 회비 현황 공유
    else if (type === 'fee') {
      const ym = extraData.yearMonth || new Date().toISOString().slice(0, 7);
      const summary = window.hwamokStore.getMonthFeeSummary(ym);
      title = `📊 화목회 ${ym.replace('-', '년 ')}월 회비 현황`;
      description = `가족 모두의 정성으로 모인 회비 수납 현황입니다.\n• 납부 완료: ${summary.paidCount}명\n• 납부 예정: ${summary.unpaidCount}명\n• 실제 납부액: ${summary.actualPaidAmount.toLocaleString()}원\n\n(개인별 명단은 비공개로 안전하게 보호됩니다)`;
      buttonTitle = '이달의 회비 현황 확인하기';
      targetUrl = this.getCanonicalUrl('view-fee');
    }
    // ③ 회계 장부 공유
    else if (type === 'ledger') {
      const summary = window.hwamokStore.calculateLedgerSummary();
      title = '📒 화목회 회계 장부 현황';
      description = `현재 총 회비 잔액: ${summary.currentBalance.toLocaleString()}원\n\n우리 가족의 소중한 살림살이 입출금 내역을 투명하게 확인해 보세요.`;
      buttonTitle = '회계 장부 내역 확인하기';
      targetUrl = this.getCanonicalUrl('view-ledger');
    }
    // ④ 가족 모임 공유
    else if (type === 'meeting') {
      const data = window.hwamokStore.getData();
      const nextEvent = data.events.find(e => e.isNext) || data.events[0];
      if (nextEvent) {
        title = `🎉 다음 가족 모임: ${nextEvent.title}`;
        description = `보고 싶은 가족들이 함께 모이는 날입니다!\n• 일시: ${nextEvent.date} ${nextEvent.time || ''}\n• 장소: ${nextEvent.location}\n\n상세 일정 및 여행 계획을 확인하세요.`;
      } else {
        title = '🎉 화목회 가족 모임 안내';
        description = '화목회 정다운 모임 및 여행 일정을 홈페이지에서 확인하세요.';
      }
      buttonTitle = '모임 일정 확인하기';
      targetUrl = this.getCanonicalUrl('view-meeting');
    }
    // ⑤ 공지사항 공유 (실제 제목, 실제 요약, 정확한 분류, 공지 상세 링크)
    else if (type === 'notice') {
      const notice = extraData.notice;
      if (notice) {
        const catLabel = this.getNoticeCategoryLabel(notice);
        title = `📢 [${catLabel}] ${notice.title}`;
        
        // 공지 본문의 줄바꿈을 공백으로 정리하여 카카오 카드 요약문으로 최적화 (글자수 제한 고려)
        const cleanContent = (notice.content || '').replace(/\r?\n+/g, ' ').trim();
        const snippet = cleanContent.length > 95 ? cleanContent.slice(0, 95) + '...' : cleanContent;
        description = `${snippet}\n\n(등록일: ${notice.date} · 총무 작성)`;
        
        buttonTitle = '공지사항 전체 읽기';
        // 공지 고유 ID를 전달하여 카카오 인앱 브라우저에서 바로 해당 공지가 열리도록 설정
        targetUrl = this.getCanonicalUrl('view-notice', `notice=${encodeURIComponent(notice.id)}`);
      } else {
        title = '📢 화목회 가족 공지사항';
        description = '가족들에게 전하는 따뜻한 소식과 중요 안내를 확인하세요.';
        buttonTitle = '공지사항 전체 읽기';
        targetUrl = this.getCanonicalUrl('view-notice');
      }
    }

    // 1단계: Kakao 공식 JavaScript SDK 공유 시도
    if (this.isSdkInitialized && window.Kakao && window.Kakao.Share) {
      try {
        window.Kakao.Share.sendDefault({
          objectType: 'feed',
          content: {
            title: title,
            description: description,
            imageUrl: imageUrl,
            imageWidth: 1200,
            imageHeight: 630,
            link: {
              mobileWebUrl: targetUrl,
              webUrl: targetUrl
            }
          },
          buttons: [
            {
              title: buttonTitle,
              link: {
                mobileWebUrl: targetUrl,
                webUrl: targetUrl
              }
            }
          ]
        });
        return;
      } catch (err) {
        console.warn('[화목회] 카카오 SDK 공유 호출 실패:', err);
      }
    }

    // 2단계: 공지사항 공유이고 SDK 실패 시, 바로 공지 전문 복사 실행
    if (type === 'notice' && extraData.notice) {
      this.copyNoticeFullText(extraData.notice);
      return;
    }

    // 3단계: 일반 공유 스마트폰 네이티브 공유 시트
    const fullShareText = `${title}\n\n${description}\n\n👉 바로가기: ${targetUrl}`;
    if (navigator.share) {
      navigator.share({
        title: title,
        text: `${title}\n\n${description}`,
        url: targetUrl
      }).catch((e) => {
        if (e.name !== 'AbortError') {
          this.executeClipboardCopy(title, fullShareText, targetUrl);
        }
      });
      return;
    }

    // 4단계: 클립보드 복사 폴백
    this.executeClipboardCopy(title, fullShareText, targetUrl);
  }

  // =========================================================================
  // 2. 공지 전문 복사 기능 (줄바꿈/문단 100% 보존, 임의 축약 없음)
  // =========================================================================
  copyNoticeFullText(notice) {
    if (!notice) {
      this.showToast('공지 정보를 찾을 수 없습니다.');
      return;
    }

    const catLabel = this.getNoticeCategoryLabel(notice);
    const noticeUrl = this.getCanonicalUrl('view-notice', `notice=${encodeURIComponent(notice.id)}`);

    // 사용자 요구사항에 맞춘 정형화된 공지 전문 포맷
    const fullText = 
`[화목회 공지사항]

분류: ${catLabel}
제목: ${notice.title}

내용:
${notice.content}

화목회 홈페이지:
${noticeUrl}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(fullText).then(() => {
        this.showToast('공지 내용이 복사되었습니다.\n카카오톡 가족방에 붙여넣어 전송해 주세요. 💬');
      }).catch(() => {
        this.showLegacyCopyModal(fullText, '공지 전문 복사 안내');
      });
    } else {
      this.showLegacyCopyModal(fullText, '공지 전문 복사 안내');
    }
  }

  // 클립보드 복사 실행 및 알림
  executeClipboardCopy(title, fullText, targetUrl) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(fullText).then(() => {
        this.showToast('안내 문구와 링크가 복사되었습니다!\n화목회 가족방에 [붙여넣기] 해주세요. 💬');
      }).catch(() => {
        this.showLegacyCopyModal(fullText);
      });
    } else {
      this.showLegacyCopyModal(fullText);
    }
  }

  // 구형 브라우저 또는 클립보드 권한 없을 시 백업 팝업 모달
  showLegacyCopyModal(text, modalTitle = '카카오톡 공유 안내') {
    const existing = document.getElementById('kakao-copy-modal');
    if (existing) existing.remove();

    const modalHtml = `
      <div id="kakao-copy-modal" class="modal-overlay active">
        <div class="modal-box">
          <div class="modal-header">
            <h3 class="modal-title">${modalTitle}</h3>
            <button class="btn-close-modal" onclick="document.getElementById('kakao-copy-modal').remove()">✕</button>
          </div>
          <p style="font-size:17px; margin-bottom:12px; font-weight:700; color:#1e3a5f; line-height:1.5;">
            아래 내용을 복사하여 <b>'화목회 가족방'</b> 카카오톡 단체방에 전송해 주세요!
          </p>
          <textarea id="copy-target-area" style="width:100%; height:200px; font-size:16px; padding:12px; border:2px solid #cbd5e1; border-radius:14px; background:#faf9f6; line-height:1.6; white-space:pre-wrap;" readonly>${text}</textarea>
          <button id="btn-select-copy" class="btn-primary-action" style="margin-top:14px; background-color:#fee500; color:#191919; min-height:56px;">
            전체 선택 및 복사하기 📋
          </button>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('btn-select-copy').onclick = () => {
      const area = document.getElementById('copy-target-area');
      area.select();
      document.execCommand('copy');
      alert('공지 내용이 복사되었습니다.\n카카오톡 가족방에 붙여넣어 전송해 주세요.');
      document.getElementById('kakao-copy-modal').remove();
    };
  }

  showToast(message) {
    let toast = document.getElementById('hwamok-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'hwamok-toast';
      toast.className = 'toast-notice';
      document.body.appendChild(toast);
    }
    toast.innerText = message;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 4000);
  }
}

window.hwamokShare = new HwamokKakaoShare();
