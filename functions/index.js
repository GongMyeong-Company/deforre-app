/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const fetch = require('node-fetch');
const {onDocumentCreated} = require("firebase-functions/v2/firestore");

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

admin.initializeApp();

/**
 * 호텔 앱 알림 기능 - Firebase Cloud Functions
 * todo 컬렉션에 새 문서가 추가되면 자동으로 푸시 알림을 보냅니다.
 * chatMessages 컬렉션에 새 문서가 추가되면 해당 채팅방의 참여자들에게 알림을 보냅니다.
 */

// todo 컬렉션에 새 문서가 추가될 때 실행되는 함수
exports.sendPickupNotification = onDocumentCreated({
  document: "todo/{todoId}",
  region: "asia-northeast3"
}, async (event) => {
  try {
    const snapshot = event.data;
    if (!snapshot) {
      logger.log("No data associated with the event");
      return;
    }
    
    const todoData = snapshot.data();
    const todoId = event.params.todoId;
    
    // 알림에 필요한 데이터 추출
    const { roomNumber, guestName, content } = todoData;
    
    // 알림 제목과 내용 구성
    const title = '새로운 픽업 요청';
    const body = `${roomNumber}호 ${guestName} ${content}`;
    
    // 알림 데이터 구성
    const notificationData = {
      type: 'pickup_request',
      todoId: todoId,
      roomNumber: roomNumber,
      guestName: guestName,
      requestType: content
    };
    
    logger.log(`새로운 픽업 요청 감지: ${roomNumber}호 ${guestName} ${content}`);
    
    // 모든 사용자 가져오기
    const usersSnapshot = await admin.firestore().collection('users').get();
    
    // 각 사용자별로 알림 처리
    const notificationPromises = [];
    const pushNotificationPromises = [];
    
    usersSnapshot.forEach(userDoc => {
      const userData = userDoc.data();
      const userId = userDoc.id;
      const userEmail = userData.email;
      
      logger.log(`사용자 ${userId} (${userEmail || '이메일 없음'})에게 알림 전송 중...`);
      logger.log(`사용자 데이터:`, JSON.stringify(userData));
      
      // Firestore에 알림 저장
      notificationPromises.push(
        admin.firestore().collection('notifications').add({
          userId: userId,
          title: title,
          body: body,
          data: notificationData,
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        })
      );
      
      // 푸시 토큰 찾기 (여러 가능한 필드명 확인)
      const pushToken = userData.pushToken || userData.expoToken || userData.expo_token || userData.expoPushToken;
      
      // 푸시 토큰이 있는 경우 푸시 알림 전송
      if (pushToken) {
        logger.log(`사용자 ${userEmail || userId}의 푸시 토큰 발견: ${pushToken}`);
        
        const message = {
          to: pushToken,
          title: title,
          body: `${roomNumber}호 ${guestName} ${content}`,
          data: notificationData,
          sound: 'default',
          badge: 1,
          channelId: 'default',
          // FCM 관련 옵션 추가 (백그라운드 알림 지원)
          priority: 'high',
          content_available: true, // iOS 백그라운드 새로고침 활성화
          _displayInForeground: true,
          ttl: 60 * 60, // 1시간 유효
          categoryId: 'default',
          subtitle: '호텔드포레' // iOS 알림 부제목
        };
        
        // Expo 푸시 알림 서비스로 전송
        pushNotificationPromises.push(
          fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'Accept-Encoding': 'gzip, deflate'
            },
            body: JSON.stringify(message)
          })
          .then(response => response.json())
          .then(responseData => {
            logger.log(`푸시 알림 응답 (${userEmail || userId}):`, JSON.stringify(responseData));
            return responseData;
          })
          .catch(error => {
            logger.error(`푸시 알림 전송 오류 (${userEmail || userId}):`, error);
            return null;
          })
        );
      } else {
        logger.log(`사용자 ${userEmail || userId}의 푸시 토큰을 찾을 수 없음. 사용자 데이터 키:`, Object.keys(userData));
      }
    });
    
    // 모든 작업 완료 대기
    const results = await Promise.all([
      Promise.all(notificationPromises),
      Promise.all(pushNotificationPromises)
    ]);
    
    logger.log(`픽업 요청 알림이 ${usersSnapshot.size}명의 사용자에게 전송되었습니다.`);
    logger.log('푸시 알림 결과:', JSON.stringify(results[1]));
    
    return null;
  } catch (error) {
    logger.error('알림 전송 중 오류 발생:', error);
    return null;
  }
});

