/**
 * Firebase v10 모듈러 SDK 환경 설정 및 Firestore 동기화 모듈
 * 
 * [보안 안내]
 * - Firestore 연동 시 아래 firebaseConfig 객체에 프로젝트 키를 입력합니다.
 * - 본 시스템은 Firebase 설정 전에도 LocalStorage 기반으로 100% 정상 작동하는
 *   하이브리드 아키텍처로 설계되었습니다.
 */

export const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "hwamokhoe-family.firebaseapp.com",
  projectId: "hwamokhoe-family",
  storageBucket: "hwamokhoe-family.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

/**
 * [Firestore 컬렉션 설계 규칙]
 * 
 * 1. 공개 컬렉션 (Public - 일반 가족 비로그인 읽기 허용, 쓰기 금지)
 *    - /public_summary/latest : { totalBalance, monthlyExpected, monthlyPaid, monthlyUnpaid, lastUpdated }
 *    - /public_ledger/{txId} : { date, type, category, desc, amount } (개인 식별정보 제외)
 *    - /public_events/{eventId} : { title, date, time, location, address, description, isNext }
 *    - /public_notices/{noticeId} : { title, category, content, date, pinned }
 * 
 * 2. 총무 전용 비공개 컬렉션 (Admin Only - admin: true 커스텀 클레임 계정만 읽기/쓰기 허용)
 *    - /admin_members/{memberId} : { name, relation, phone, active, joinedAt }
 *    - /admin_fee_records/{recordId} : { memberId, targetMonth, status, amount, paidAt, note }
 *    - /admin_settings/general : { monthlyFee, dueDay, migrationType, migrationBaseDate, openingBalance, actualBankBalance, graceMonths, refundRate }
 *    - /admin_audit_logs/{logId} : { timestamp, action, detail, operatorUid }
 */
