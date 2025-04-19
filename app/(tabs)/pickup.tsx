import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl, Modal, TextInput, ScrollView, TouchableWithoutFeedback, Keyboard, KeyboardAvoidingView, Platform } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { collection, query, orderBy, onSnapshot, updateDoc, doc, getDoc, addDoc, serverTimestamp, deleteDoc, where, getDocs } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { TextWithColor } from '@/components/ThemedText';
import { router, useLocalSearchParams } from 'expo-router';
import { validateAdminPassword } from '@/config/admin-auth';
import { sendPushToAllUsers, sendLocalNotification, sendUpdateNotification } from '@/utils/notificationHelper';

// Todo 아이템 타입 정의
type TodoItem = {
  id: string;
  roomNumber: string;
  guestName: string;
  peopleCount: string;
  content: string;
  status: 'new' | 'ing' | 'comp';
  createdAt: string;
  wingsCount?: string;
  cartCount?: string;
  handledBy?: string;
  startTime?: string;
  completedTime?: string;
  completedBy?: string;
};

// 투숙객 아이템 타입 정의
type GuestItem = {
  id: string;
  roomNumber: string;
  guestName: string;
  wingsCount?: string;
  roomType?: string;
  status: 'RR' | 'CI' | 'CO'; // 예약, 체크인, 체크아웃
  guestCount?: string; // 인원수
};

