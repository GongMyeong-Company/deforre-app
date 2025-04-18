import React, { useState, useEffect } from 'react';
import { StyleSheet, View, FlatList, ActivityIndicator, SectionList, TouchableOpacity, Alert, RefreshControl, ScrollView, TextInput, BackHandler, Animated } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { collection, query, onSnapshot, doc, updateDoc, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { validateAdminPassword } from '@/config/admin-auth';
import { useLocalSearchParams, useNavigation } from 'expo-router';

// 객실 정보 타입 정의
interface RoomData {
  id: string;
  roomNumber: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  clean: string;
  status: string;
  cleanedAt?: string;
  cleanedBy?: string;
  inspectedAt?: string;
  inspectedBy?: string;
}

// 섹션 타입 정의
interface Section {
  title: string;
  data: RoomData[];
}

// 정비 모달 상태 타입
interface CleanModalState {
  visible: boolean;
  room: RoomData | null;
  type: 'clean' | 'inspect' | 'reset' | null;
}

// 체크아웃 모달 상태 타입
interface CheckoutModalState {
  visible: boolean;
  room: RoomData | null;
}

// 인원수 모달 상태 타입
interface PeopleCountModalState {
  visible: boolean;
  room: RoomData | null;
}

// 층별 필터 설정
const FLOOR_FILTERS = [
  { id: 'all', label: '전체' },
  { id: '1f', label: '1층', range: [101, 105] },
  { id: '2f', label: '2층', range: [106, 112] },
  { id: '2b', label: '2동', range: [201, 204] },
  { id: '3b', label: '3동', range: [301, 304] },
  { id: '4b', label: '4동', range: [401, 403] },
  { id: '5b', label: '5동', range: [501, 503] },
  { id: '6b', label: '6동', range: [601, 602] },
  { id: '7b', label: '7동', range: [701, 702] },
  { id: '8b', label: '8동', range: [801, 802] },
];

// 상단에 추가
const TextWithColor = ({ style, children, ...props }: any) => (
  <ThemedText style={[{ color: '#000' }, style]} {...props}>
    {children}
  </ThemedText>
);

// 모달 상태 관리를 위한 전역 플래그 추가
let isModalTransitioning = false;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  filterContainer: {
    padding: 0,
    paddingTop: 0,
    paddingBottom: 5,
    marginTop: 10,
  },
  filterScrollContent: {
    paddingRight: 10,
    paddingLeft: 10,
    paddingTop: 5,
  },
  filterButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',  },
  filterButtonActive: {
    backgroundColor: '#4B7F52',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#555',
  },
  filterButtonTextActive: {
    color: 'white',
  },
  listContent: {
    padding: 10,
    paddingBottom: 80,
  },
  sectionHeader: {
    padding: 10,
    backgroundColor: '#4B7F52',
    borderRadius: 5,
    marginVertical: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  roomItem: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  roomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roomNumberNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roomNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
    color: '#000',
  },
  guestName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  badgesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 5,
    marginRight: 10,
    minWidth: 50,
  },
  statusEmptyBadge: {
    backgroundColor: '#bdbdbd',
  },
  statusCheckedInBadge: {
    backgroundColor: '#4B7F52',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  cleanBadge: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 5,
    backgroundColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 50,
  },
  cleanVD: {
    backgroundColor: '#ef9a9a',
  },
  cleanVC: {
    backgroundColor: '#90caf9',
  },
  cleanVI: {
    backgroundColor: '#a5d6a7',
  },
  cleanDefault: {
    backgroundColor: '#bdbdbd',
  },
  cleanText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'white',
  },
  dateInfoContainer: {
    flexDirection: 'row',
    marginTop: 10,
    flexWrap: 'wrap',
    paddingHorizontal: 2,
  },
  dateInfo: {
    fontSize: 12,
    color: '#555',
    letterSpacing: 0.3,
  },
  dateLabel: {
    fontWeight: '500',
    marginRight: 3,
    color: '#444',
  },
  dateSeparator: {
    fontSize: 12,
    color: '#999',
    marginHorizontal: 8,
  },
  
  // 모달 스타일 업데이트
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdropTouchable: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInfoContainer: {
    width: '100%',
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  modalInfoText: {
    fontSize: 14,
    marginBottom: 8,
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#e0e0e0',
    padding: 12,
    borderRadius: 5,
    marginRight: 8,
    alignItems: 'center',
  },
  modalConfirmButton: {
    flex: 1,
    backgroundColor: '#4B7F52',
    padding: 12,
    borderRadius: 5,
    marginLeft: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'white',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 20,
  },
  passwordInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 12,
    width: '100%',
    color: '#000',
  },
  // 체크아웃 버튼 스타일 추가
  checkoutOnlyButton: {
    flex: 1,
    backgroundColor: '#e0e0e0', // 회색으로 변경
    padding: 12,
    borderRadius: 5,
    marginRight: 8,
    alignItems: 'center',
  },
  checkoutRequestButton: {
    flex: 1,
    backgroundColor: '#4B7F52', // 녹색 유지
    padding: 12,
    borderRadius: 5,
    marginLeft: 8,
    alignItems: 'center',
  },
  modalDescription: {
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
  },
  // 숫자 입력 스타일 추가
  numberInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 12,
    width: '100%',
    color: '#000',
    fontSize: 16,
    textAlign: 'center',
  },
});

