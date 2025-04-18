const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 먼저 chatRooms 컬렉션에 테스트 채팅방 추가
db.collection('chatRooms').doc('test_chat_room').set({
  name: '테스트 채팅방',
  participants: ['hyoon27@naver.com', 'test_sender'],
  createdAt: admin.firestore.FieldValue.serverTimestamp()
})
.then(() => {
  console.log('테스트 채팅방이 생성되었습니다.');
  
  // 테스트 채팅 메시지 추가
  return db.collection('chatMessages').add({
    chatRoomId: 'test_chat_room',
    sender: 'test_sender',
    senderName: '테스트 발신자',
    message: '이것은 테스트 메시지입니다',
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
})
.then((docRef) => {
  console.log('테스트 메시지가 추가되었습니다:', docRef.id);
})
.catch((error) => {
  console.error('오류 발생:', error);
}); 