import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { db, auth } from '@/config/firebase';
import { doc, setDoc, getDoc, collection, addDoc, serverTimestamp, query, where, getDocs, updateDoc } from 'firebase/firestore';

// 알림이 포그라운드, 백그라운드, 종료된 상태 모두에서 표시되도록 설정
Notifications.setNotificationHandler({
  handleNotification: async () => {
    console.log('알림 처리 중...');
    
    return {
      shouldShowAlert: true, // 알림 표시
      shouldPlaySound: true, // 소리 재생
      shouldSetBadge: true, // 앱 아이콘에 배지 표시
      priority: Notifications.AndroidNotificationPriority.MAX, // Android에서 최대 우선순위
    };
  },
});

// 디바이스 푸시 토큰 등록 함수
export async function registerForPushNotificationsAsync() {
  let token;

  console.log('푸시 토큰 발급 시작');
  
  // 디바이스가 실제 디바이스인지 확인 (에뮬레이터는 푸시 알림 작동 안함)
  if (!Device.isDevice) {
    console.log('실제 디바이스가 아닙니다. 테스트용 더미 토큰을 사용합니다.');
    
    // 시뮬레이터/에뮬레이터에서 테스트용 더미 토큰 반환
    return 'ExponentPushToken[simulator-test-token]';
  }
  
  try {
    // 권한 확인
    console.log('알림 권한 상태 확인 중...');
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    console.log('알림 권한 상태:', existingStatus);
    
    let finalStatus = existingStatus;

    // 권한이 아직 없으면 요청
    if (existingStatus !== 'granted') {
      console.log('알림 권한 요청 팝업 표시...');
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
      console.log('알림 권한 요청 결과:', status);
    }

    // 권한이 없으면 알림을 보낼 수 없음
    if (finalStatus !== 'granted') {
      console.log('알림 권한이 거부되었습니다.');
      return null;
    }

    console.log('알림 권한 확인됨, 토큰 발급 시도 중...');
    
    // Expo 푸시 토큰 가져오기 - projectId 직접 지정
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: "eb1c4b94-7787-4377-a9e8-e107bcb41a5f" // app.json에서 가져온 실제 projectId
    });
    
    token = tokenData.data;
    console.log('발급된 푸시 토큰:', token);
    
    // Android에서는 별도의 채널 설정이 필요
    if (Platform.OS === 'android') {
      console.log('Android 채널 설정 중...');
      await Notifications.setNotificationChannelAsync('default', {
        name: '기본 알림',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#4B7F52',
      });
      console.log('Android 채널 설정 완료');
    }
    
    return token;
  } catch (error) {
    console.error('푸시 토큰 발급 중 오류 발생:', error);
    return null;
  }
}

// 사용자의 푸시 토큰을 Firestore에 저장
export async function saveUserPushToken(token: string): Promise<boolean> {
  try {
    // 토큰이 null인 경우 처리
    if (!token) {
      console.log('저장할 토큰이 없습니다. 더미 토큰을 사용합니다.');
      token = 'ExponentPushToken[simulator-test-token]';
    }
    
    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.email) {
      console.log('사용자가 로그인되어 있지 않거나 이메일이 없습니다.');
      return false;
    }

    console.log(`사용자 ${currentUser.email}의 푸시 토큰 저장 시도`);
    
    // 이메일로 사용자 문서 찾기
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', currentUser.email));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      // 기존 사용자 문서가 있는 경우 업데이트
      const userDoc = querySnapshot.docs[0];
      console.log('기존 사용자 문서 찾음:', userDoc.data());
      
      await updateDoc(doc(db, 'users', userDoc.id), {
        pushToken: token,       // 원래 필드명
        expoToken: token,       // 대체 필드명 1
        expoPushToken: token,   // 대체 필드명 2
        uid: currentUser.uid,   // UID 추가
        lastTokenUpdate: new Date()
      });
      
      console.log(`사용자 ${currentUser.email} 문서(${userDoc.id})에 토큰 업데이트 완료`);
    } else {
      // 기존 문서가 없는 경우 새로 생성
      console.log(`사용자 ${currentUser.email}의 문서 없음, 새로 생성`);
      
      const newUserRef = await addDoc(collection(db, 'users'), {
        email: currentUser.email,
        uid: currentUser.uid,    // UID 추가
        pushToken: token,       // 원래 필드명
        expoToken: token,       // 대체 필드명 1
        expoPushToken: token,   // 대체 필드명 2
        createdAt: new Date(),
        lastTokenUpdate: new Date()
      });
      
      console.log(`새 사용자 문서 생성 완료, ID: ${newUserRef.id}`);
    }
    
    // 확인을 위해 다시 조회
    const verifySnapshot = await getDocs(q);
    if (!verifySnapshot.empty) {
      console.log('토큰 저장 후 사용자 문서:', verifySnapshot.docs[0].data());
    }
    
    console.log('푸시 토큰이 성공적으로 저장되었습니다:', token);
    return true;
  } catch (error) {
    console.error('푸시 토큰 저장 중 오류 발생:', error);
    return false;
  }
}

