// 관리자 인증을 위한 비밀번호 
// 실제 프로덕션 환경에서는 환경 변수 등 더 안전한 방법으로 관리해야 합니다
export const ADMIN_PASSWORD = '842685';

// 관리자 비밀번호 검증 함수
export const validateAdminPassword = (password: string): boolean => {
  return password === ADMIN_PASSWORD;
}; 