export default function PickupPage() {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [activeTab, setActiveTab] = useState<'new' | 'ing' | 'comp'>('new');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedTodo, setSelectedTodo] = useState<TodoItem | null>(null);
  const [cartCount, setCartCount] = useState('');
  const [userName, setUserName] = useState('로딩 중...');
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  
  // 투숙객 명단 관련 상태
  const [guestListModalVisible, setGuestListModalVisible] = useState(false);
  const [guestList, setGuestList] = useState<GuestItem[]>([]);
  const [guestListLoading, setGuestListLoading] = useState(false);
  
  // 요청 확인 모달 관련 상태
  const [requestModalVisible, setRequestModalVisible] = useState(false);
  const [selectedGuest, setSelectedGuest] = useState<GuestItem | null>(null);
  const [requestPeopleCount, setRequestPeopleCount] = useState('');
  const [requestType, setRequestType] = useState<'체크인' | '픽업' | '픽업(밑으로)' | null>(null);
  
  // 관리자 인증 관련 상태
  const [adminAuthModalVisible, setAdminAuthModalVisible] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminAuthError, setAdminAuthError] = useState('');
  
  // 상태 변경 대상 todo
  const [authTargetTodo, setAuthTargetTodo] = useState<TodoItem | null>(null);

  // 상세 모달 관련 상태
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [compTodo, setCompTodo] = useState<TodoItem | null>(null);

  // 상태 변수 추가
  const [isAdminDeleteAuth, setIsAdminDeleteAuth] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

  // 데이터 가져오기
  useEffect(() => {
    const q = query(collection(db, 'todo'));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const todoItems: TodoItem[] = [];
      querySnapshot.forEach((doc) => {
        todoItems.push({
          id: doc.id,
          ...doc.data() as Omit<TodoItem, 'id'>
        });
      });
      
      setTodos(todoItems);
      setIsLoading(false);
      setRefreshing(false);
    }, (error) => {
      console.error('Error fetching todos:', error);
      setIsLoading(false);
      setRefreshing(false);
    });
    
    return () => unsubscribe();
  }, []);

  // 모달이 열릴 때 사용자 이름 가져오기
  useEffect(() => {
    if (modalVisible && selectedTodo) {
      const fetchUserName = async () => {
        const currentUser = auth.currentUser;
        const name = await getUserName(currentUser?.email || null);
        setUserName(name);
      };
      
      fetchUserName();
    }
  }, [modalVisible, selectedTodo]);

  // 현재 사용자 이름 가져오기
  useEffect(() => {
    const fetchCurrentUserName = async () => {
      const currentUser = auth.currentUser;
      if (currentUser?.email) {
        const name = await getUserName(currentUser.email);
        setCurrentUserName(name);
      }
    };
    
    fetchCurrentUserName();
  }, []);

  // 요청 모달 상태 변경 추적
  useEffect(() => {
    console.log('요청 모달 상태 변경:', requestModalVisible, '선택된 투숙객:', selectedGuest);
  }, [requestModalVisible, selectedGuest]);

  // 활성 탭이 변경될 때 라우터 파라미터 업데이트
  useEffect(() => {
    // 라우터 파라미터 업데이트하여 헤더 버튼 변경
    router.setParams({ activeTab });
    
    // 탭이 변경될 때 관리자 인증 상태 초기화
    setIsAdmin(false);
  }, [activeTab]);

  // isAdmin 상태가 변경될 때마다 전역 변수에 저장
  useEffect(() => {
    // @ts-ignore
    global.isAdminAuthenticated = isAdmin;
    
    return () => {
      // 컴포넌트 언마운트 시 초기화
      // @ts-ignore
      global.isAdminAuthenticated = undefined;
    };
  }, [isAdmin]);

  // 상태 변경 함수
  const updateTodoStatus = async (id: string, newStatus: 'new' | 'ing' | 'comp', cartCount?: string, handledBy?: string, startTime?: string) => {
    try {
      const todoRef = doc(db, 'todo', id);
      const updateData: { 
        status: string; 
        cartCount?: string; 
        handledBy?: string;
        startTime?: string;
      } = { status: newStatus };
      
      if (cartCount) {
        updateData.cartCount = cartCount;
      }
      
      if (handledBy) {
        updateData.handledBy = handledBy;
      }
      
      if (startTime) {
        updateData.startTime = startTime;
      }
      
      await updateDoc(todoRef, updateData);
    } catch (error) {
      console.error('Error updating todo status:', error);
    }
  };
  
  // 완료 처리 함수
  const handleCompleteTodo = async (id: string) => {
    try {
      console.log('완료 처리 시작:', id);
      
      const now = new Date().toISOString();
      const currentUser = auth.currentUser;
      const completedBy = await getUserName(currentUser?.email || null);
      
      const todoRef = doc(db, 'todo', id);
      
      // Firestore 문서 업데이트
      await updateDoc(todoRef, {
        status: 'comp',
        completedTime: now,
        completedBy: completedBy
      });
      
      console.log('완료 상태로 업데이트됨');
      console.log('완료 처리 종료');
    } catch (error) {
      console.error('완료 처리 오류:', error);
    }
  };
  
  // guestList 데이터 가져오기
  const fetchGuestList = async () => {
    setGuestListLoading(true);
    
    try {
      // guestList 컬렉션에서 데이터 가져오기
      const q = query(collection(db, 'guestList'));
      
      const querySnapshot = await getDocs(q);
      const guestItems: GuestItem[] = [];
      
      querySnapshot.forEach((docSnap) => {
        const guestData = docSnap.data();
        const docId = docSnap.id;
        
        // 필요한 필드들만 추출하여 추가
        guestItems.push({
          id: docId,
          roomNumber: guestData.roomNumber || '',
          guestName: guestData.guestName || '',
          wingsCount: guestData.wingsCount || '',
          roomType: guestData.roomType || '',
          status: guestData.status || 'CI',
          guestCount: guestData.guestCount || ''
        });
      });
      
      // 정렬: 이름순으로 정렬
      guestItems.sort((a, b) => {
        // 이름이 없는 경우 빈 문자열로 처리
        const aName = a.guestName || '';
        const bName = b.guestName || '';
        
        // 이름 기준 오름차순 정렬 (한글 정렬을 위해 'ko' 로케일 사용)
        return aName.localeCompare(bName, 'ko');
      });
      
      setGuestList(guestItems);
      setGuestListLoading(false);
    } catch (error) {
      console.error('투숙객 명단 가져오기 오류:', error);
      setGuestListLoading(false);
    }
  };
  
  // 명단 버튼 클릭 핸들러 (외부에서 호출되는 함수)
  const handleGuestListButtonClick = () => {
    setGuestListModalVisible(true);
    fetchGuestList();
  };
  
  // 투숙객 상태 버튼 클릭 핸들러
  const handleGuestStatusClick = (guest: GuestItem) => {
    console.log('상태 버튼 클릭:', guest);
    
    // 먼저 상태 업데이트
    setSelectedGuest(guest);
    setRequestPeopleCount('');
    setRequestType(null);
    
    // 명단 모달을 먼저 닫고 요청 모달 열기
    setGuestListModalVisible(false);
    
    // 비동기 작업을 setTimeout으로 분리하여 상태 업데이트 후 모달을 표시
    setTimeout(() => {
      setRequestModalVisible(true);
      console.log('요청 모달 표시 시도됨');
    }, 300);
  };
  
  // 요청 확인 모달 제출 핸들러
  const handleRequestSubmit = async () => {
    if (!selectedGuest || !requestType) {
      console.log('선택된 투숙객 또는 요청 타입이 없습니다.');
      return;
    }

    // 인원수 유효성 검사
    if (!requestPeopleCount.trim()) {
      console.log('인원수를 입력해주세요.');
      return;
    }

    setRequestModalVisible(false);
    
    // Firestore에 todo 항목 추가
    try {
      const todoData = {
        roomNumber: selectedGuest.roomNumber,
        guestName: selectedGuest.guestName,
        peopleCount: requestPeopleCount,
        content: requestType,
        status: 'new',
        createdAt: serverTimestamp(),
        wingsCount: selectedGuest.wingsCount || '0'
      };
      
      console.log('Todo 추가 시작:', todoData);
      
      const docRef = await addDoc(collection(db, 'todo'), todoData);
      console.log('요청 문서 생성됨:', docRef.id);
      
      // 모달 닫기 및 상태 초기화
      setRequestType(null);
      setRequestPeopleCount('');
      setSelectedGuest(null);
      
      console.log('요청이 성공적으로 추가되었습니다.');
    } catch (error) {
      console.error('요청 추가 오류:', error);
    }
  };
  
  // _layout.tsx에서 명단 버튼 클릭 시 사용할 핸들러 함수를 전역 객체에 등록
  useEffect(() => {
    // @ts-ignore - 전역 객체에 함수 등록
    global.handleGuestListButtonClick = handleGuestListButtonClick;
    
    return () => {
      // 컴포넌트 언마운트 시 함수 제거
      // @ts-ignore
      global.handleGuestListButtonClick = undefined;
    };
  }, []);

  // _layout.tsx에서 인증 버튼 클릭 시 사용할 핸들러 함수를 전역 객체에 등록
  useEffect(() => {
    // @ts-ignore - 전역 객체에 함수 등록
    global.handleAdminAuthButtonClick = handleAdminAuthButtonClick;
    
    return () => {
      // 컴포넌트 언마운트 시 함수 제거
      // @ts-ignore
      global.handleAdminAuthButtonClick = undefined;
    };
  }, [activeTab]);
  
  // 인증 버튼 클릭 핸들러 (외부에서 호출되는 함수)
  const handleAdminAuthButtonClick = () => {
    setAdminPassword('');
    setAdminAuthError('');
    
    // 완료 탭에서는 전체 삭제 인증 모달로 활용
    if (activeTab === 'comp') {
      setIsAdminDeleteAuth(false);
    }
    
    setAdminAuthModalVisible(true);
  };
  
  // 관리자 비밀번호 확인
  const checkAdminPassword = (password: string) => {
    return validateAdminPassword(password);
  };
  
  // 관리자 인증 확인 핸들러
  const handleAdminAuthSubmit = () => {
    if (checkAdminPassword(adminPassword)) {
      setIsAdmin(true);
      setAdminAuthModalVisible(false);
      setAdminAuthError('');
      alert('관리자 인증이 완료되었습니다.');
    } else {
      setAdminAuthError('비밀번호가 올바르지 않습니다.');
    }
  };

  // 전체 삭제 인증 핸들러
  const handleDeleteAuthSubmit = () => {
    if (checkAdminPassword(adminPassword)) {
      setIsAdminDeleteAuth(true);
      setAdminAuthModalVisible(false);
      setAdminAuthError('');
      setShowDeleteConfirmation(true);
    } else {
      setAdminAuthError('비밀번호가 올바르지 않습니다.');
    }
  };
  
  // 전체 삭제 요청
  const handleBulkDelete = async () => {
    if (!isAdmin) {
      setAdminAuthModalVisible(true);
      setIsAdminDeleteAuth(true);
      return;
    }
    
    // 사용자에게 최종 확인
    setShowDeleteConfirmation(true);
  };

  // 일괄 삭제 확인
  const confirmBulkDelete = async () => {
    setShowDeleteConfirmation(false);
    
    try {
      const q = query(collection(db, 'todo'), where('status', '==', 'comp'));
      const querySnapshot = await getDocs(q);
      
      // 확인 메시지
      if (querySnapshot.empty) {
        console.log('삭제할 완료 항목이 없습니다.');
        return;
      }
      
      console.log(`총 ${querySnapshot.size}개의 완료 항목을 삭제합니다.`);
      
      // 삭제 작업 실행
      const deletePromises = querySnapshot.docs.map(docSnapshot => 
        deleteDoc(doc(db, 'todo', docSnapshot.id))
      );
      
      await Promise.all(deletePromises);
      console.log('모든 완료 항목이 삭제되었습니다.');
      
      // 관리자 인증 상태 초기화
      setIsAdmin(false);
    } catch (error) {
      console.error('일괄 삭제 중 오류 발생:', error);
    }
  };

  // 진행 버튼 처리
  const handleProcessButton = (todo: TodoItem) => {
    setSelectedTodo(todo);
    setCartCount('');
    setModalVisible(true);
  };

  // 사용자 이름 가져오기
  const getUserName = async (email: string | null): Promise<string> => {
    if (!email) return '알 수 없음';
    
    try {
      const userRef = doc(db, 'users', email);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        // userData가 undefined일 수 있으므로 옵셔널 체이닝 사용
        return userData?.name || email.split('@')[0] || '미상';
      } else {
        // 사용자 문서가 없다면 이메일의 @ 앞부분을 이름으로 사용
        return email.split('@')[0] || '미상';
      }
    } catch (error) {
      console.error('사용자 이름 조회 오류:', error);
      return '오류';
    }
  };

  // 모달 확인 버튼 처리
  const handleConfirmProcess = async () => {
    setModalVisible(false);
    
    if (!selectedTodo) return;
    
    // 현재 로그인한 사용자 정보를 담당자로 저장
    const currentUser = auth.currentUser;
    const handledBy = await getUserName(currentUser?.email || null);
    
    // 현재 시간을 ISO 문자열로 저장
    const startTime = new Date().toISOString();
    
    // 카트 수를 기본값으로 설정
    const cartCnt = cartCount || '0';
    
    // 상태 업데이트
    await updateTodoStatus(selectedTodo.id, 'ing', cartCnt, handledBy, startTime);
    
    // 폼 초기화
    setCartCount('');
    setSelectedTodo(null);
    
    // 수동으로 새로고침 처리
    const q = query(collection(db, 'todo'));
    onSnapshot(q, (querySnapshot) => {
      const todoItems: TodoItem[] = [];
      querySnapshot.forEach((doc) => {
        todoItems.push({
          id: doc.id,
          ...doc.data() as Omit<TodoItem, 'id'>
        });
      });
      
      setTodos(todoItems);
    });
  };

  // 데이터 새로고침
  const onRefresh = () => {
    setRefreshing(true);
    
    // 수동으로 새로고침 처리
    const q = query(collection(db, 'todo'));
    onSnapshot(q, (querySnapshot) => {
      const todoItems: TodoItem[] = [];
      querySnapshot.forEach((doc) => {
        todoItems.push({
          id: doc.id,
          ...doc.data() as Omit<TodoItem, 'id'>
        });
      });
      
      setTodos(todoItems);
      setRefreshing(false);
    }, (error) => {
      console.error('Error refreshing todos:', error);
      setRefreshing(false);
    });
  };

  // 필터링된 할일 목록
  const getTimeValue = (dateString: string): number => {
    if (!dateString) return 0;
    
    try {
      // 숫자나 숫자 문자열인 경우 (타임스탬프)
      if (!isNaN(Number(dateString))) {
        const timestamp = Number(dateString);
        return timestamp > 99999999999 ? timestamp : timestamp * 1000;
      }
      
      // 날짜 문자열인 경우
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date.getTime();
      }
      
      return 0;
    } catch (error) {
      console.error('날짜 변환 오류:', error);
      return 0;
    }
  };
  
  const filteredTodos = todos
    .filter(todo => todo.status === activeTab)
    .sort((a, b) => {
      // createdAt 기준 정렬
      const timeA = getTimeValue(a.createdAt);
      const timeB = getTimeValue(b.createdAt);
      
      // 오래된 순서대로 정렬 (오름차순)
      return timeA - timeB;
    });

  // 날짜 형식화 함수
  const formatDate = (dateString: string) => {
    try {
      // Firestore 타임스탬프 객체인 경우 (초 또는 밀리초 단위의 숫자 또는 숫자 문자열)
      if (!isNaN(Number(dateString))) {
        const timestamp = Number(dateString);
        // 타임스탬프가 초 단위인지 밀리초 단위인지 확인
        const date = timestamp > 99999999999 
          ? new Date(timestamp) // 밀리초 단위
          : new Date(timestamp * 1000); // 초 단위
        
        return date.toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });
      }
      
      // ISO 문자열, Firebase 타임스탬프 객체 등 다른 형식 처리
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date.toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });
      }
      
      // 날짜 객체로 변환할 수 없는 경우
      console.log('날짜 형식 오류:', dateString);
      return "시간 정보 없음";
    } catch (error) {
      console.error('날짜 형식화 오류:', error);
      return "시간 정보 없음";
    }
  };

  // 완료 상세 모달 열기 함수
  const openDetailModal = (todo: TodoItem) => {
    setCompTodo(todo);
    setDetailModalVisible(true);
  };

  // 삭제 함수
  const handleDeleteTodo = async (id: string) => {
    if (confirm('정말로 이 요청을 삭제하시겠습니까?')) {
      try {
        const todoRef = doc(db, 'todo', id);
        await deleteDoc(todoRef);
        setDetailModalVisible(false);
        setCompTodo(null);
      } catch (error) {
        console.error('삭제 오류:', error);
      }
    }
  };

  // 할일 아이템 렌더링
  const renderTodoItem = ({ item, index }: { item: TodoItem; index: number }) => {
    // 다음 상태 계산
    let nextStatus: 'new' | 'ing' | 'comp';
    let actionText: string;
    
    if (item.status === 'new') {
      nextStatus = 'ing';
      actionText = '진행';
    } else if (item.status === 'ing') {
      nextStatus = 'comp';
      actionText = '완료';
    } else {
      nextStatus = 'new';
      actionText = '재요청';
    }
    
    // content 색상 결정
    let contentColor = '#333'; // 기본 색상
    const content = item.content || '';
    const lowerContent = content.toLowerCase();
    
    if (lowerContent.includes('체크아웃') || lowerContent.includes('픽업(밑으로)')) {
      contentColor = '#e53935'; // 빨간색
    } else if (lowerContent.includes('체크인') || lowerContent.includes('픽업')) {
      contentColor = '#4B7F52'; // 앱 기본 초록색
    }
    
    // 완료 탭의 경우 간소화된 뷰 및 클릭 시 상세 모달
    if (activeTab === 'comp') {
      return (
        <TouchableOpacity
          style={styles.todoItem}
          onPress={() => openDetailModal(item)}
        >
          <View style={styles.todoHeader}>
            <View style={styles.todoInfo}>
              <TextWithColor style={styles.todoOrder}>{index + 1}</TextWithColor>
              <TextWithColor style={[styles.todoContent, { color: contentColor }]}>
                {content}
              </TextWithColor>
            </View>
          </View>
          
          <View style={styles.todoBody}>
            <View style={styles.todoRow}>
              <TextWithColor style={styles.todoLabel}>객실:</TextWithColor>
              <TextWithColor style={styles.todoValue}>
                {item.roomNumber ? `${item.roomNumber}호` : ''}
              </TextWithColor>
            </View>
            
            <View style={styles.todoRow}>
              <TextWithColor style={styles.todoLabel}>이름:</TextWithColor>
              <TextWithColor style={styles.todoValue}>{item.guestName}</TextWithColor>
            </View>
          </View>
        </TouchableOpacity>
      );
    }
    
    // 진행중 탭일 경우
    if (activeTab === 'ing') {
      // 현재 사용자가 담당자인지 확인
      const isAssignedUser = currentUserName === item.handledBy;
      // 담당자이거나 관리자 인증을 받은 경우 버튼 활성화
      const canComplete = isAssignedUser || isAdmin;
      
      return (
        <View style={styles.todoItem}>
          <View style={styles.todoHeader}>
            <View style={styles.todoInfo}>
              <TextWithColor style={styles.todoOrder}>{index + 1}</TextWithColor>
              <TextWithColor style={[styles.todoContent, { color: contentColor }]}>
                {content}
              </TextWithColor>
            </View>
            
            {canComplete ? (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleCompleteTodo(item.id)}
              >
                <TextWithColor style={styles.actionButtonText}>{actionText}</TextWithColor>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.disabledActionButton}
                disabled={true}
              >
                <TextWithColor style={styles.actionButtonText}>담당자 전용</TextWithColor>
              </TouchableOpacity>
            )}
          </View>
          
          <View style={styles.todoBody}>
            <View style={styles.todoRow}>
              <TextWithColor style={styles.ingTodoLabel}>객실:</TextWithColor>
              <TextWithColor style={styles.todoValue}>
                {item.roomNumber ? `${item.roomNumber}호` : ''}
              </TextWithColor>
            </View>
            
            <View style={styles.todoRow}>
              <TextWithColor style={styles.ingTodoLabel}>이름:</TextWithColor>
              <TextWithColor style={styles.todoValue}>{item.guestName}</TextWithColor>
            </View>
            
            <View style={styles.todoRow}>
              <TextWithColor style={styles.ingTodoLabel}>등록/요청/탑승:</TextWithColor>
              <TextWithColor style={styles.todoValue}>
                {item.wingsCount || '0'} / {item.peopleCount || '0'} / {item.cartCount || '0'}
              </TextWithColor>
            </View>
            
            <View style={styles.todoRow}>
              <TextWithColor style={styles.ingTodoLabel}>담당자:</TextWithColor>
              <TextWithColor style={styles.todoValue}>{item.handledBy || '미지정'}</TextWithColor>
            </View>
            
            <View style={styles.todoRow}>
              <TextWithColor style={styles.ingTodoLabel}>담당 시간:</TextWithColor>
              <TextWithColor style={styles.todoValue}>
                {item.startTime ? formatDate(item.startTime) : '기록 없음'}
              </TextWithColor>
            </View>
          </View>
        </View>
      );
    } else if (activeTab === 'new') {
      // 요청 탭일 경우
      return (
        <View style={styles.todoItem}>
          <View style={styles.todoHeader}>
            <View style={styles.todoInfo}>
              <TextWithColor style={styles.todoOrder}>{index + 1}</TextWithColor>
              <TextWithColor style={[styles.todoContent, { color: contentColor }]}>
                {content}
              </TextWithColor>
            </View>
            
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleProcessButton(item)}
            >
              <TextWithColor style={styles.actionButtonText}>{actionText}</TextWithColor>
            </TouchableOpacity>
          </View>
          
          <View style={styles.todoBody}>
            <View style={styles.todoRow}>
              <TextWithColor style={styles.todoLabel}>객실:</TextWithColor>
              <TextWithColor style={styles.todoValue}>
                {item.roomNumber ? `${item.roomNumber}호` : ''}
              </TextWithColor>
            </View>
            
            <View style={styles.todoRow}>
              <TextWithColor style={styles.todoLabel}>이름:</TextWithColor>
              <TextWithColor style={styles.todoValue}>{item.guestName}</TextWithColor>
            </View>
            
            <View style={styles.todoRow}>
              <TextWithColor style={styles.todoLabel}>인원:</TextWithColor>
              <TextWithColor style={styles.todoValue}>{item.peopleCount}명</TextWithColor>
            </View>
          </View>
        </View>
      );
    }
    
    // 기본 반환값 (여기에 도달하지 않지만 린트 에러 방지용)
    return null;
  };

  // 진행 모달 렌더링
  const renderProcessModal = () => {
    if (!selectedTodo) return null;
    
    return (
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <TextWithColor style={styles.modalTitle}>진행 확인</TextWithColor>
              </View>
              
              <View style={styles.modalContent}>
                <View style={styles.modalRow}>
                  <TextWithColor style={styles.modalLabel}>객실:</TextWithColor>
                  <TextWithColor style={styles.modalValue}>{selectedTodo.roomNumber ? `${selectedTodo.roomNumber}호` : ''}</TextWithColor>
                </View>
                
                <View style={styles.modalRow}>
                  <TextWithColor style={styles.modalLabel}>고객명:</TextWithColor>
                  <TextWithColor style={styles.modalValue}>{selectedTodo.guestName}</TextWithColor>
                </View>
                
                <View style={styles.modalRow}>
                  <TextWithColor style={styles.modalLabel}>요청 내용:</TextWithColor>
                  <TextWithColor style={styles.modalValue}>{selectedTodo.content}</TextWithColor>
                </View>
                
                <View style={styles.modalRow}>
                  <TextWithColor style={styles.modalLabel}>요청 시간:</TextWithColor>
                  <TextWithColor style={styles.modalValue}>{formatDate(selectedTodo.createdAt)}</TextWithColor>
                </View>
                
                <View style={styles.modalRow}>
                  <TextWithColor style={styles.modalLabel}>등록/요청:</TextWithColor>
                  <TextWithColor style={styles.modalValue}>
                    {selectedTodo.wingsCount || '0'}명 / {selectedTodo.peopleCount || '0'}명
                  </TextWithColor>
                </View>
              </View>
              
              <View style={styles.modalInputSection}>
                <TextWithColor style={styles.modalInputLabel}>
                  탑승 인원수 (24개월 미만은 제외)
                </TextWithColor>
                <TextInput
                  style={styles.modalInput}
                  placeholder="인원수 입력"
                  placeholderTextColor="#999"
                  keyboardType="number-pad"
                  value={cartCount}
                  onChangeText={setCartCount}
                />
              </View>
              
              <View style={styles.modalButtonContainer}>
                <TouchableOpacity 
                  style={styles.modalCancelButton}
                  onPress={() => {
                    Keyboard.dismiss();
                    setModalVisible(false);
                  }}
                >
                  <TextWithColor style={styles.modalCancelButtonText}>취소</TextWithColor>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.modalConfirmButton}
                  onPress={() => {
                    Keyboard.dismiss();
                    handleConfirmProcess();
                  }}
                >
                  <TextWithColor style={styles.modalButtonText}>확인</TextWithColor>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    );
  };

  // 투숙객 명단 모달 렌더링
  const renderGuestListModal = () => {
    return (
      <Modal
        visible={guestListModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setGuestListModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, styles.guestListModalContainer]}>
            <View style={styles.modalHeader}>
              <TextWithColor style={styles.modalTitle}>투숙객 명단</TextWithColor>
            </View>
            
            {guestListLoading ? (
              <View style={styles.guestListLoadingContainer}>
                <ActivityIndicator size="large" color="#4B7F52" />
                <TextWithColor style={styles.guestListLoadingText}>명단을 불러오는 중...</TextWithColor>
              </View>
            ) : (
              <ScrollView style={styles.guestListScrollView}>
                <View style={styles.guestListHeaderRow}>
                  <TextWithColor style={[styles.guestListHeaderCell, { flex: 0.6 }]}>호수</TextWithColor>
                  <TextWithColor style={[styles.guestListHeaderCell, { flex: 1.5 }]}>고객명</TextWithColor>
                  <TextWithColor style={[styles.guestListHeaderCell, { flex: 0.7 }]}>인원</TextWithColor>
                  <TextWithColor style={[styles.guestListHeaderCell, { flex: 0.7 }]}>타입</TextWithColor>
                  <TextWithColor style={[styles.guestListHeaderCell, { flex: 1.1 }]}>상태</TextWithColor>
                </View>
                
                {guestList.map((guest) => (
                  <View key={guest.id} style={styles.guestListRow}>
                    <TextWithColor style={[styles.guestListCell, { flex: 0.6 }]}>{guest.roomNumber}</TextWithColor>
                    <TextWithColor style={[styles.guestListCell, { flex: 1.5 }]}>{guest.guestName}</TextWithColor>
                    <TextWithColor style={[styles.guestListCell, { flex: 0.7 }]}>{guest.guestCount}</TextWithColor>
                    <TextWithColor style={[styles.guestListCell, { flex: 0.7 }]}>{guest.roomType || '-'}</TextWithColor>
                    <View style={[styles.guestListCell, { flex: 1.1 }]}>
                      <TouchableOpacity
                        style={[
                          styles.guestStatusButton,
                          guest.status === 'RR' ? styles.guestStatusRR : 
                          guest.status === 'CI' ? styles.guestStatusCI : 
                          styles.guestStatusCO
                        ]}
                        onPress={() => handleGuestStatusClick(guest)}
                      >
                        <TextWithColor style={styles.guestStatusText}>
                          {guest.status === 'RR' ? '예약' : 
                           guest.status === 'CI' ? '체크인' : 
                           '체크아웃'}
                        </TextWithColor>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
                
                {guestList.length === 0 && (
                  <View style={styles.guestListEmptyContainer}>
                    <TextWithColor style={styles.guestListEmptyText}>
                      투숙객 정보가 없습니다.
                    </TextWithColor>
                  </View>
                )}
              </ScrollView>
            )}
            
            <TouchableOpacity 
              style={styles.guestListCloseButton}
              onPress={() => setGuestListModalVisible(false)}
            >
              <TextWithColor style={styles.guestListCloseButtonText}>닫기</TextWithColor>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  // 관리자 인증 모달 렌더링
  const renderAdminAuthModal = () => {
    const isForDelete = activeTab === 'comp' && !isAdmin;
    const submitHandler = isForDelete ? handleDeleteAuthSubmit : handleAdminAuthSubmit;
    
    return (
      <Modal
        visible={adminAuthModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setAdminAuthModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <TextWithColor style={styles.modalTitle}>
                  {isForDelete ? '전체 삭제 인증' : '관리자 인증'}
                </TextWithColor>
              </View>
              
              <View style={styles.modalContent}>
                <TextWithColor style={isForDelete ? styles.deleteAuthModalText : styles.authModalText}>
                  {isForDelete 
                    ? '완료된 요청을 모두 삭제하려면\n\n관리자 비밀번호를 입력해주세요.' 
                    : '관리자 비밀번호를 입력해주세요.'}
                </TextWithColor>
                
                <TextInput
                  style={styles.modalInput}
                  placeholder="비밀번호 입력"
                  placeholderTextColor="#999"
                  secureTextEntry={true}
                  value={adminPassword}
                  onChangeText={setAdminPassword}
                />
                
                {adminAuthError ? (
                  <TextWithColor style={styles.authErrorText}>
                    {adminAuthError}
                  </TextWithColor>
                ) : null}
              </View>
              
              <View style={styles.modalButtonContainer}>
                <TouchableOpacity 
                  style={styles.modalCancelButton}
                  onPress={() => {
                    Keyboard.dismiss();
                    setAdminAuthModalVisible(false);
                  }}
                >
                  <TextWithColor style={styles.modalCancelButtonText}>취소</TextWithColor>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.modalConfirmButton}
                  onPress={() => {
                    Keyboard.dismiss();
                    submitHandler();
                  }}
                >
                  <TextWithColor style={styles.modalButtonText}>확인</TextWithColor>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    );
  };

  // 전체 삭제 확인 모달
  const renderDeleteConfirmModal = () => {
    return (
      <Modal
        visible={showDeleteConfirmation}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDeleteConfirmation(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TextWithColor style={styles.modalTitle}>삭제 확인</TextWithColor>
            </View>
            
            <View style={styles.modalContent}>
              <TextWithColor style={styles.deleteConfirmText}>
                완료된 모든 요청을 삭제하시겠습니까?
              </TextWithColor>
              <TextWithColor style={styles.deleteWarningText}>
                이 작업은 되돌릴 수 없습니다.
              </TextWithColor>
            </View>
            
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity 
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowDeleteConfirmation(false);
                  setIsAdminDeleteAuth(false);
                }}
              >
                <TextWithColor style={styles.modalCancelButtonText}>취소</TextWithColor>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalConfirmButton, { backgroundColor: '#e53935' }]}
                onPress={confirmBulkDelete}
              >
                <TextWithColor style={styles.modalButtonText}>삭제</TextWithColor>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  // 완료된 할일 상세 모달 렌더링
  const renderDetailModal = () => {
    if (!compTodo) return null;
    
    // content 색상 결정
    let contentColor = '#333'; // 기본 색상
    const content = compTodo.content || '';
    const lowerContent = content.toLowerCase();
    
    if (lowerContent.includes('체크아웃') || lowerContent.includes('픽업(밑으로)')) {
      contentColor = '#e53935'; // 빨간색
    } else if (lowerContent.includes('체크인') || lowerContent.includes('픽업')) {
      contentColor = '#4B7F52'; // 앱 기본 초록색
    }
    
    return (
      <Modal
        visible={detailModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <TextWithColor style={styles.modalTitle}>요청 상세 정보</TextWithColor>
              </View>
              
              <View style={styles.modalContent}>
                <View style={styles.detailHeader}>
                  <View style={styles.detailRow}>
                    <TextWithColor style={styles.detailLabel}>객실/고객명</TextWithColor>
                    <TextWithColor style={styles.detailValue}>{compTodo.roomNumber ? `${compTodo.roomNumber}호` : ''} / {compTodo.guestName}</TextWithColor>
                  </View>
                  
                  <View style={styles.detailRow}>
                    <TextWithColor style={styles.detailLabel}>등록/요청/탑승</TextWithColor>
                    <TextWithColor style={styles.detailValue}>
                      {compTodo.wingsCount || '0'} / {compTodo.peopleCount || '0'} / {compTodo.cartCount || '0'}
                    </TextWithColor>
                  </View>
                  
                  <View style={styles.detailRow}>
                    <TextWithColor style={styles.detailLabel}>요청내용</TextWithColor>
                    <TextWithColor style={[styles.detailValue, { color: contentColor, fontWeight: 'bold' }]}>
                      {compTodo.content}
                    </TextWithColor>
                  </View>
                  
                  <View style={styles.detailRow}>
                    <TextWithColor style={styles.detailLabel}>담당자/완료자</TextWithColor>
                    <TextWithColor style={styles.detailValue}>
                      {compTodo.handledBy || '미지정'} / {compTodo.completedBy || '미지정'}
                    </TextWithColor>
                  </View>
                </View>
                
                <View style={styles.detailDivider} />
                
                <View style={styles.detailTimeline}>
                  <View style={styles.timeRow}>
                    <TextWithColor style={styles.timeLabel}>요청 시간:</TextWithColor>
                    <TextWithColor style={styles.timeValue}>
                      {formatDate(compTodo.createdAt)}
                    </TextWithColor>
                  </View>
                  
                  <View style={styles.timeRow}>
                    <TextWithColor style={styles.timeLabel}>담당 시간:</TextWithColor>
                    <TextWithColor style={styles.timeValue}>
                      {compTodo.startTime ? formatDate(compTodo.startTime) : '기록 없음'}
                    </TextWithColor>
                  </View>
                  
                  <View style={styles.timeRow}>
                    <TextWithColor style={styles.timeLabel}>완료 시간:</TextWithColor>
                    <TextWithColor style={styles.timeValue}>
                      {compTodo.completedTime ? formatDate(compTodo.completedTime) : '기록 없음'}
                    </TextWithColor>
                  </View>
                </View>
              </View>
              
              <View style={styles.detailButtonContainer}>
                <TouchableOpacity 
                  style={styles.detailDeleteButton}
                  onPress={() => handleDeleteTodo(compTodo.id)}
                >
                  <TextWithColor style={styles.detailButtonText}>삭제</TextWithColor>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.detailRequestButton}
                  onPress={() => {
                    updateTodoStatus(compTodo.id, 'new');
                    setDetailModalVisible(false);
                  }}
                >
                  <TextWithColor style={styles.detailButtonText}>재요청</TextWithColor>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.detailCloseButton}
                  onPress={() => setDetailModalVisible(false)}
                >
                  <TextWithColor style={styles.detailCloseButtonText}>닫기</TextWithColor>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    );
  };

  // 탭 버튼 렌더링
  const renderTabButtons = () => (
    <View style={styles.tabContainer}>
      <TouchableOpacity
        style={[styles.tabButton, activeTab === 'new' && styles.activeTabButton]}
        onPress={() => setActiveTab('new')}
      >
        <ThemedText style={[styles.tabButtonText, activeTab === 'new' && styles.activeTabButtonText]}>
          요청
        </ThemedText>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.tabButton, activeTab === 'ing' && styles.activeTabButton]}
        onPress={() => setActiveTab('ing')}
      >
        <ThemedText style={[styles.tabButtonText, activeTab === 'ing' && styles.activeTabButtonText]}>
          진행중
        </ThemedText>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.tabButton, activeTab === 'comp' && styles.activeTabButton]}
        onPress={() => setActiveTab('comp')}
      >
        <ThemedText style={[styles.tabButtonText, activeTab === 'comp' && styles.activeTabButtonText]}>
          완료
        </ThemedText>
      </TouchableOpacity>
    </View>
  );

  if (isLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4B7F52" />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {renderTabButtons()}
      
      {renderProcessModal()}
      {renderGuestListModal()}
      {renderAdminAuthModal()}
      {renderDetailModal()}
      {renderDeleteConfirmModal()}
      
      {/* 직접 렌더링하는 요청 모달 */}
      {requestModalVisible && selectedGuest && (
        <KeyboardAvoidingView
          style={[styles.modalOverlay, {
            position: 'absolute',
            top: 0, 
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999
          }]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={[styles.modalContainer, { zIndex: 10000 }]}>
              <View style={styles.modalHeader}>
                <TextWithColor style={styles.modalTitle}>요청 확인</TextWithColor>
              </View>
              
              <View style={styles.modalContent}>
                <TextWithColor style={styles.requestModalText}>
                  {selectedGuest.guestName}님 요청을 선택해주세요.
                </TextWithColor>
                
                <TextWithColor style={styles.modalInputLabel}>
                  인원 수 (24개월 미만 제외)
                </TextWithColor>
                
                <TextInput
                  style={styles.modalInput}
                  placeholder="인원수 입력"
                  placeholderTextColor="#999"
                  keyboardType="number-pad"
                  value={requestPeopleCount}
                  onChangeText={setRequestPeopleCount}
                />
                
                <View style={styles.requestTypeContainer}>
                  <TouchableOpacity 
                    style={[
                      styles.requestTypeButton,
                      requestType === '체크인' && styles.requestTypeButtonActive
                    ]}
                    onPress={() => {
                      Keyboard.dismiss();
                      setRequestType('체크인');
                    }}
                  >
                    <TextWithColor 
                      style={[
                        styles.requestTypeText,
                        requestType === '체크인' && styles.requestTypeTextActive
                      ]}
                    >
                      체크인
                    </TextWithColor>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[
                      styles.requestTypeButton,
                      requestType === '픽업' && styles.requestTypeButtonActive
                    ]}
                    onPress={() => {
                      Keyboard.dismiss();
                      setRequestType('픽업');
                    }}
                  >
                    <TextWithColor 
                      style={[
                        styles.requestTypeText,
                        requestType === '픽업' && styles.requestTypeTextActive
                      ]}
                    >
                      픽업
                    </TextWithColor>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[
                      styles.requestTypeButton,
                      requestType === '픽업(밑으로)' && styles.requestTypeButtonActive
                    ]}
                    onPress={() => {
                      Keyboard.dismiss();
                      setRequestType('픽업(밑으로)');
                    }}
                  >
                    <TextWithColor 
                      style={[
                        styles.requestTypeText,
                        requestType === '픽업(밑으로)' && styles.requestTypeTextActive
                      ]}
                    >
                      픽업{'\n'}(밑으로)
                    </TextWithColor>
                  </TouchableOpacity>
                </View>
              </View>
              
              <View style={styles.modalButtonContainer}>
                <TouchableOpacity 
                  style={styles.modalCancelButton}
                  onPress={() => {
                    Keyboard.dismiss();
                    setRequestModalVisible(false);
                  }}
                >
                  <TextWithColor style={styles.modalCancelButtonText}>취소</TextWithColor>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.modalConfirmButton}
                  onPress={() => {
                    Keyboard.dismiss();
                    handleRequestSubmit();
                  }}
                >
                  <TextWithColor style={styles.modalButtonText}>확인</TextWithColor>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      )}
      
      <FlatList
        data={filteredTodos}
        renderItem={renderTodoItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        onEndReachedThreshold={0.1}
        scrollEventThrottle={16}
        initialNumToRender={20}
        maxToRenderPerBatch={10}
        windowSize={5}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <ThemedText style={styles.emptyText}>
              {activeTab === 'new' ? '새로운 요청이 없습니다.' : 
               activeTab === 'ing' ? '진행 중인 요청이 없습니다.' : 
               '완료된 요청이 없습니다.'}
            </ThemedText>
          </View>
        )}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    marginHorizontal: 5,
    borderRadius: 5,
    backgroundColor: '#f0f0f0',
  },
  activeTabButton: {
    backgroundColor: '#4B7F52',
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#555',
  },
  activeTabButtonText: {
    color: 'white',
  },
  listContainer: {
    padding: 10,
    paddingBottom: 80,
  },
  todoItem: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  todoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  todoInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  todoOrder: {
    fontWeight: 'bold',
    fontSize: 16,
    marginRight: 10,
    color: '#000',
  },
  actionButton: {
    backgroundColor: '#4B7F52',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 5,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonText: {
    color: 'white',
    fontWeight: '500',
  },
  todoBody: {
    gap: 8,
  },
  todoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  todoLabel: {
    width: 50,
    fontSize: 14,
    fontWeight: '500',
    color: '#555',
  },
  ingTodoLabel: {
    width: 100,
    fontSize: 14,
    fontWeight: '500',
    color: '#555',
  },
  todoValue: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  todoContent: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
    flex: 1,
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
  },
  
  // 모달 스타일
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    width: '90%',
    maxWidth: 400,
    padding: 0,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalHeader: {
    backgroundColor: '#4B7F52',
    padding: 15,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  modalContent: {
    padding: 20,
  },
  modalRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  modalLabel: {
    width: 80,
    fontSize: 14,
    fontWeight: '500',
    color: '#555',
  },
  modalValue: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  modalInputSection: {
    padding: 20,
    paddingTop: 0,
  },
  modalInputLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  modalButtonContainer: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  modalCancelButton: {
    flex: 1,
    padding: 15,
    alignItems: 'center',
    borderRightWidth: 0.5,
    borderRightColor: '#eee',
  },
  modalConfirmButton: {
    flex: 1,
    padding: 15,
    alignItems: 'center',
    backgroundColor: '#4B7F52',
    borderBottomRightRadius: 10,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: 'white',
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  disabledActionButton: {
    backgroundColor: '#ccc',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 5,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  guestListModalContainer: {
    width: '90%',
    maxWidth: 500,
    height: '70%',
    maxHeight: 600,
    padding: 0,
  },
  guestListLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  guestListLoadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#555',
  },
  guestListScrollView: {
    padding: 10,
  },
  guestListHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  guestListHeaderCell: {
    flex: 1,
    fontWeight: 'bold',
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
  },
  guestListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  guestListCell: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
  },
  guestStatusButton: {
    padding: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#4B7F52',
    borderRadius: 5,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
    height: 36,
  },
  guestStatusRR: {
    backgroundColor: '#888',
  },
  guestStatusCI: {
    backgroundColor: '#4B7F52',
  },
  guestStatusCO: {
    backgroundColor: '#e53935',
  },
  guestStatusText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
    lineHeight: 20,
  },
  guestListEmptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  guestListEmptyText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
  },
  guestListCloseButton: {
    padding: 15,
    alignItems: 'center',
    backgroundColor: '#4B7F52',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  guestListCloseButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: 'white',
  },
  requestModalText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  requestTypeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  requestTypeButton: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: '#4B7F52',
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 5,
    minHeight: 60,
  },
  requestTypeButtonActive: {
    backgroundColor: '#4B7F52',
  },
  requestTypeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4B7F52',
    textAlign: 'center',
  },
  requestTypeTextActive: {
    color: 'white',
  },
  authModalText: {
    marginBottom: 20,
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
  },
  deleteAuthModalText: {
    marginBottom: 20,
    fontSize: 14,
    color: '#e53935',
    textAlign: 'center',
    fontWeight: '500',
  },
  authErrorText: {
    fontSize: 14,
    color: '#e53935',
    marginBottom: 10,
  },
  adminBadge: {
    padding: 5,
    backgroundColor: '#4B7F52',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#3a6241',
  },
  adminBadgeText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  // 상세 모달 스타일
  detailHeader: {
    marginBottom: 15,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  detailCol: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 3,
    width: 100,  // 라벨 너비 고정
  },
  detailValue: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  detailDivider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 15,
  },
  detailTimeline: {
    marginTop: 5,
  },
  timeRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  timeLabel: {
    width: 90,
    fontSize: 14,
    color: '#555',
  },
  timeValue: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  detailButtonContainer: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  detailDeleteButton: {
    flex: 1,
    padding: 15,
    alignItems: 'center',
    backgroundColor: '#e53935',
  },
  detailRequestButton: {
    flex: 1,
    padding: 15,
    alignItems: 'center',
    backgroundColor: '#4B7F52',
  },
  detailCloseButton: {
    flex: 1,
    padding: 15,
    alignItems: 'center',
  },
  detailButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: 'white',
  },
  detailCloseButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  deleteConfirmText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
    textAlign: 'center',
  },
  deleteWarningText: {
    fontSize: 14,
    color: '#e53935',
    textAlign: 'center',
  },
}); 