// 로컬 알림 보내기 함수
export async function sendLocalNotification(title: string, body: string, data?: any) {
  try {
    console.log('[알림 디버깅] 로컬 알림 전송 시도:', { title, body, data });
    
    // 데이터가 없는 경우 기본 객체 생성
    const notificationData = data || {};
    
    // 중복 방지를 위한 타임스탬프 추가
    notificationData._notificationId = `notification_${new Date().getTime()}_${Math.random().toString(36).substring(2, 10)}`;
    
    // 알림 유형 확인 (기본값을 pickup_request로 설정)
    if (!notificationData.type) {
      notificationData.type = 'pickup_request';
    }
    
    // 픽업 요청 알림인 경우 객실 호수 체크
    if (data?.type === 'pickup_request') {
      const roomNumber = data.roomNumber;
      const guestName = data.guestName;
      const requestType = data.requestType;
      
      // 게스트 이름과 요청 유형이 있는 경우에만 처리
      if (guestName && requestType) {
        // 객실 호수가 유효한 값인 경우에만 "호"를 붙임
        let roomNumberText = '';
        if (roomNumber && typeof roomNumber === 'string' && roomNumber.trim() !== '') {
          roomNumberText = `${roomNumber}호 `;
        } else if (roomNumber && typeof roomNumber === 'number' && roomNumber > 0) {
          roomNumberText = `${roomNumber}호 `;
        }
        
        body = `${roomNumberText}${guestName} ${requestType}`;
        
        // 제목도 더 명확하게 설정
        if (title === '새로운 알림') {
          title = '새로운 픽업요청';
        }
      }
    }
    
    console.log('[알림 디버깅] 알림 내용 구성 완료:', { title, body });
    
    // iOS 및 Android에 맞는 설정
    const notificationContent: any = {
      title,
      body,
      data: notificationData,
      sound: true, // 소리 활성화
      badge: 1, // 앱 아이콘에 배지 표시
      color: '#4B7F52', // 알림 색상 (Android)
      priority: Notifications.AndroidNotificationPriority.MAX,
    };
    
    // iOS 카테고리 설정 (옵션 포함 알림 표시)
    if (Platform.OS === 'ios') {
      notificationContent.categoryIdentifier = 'default';
    }
    
    // Android에서 백그라운드 알림을 위한 채널 설정
    if (Platform.OS === 'android') {
      // Android 백그라운드 알림을 위한 추가 설정
      console.log('[알림 디버깅] Android 채널 설정 시작');
      await Notifications.setNotificationChannelAsync('default', {
        name: '호텔드포레 Staff',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#4B7F52',
        sound: 'default',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true,
      });
      console.log('[알림 디버깅] Android 채널 설정 완료');
      
      // Android 알림 설정 추가
      notificationContent.channelId = 'default';
      notificationContent.enableVibrate = true;
      notificationContent.vibrate = [0, 250, 250, 250];
    }
    
    console.log('[알림 디버깅] 알림 스케줄링 시작');
    
    // 알림 즉시 스케줄링
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: notificationContent,
      trigger: null, // 즉시 실행
    });
    
    console.log('[알림 디버깅] 로컬 알림 전송 성공, ID:', notificationId);
    return notificationId;
  } catch (error) {
    console.error('[알림 디버깅] 로컬 알림 전송 실패:', error);
    throw error;
  }
}