export default function RoomPage() {
  const navigation = useNavigation();
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [isAdmin, setIsAdmin] = useState(false);
  
  // 각 모달에 대한 상태 관리 - 각 상태 별도로 관리
  const [checkoutModalVisible, setCheckoutModalVisible] = useState(false);
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [peopleCountModalVisible, setPeopleCountModalVisible] = useState(false);
  const [cleanModalVisible, setCleanModalVisible] = useState(false);
  
  // 애니메이션 값
  const [modalAnimation] = useState(new Animated.Value(0));
  
  // 모달 데이터 관리
  const [selectedRoom, setSelectedRoom] = useState<RoomData | null>(null);
  const [cleanType, setCleanType] = useState<'clean' | 'inspect' | 'reset' | null>(null);
  
  // 입력값 상태
  const [peopleCount, setPeopleCount] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  
  // 모달 전환 플래그
  const [isModalSwitching, setIsModalSwitching] = useState(false);
  
  // 라이프사이클 처리
  useEffect(() => {
    // 모든 모달 전환 시 사용자가 뒤로가기 버튼을 눌렀을 때의 처리
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        // 어떤 모달이라도 열려있으면 닫기
        if (checkoutModalVisible || authModalVisible || peopleCountModalVisible || cleanModalVisible) {
          closeAllModals();
          return true;
        }
        return false;
      }
    );
    
    return () => backHandler.remove();
  }, [checkoutModalVisible, authModalVisible, peopleCountModalVisible, cleanModalVisible]);
  
  // 모달 활성화/비활성화 애니메이션 처리
  useEffect(() => {
    if (checkoutModalVisible || authModalVisible || peopleCountModalVisible || cleanModalVisible) {
      // 모달 열기 애니메이션
      Animated.timing(modalAnimation, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      // 모달 닫기 애니메이션
      Animated.timing(modalAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [checkoutModalVisible, authModalVisible, peopleCountModalVisible, cleanModalVisible]);

  // 헤더 버튼 핸들러 설정
  useEffect(() => {
    try {
      // 전역 함수 등록 방식으로 변경
      // @ts-ignore
      global.handleRoomAuthButtonClick = () => {
        // 다른 모달이 열려 있지 않을 때만 인증 모달 표시
        if (!checkoutModalVisible && !peopleCountModalVisible && !cleanModalVisible && !isModalSwitching) {
          setAuthModalVisible(true);
          setAdminPassword('');
        }
      };
      
      // 네비게이션 파라미터 설정
      navigation.setParams({ 
        isAdmin: isAdmin
      });
      
      return () => {
        // 컴포넌트 언마운트 시 전역 함수 삭제
        // @ts-ignore
        global.handleRoomAuthButtonClick = undefined;
      };
    } catch (error) {
      console.error('헤더 초기화 오류:', error);
    }
  }, [isAdmin, checkoutModalVisible, peopleCountModalVisible, cleanModalVisible, isModalSwitching]);
  
  useEffect(() => {
    // 컴포넌트 마운트 시 실시간 리스너 설정
    const unsubscribe = setupRoomsListener();
    return () => unsubscribe();
  }, []);
  
  // 액티브 필터 변경 시 섹션 업데이트
  useEffect(() => {
    if (rooms.length > 0) {
      updateSections(rooms, activeFilter);
    }
  }, [activeFilter, rooms]);
  
  // 모든 모달 닫기
  const closeAllModals = () => {
    setCheckoutModalVisible(false);
    setAuthModalVisible(false);
    setPeopleCountModalVisible(false);
    setCleanModalVisible(false);
    setIsModalSwitching(false);
  };
  
  // 모달 전환 함수
  const switchModal = (fromModal: string, toModal: string) => {
    setIsModalSwitching(true);
    
    // 현재 모달 닫기
    switch (fromModal) {
      case 'checkout':
        setCheckoutModalVisible(false);
        break;
      case 'auth':
        setAuthModalVisible(false);
        break;
      case 'peopleCount':
        setPeopleCountModalVisible(false);
        break;
      case 'clean':
        setCleanModalVisible(false);
        break;
    }
    
    // 애니메이션 완료 후 새 모달 열기
    setTimeout(() => {
      switch (toModal) {
        case 'checkout':
          setCheckoutModalVisible(true);
          break;
        case 'auth':
          setAuthModalVisible(true);
          break;
        case 'peopleCount':
          setPeopleCountModalVisible(true);
          break;
        case 'clean':
          setCleanModalVisible(true);
          break;
        case 'none':
          // 모달 닫기만 수행
          break;
      }
      setIsModalSwitching(false);
    }, 250); // 애니메이션 완료 후 다음 모달 표시
  };
  
  const getCurrentUser = () => {
    return auth.currentUser;
  };

  const initializeRoomData = async () => {
    const user = getCurrentUser();
    if (!user) {
      console.log('사용자가 로그인되어 있지 않습니다.');
      return;
    }
    await fetchRooms();
  };

  const setupRoomsListener = () => {
    const roomsRef = collection(db, 'rooms');
    const unsubscribe = onSnapshot(roomsRef, (snapshot) => {
      const roomsData: RoomData[] = [];
      snapshot.forEach((doc) => {
        roomsData.push({ id: doc.id, ...doc.data() } as RoomData);
      });
      setRooms(roomsData);
      updateSections(roomsData, activeFilter);
      setIsLoading(false);
      setRefreshing(false);
    }, (error) => {
      console.error('객실 데이터 구독 오류:', error);
      setIsLoading(false);
      setRefreshing(false);
    });
    return unsubscribe;
  };

  const fetchRooms = async () => {
    try {
      const roomsRef = collection(db, 'rooms');
      const roomsSnapshot = await getDocs(roomsRef);
      const roomsData: RoomData[] = [];
      roomsSnapshot.forEach((doc) => {
        roomsData.push({ id: doc.id, ...doc.data() } as RoomData);
      });
      setRooms(roomsData);
      updateSections(roomsData, activeFilter);
      setIsLoading(false);
      setRefreshing(false);
    } catch (error) {
      console.error('객실 데이터 가져오기 실패:', error);
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  // 필터에 따라 섹션 데이터 업데이트
  const updateSections = (roomsData: RoomData[], filterId: string) => {
    if (filterId === 'all') {
      // 모든 객실 표시 (호텔동/한실동 구분)
      const hotelRooms = roomsData.filter(room => {
        const roomNum = parseInt(room.roomNumber);
        return roomNum >= 101 && roomNum <= 112;
      });
      
      const traditionalRooms = roomsData.filter(room => {
        const roomNum = parseInt(room.roomNumber);
        return roomNum >= 201 && roomNum <= 802;
      });
      
      setSections([
        { title: '호텔동', data: hotelRooms },
        { title: '한실동', data: traditionalRooms }
      ]);
    } else {
      // 선택된 필터에 따라 객실 필터링
      const filter = FLOOR_FILTERS.find(f => f.id === filterId);
      if (filter && filter.range) {
        const [min, max] = filter.range;
        const filteredRooms = roomsData.filter(room => {
          const roomNum = parseInt(room.roomNumber);
          return roomNum >= min && roomNum <= max;
        });
        
        setSections([
          { title: `${filter.label}`, data: filteredRooms }
        ]);
      }
    }
  };

  // 필터 변경 핸들러
  const handleFilterChange = (filterId: string) => {
    setActiveFilter(filterId);
    updateSections(rooms, filterId);
  };

  // 당겨서 새로고침
  const onRefresh = () => {
    setRefreshing(true);
    fetchRooms();
  };
  
  // 상태 버튼 클릭 핸들러
  const handleStatusButtonPress = (room: RoomData) => {
    // 재실 상태일 때만 체크아웃 모달 표시
    if (room.status === 'checked_in' || room.status === 'checked_out' || room.status === '재실') {
      // 다른 모달이 이미 열려있다면 무시
      if (checkoutModalVisible || authModalVisible || peopleCountModalVisible || cleanModalVisible || isModalSwitching) {
        return;
      }
      
      // 모달 데이터 설정
      setSelectedRoom(room);
      
      // 모달 표시
      setCheckoutModalVisible(true);
    }
  };

  // 체크아웃 버튼 핸들러
  const handleCheckout = (withPickupRequest: boolean) => {
    if (!selectedRoom) return;
    
    const roomInfo = selectedRoom;
    
    if (withPickupRequest) {
      // 인원수 모달로 전환
      switchModal('checkout', 'peopleCount');
    } else {
      // 모달 닫고 체크아웃 처리
      closeAllModals();
      setTimeout(() => {
        processCheckout(roomInfo, false);
      }, 300);
    }
  };
  
  // 인원수 확인 핸들러
  const handleConfirmPeopleCount = () => {
    if (!selectedRoom) return;
    
    // 인원수 입력값 확인
    const count = peopleCount.trim() || '1'; // 입력값이 없으면 기본값 1로 설정
    
    // 모달 닫기
    const roomInfo = selectedRoom;
    closeAllModals();
    
    // 체크아웃 처리
    setTimeout(() => {
      processCheckout(roomInfo, true, count);
      setPeopleCount(''); // 인원수 초기화
    }, 300);
  };
  
  // 정비 버튼 클릭 핸들러
  const handleCleanButtonPress = (room: RoomData) => {
    // 다른 모달이 이미 열려있다면 무시
    if (checkoutModalVisible || authModalVisible || peopleCountModalVisible || cleanModalVisible || isModalSwitching) {
      return;
    }
    
    setSelectedRoom(room);
    
    if (room.clean === 'VD') {
      setCleanType('clean');
    } else if (room.clean === 'VC') {
      setCleanType('inspect');
    } else if (room.clean === 'VI') {
      setCleanType('reset');
    }
    
    // 모달 표시
    setCleanModalVisible(true);
  };
  
  // 관리자 인증 핸들러
  const handleAdminAuth = () => {
    if (validateAdminPassword(adminPassword)) {
      setIsAdmin(true);
      closeAllModals();
      setAdminPassword('');
      
      try {
        // @ts-ignore
        navigation.setParams({ isAdmin: true });
      } catch (error) {
        console.error('헤더 업데이트 오류:', error);
      }
      
      Alert.alert('성공', '관리자로 인증되었습니다.');
    } else {
      Alert.alert('오류', '비밀번호가 일치하지 않습니다.');
    }
  };
  
  // 정비 상태 업데이트 핸들러
  const handleCleanStatusUpdate = async () => {
    if (!selectedRoom || !cleanType) return;

    const user = getCurrentUser();
    if (!user) {
        Alert.alert('오류', '사용자 인증이 필요합니다.');
        return;
    }

    // 현재 사용자의 이름 가져오기
    try {
        const userQuery = query(
            collection(db, 'users'),
            where('email', '==', user.email)
        );
        const userSnapshot = await getDocs(userQuery);
        
        if (userSnapshot.empty) {
            Alert.alert('오류', '사용자 정보를 찾을 수 없습니다.');
            return;
        }

        const userData = userSnapshot.docs[0].data();
        const userName = userData.name || user.email?.split('@')[0] || '알 수 없음';

        const roomRef = doc(db, 'rooms', selectedRoom.id);
        const updateData: any = {};

        if (cleanType === 'clean') {
            updateData.clean = 'VC';
            updateData.cleanedAt = new Date().toISOString();
            updateData.cleanedBy = userName;  // 이메일 대신 이름으로 저장
        } else if (cleanType === 'inspect') {
            updateData.clean = 'VI';
            updateData.inspectedAt = new Date().toISOString();
            updateData.inspectedBy = userName;  // 이메일 대신 이름으로 저장
        } else if (cleanType === 'reset') {
            updateData.clean = 'VD';
            updateData.cleanedAt = null;
            updateData.cleanedBy = null;
            updateData.inspectedAt = null;
            updateData.inspectedBy = null;
        }

        await updateDoc(roomRef, updateData);
        setCleanModalVisible(false);
        Alert.alert('성공', '객실 상태가 업데이트되었습니다.');
    } catch (error) {
        console.error('객실 상태 업데이트 실패:', error);
        Alert.alert('오류', '객실 상태 업데이트에 실패했습니다.');
    }
  };
  
  // 체크아웃 처리 함수
  const processCheckout = async (roomInfo: RoomData, withPickupRequest: boolean, peopleCount?: string) => {
    const roomRef = doc(db, 'rooms', roomInfo.id);
    try {
        // 객실 데이터 초기화 (정비 상태 제외)
        await updateDoc(roomRef, {
            status: 'empty',
            guestName: '',
            checkIn: '',
            checkOut: ''
        });

        // 픽업 요청이 있는 경우
        if (withPickupRequest && peopleCount) {
            const pickupRef = collection(db, 'todo');
            const newPickup = {
                roomNumber: roomInfo.roomNumber,
                guestName: roomInfo.guestName,
                peopleCount: peopleCount,
                content: '체크아웃',
                status: 'new',
                createdAt: serverTimestamp(),
                wingsCount: '0'
            };
            
            // 픽업 요청 추가
            await addDoc(pickupRef, newPickup);
        }

        Alert.alert('성공', withPickupRequest ? '체크아웃 처리 및 픽업 요청이 완료되었습니다.' : '체크아웃 처리가 완료되었습니다.');
    } catch (error) {
        console.error('체크아웃 처리 실패:', error);
        Alert.alert('오류', '체크아웃 처리에 실패했습니다.');
    }
  };
  
  // 객실 항목 렌더링
  const renderRoomItem = ({ item }: { item: RoomData }) => {
    // 상태 표시 텍스트 결정
    const getStatusText = (status: string) => {
      if (status === 'empty') return '공실';
      if (status === 'checked_in' || status === 'checked_out') return '재실';
      return status || '-';
    };

    const isOccupied = item.status === 'checked_in' || item.status === 'checked_out' || item.status === '재실';

    return (
      <View style={styles.roomItem}>
        <View style={styles.roomHeader}>
          <View style={styles.roomNumberNameContainer}>
            <TextWithColor style={styles.roomNumber}>{item.roomNumber}호</TextWithColor>
            {item.guestName ? (
              <TextWithColor style={styles.guestName}>{item.guestName}</TextWithColor>
            ) : null}
          </View>
          
          <View style={styles.badgesContainer}>
            {/* 상태 버튼 - isAdmin 상태에 따라 활성/비활성화 */}
            <TouchableOpacity
              onPress={() => isOccupied && handleStatusButtonPress(item)}
              disabled={!isOccupied || !isAdmin}
              style={{ opacity: isAdmin ? 1 : 0.5 }}
            >
              <View style={[
                styles.statusBadge, 
                isOccupied ? styles.statusCheckedInBadge : styles.statusEmptyBadge
              ]}>
                <TextWithColor style={styles.statusBadgeText}>
                  {getStatusText(item.status)}
                </TextWithColor>
              </View>
            </TouchableOpacity>
            
            {/* 정비 버튼 - 항상 활성화 */}
            <TouchableOpacity
              onPress={() => handleCleanButtonPress(item)}
            >
              {item.clean ? (
                <View style={[
                  styles.cleanBadge, 
                  item.clean === 'VD' ? styles.cleanVD : 
                  item.clean === 'VC' ? styles.cleanVC : 
                  item.clean === 'VI' ? styles.cleanVI : 
                  styles.cleanDefault
                ]}>
                  <TextWithColor style={styles.cleanText}>{item.clean}</TextWithColor>
                </View>
              ) : (
                <View style={styles.cleanBadge}>
                  <TextWithColor style={styles.cleanText}>-</TextWithColor>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
        
        {/* 체크인/체크아웃 정보만 한 줄로 표시 */}
        {(item.checkIn || item.checkOut) && (
          <View style={styles.dateInfoContainer}>
            {item.checkIn && (
              <TextWithColor style={styles.dateInfo}>
                <TextWithColor style={styles.dateLabel}>체크인: </TextWithColor>
                {item.checkIn}
              </TextWithColor>
            )}
            {item.checkIn && item.checkOut && (
              <TextWithColor style={styles.dateSeparator}> | </TextWithColor>
            )}
            {item.checkOut && (
              <TextWithColor style={styles.dateInfo}>
                <TextWithColor style={styles.dateLabel}>체크아웃: </TextWithColor>
                {item.checkOut}
              </TextWithColor>
            )}
          </View>
        )}
      </View>
    );
  };
  
  // 섹션 헤더 렌더링
  const renderSectionHeader = ({ section }: { section: Section }) => (
    <View style={styles.sectionHeader}>
      <TextWithColor style={styles.sectionTitle}>{section.title}</TextWithColor>
    </View>
  );

  // 필터 버튼 그룹 렌더링
  const renderFilterButtons = () => (
    <ThemedView style={styles.filterContainer}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterScrollContent}
      >
        {FLOOR_FILTERS.map((filter) => (
          <TouchableOpacity
            key={filter.id}
            style={[
              styles.filterButton,
              activeFilter === filter.id && styles.filterButtonActive
            ]}
            onPress={() => handleFilterChange(filter.id)}
          >
            <TextWithColor 
              style={[
                styles.filterButtonText,
                activeFilter === filter.id && styles.filterButtonTextActive
              ]}
            >
              {filter.label}
            </TextWithColor>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </ThemedView>
  );

  // 체크아웃 모달 렌더링
  const renderCheckoutModal = () => {
    if (!checkoutModalVisible && !isModalSwitching) return null;
    
    const animatedStyle = {
      transform: [{
        scale: modalAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [0.9, 1],
        }),
      }],
    };
    
    const backdropStyle = {
      opacity: 1, // 배경은 항상 완전히 보이게
    };
    
    return (
      <View style={styles.modalOverlay}>
        <Animated.View style={[styles.modalBackdrop, backdropStyle]}>
          <TouchableOpacity 
            style={styles.modalBackdropTouchable}
            activeOpacity={1}
            onPress={closeAllModals}
          >
            <Animated.View 
              style={[styles.modalContainer, animatedStyle]} 
              onStartShouldSetResponder={() => true} 
              onResponderRelease={e => e.stopPropagation()}
            >
              <TextWithColor style={styles.modalTitle}>
                {selectedRoom?.roomNumber}호 {selectedRoom?.guestName}
              </TextWithColor>
              
              <TextWithColor style={styles.modalDescription}>
                체크아웃 픽업 요청할까요?
              </TextWithColor>
              
              <View style={styles.modalButtonContainer}>
                <TouchableOpacity 
                  style={styles.checkoutOnlyButton}
                  onPress={() => handleCheckout(false)}
                >
                  <TextWithColor style={styles.modalButtonText}>아웃</TextWithColor>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.checkoutRequestButton}
                  onPress={() => handleCheckout(true)}
                >
                  <TextWithColor style={styles.modalButtonText}>요청</TextWithColor>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  };
  
  // 인원수 입력 모달 렌더링
  const renderPeopleCountModal = () => {
    if (!peopleCountModalVisible && !isModalSwitching) return null;
    
    const animatedStyle = {
      transform: [{
        scale: modalAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [0.9, 1],
        }),
      }],
    };
    
    const backdropStyle = {
      opacity: 1, // 배경은 항상 완전히 보이게
    };
    
    return (
      <View style={styles.modalOverlay}>
        <Animated.View style={[styles.modalBackdrop, backdropStyle]}>
          <TouchableOpacity 
            style={styles.modalBackdropTouchable}
            activeOpacity={1}
            onPress={() => {
              closeAllModals();
              setPeopleCount('');
            }}
          >
            <Animated.View 
              style={[styles.modalContainer, animatedStyle]} 
              onStartShouldSetResponder={() => true} 
              onResponderRelease={e => e.stopPropagation()}
            >
              <TextWithColor style={styles.modalTitle}>
                {selectedRoom?.roomNumber}호 {selectedRoom?.guestName}
              </TextWithColor>
              
              <TextWithColor style={styles.modalDescription}>
                픽업 인원수를 입력해주세요
              </TextWithColor>
              
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.numberInput}
                  placeholder="인원수를 입력하세요"
                  keyboardType="number-pad"
                  value={peopleCount}
                  onChangeText={setPeopleCount}
                  placeholderTextColor="#999"
                />
              </View>
              
              <View style={styles.modalButtonContainer}>
                <TouchableOpacity 
                  style={styles.modalCancelButton}
                  onPress={() => {
                    closeAllModals();
                    setPeopleCount('');
                  }}
                >
                  <TextWithColor style={styles.modalButtonText}>취소</TextWithColor>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.modalConfirmButton}
                  onPress={handleConfirmPeopleCount}
                >
                  <TextWithColor style={styles.modalButtonText}>요청</TextWithColor>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  };
  
  // 관리자 인증 모달 렌더링
  const renderAuthModal = () => {
    if (!authModalVisible && !isModalSwitching) return null;
    
    const animatedStyle = {
      transform: [{
        scale: modalAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [0.9, 1],
        }),
      }],
    };
    
    const backdropStyle = {
      opacity: 1, // 배경은 항상 완전히 보이게
    };
    
    return (
      <View style={styles.modalOverlay}>
        <Animated.View style={[styles.modalBackdrop, backdropStyle]}>
          <TouchableOpacity 
            style={styles.modalBackdropTouchable}
            activeOpacity={1}
            onPress={() => {
              closeAllModals();
              setAdminPassword('');
            }}
          >
            <Animated.View 
              style={[styles.modalContainer, animatedStyle]} 
              onStartShouldSetResponder={() => true} 
              onResponderRelease={e => e.stopPropagation()}
            >
              <TextWithColor style={styles.modalTitle}>관리자 인증</TextWithColor>
              
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="비밀번호를 입력하세요"
                  secureTextEntry
                  value={adminPassword}
                  onChangeText={setAdminPassword}
                  placeholderTextColor="#999"
                />
              </View>
              
              <View style={styles.modalButtonContainer}>
                <TouchableOpacity 
                  style={styles.modalCancelButton}
                  onPress={() => {
                    closeAllModals();
                    setAdminPassword('');
                  }}
                >
                  <TextWithColor style={styles.modalButtonText}>취소</TextWithColor>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.modalConfirmButton}
                  onPress={handleAdminAuth}
                >
                  <TextWithColor style={styles.modalButtonText}>확인</TextWithColor>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  };
  
  // 정비 모달 렌더링
  const renderCleanModal = () => {
    if (!cleanModalVisible && !isModalSwitching || !selectedRoom || !cleanType) return null;
    
    const animatedStyle = {
      transform: [{
        scale: modalAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [0.9, 1],
        }),
      }],
    };
    
    const backdropStyle = {
      opacity: 1, // 배경은 항상 완전히 보이게
    };
    
    let title = '';
    let content = null;
    
    if (cleanType === 'clean') {
      // VD -> VC: 정비 완료 처리
      title = `${selectedRoom.roomNumber}호 정비완료 처리 하시겠습니까?`;
    } else if (cleanType === 'inspect') {
      // VC -> VI: 점검 완료 처리
      title = `${selectedRoom.roomNumber}호 점검완료 처리 하시겠습니까?`;
      content = (
        <View style={styles.modalInfoContainer}>
          <TextWithColor style={styles.modalInfoText}>
            청소 완료자: {selectedRoom.cleanedBy || '정보 없음'}
          </TextWithColor>
        </View>
      );
    } else if (cleanType === 'reset') {
      // VI -> VD: 미정비 처리
      title = `${selectedRoom.roomNumber}호 미정비처리 하시겠습니까?`;
      content = (
        <View style={styles.modalInfoContainer}>
          <TextWithColor style={styles.modalInfoText}>
            청소 완료자: {selectedRoom.cleanedBy || '정보 없음'}
          </TextWithColor>
          <TextWithColor style={styles.modalInfoText}>
            점검 완료자: {selectedRoom.inspectedBy || '정보 없음'}
          </TextWithColor>
        </View>
      );
    }
    
    return (
      <View style={styles.modalOverlay}>
        <Animated.View style={[styles.modalBackdrop, backdropStyle]}>
          <TouchableOpacity 
            style={styles.modalBackdropTouchable}
            activeOpacity={1}
            onPress={closeAllModals}
          >
            <Animated.View 
              style={[styles.modalContainer, animatedStyle]} 
              onStartShouldSetResponder={() => true} 
              onResponderRelease={e => e.stopPropagation()}
            >
              <TextWithColor style={styles.modalTitle}>{title}</TextWithColor>
              
              {content}
              
              <View style={styles.modalButtonContainer}>
                <TouchableOpacity 
                  style={styles.modalCancelButton}
                  onPress={closeAllModals}
                >
                  <TextWithColor style={styles.modalButtonText}>취소</TextWithColor>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.modalConfirmButton}
                  onPress={handleCleanStatusUpdate}
                >
                  <TextWithColor style={styles.modalButtonText}>확인</TextWithColor>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  };
  
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4B7F52" />
        <TextWithColor style={styles.loadingText}>객실 정보를 불러오는 중...</TextWithColor>
      </View>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {renderFilterButtons()}
      {renderCheckoutModal()}
      {renderPeopleCountModal()}
      {renderAuthModal()}
      {renderCleanModal()}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderRoomItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#4B7F52']}
            tintColor="#4B7F52"
          />
        }
      />
    </ThemedView>
  );
}
