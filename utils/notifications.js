import { firestore } from '@/config/firebase';
import { collection, addDoc, serverTimestamp, updateDoc, doc, getDoc } from 'firebase/firestore';
import { auth } from '@/config/firebase';

/**
 * Firestore notifications 컬렉션에 새 알림을 생성합니다.
 * @param {Object} notificationData 알림 데이터
 * @param {string} notificationData.title 알림 제목
 * @param {string} notificationData.message 알림 메시지
 * @param {string} notificationData.type 알림 유형 (pickup, maintenance, cleaning 등)
 * @param {string} notificationData.roomNumber 객실 번호 (선택)
 * @param {string} notificationData.sender 발신자 (선택)
 * @param {string} notificationData.priority 우선순위 (high, medium, low)
 * @param {string} notificationData.status 알림 상태
 * @returns {Promise<string>} 생성된 알림 문서의 ID
 */
export const createNotification = async (notificationData) => {
  try {
    // 유효성 검사
    if (!notificationData.title || !notificationData.message) {
      throw new Error('알림 제목과 메시지는 필수입니다.');
    }

    // 현재 로그인한 사용자 정보 추가 (발신자가 지정되지 않은 경우)
    const currentUser = auth.currentUser;
    let sender = notificationData.sender || '';
    
    if (!sender && currentUser) {
      // 현재 사용자 정보로 발신자 설정
      try {
        // 사용자 컬렉션에서 추가 정보 가져오기
        const userDoc = await getDoc(doc(firestore, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.displayName) {
            sender = userData.displayName;
          } else {
            sender = currentUser.email || '';
          }
        } else {
          sender = currentUser.email || '';
        }
      } catch (error) {
        console.error('사용자 정보 조회 실패:', error);
        sender = currentUser.email || '';
      }
    }

    // 타임스탬프 추가
    const notificationWithTimestamp = {
      ...notificationData,
      createdAt: serverTimestamp(),
      status: notificationData.status || 'pending', // 기본값은 대기 중
      sender
    };

    // Firestore에 알림 추가
    const notificationsRef = collection(firestore, 'notifications');
    const docRef = await addDoc(notificationsRef, notificationWithTimestamp);
    
    console.log('알림이 생성되었습니다. ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('알림 생성 실패:', error);
    throw error;
  }
};

/**
 * 알림 상태를 업데이트합니다.
 * @param {string} notificationId 알림 ID
 * @param {string} status 새 상태 (pending, processing, completed, cancelled)
 * @param {string} comment 선택적 댓글/메모
 * @returns {Promise<void>}
 */
export const updateNotificationStatus = async (notificationId, status, comment = '') => {
  try {
    const notificationRef = doc(firestore, 'notifications', notificationId);
    
    // 현재 로그인한 사용자 정보 가져오기
    const currentUser = auth.currentUser;
    let updatedBy = '';
    
    if (currentUser) {
      try {
        // 사용자 컬렉션에서 추가 정보 가져오기
        const userDoc = await getDoc(doc(firestore, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.displayName) {
            updatedBy = userData.displayName;
          } else {
            updatedBy = currentUser.email || '';
          }
        } else {
          updatedBy = currentUser.email || '';
        }
      } catch (error) {
        console.error('사용자 정보 조회 실패:', error);
        updatedBy = currentUser.email || '';
      }
    }
    
    // 업데이트할 데이터
    const updateData = {
      status,
      updatedAt: serverTimestamp(),
      updatedBy
    };
    
    // 댓글이 있으면 추가
    if (comment) {
      updateData.comment = comment;
    }
    
    // 알림 업데이트
    await updateDoc(notificationRef, updateData);
    console.log(`알림 ID: ${notificationId}의 상태가 '${status}'로 업데이트되었습니다.`);
  } catch (error) {
    console.error('알림 상태 업데이트 실패:', error);
    throw error;
  }
};

/**
 * 객실 관련 알림을 생성하는 헬퍼 함수
 * @param {string} roomNumber 객실 번호
 * @param {string} title 알림 제목
 * @param {string} message 알림 메시지
 * @param {string} type 알림 유형
 * @param {string} priority 우선순위
 * @param {string} sender 발신자
 * @returns {Promise<string>} 생성된 알림 문서의 ID
 */
export const createRoomNotification = async (roomNumber, title, message, type, priority = 'medium', sender = '') => {
  return createNotification({
    title,
    message,
    type,
    roomNumber,
    priority,
    sender,
    status: 'pending'
  });
};

/**
 * 객실 청소 요청 알림 생성
 * @param {string} roomNumber 객실 번호
 * @param {string} sender 발신자 (선택)
 * @returns {Promise<string>} 알림 ID
 */
export const createCleaningRequest = async (roomNumber, sender = '') => {
  // 객실 호수 검사를 더 엄격하게 수행
  let roomNumberText = '객실';
  if (roomNumber && typeof roomNumber === 'string' && roomNumber.trim() !== '') {
    roomNumberText = `${roomNumber}호`;
  } else if (roomNumber && typeof roomNumber === 'number' && roomNumber > 0) {
    roomNumberText = `${roomNumber}호`;
  }

  return createRoomNotification(
    roomNumber,
    `청소 요청: ${roomNumberText}`,
    `${roomNumberText}의 청소가 요청되었습니다.`,
    'cleaning',
    'medium',
    sender
  );
};

/**
 * 객실 픽업 요청 알림 생성
 * @param {string} roomNumber 객실 번호
 * @param {string} sender 발신자 (선택)
 * @param {string} pickupTime 픽업 시간 (선택)
 * @returns {Promise<string>} 알림 ID
 */
export const createPickupRequest = async (roomNumber, sender = '', pickupTime = '') => {
  const timeInfo = pickupTime ? ` ${pickupTime}에` : '';
  
  // 객실 호수 검사를 더 엄격하게 수행
  let roomNumberText = '객실';
  if (roomNumber && typeof roomNumber === 'string' && roomNumber.trim() !== '') {
    roomNumberText = `${roomNumber}호`;
  } else if (roomNumber && typeof roomNumber === 'number' && roomNumber > 0) {
    roomNumberText = `${roomNumber}호`;
  }
  
  return createRoomNotification(
    roomNumber,
    `픽업 요청: ${roomNumberText}`,
    `${roomNumberText}에서${timeInfo} 픽업이 요청되었습니다.`,
    'pickup',
    'high',
    sender
  );
};

/**
 * 객실 유지보수 요청 알림 생성
 * @param {string} roomNumber 객실 번호
 * @param {string} issue 문제 설명
 * @param {string} sender 발신자 (선택)
 * @returns {Promise<string>} 알림 ID
 */
export const createMaintenanceRequest = async (roomNumber, issue, sender = '') => {
  // 객실 호수 검사를 더 엄격하게 수행
  let roomNumberText = '객실';
  if (roomNumber && typeof roomNumber === 'string' && roomNumber.trim() !== '') {
    roomNumberText = `${roomNumber}호`;
  } else if (roomNumber && typeof roomNumber === 'number' && roomNumber > 0) {
    roomNumberText = `${roomNumber}호`;
  }
  
  return createRoomNotification(
    roomNumber,
    `유지보수 요청: ${roomNumberText}`,
    `${roomNumberText}에 유지보수가 필요합니다: ${issue}`,
    'maintenance',
    'high',
    sender
  );
}; 