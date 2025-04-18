import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  FlatList, 
  TextInput, 
  TouchableOpacity, 
  Modal,
  Platform, 
  ActivityIndicator, 
  View, 
  Image, 
  Alert,
  SafeAreaView,
  Keyboard,
  Animated,
  RefreshControl,
  ViewStyle,
  KeyboardAvoidingView,
} from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  query, 
  where, 
  orderBy, 
  limit,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  writeBatch,
  getDoc,
  DocumentData
} from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRouter } from 'expo-router';

type Message = {
  id: string;
  text: string;
  userId: string;
  userName: string;
  createdAt: any;
  userPhotoURL?: string;
  chatRoomId: string;
};

type ChatRoom = {
  id: string;
  name: string;
  createdAt: any;
  participants: string[];
  lastMessage?: string;
  lastMessageTime?: any;
  createdBy?: string;
};

// 메인 색상 변수 정의
const MAIN_COLOR = '#2E8B57'; // 초록색 (SeaGreen)

export default function ChatPage() {
  // 상태 변수
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [userPhotoURL, setUserPhotoURL] = useState<string | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [createRoomModalVisible, setCreateRoomModalVisible] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [showRoomOptions, setShowRoomOptions] = useState(false);
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [users, setUsers] = useState<{id: string, uid: string, name: string, email: string, isParticipant?: boolean}[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [tabBarHeight, setTabBarHeight] = useState(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  
  const flatListRef = useRef<FlatList>(null);
  const [inputBottomAnim] = useState(new Animated.Value(0));

  // 네비게이션 객체 가져오기
  const navigation = useNavigation();
  const router = useRouter();

  // 컴포넌트 마운트 시 전역 변수 초기화
  useEffect(() => {
    console.log('채팅 컴포넌트 마운트: 전역 변수 초기화');
    
    // 전역 상태 초기화
    global.isInChatRoom = false;
    global.selectedRoomName = '채팅';
    
    // 전역에 모달 열기 함수 등록
    global.createChatRoomModal = (visible: boolean) => {
      setCreateRoomModalVisible(visible);
    };

    // 뒤로가기 함수를 로컬 함수 참조로 등록
    global.goBackToRoomList = goBackToRoomList;

    return () => {
      console.log('채팅 컴포넌트 언마운트: 전역 변수 정리');
      global.createChatRoomModal = undefined;
      global.goBackToRoomList = undefined;
      global.isInChatRoom = undefined;
      global.selectedRoomName = undefined;
    };
  }, []);

  // 키보드 이벤트 감지
  useEffect(() => {
    // 하단탭 높이 측정
    const measureTabBar = () => {
      if (Platform.OS === 'ios') {
        setTabBarHeight(80); // iOS 하단탭 높이 증가
      } else {
        setTabBarHeight(90); // Android 하단탭 높이 증가
      }
    };
    
    measureTabBar();

    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardVisible(true);
        setKeyboardHeight(e.endCoordinates.height);
        
        // 키보드가 표시될 때 화면을 아래로 스크롤
        if (flatListRef.current && messages.length > 0) {
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      }
    );

    const keyboardWillHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
    };
  }, [messages.length]);

  // 사용자 정보 가져오기
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const currentUser = getAuth().currentUser;
        if (!currentUser || !currentUser.email) return;
        
        const q = query(collection(getFirestore(), 'users'), where('email', '==', currentUser.email));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const userData = querySnapshot.docs[0].data();
          
          // UID가 없으면 추가 (한 번만 업데이트)
          if (!userData.uid) {
            await updateDoc(doc(getFirestore(), 'users', querySnapshot.docs[0].id), {
              uid: currentUser.uid
            });
            console.log('사용자 문서에 UID 추가:', currentUser.uid);
          }
          
          setUserName(userData.name || currentUser.email.split('@')[0]);
          setUserPhotoURL(userData.profileImage || null);
        } else {
          setUserName(currentUser.email.split('@')[0]);
          
          // 사용자 문서가 없으면 생성
          try {
            const newUserRef = await addDoc(collection(getFirestore(), 'users'), {
              email: currentUser.email,
              uid: currentUser.uid,
              name: currentUser.email.split('@')[0],
              createdAt: serverTimestamp()
            });
            console.log('새 사용자 문서 생성:', newUserRef.id);
          } catch (error) {
            console.error('사용자 문서 생성 실패:', error);
          }
        }
      } catch (error) {
        console.error('사용자 정보 조회 실패:', error);
      }
    };

    fetchUserInfo();
  }, []);

  // 사용자 목록 가져오기
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoadingUsers(true);
        const usersRef = collection(getFirestore(), 'users');
        const querySnapshot = await getDocs(usersRef);
        
        const usersList: {id: string, uid: string, name: string, email: string, isParticipant?: boolean}[] = [];
        const currentUser = getAuth().currentUser;
        
        // 현재 채팅방의 참여자 목록 가져오기
        if (selectedRoom) {
          const roomRef = doc(collection(getFirestore(), 'chatRooms'), selectedRoom.id);
          const roomSnapshot = await getDoc(roomRef);
          const roomData = roomSnapshot.data();
          const currentParticipants = roomData?.participants || [];
          
          querySnapshot.forEach((doc) => {
            const userData = doc.data();
            // 자기 자신은 제외
            if (currentUser?.email && userData.email !== currentUser.email) {
              usersList.push({
                id: doc.id,
                uid: userData.uid || doc.id,
                name: userData.name || '이름 없음',
                email: userData.email || '',
                isParticipant: currentParticipants.includes(userData.email)
              });
            }
          });
          
          // 참여자와 비참여자 구분하여 정렬
          usersList.sort((a, b) => {
            // 참여자를 먼저 표시
            if (a.isParticipant && !b.isParticipant) return -1;
            if (!a.isParticipant && b.isParticipant) return 1;
            // 이름 순으로 정렬
            return a.name.localeCompare(b.name);
          });
        }
        
        setUsers(usersList);
        setLoadingUsers(false);
      } catch (error) {
        console.error('사용자 목록 가져오기 오류:', error);
        setLoadingUsers(false);
      }
    };
    
    if (inviteModalVisible) {
      fetchUsers();
    }
  }, [inviteModalVisible, selectedRoom]);

  // 채팅방 목록 가져오기
  useEffect(() => {
    const fetchChatRooms = async () => {
      try {
        const currentUser = getAuth().currentUser;
        if (!currentUser || !currentUser.email) {
          setLoading(false);
          return;
        }

        const q = query(
          collection(getFirestore(), 'chatRooms'),
          where('participants', 'array-contains', currentUser.email)
        );

        // 실시간 리스너 설정
        const unsubscribe = onSnapshot(q, (snapshot) => {
          const rooms = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as ChatRoom[];

          // lastMessageTime이 없는 경우 createdAt을 기준으로 정렬
          rooms.sort((a, b) => {
            const timeA = (a.lastMessageTime || a.createdAt)?.seconds || 0;
            const timeB = (b.lastMessageTime || b.createdAt)?.seconds || 0;
            return timeB - timeA;
          });

          setChatRooms(rooms);
          setLoading(false);
        }, (error) => {
          console.error('채팅방 목록 조회 실패:', error);
          setLoading(false);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error('채팅방 목록 조회 실패:', error);
        setLoading(false);
      }
    };

    fetchChatRooms();
  }, []);

  // 로그인 상태 체크
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace('/login');
      }
    });

    return () => unsubscribe();
  }, []);

  // 메시지 가져오기
  const fetchMessages = (roomId: string) => {
    setLoadingMessages(true);
    try {
      const q = query(
        collection(getFirestore(), 'messages'),
        where('chatRoomId', '==', roomId),
        orderBy('createdAt', 'asc')  // 서버 측에서 오래된 순으로 정렬
      );

      // 실시간 리스너 설정
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const newMessages = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Message[];

        setMessages(newMessages);
        setLoadingMessages(false);

        // 새 메시지가 추가되면 자동으로 스크롤
        if (flatListRef.current && newMessages.length > 0) {
          flatListRef.current?.scrollToEnd({ animated: true });
        }
      }, (error) => {
        console.error('메시지 조회 실패:', error);
        setLoadingMessages(false);
      });

      return unsubscribe;
    } catch (error) {
      console.error('메시지 조회 실패:', error);
      setLoadingMessages(false);
      return () => {};
    }
  };

  // 메시지 전송
  const sendMessage = async () => {
    if (!inputMessage.trim() || !selectedRoom) return;

    const currentUser = getAuth().currentUser;
    if (!currentUser) return;

    try {
      const messageData = {
        text: inputMessage.trim(),
        userId: currentUser.uid,
        userName: userName,
        userPhotoURL: userPhotoURL,
        chatRoomId: selectedRoom.id,
        createdAt: serverTimestamp()
      };

      // 실제 메시지 전송
      await addDoc(collection(getFirestore(), 'messages'), messageData);

      // 채팅방 정보 업데이트
      await updateDoc(doc(getFirestore(), 'chatRooms', selectedRoom.id), {
        lastMessage: inputMessage.trim(),
        lastMessageTime: serverTimestamp()
      });

      setInputMessage('');
      
      // 스크롤 이동
      if (flatListRef.current) {
        flatListRef.current?.scrollToEnd({ animated: true });
      }
    } catch (error) {
      console.error('메시지 전송 실패:', error);
      Alert.alert('오류', '메시지 전송에 실패했습니다.');
    }
  };

  // 채팅방 생성
  const createChatRoom = async () => {
    if (!newRoomName.trim()) {
      Alert.alert('오류', '채팅방 이름을 입력해주세요.');
      return;
    }

    try {
      const currentUser = getAuth().currentUser;
      if (!currentUser || !currentUser.email) return;

      const currentTime = serverTimestamp();
      const roomData = {
        name: newRoomName.trim(),
        createdAt: currentTime,
        lastMessageTime: currentTime,  // lastMessageTime도 생성 시점으로 설정
        participants: [currentUser.email],
        createdBy: currentUser.email
      };

      const roomRef = await addDoc(collection(getFirestore(), 'chatRooms'), roomData);
      
      // 로컬 상태 업데이트 - 새 채팅방을 목록 맨 위에 추가
      const newRoom = {
        id: roomRef.id,
        ...roomData,
      } as ChatRoom;
      
      setChatRooms(prevRooms => [newRoom, ...prevRooms]);
      
      setCreateRoomModalVisible(false);
      setNewRoomName('');
      
      // 생성된 방으로 이동
      selectRoom(newRoom);
    } catch (error) {
      console.error('채팅방 생성 오류:', error);
      Alert.alert('오류', '채팅방 생성에 실패했습니다.');
    }
  };

  // 채팅방 선택
  const selectRoom = (room: ChatRoom) => {
    console.log('채팅방 선택됨:', room.name);
    
    // 전역 변수 업데이트 - 다른 코드보다 먼저 실행
    global.isInChatRoom = true;
    global.selectedRoomName = room.name;
    
    // 하단탭 숨기기
    if (typeof global.setTabBarVisible === 'function') {
      global.setTabBarVisible(false);
    }
    
    // 네비게이션 헤더 강제 업데이트
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity
          style={[styles.headerButton, styles.headerBackButton]}
          onPress={goBackToRoomList}
        >
          <Ionicons name="chevron-back" size={24} color="#2E8B57" />
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => setShowRoomOptions(true)}
        >
          <Ionicons name="ellipsis-horizontal" size={24} color="#2E8B57" />
        </TouchableOpacity>
      ),
      title: room.name
    });
    
    // 상태 업데이트
    setSelectedRoom(room);
    
    // 메시지 실시간 리스너 설정
    const unsubscribe = fetchMessages(room.id);
    
    // 컴포넌트가 언마운트되거나 다른 방을 선택할 때 리스너 해제
    return () => {
      unsubscribe();
      setMessages([]);
    };
  };
  
  // 채팅방 목록으로 돌아가기
  const goBackToRoomList = () => {
    console.log('채팅방 나가기 함수 호출됨');
    
    // 전역 변수 먼저 업데이트
    global.isInChatRoom = false;
    global.selectedRoomName = '채팅';
    
    // 하단탭 다시 보이기
    if (typeof global.setTabBarVisible === 'function') {
      global.setTabBarVisible(true);
      console.log('하단 탭바 표시 설정됨 - setTabBarVisible(true) 호출');
    } else {
      console.log('setTabBarVisible 함수를 찾을 수 없음');
    }
    
    // 네비게이션 헤더 강제 업데이트 - 안드로이드 대응
    setTimeout(() => {
      navigation.setOptions({
        headerTitle: '채팅',
        headerLeft: () => null,
        headerRight: () => (
          <TouchableOpacity
            style={[styles.headerButton, { marginRight: 5 }]}
            onPress={() => {
              if (typeof global.createChatRoomModal === 'function') {
                global.createChatRoomModal(true);
              }
            }}
          >
            <Ionicons name="add-circle" size={26} color="#2E8B57" />
          </TouchableOpacity>
        )
      });
      console.log('헤더 업데이트 완료');
    }, 100);
    
    // 상태 업데이트
    setSelectedRoom(null);
    setMessages([]);
    console.log('채팅방 상태 초기화 완료');
  };

  // 날짜 포맷팅
  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    
    try {
      const date = timestamp.toDate();
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 1) {
        return '방금 전';
      } else if (diffMins < 60) {
        return `${diffMins}분 전`;
      } else if (diffMins < 1440) { // 24시간
        return `${Math.floor(diffMins / 60)}시간 전`;
      } else {
        return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
      }
    } catch (error) {
      return '시간 오류';
    }
  };

  // 채팅방 항목 렌더링
  const renderChatRoomItem = ({ item }: { item: ChatRoom }) => (
    <TouchableOpacity 
      style={styles.roomItem}
      onPress={() => selectRoom(item)}
    >
      <View style={styles.roomIconContainer}>
        <Ionicons name="chatbubble-ellipses" size={24} color={MAIN_COLOR} />
      </View>
      <View style={styles.roomInfo}>
        <ThemedText style={styles.roomName}>{item.name}</ThemedText>
        {item.lastMessage ? (
          <ThemedText style={styles.lastMessage} numberOfLines={1}>
            {item.lastMessage}
          </ThemedText>
        ) : (
          <ThemedText style={styles.noMessage}>새로운 채팅방</ThemedText>
        )}
      </View>
      <View style={styles.roomMeta}>
        {item.lastMessageTime && (
          <ThemedText style={styles.lastMessageTime}>
            {formatDate(item.lastMessageTime)}
          </ThemedText>
        )}
      </View>
    </TouchableOpacity>
  );

  // 메시지 렌더링
  const renderMessage = ({ item }: { item: Message }) => {
    const isMyMessage = getAuth().currentUser?.uid === item.userId;
    
    return (
      <View style={[
        styles.messageRow,
        isMyMessage ? styles.myMessageRow : styles.otherMessageRow
      ]}>
        {!isMyMessage && (
          <View style={styles.avatar}>
            {item.userPhotoURL ? (
              <Image source={{ uri: item.userPhotoURL }} style={styles.avatarImage} />
            ) : (
              <View style={styles.defaultAvatar}>
                <ThemedText style={styles.avatarText}>
                  {item.userName.charAt(0).toUpperCase()}
                </ThemedText>
              </View>
            )}
          </View>
        )}
        
        <View style={styles.messageContentContainer}>
          {!isMyMessage && (
            <ThemedText style={styles.userName}>{item.userName}</ThemedText>
          )}
          
          <View style={[
            styles.bubble,
            isMyMessage ? styles.myBubble : styles.otherBubble
          ]}>
            <ThemedText style={[
              styles.messageText,
              isMyMessage ? styles.myMessageText : styles.otherMessageText
            ]}>
              {item.text}
            </ThemedText>
          </View>
          
          <ThemedText style={[
            styles.timestamp,
            isMyMessage ? styles.myTimestamp : styles.otherTimestamp
          ]}>
            {formatDate(item.createdAt)}
          </ThemedText>
        </View>
      </View>
    );
  };

  // 채팅방 목록 화면
  const renderChatRoomList = () => {
    const [refreshing, setRefreshing] = useState(false);
    
    // 채팅방 목록 새로고침
    const onRefresh = async () => {
      try {
        setRefreshing(true);
        
        // 채팅방 목록 다시 가져오기
        const currentUser = getAuth().currentUser;
        if (!currentUser || !currentUser.email) {
          setRefreshing(false);
          return;
        }
        
        const chatRoomsRef = collection(getFirestore(), 'chatRooms');
        const q = query(chatRoomsRef, where('participants', 'array-contains', currentUser.email));
        
        const querySnapshot = await getDocs(q);
        const roomsList: ChatRoom[] = [];
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          roomsList.push({
            id: doc.id,
            name: data.name || '이름 없는 채팅방',
            createdAt: data.createdAt,
            participants: data.participants || [],
            lastMessage: data.lastMessage,
            lastMessageTime: data.lastMessageTime,
            createdBy: data.createdBy
          });
        });
        
        // 클라이언트에서 수동으로 정렬
        roomsList.sort((a, b) => {
          if (!a.createdAt) return 1;
          if (!b.createdAt) return -1;
          
          try {
            const timeA = a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
            const timeB = b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
            return timeB - timeA; // 내림차순
          } catch (e) {
            return 0;
          }
        });
        
        setChatRooms(roomsList);
        console.log('채팅방 목록 새로고침 완료:', roomsList.length);
      } catch (error) {
        console.error('채팅방 목록 새로고침 오류:', error);
      } finally {
        setRefreshing(false);
      }
    };
    
    return (
      <View style={styles.container}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={MAIN_COLOR} />
            <ThemedText style={{ marginTop: 10, fontSize: 16 }}>채팅방 목록 불러오는 중...</ThemedText>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => {
                setLoading(true);
                // 상태 초기화 후 다시 시도
                setChatRooms([]);
                const currentUser = getAuth().currentUser;
                if (currentUser) {
                  const chatRoomsRef = collection(getFirestore(), 'chatRooms');
                  // 인덱스 오류를 방지하기 위해 쿼리 수정
                  const q = query(chatRoomsRef, where('participants', 'array-contains', currentUser.uid));
                  getDocs(q).then((snapshot) => {
                    const roomsList: ChatRoom[] = [];
                    snapshot.forEach((doc) => {
                      const data = doc.data();
                      roomsList.push({
                        id: doc.id,
                        name: data.name || '이름 없는 채팅방',
                        createdAt: data.createdAt,
                        participants: data.participants || [],
                        lastMessage: data.lastMessage,
                        lastMessageTime: data.lastMessageTime,
                        createdBy: data.createdBy
                      });
                    });
                    
                    // 클라이언트에서 수동으로 정렬
                    roomsList.sort((a, b) => {
                      if (!a.createdAt) return 1;
                      if (!b.createdAt) return -1;
                      
                      try {
                        const timeA = a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
                        const timeB = b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
                        return timeB - timeA; // 내림차순
                      } catch (e) {
                        return 0;
                      }
                    });
                    
                    setChatRooms(roomsList);
                    setLoading(false);
                  });
                } else {
                  setLoading(false);
                }
              }}
            >
              <ThemedText style={styles.retryButtonText}>다시 시도</ThemedText>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={chatRooms}
            renderItem={renderChatRoomItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.roomList}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[MAIN_COLOR]}
                tintColor={MAIN_COLOR}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="chatbubbles-outline" size={60} color={MAIN_COLOR} style={{marginBottom: 15}} />
                <ThemedText style={styles.emptyText}>
                  참여 중인 채팅방이 없습니다.
                </ThemedText>
                <TouchableOpacity
                  style={styles.createFirstRoomButton}
                  onPress={() => setCreateRoomModalVisible(true)}
                >
                  <ThemedText style={styles.createFirstRoomButtonText}>
                    채팅방 만들기
                  </ThemedText>
                </TouchableOpacity>
              </View>
            }
          />
        )}
        
        {renderCreateRoomModal()}
      </View>
    );
  };

  // 새 채팅방 생성 모달
  const renderCreateRoomModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={createRoomModalVisible}
      onRequestClose={() => setCreateRoomModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <ThemedText style={styles.modalTitle}>새 채팅방 생성</ThemedText>
          
          <TextInput
            style={styles.modalInput}
            placeholder="채팅방 이름"
            placeholderTextColor="#999"
            value={newRoomName}
            onChangeText={setNewRoomName}
            autoFocus
          />
          
          <View style={styles.modalButtonsContainer}>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => {
                setNewRoomName('');
                setCreateRoomModalVisible(false);
              }}
            >
              <ThemedText style={styles.modalButtonText}>취소</ThemedText>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.modalCreateButton,
                !newRoomName.trim() && styles.disabledButton
              ]}
              onPress={createChatRoom}
              disabled={!newRoomName.trim()}
            >
              <ThemedText style={styles.modalButtonText}>생성</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // 채팅 대화 화면
  const renderChatRoom = () => {
    const [refreshingMessages, setRefreshingMessages] = useState(false);

    const onRefreshMessages = async () => {
      if (!selectedRoom) return;
      
      try {
        setRefreshingMessages(true);
        const messagesRef = collection(getFirestore(), 'messages');
        const q = query(messagesRef, where('chatRoomId', '==', selectedRoom.id));
        const querySnapshot = await getDocs(q);
        const messagesList: Message[] = [];
        
        querySnapshot.forEach((doc: DocumentData) => {
          const data = doc.data();
          if (data.createdAt) {
            messagesList.push({
              id: doc.id,
              text: data.text || '',
              userId: data.userId || 'unknown',
              userName: data.userName || '사용자',
              createdAt: data.createdAt,
              userPhotoURL: data.userPhotoURL,
              chatRoomId: data.chatRoomId,
            });
          }
        });

        messagesList.sort((a, b) => {
          const timeA = a.createdAt?.seconds || 0;
          const timeB = b.createdAt?.seconds || 0;
          return timeA - timeB;
        });
        
        setMessages(messagesList);
      } catch (error) {
        console.error('메시지 목록 새로고침 오류:', error);
      } finally {
        setRefreshingMessages(false);
      }
    };

    // iOS 패딩 동적 계산
    const iosPadding = Platform.OS === 'ios' ? (keyboardVisible ? 20 : 30) : 8;

    return (
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} 
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.chatContainer}>
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            style={styles.messageList}
            contentContainerStyle={{ paddingBottom: 20 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshingMessages}
                onRefresh={onRefreshMessages}
                colors={[MAIN_COLOR]}
                tintColor={MAIN_COLOR}
              />
            }
            onContentSizeChange={() => {
              if (messages.length > 0) {
                flatListRef.current?.scrollToEnd({ animated: true });
              }
            }}
          />
          <View style={[styles.inputWrapper, { position: 'relative', paddingBottom: iosPadding }]}>
            <TextInput
              style={styles.input}
              placeholder="메시지를 입력하세요"
              placeholderTextColor="#999"
              value={inputMessage}
              onChangeText={setInputMessage}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                !inputMessage.trim() && styles.disabledSendButton
              ]}
              onPress={sendMessage}
              disabled={!inputMessage.trim()}
            >
              <Ionicons
                name="send"
                size={24}
                color={inputMessage.trim() ? "#FFFFFF" : "#999"}
              />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  };

  // 채팅방 옵션 모달
  const renderRoomOptionsModal = () => (
    <Modal
      animationType="fade"
      transparent={true}
      visible={showRoomOptions}
      onRequestClose={() => setShowRoomOptions(false)}
    >
      <TouchableOpacity 
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowRoomOptions(false)}
      >
        <View style={styles.optionsModalContent}>
          <TouchableOpacity
            style={styles.optionItem}
            onPress={() => {
              setShowRoomOptions(false);
              setInviteModalVisible(true);
            }}
          >
            <Ionicons name="person-add" size={22} color={MAIN_COLOR} />
            <ThemedText style={styles.optionText}>사용자 초대</ThemedText>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.optionItem, styles.leaveOption]}
            onPress={() => {
              setShowRoomOptions(false);
              leaveRoom();
            }}
          >
            <Ionicons name="exit-outline" size={22} color="#ff3b30" />
            <ThemedText style={styles.leaveOptionText}>채팅방 나가기</ThemedText>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
  
  // 사용자 초대 모달
  const renderInviteUserModal = () => {
    // 참여자와 비참여자 분리
    const participants = users.filter(user => user.isParticipant);
    const nonParticipants = users.filter(user => !user.isParticipant);

    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={inviteModalVisible}
        onRequestClose={() => setInviteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.inviteModalContent}>
            <View style={styles.inviteModalHeader}>
              <ThemedText style={styles.modalTitle}>사용자 초대</ThemedText>
              <TouchableOpacity
                onPress={() => setInviteModalVisible(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            {loadingUsers ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={MAIN_COLOR} />
                <ThemedText style={{ marginTop: 10 }}>사용자 목록 불러오는 중...</ThemedText>
              </View>
            ) : (
              <FlatList
                data={[
                  { title: '참여 중인 사용자', data: participants },
                  { title: '초대 가능한 사용자', data: nonParticipants }
                ]}
                keyExtractor={(item, index) => index.toString()}
                contentContainerStyle={styles.usersList}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <ThemedText style={styles.emptyText}>
                      초대할 수 있는 사용자가 없습니다.
                    </ThemedText>
                  </View>
                }
                renderItem={({ item: section }) => (
                  <>
                    {section.data.length > 0 && (
                      <>
                        <View style={styles.sectionHeader}>
                          <ThemedText style={styles.sectionHeaderText}>{section.title}</ThemedText>
                        </View>
                        {section.data.map((user) => (
                          <TouchableOpacity
                            key={user.id}
                            style={[
                              styles.userItem,
                              user.isParticipant && styles.participantUserItem
                            ]}
                            onPress={() => user.isParticipant ? null : inviteUser(user.id)}
                            disabled={user.isParticipant}
                          >
                            <View style={styles.userAvatar}>
                              <ThemedText style={styles.avatarText}>
                                {user.name.charAt(0).toUpperCase()}
                              </ThemedText>
                            </View>
                            <View style={styles.userInfo}>
                              <ThemedText style={styles.userNameText}>{user.name}</ThemedText>
                              <ThemedText style={styles.userEmail}>{user.email}</ThemedText>
                            </View>
                            {user.isParticipant ? (
                              <View style={styles.participantBadge}>
                                <ThemedText style={styles.participantBadgeText}>참여 중</ThemedText>
                              </View>
                            ) : (
                              <Ionicons name="add-circle" size={24} color={MAIN_COLOR} />
                            )}
                          </TouchableOpacity>
                        ))}
                      </>
                    )}
                  </>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    );
  };

  // 사용자 초대
  const inviteUser = async (userId: string) => {
    if (!selectedRoom) return;

    try {
      const userDoc = await getDoc(doc(getFirestore(), 'users', userId));
      if (!userDoc.exists()) {
        Alert.alert('오류', '사용자를 찾을 수 없습니다.');
        return;
      }

      const userData = userDoc.data();
      const userEmail = userData.email;

      if (!userEmail) {
        Alert.alert('오류', '사용자 이메일을 찾을 수 없습니다.');
        return;
      }

      const roomRef = doc(collection(getFirestore(), 'chatRooms'), selectedRoom.id);
      
      await updateDoc(roomRef, {
        participants: arrayUnion(userEmail)
      });

      setInviteModalVisible(false);
      Alert.alert('성공', '사용자를 초대했습니다.');
    } catch (error) {
      console.error('사용자 초대 오류:', error);
      Alert.alert('오류', '사용자 초대에 실패했습니다.');
    }
  };
  
  // 채팅방 나가기
  const leaveRoom = async () => {
    if (!selectedRoom) return;

    try {
      const currentUser = getAuth().currentUser;
      if (!currentUser || !currentUser.email) return;

      const roomRef = doc(collection(getFirestore(), 'chatRooms'), selectedRoom.id);
      const roomSnapshot = await getDoc(roomRef);
      
      if (!roomSnapshot.exists()) {
        console.error('채팅방을 찾을 수 없습니다.');
        return;
      }

      const roomData = roomSnapshot.data();
      if (!roomData) {
        console.error('채팅방 데이터를 찾을 수 없습니다.');
        return;
      }

      const updatedParticipants = (roomData.participants || []).filter((email: string) => email !== currentUser.email);

      if (updatedParticipants.length === 0) {
        // 마지막 유저가 나가는 경우 채팅방과 메시지 삭제
        const messagesRef = collection(getFirestore(), 'messages');
        const messageQuery = query(messagesRef, where('chatRoomId', '==', selectedRoom.id));
        const messageSnapshot = await getDocs(messageQuery);

        // 메시지 삭제
        const batch = writeBatch(getFirestore());
        messageSnapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });
        
        // 채팅방 삭제
        batch.delete(roomRef);
        await batch.commit();
      } else {
        // 다른 유저가 남아있는 경우 참여자 목록만 업데이트
        await updateDoc(roomRef, {
          participants: updatedParticipants
        });
      }

      // 전역 변수 업데이트
      global.isInChatRoom = false;
      global.selectedRoomName = '채팅';
      
      // 하단탭 다시 표시
      if (typeof global.setTabBarVisible === 'function') {
        global.setTabBarVisible(true);
        console.log('채팅방 나가기: 하단 탭바 표시 설정됨');
      } else {
        console.log('채팅방 나가기: setTabBarVisible 함수를 찾을 수 없음');
      }

      // 네비게이션 헤더 업데이트 - 안드로이드 대응
      setTimeout(() => {
        navigation.setOptions({
          headerTitle: '채팅',
          headerLeft: () => null,
          headerRight: () => (
            <TouchableOpacity
              style={[styles.headerButton, { marginRight: 5 }]}
              onPress={() => {
                if (typeof global.createChatRoomModal === 'function') {
                  global.createChatRoomModal(true);
                }
              }}
            >
              <Ionicons name="add-circle" size={26} color="#2E8B57" />
            </TouchableOpacity>
          )
        });
      }, 100);

      setShowRoomOptions(false);
      setSelectedRoom(null);
      Alert.alert('알림', '채팅방을 나갔습니다.');
    } catch (error) {
      console.error('채팅방 나가기 오류:', error);
      Alert.alert('오류', '채팅방 나가기에 실패했습니다.');
    }
  };

  return (
    <View style={styles.safeArea}>
      {selectedRoom ? renderChatRoom() : renderChatRoomList()}
      {renderRoomOptionsModal()}
      {renderInviteUserModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff'
  },
  container: {
    flex: 1,
    paddingTop: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eaeaea',
    backgroundColor: '#FFFFFF',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
    color: MAIN_COLOR,
  },
  headerRoomTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
    marginRight: 30,
  },
  backButton: {
    padding: 5,
  },
  newRoomButton: {
    padding: 5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roomList: {
    padding: 10,
  },
  roomItem: {
    flexDirection: 'row',
    padding: 15,
    marginVertical: 6,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    alignItems: 'center',
  },
  roomIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F5F9F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  roomInfo: {
    flex: 1,
  },
  roomName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
  },
  noMessage: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  roomMeta: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  lastMessageTime: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: 100,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  createFirstRoomButton: {
    backgroundColor: MAIN_COLOR,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  createFirstRoomButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.27,
    shadowRadius: 4.65,
    elevation: 6,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: MAIN_COLOR,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  modalButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalCancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 25,
    backgroundColor: '#ddd',
    marginRight: 10,
    alignItems: 'center',
  },
  modalCreateButton: {
    flex: 1,
    padding: 12,
    borderRadius: 25,
    backgroundColor: MAIN_COLOR,
    alignItems: 'center',
  },
  modalButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 15,
  },
  chatContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  messageList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 16,
    maxWidth: '80%',
  },
  myMessageRow: {
    alignSelf: 'flex-end',
  },
  otherMessageRow: {
    alignSelf: 'flex-start',
  },
  avatar: {
    marginRight: 8,
    width: 36,
    height: 36,
  },
  avatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  defaultAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: MAIN_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  messageContentContainer: {
    flexDirection: 'column',
  },
  userName: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    color: '#666',
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  myBubble: {
    backgroundColor: MAIN_COLOR,
  },
  otherBubble: {
    backgroundColor: '#f1f1f1',
  },
  messageText: {
    fontSize: 16,
  },
  myMessageText: {
    color: 'white',
  },
  otherMessageText: {
    color: '#333',
  },
  timestamp: {
    fontSize: 11,
    marginTop: 4,
  },
  myTimestamp: {
    color: '#888',
    alignSelf: 'flex-end',
  },
  otherTimestamp: {
    color: '#888',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#eaeaea',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    marginRight: 10,
    color: '#000000',
  },
  sendButton: {
    marginLeft: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: MAIN_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledSendButton: {
    backgroundColor: '#cccccc',
  },
  disabledButton: {
    opacity: 0.5,
  },
  retryButton: {
    marginTop: 20,
    padding: 12,
    borderRadius: 25,
    backgroundColor: MAIN_COLOR,
    alignItems: 'center',
    width: 140,
    alignSelf: 'center',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 15,
  },
  
  // 채팅방 옵션 모달
  optionsModalContent: {
    position: 'absolute',
    top: 70,
    right: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    width: 170,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  optionText: {
    marginLeft: 12,
    fontSize: 15,
  },
  leaveOption: {
    borderTopWidth: 1,
    borderTopColor: '#eaeaea',
  },
  leaveOptionText: {
    marginLeft: 12,
    fontSize: 15,
    color: '#ff3b30',
  },
  
  // 사용자 초대 모달
  inviteModalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: '90%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    paddingBottom: 20,
  },
  inviteModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eaeaea',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  closeButton: {
    padding: 5,
  },
  usersList: {
    paddingHorizontal: 15,
    paddingTop: 10,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: MAIN_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  userInfo: {
    flex: 1,
  },
  userNameText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 3,
  },
  userEmail: {
    fontSize: 13,
    color: '#666',
  },
  headerButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    height: 44,
    width: 44,
  },
  headerBackButton: {
    paddingLeft: 8,
    paddingTop: 0,
    paddingBottom: 8,
    marginTop: -4,
  },
  sectionHeader: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eaeaea',
    paddingHorizontal: 15,
  },
  sectionHeaderText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  participantBadge: {
    backgroundColor: MAIN_COLOR,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
    marginLeft: 10,
  },
  participantBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  participantUserItem: {
    // 회색 배경 스타일 제거
  },
}); 