// chatMessages 컬렉션에 새 메시지가 추가될 때 실행되는 함수
exports.sendChatNotification = onDocumentCreated({
  document: "chatMessages/{messageId}",
  region: "asia-northeast3"
}, async (event) => {
  try {
    logger.log("====== 채팅 메시지 알림 함수 시작 ======");
    logger.log(`이벤트 ID: ${event.id}, 타임스탬프: ${event.timestamp}`);
    
    const snapshot = event.data;
    if (!snapshot) {
      logger.log("No data associated with the event");
      return;
    }
    
    const messageData = snapshot.data();
    const messageId = event.params.messageId;
    
    // 알림에 필요한 데이터 출력
    logger.log("채팅 메시지 데이터:", JSON.stringify(messageData));
    logger.log("메시지 데이터 필드:", Object.keys(messageData).join(", "));
    logger.log(`메시지 ID: ${messageId}`);
    logger.log(`메시지 내용 필드 확인 - text: '${messageData.text}', message: '${messageData.message}'`);
    
    // 알림에 필요한 필수 데이터가 있는지 확인
    const { chatRoomId, sender, senderName } = messageData;
    
    // 필수 필드 확인
    if (!chatRoomId) {
      logger.log("chatRoomId가 없습니다. 이전 형식의 메시지로 알림을 보내지 않습니다.");
      return null;
    }
    
    if (!sender) {
      logger.log("sender 필드가 없습니다. userId를 sender로 사용합니다.");
      messageData.sender = messageData.userId || 'unknown';
    }
    
    if (!senderName) {
      logger.log("senderName 필드가 없습니다. userName을 senderName으로 사용합니다.");
      messageData.senderName = messageData.userName || '익명 사용자';
    }
    
    // 메시지 내용 필드 처리 (text 또는 message)
    if (!messageData.text && messageData.message) {
      logger.log("text 필드가 없고 message 필드가 있습니다. message를 text로 사용합니다.");
      messageData.text = messageData.message;
    } else if (!messageData.text && !messageData.message) {
      logger.log("text와 message 필드가 모두 없습니다. 기본 메시지를 사용합니다.");
      messageData.text = '새 메시지';
    } else {
      logger.log(`text 필드 사용: '${messageData.text}'`);
    }
    
    // 본인이 보낸 메시지에 대해서는 알림을 보내지 않기 위한 체크가 필요합니다.
    // chatRoomId를 기반으로 채팅방 정보 가져오기
    logger.log(`새 채팅 메시지 감지 - 채팅방: ${messageData.chatRoomId}, 발신자: ${messageData.senderName}, 내용: '${messageData.text}'`);
    
    // 채팅방 문서 가져오기
    const chatRoomDoc = await admin.firestore().collection('chatRooms').doc(messageData.chatRoomId).get();
    
    if (!chatRoomDoc.exists) {
      logger.log(`채팅방 정보를 찾을 수 없음: ${messageData.chatRoomId}`);
      return null;
    }
    
    const chatRoomData = chatRoomDoc.data();
    const { participants, name: chatRoomName } = chatRoomData;
    
    // participants가 없는 경우 처리
    if (!participants || !Array.isArray(participants) || participants.length === 0) {
      logger.log('채팅방에 참여자 정보가 없습니다.');
      return null;
    }
    
    // 알림 제목과 내용 구성
    const title = `${chatRoomName || '새 메시지'}`;
    const body = `${messageData.senderName}: ${messageData.text}`;
    
    logger.log(`알림 내용 구성 - 제목: '${title}', 내용: '${body}'`);
    
    // 알림 데이터 구성
    const notificationData = {
      type: 'chat_message',
      messageId: messageId,
      chatRoomId: messageData.chatRoomId,
      sender: messageData.sender,
      senderName: messageData.senderName,
      messageText: messageData.text, // 메시지 내용도 데이터에 포함
      chatRoomName: chatRoomName || null
    };
    
    logger.log(`채팅 메시지 알림 준비 중: ${messageData.senderName}의 메시지 (${messageData.chatRoomId})`);
    
    // 알림을 보낼 참여자들 (발신자 제외)
    const recipients = participants.filter(userId => userId !== messageData.sender);
    
    if (recipients.length === 0) {
      logger.log('알림을 받을 다른 참여자가 없습니다.');
      return null;
    }
    
    // 메시지 발신자를 제외한 참여자들의 정보 가져오기
    const usersSnapshot = await admin.firestore().collection('users')
      .where(admin.firestore.FieldPath.documentId(), 'in', recipients)
      .get();
    
    // 각 참여자별로 알림 처리
    const notificationPromises = [];
    const pushNotificationPromises = [];
    
    usersSnapshot.forEach(userDoc => {
      const userData = userDoc.data();
      const userId = userDoc.id;
      const userEmail = userData.email;
      
      logger.log(`채팅 메시지 알림 전송 중 - 사용자: ${userId} (${userEmail || '이메일 없음'})`);
      
      // Firestore에 알림 저장
      notificationPromises.push(
        admin.firestore().collection('notifications').add({
          userId: userId,
          title: title,
          body: body,
          data: {
            ...notificationData,
            messageText: messageData.text || '새 메시지',
            text: messageData.text || '새 메시지',
            message: messageData.text || '새 메시지',
            content: messageData.text || '새 메시지'
          },
          messageText: messageData.text || '새 메시지',
          text: messageData.text || '새 메시지',
          message: messageData.text || '새 메시지',
          content: messageData.text || '새 메시지',
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        })
      );
      
      // 푸시 토큰 찾기 (여러 가능한 필드명 확인)
      const pushToken = userData.pushToken || userData.expoToken || userData.expo_token || userData.expoPushToken;
      
      // 푸시 토큰이 있는 경우 푸시 알림 전송
      if (pushToken) {
        logger.log(`채팅 참여자 ${userEmail || userId}의 푸시 토큰 발견: ${pushToken}`);
        
        // 메시지 내용을 여러 위치에 중복 저장
        const messageContent = messageData.text || '새 메시지';
        
        const message = {
          to: pushToken,
          title: title,
          body: `${messageData.senderName}: ${messageContent}`,
          // 데이터 내부에 메시지 내용 추가
          data: {
            ...notificationData,
            messageText: messageContent,
            text: messageContent,
            message: messageContent,
            content: messageContent,
            body: `${messageData.senderName}: ${messageContent}`
          },
          // 데이터 외부에도 메시지 내용 추가
          messageText: messageContent,
          text: messageContent,
          message: messageContent,
          content: messageContent,
          sound: 'default',
          badge: 1,
          // FCM 관련 옵션 추가 (백그라운드 알림 지원)
          priority: 'high',
          content_available: true, // iOS 백그라운드 새로고침 활성화
          _displayInForeground: true,
          ttl: 60 * 60, // 1시간 유효
          categoryId: 'default',
          subtitle: '호텔드포레 채팅', // iOS 알림 부제목
          channelId: 'default'
        };
        
        logger.log(`푸시 알림 메시지 구성: ${JSON.stringify(message)}`);
        
        // Expo 푸시 알림 서비스로 전송
        pushNotificationPromises.push(
          fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(message)
          })
          .then(response => response.json())
          .then(responseData => {
            logger.log(`채팅 알림 응답 (${userEmail || userId}):`, JSON.stringify(responseData));
            return responseData;
          })
          .catch(error => {
            logger.error(`채팅 알림 전송 오류 (${userEmail || userId}):`, error);
            return null;
          })
        );
      } else {
        logger.log(`사용자 ${userEmail || userId}의 푸시 토큰을 찾을 수 없음`);
      }
    });
    
    // 모든 작업 완료 대기
    const results = await Promise.all([
      Promise.all(notificationPromises),
      Promise.all(pushNotificationPromises)
    ]);
    
    logger.log(`채팅 메시지 알림이 ${usersSnapshot.size}명의 참여자에게 전송되었습니다.`);
    logger.log('채팅 알림 전송 결과:', JSON.stringify(results[1]));
    
    return null;
  } catch (error) {
    logger.error('채팅 알림 전송 중 오류 발생:', error);
    return null;
  }
});