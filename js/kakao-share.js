/**
 * 카카오톡 가족 초대 및 공유 엔진 (Kakao JavaScript SDK 연동 & Web Share API & 링크 복사 Fallback)
 * 
 * [5대 공유 기능 구분]
 * ① invite  : 가족 초대하기 (메인 환영 초대장 및 홈페이지 바로가기)
 * ② fee     : 회비 현황 공유 (월별 수납 현황 요약, 익명 통계)
 * ③ ledger  : 회계장부 공유 (수입, 지출, 잔액 요약)
 * ④ meeting : 가족 모임 공유 (모임 일시, 장소, 세부 안내)
 * ⑤ notice  : 공지사항 공유 (공지 제목, 내용 요약, 확인 링크)
 * 
 * [스마트폰 최적화 폴백]
 * 1. Kakao SDK 피드 공유 시도
 * 2. 실패 또는 모바일 환경 시: navigator.share (스마트폰 네이티브 공유 시트)
 * 3. 클립보드 복사 (안내 토스트 및 모달)
 */

const KAKAO_STORAGE_KEY = 'hwamokhoe_kakao_js_key';
const PUBLIC_DOMAIN_STORAGE_KEY = 'hwamokhoe_public_domain';
// 기본 공개 배포 권장 도메인 (로컬 file:// 실행 시 초대 링크로 활용)
const DEFAULT_PUBLIC_DOMAIN = 'https://hwamokhoe.pages.dev';

class HwamokKakaoShare {
  constructor() {
    this.appKey = localStorage.getItem(KAKAO_STORAGE_KEY) || '';
    this.publicDomain = localStorage.getItem(PUBLIC_DOMAIN_STORAGE_KEY) || DEFAULT_PUBLIC_DOMAIN;
    this.isSdkInitialized = false;
    this.initKakao();
  }

  initKakao() {
    if (this.appKey && window.Kakao) {
      try {
        if (!window.Kakao.isInitialized()) {
          window.Kakao.init(this.appKey);
        }
        this.isSdkInitialized = window.Kakao.isInitialized();
      } catch (e) {
        console.warn('Kakao SDK 초기화 알림:', e);
        this.isSdkInitialized = false;
      }
    }
  }

  setAppKey(key) {
    this.appKey = key.trim();
    localStorage.setItem(KAKAO_STORAGE_KEY, this.appKey);
    this.initKakao();
  }

  getAppKey() {
    return this.appKey;
  }

  setPublicDomain(domain) {
    this.publicDomain = domain.trim();
    localStorage.setItem(PUBLIC_DOMAIN_STORAGE_KEY, this.publicDomain);
  }

  getPublicDomain() {
    return this.publicDomain;
  }

  // 실제 외부 접속 가능한 HTTPS 주소 계산 (file:// 또는 localhost 방지)
  getCanonicalUrl(hashPath = '') {
    const loc = window.location;
    if (loc.protocol === 'https:' || (loc.protocol === 'http:' && !loc.hostname.includes('localhost') && !loc.hostname.includes('127.0.0.1'))) {
      const base = loc.origin + loc.pathname;
      return hashPath ? `${base}#${hashPath}` : base;
    }
    // 로컬 환경일 경우 설정된 공개 도메인 사용
    const base = this.publicDomain.replace(/\/$/, '');
    return hashPath ? `${base}/#${hashPath}` : `${base}/`;
  }

  // 대표 이미지 절대 HTTPS URL 계산
  getRepresentativeImageUrl() {
    const loc = window.location;
    if (loc.protocol === 'https:' || (loc.protocol === 'http:' && !loc.hostname.includes('localhost'))) {
      return new URL('assets/og-image.png', loc.href).href;
    }
    // 로컬 테스트 환경 시 신뢰할 수 있는 CDN 고해상도 백업 이미지 (1200x630 규격)
    return 'https://images.unsplash.com/photo-1511895426328-dc8714191300?w=1200&h=630&fit=crop&q=80';
  }

  // =========================================================================
  // 5대 공유 통합 메서드
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
    // ⑤ 공지사항 공유
    else if (type === 'notice') {
      const notice = extraData.notice;
      if (notice) {
        title = `📢 [공지] ${notice.title}`;
        description = `${notice.content.slice(0, 110)}${notice.content.length > 110 ? '...' : ''}\n\n등록일: ${notice.date} (총무 작성)`;
      } else {
        title = '📢 화목회 가족 공지사항';
        description = '가족들에게 전하는 따뜻한 소식과 중요 안내를 확인하세요.';
      }
      buttonTitle = '공지사항 전체 읽기';
      targetUrl = this.getCanonicalUrl('view-notice');
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
        console.warn('카카오 SDK 공유 호출 실패:', err);
      }
    }

    // 2단계: 스마트폰 브라우저 네이티브 공유 시트 (Android/iOS Safari)
    const fullShareText = `${title}\n\n${description}\n\n👉 바로가기: ${targetUrl}`;

    if (navigator.share) {
      navigator.share({
        title: title,
        text: `${title}\n\n${description}`,
        url: targetUrl
      }).then(() => {
        // 스마트폰 공유창 호출 성공
      }).catch((e) => {
        // 사용자가 취소했거나 오류 시 클립보드 복사로 대체
        if (e.name !== 'AbortError') {
          this.executeClipboardCopy(title, fullShareText, targetUrl);
        }
      });
      return;
    }

    // 3단계: 클립보드 복사 모드 (SDK 미연결 상태임을 솔직하게 안내)
    this.executeClipboardCopy(title, fullShareText, targetUrl);
  }

  // 클립보드 복사 및 솔직하고 친절한 알림 피드백
  executeClipboardCopy(title, fullText, targetUrl) {
    const isSdkMissing = !this.isSdkInitialized;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(fullText).then(() => {
        const guideMsg = isSdkMissing
          ? '초대 링크와 안내 문구가 복사되었습니다!\n(카카오 앱키 미등록 상태)\n카카오톡 가족방에 [붙여넣기] 해주세요. 💬'
          : '카카오톡 공유 문구가 복사되었습니다!\n화목회 가족방에 [붙여넣기] 해주세요. 💬';
        this.showToast(guideMsg);
      }).catch(() => {
        this.showLegacyCopyModal(fullText);
      });
    } else {
      this.showLegacyCopyModal(fullText);
    }
  }

  showLegacyCopyModal(text) {
    const existing = document.getElementById('kakao-copy-modal');
    if (existing) existing.remove();

    const modalHtml = `
      <div id="kakao-copy-modal" class="modal-overlay active">
        <div class="modal-box">
          <div class="modal-header">
            <h3 class="modal-title">카카오톡 초대 문구</h3>
            <button class="btn-close-modal" onclick="document.getElementById('kakao-copy-modal').remove()">✕</button>
          </div>
          <p style="font-size:17px; margin-bottom:12px; font-weight:700; color:#1e3a5f; line-height:1.5;">
            아래 내용을 복사하여 <b>'화목회 가족방'</b> 카카오톡 단체방에 전송해 주세요!
          </p>
          <textarea id="copy-target-area" style="width:100%; height:180px; font-size:16px; padding:12px; border:2px solid #cbd5e1; border-radius:14px; background:#faf9f6; line-height:1.5;" readonly>${text}</textarea>
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
      alert('초대 문구가 복사되었습니다!\n카카오톡 화목회 가족방에 [붙여넣기] 하세요.');
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