// 특정 사용자에게 알림 전송 (Firestore 기반)
export async function sendPushToUser(userId: string, title: string, body: string, data?: any) {
  try {
    // 중복 방지를 위한 타임스탬프 추가
    const notificationData = {
      ...data,
      _notificationTimestamp: new Date().getTime()
    };
    
    // 알림 컬렉션에 새 알림 추가
    await addDoc(collection(db, 'notifications'), {
      userId,
      title,
      body,
      data: notificationData,
      read: false,
      createdAt: serverTimestamp(),
    });
    
    console.log(`사용자 ${userId}에게 알림이 전송되었습니다.`);
  } catch (error) {
    console.error('알림 전송 중 오류 발생:', error);
  }
}

// 모든 사용자에게 알림 전송
export async function sendPushToAllUsers(title: string, body: string, data?: any) {
  try {
    // 알림 중복 방지를 위한 타임스탬프 추가
    const notificationData = {
      ...data,
      _notificationTimestamp: new Date().getTime()
    };
    
    console.log('[알림 디버깅] 전체 알림 전송 시작:', { title, body, data: notificationData });
    
    // 모든 사용자 가져오기
    const usersQuery = query(collection(db, 'users'));
    const usersSnapshot = await getDocs(usersQuery);
    
    // 사용자가 없는 경우
    if (usersSnapshot.empty) {
      console.log('[알림 디버깅] 전송할 사용자가 없습니다.');
      return;
    }
    
    console.log(`[알림 디버깅] 총 ${usersSnapshot.size}명의 사용자에게 알림 전송 시작`);
    
    // 각 사용자에게 알림 전송
    const notificationPromises = usersSnapshot.docs.map(userDoc => {
      console.log(`[알림 디버깅] 사용자 ${userDoc.id}에게 알림 추가 중`);
      return addDoc(collection(db, 'notifications'), {
        userId: userDoc.id,
        title,
        body,
        data: notificationData,
        read: false,
        createdAt: serverTimestamp(),
      });
    });
    
    const results = await Promise.all(notificationPromises);
    console.log(`[알림 디버깅] ${usersSnapshot.size}명의 사용자에게 알림이 전송되었습니다.`);
    console.log('[알림 디버깅] 알림 문서 ID들:', results.map(docRef => docRef.id));
  } catch (error) {
    console.error('[알림 디버깅] 전체 알림 전송 중 오류 발생:', error);
  }
}

// 특정 역할의 사용자에게 알림 전송
export async function sendPushToRole(role: string, title: string, body: string, data?: any) {
  try {
    // 특정 역할을 가진 사용자 가져오기
    const usersQuery = query(collection(db, 'users'), where('role', '==', role));
    const usersSnapshot = await getDocs(usersQuery);
    
    // 해당 역할의 각 사용자에게 알림 전송
    const notificationPromises = usersSnapshot.docs.map(userDoc => {
      return addDoc(collection(db, 'notifications'), {
        userId: userDoc.id,
        title,
        body,
        data: data || {},
        read: false,
        createdAt: serverTimestamp(),
      });
    });
    
    await Promise.all(notificationPromises);
    console.log(`${role} 역할의 ${usersSnapshot.size}명에게 알림이 전송되었습니다.`);
  } catch (error) {
    console.error(`${role} 역할 사용자 알림 전송 중 오류 발생:`, error);
  }
}

// Expo 푸시 알림 API를 직접 호출하여 알림 테스트
export async function testExpoPushNotification(token: string, title: string, body: string, data?: any) {
  try {
    console.log('Expo 푸시 알림 테스트 시작');
    console.log('대상 토큰:', token);
    
    const message = {
      to: token,
      title: title,
      body: body,
      data: data || {},
      sound: 'default',
      badge: 1,
      channelId: 'default'
    };
    
    console.log('전송할 메시지:', message);
    
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message)
    });
    
    const responseData = await response.json();
    console.log('Expo 푸시 알림 응답:', responseData);
    
    return responseData;
  } catch (error) {
    console.error('Expo 푸시 알림 테스트 오류:', error);
    throw error;
  }
}

// Expo 서버를 직접 호출하여 백그라운드 푸시알림 보내기 (테스트용)
export async function testBackgroundPushNotification(token: string, title: string, body: string, data?: any) {
  try {
    console.log('백그라운드 푸시 알림 테스트 시작');
    console.log('대상 토큰:', token);
    
    // 데이터가 없는 경우 기본 객체 생성
    const notificationData = data || {};
    
    // 필수 필드가 없는 경우 기본값 설정
    if (!notificationData.type) {
      notificationData.type = 'pickup_request';
    }
    
    // 푸시 알림 메시지 구성
    const message = {
      to: token,
      title: title,
      body: body,
      data: notificationData,
      sound: 'default',
      badge: 1,
      channelId: 'default',
      _displayInForeground: false, // 포그라운드에서 표시하지 않음 (백그라운드 테스트용)
      // FCM 관련 설정
      ttl: 3600, // 메시지 유효 시간 (초)
      expiration: Math.floor(Date.now() / 1000) + 3600, // 만료 시간
      priority: 'high', // FCM 우선순위
      subtitle: '알림 테스트',
      // 카테고리 설정
      categoryId: 'default'
    };
    
    console.log('전송할 메시지:', message);
    
    // Expo 푸시 서버로 직접 요청 전송
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Accept-Encoding': 'gzip, deflate'
      },
      body: JSON.stringify(message)
    });
    
    const responseData = await response.json();
    console.log('Expo 푸시 응답:', responseData);
    
    return responseData;
  } catch (error) {
    console.error('백그라운드 푸시 알림 테스트 오류:', error);
    throw error;
  }
}

// 업데이트 알림 전송
export async function sendUpdateNotification(todoId: string, title: string, body: string, data?: any) {
  try {
    console.log('[알림 디버깅] 업데이트 알림 전송 시작:', { todoId, title, body });
    
    // 중복 방지를 위한 타임스탬프 추가
    const notificationData = {
      type: 'pickup_update',
      todoId,
      ...data,
      _notificationTimestamp: new Date().getTime()
    };
    
    // 모든 사용자 가져오기
    const usersQuery = query(collection(db, 'users'));
    const usersSnapshot = await getDocs(usersQuery);
    
    // 사용자가 없는 경우
    if (usersSnapshot.empty) {
      console.log('[알림 디버깅] 전송할 사용자가 없습니다.');
      return;
    }
    
    console.log(`[알림 디버깅] 총 ${usersSnapshot.size}명의 사용자에게 업데이트 알림 전송 시작`);
    
    // 각 사용자에게 알림 전송
    const notificationPromises = usersSnapshot.docs.map(userDoc => {
      return addDoc(collection(db, 'notifications'), {
        userId: userDoc.id,
        title,
        body,
        data: notificationData,
        read: false,
        createdAt: serverTimestamp(),
      });
    });
    
    const results = await Promise.all(notificationPromises);
    console.log(`[알림 디버깅] ${usersSnapshot.size}명의 사용자에게 업데이트 알림이 전송되었습니다.`);
    
    // 완료 알림의 경우 Firestore의 notifications 컬렉션에만 저장하고
    // 로컬 알림은 _layout.tsx의 onSnapshot에서 자동으로 표시되므로 여기서는 전송하지 않음
    // await sendLocalNotification(title, body, notificationData);
    console.log('[알림 디버깅] 중복 방지를 위해 로컬 알림은 직접 전송하지 않음');
    
    return results;
  } catch (error) {
    console.error('[알림 디버깅] 업데이트 알림 전송 중 오류 발생:', error);
    return null;
  }
} 