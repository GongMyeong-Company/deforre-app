import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { TextWithColor } from '@/components/ThemedText';
import { collection, query, where, orderBy, limit, onSnapshot, doc, updateDoc, deleteDoc, getDocs, Timestamp } from 'firebase/firestore';
import { db, auth } from '@/config/firebase';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

// 알림 아이템 타입 정의
type NotificationItem = {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: any;
  data?: any;
  userId: string;
};

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  // 알림 데이터 로드
  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser || !currentUser.email) {
          console.log('로그인된 사용자가 없습니다.');
          setIsLoading(false);
          setRefreshing(false);
          return;
        }

        console.log('현재 로그인된 사용자:', currentUser.email, currentUser.uid);

        // 먼저 UID로 조회 시도
        const uidQuery = query(
          collection(db, 'notifications'),
          where('userId', '==', currentUser.uid),
          orderBy('createdAt', 'desc'),
          limit(50)
        );

        const uidSnapshot = await getDocs(uidQuery);
        console.log(`UID로 검색된 알림: ${uidSnapshot.docs.length}개`);

        // UID로 알림이 찾아지면 해당 알림 사용
        if (!uidSnapshot.empty) {
          console.log('UID로 알림을 찾았습니다.');
          const unsubscribe = onSnapshot(uidQuery, (querySnapshot) => {
            const notificationItems: NotificationItem[] = [];
            querySnapshot.forEach((doc) => {
              const data = doc.data();
              
              // 알림 항목 기본 데이터
              const notificationItem: NotificationItem = {
                id: doc.id,
                ...data as Omit<NotificationItem, 'id'>
              };
              
              // 픽업 요청 알림인 경우 body 수정 (객실 호수가 있을 때만 "호" 붙임)
              if (data.data?.type === 'pickup_request') {
                const roomNumber = data.data.roomNumber;
                const guestName = data.data.guestName;
                const requestType = data.data.requestType;
                
                if (roomNumber && guestName && requestType) {
                  const roomNumberText = roomNumber ? `${roomNumber}호 ` : '';
                  notificationItem.body = `${roomNumberText}${guestName} ${requestType}`;
                }
              }
              
              notificationItems.push(notificationItem);
            });
            
            console.log(`${notificationItems.length}개의 알림을 가져왔습니다.`);
            setNotifications(notificationItems);
            if (!refreshing) {
              setIsLoading(false);
            }
            setRefreshing(false);
          }, (error) => {
            console.error('알림 가져오기 오류:', error);
            setIsLoading(false);
            setRefreshing(false);
          });

          return () => unsubscribe();
        }

        // UID로 찾지 못했다면 사용자 문서 ID로 검색
        console.log('UID로 알림을 찾지 못했습니다. 사용자 문서 ID로 검색합니다.');
        // 사용자 문서 ID 찾기 (email로 검색)
        const usersRef = collection(db, 'users');
        const userQuery = query(usersRef, where('email', '==', currentUser.email));
        const userSnapshot = await getDocs(userQuery);
        
        if (userSnapshot.empty) {
          console.log(`사용자 문서를 찾을 수 없습니다: ${currentUser.email}`);
          setIsLoading(false);
          setRefreshing(false);
          return;
        }
        
        const userDoc = userSnapshot.docs[0];
        const userId = userDoc.id;
        console.log(`사용자 문서 ID: ${userId}`);

        // 사용자 문서 ID로 알림 검색
        const docIdQuery = query(
          collection(db, 'notifications'),
          where('userId', '==', userId),
          orderBy('createdAt', 'desc'),
          limit(50)
        );

        const unsubscribe = onSnapshot(docIdQuery, (querySnapshot) => {
          const notificationItems: NotificationItem[] = [];
          querySnapshot.forEach((doc) => {
            const data = doc.data();
            
            // 알림 항목 기본 데이터
            const notificationItem: NotificationItem = {
              id: doc.id,
              ...data as Omit<NotificationItem, 'id'>
            };
            
            // 픽업 요청 알림인 경우 body 수정 (객실 호수가 있을 때만 "호" 붙임)
            if (data.data?.type === 'pickup_request') {
              const roomNumber = data.data.roomNumber;
              const guestName = data.data.guestName;
              const requestType = data.data.requestType;
              
              if (roomNumber && guestName && requestType) {
                const roomNumberText = roomNumber ? `${roomNumber}호 ` : '';
                notificationItem.body = `${roomNumberText}${guestName} ${requestType}`;
              }
            }
            
            notificationItems.push(notificationItem);
          });
          
          console.log(`문서 ID로 ${notificationItems.length}개의 알림을 가져왔습니다.`);
          setNotifications(notificationItems);
          if (!refreshing) {
            setIsLoading(false);
          }
          setRefreshing(false);
        }, (error) => {
          console.error('알림 가져오기 오류:', error);
          setIsLoading(false);
          setRefreshing(false);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error('알림 로드 중 오류 발생:', error);
        setIsLoading(false);
        setRefreshing(false);
      }
    };

    if (isLoading || refreshing) {
      loadNotifications();
    }
  }, [isLoading, refreshing]);

  // 알림 읽음 표시
  const markAsRead = async (notificationId: string) => {
    try {
      const notificationRef = doc(db, 'notifications', notificationId);
      await updateDoc(notificationRef, {
        read: true
      });
    } catch (error) {
      console.error('알림 읽음 표시 오류:', error);
    }
  };

  // 알림 클릭 처리
  const handleNotificationPress = async (notification: NotificationItem) => {
    // 읽음 표시
    if (!notification.read) {
      await markAsRead(notification.id);
    }

    // 알림 데이터에 따른 화면 이동
    if (notification.data?.type === 'pickup_request') {
      router.push('/(tabs)/pickup');
    } else if (notification.data?.type === 'chat_message') {
      router.push('/(tabs)/chat');
    } else if (notification.data?.roomNumber) {
      // 객실 상세 화면으로 이동
      router.push(`/(tabs)/room?roomNumber=${notification.data.roomNumber}`);
    }
  };

  // 모든 알림 읽음 표시
  const markAllAsRead = async () => {
    if (notifications.length === 0) {
      Alert.alert('알림 없음', '읽을 알림이 없습니다.');
      return;
    }
    
    try {
      const updatePromises = notifications
        .filter(notification => !notification.read)
        .map(notification => 
          updateDoc(doc(db, 'notifications', notification.id), { read: true })
        );

      if (updatePromises.length === 0) {
        Alert.alert('알림', '모든 알림이 이미 읽음 상태입니다.');
        return;
      }

      await Promise.all(updatePromises);
      Alert.alert('성공', '모든 알림을 읽음 처리했습니다.');
    } catch (error) {
      console.error('전체 읽음 표시 오류:', error);
      Alert.alert('오류', '알림 읽음 처리 중 문제가 발생했습니다.');
    }
  };

  // 모든 알림 삭제
  const deleteAllNotifications = async () => {
    if (notifications.length === 0) {
      Alert.alert('알림 없음', '삭제할 알림이 없습니다.');
      return;
    }
    
    // 확인 대화상자 표시
    Alert.alert(
      '모든 알림 삭제',
      '정말 모든 알림을 삭제하시겠습니까?',
      [
        {
          text: '취소',
          style: 'cancel'
        },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              
              // 모든 알림 삭제
              const deletePromises = notifications.map(notification => 
                deleteDoc(doc(db, 'notifications', notification.id))
              );
              
              await Promise.all(deletePromises);
              
              setNotifications([]); // 로컬 상태 비우기
              setIsLoading(false);
              Alert.alert('성공', '모든 알림이 삭제되었습니다.');
            } catch (error) {
              console.error('전체 알림 삭제 오류:', error);
              setIsLoading(false);
              Alert.alert('오류', '알림 삭제 중 문제가 발생했습니다.');
            }
          }
        }
      ]
    );
  };

  // 알림 삭제
  const deleteNotification = async (notificationId: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', notificationId));
    } catch (error) {
      console.error('알림 삭제 오류:', error);
      Alert.alert('오류', '알림 삭제 중 문제가 발생했습니다.');
    }
  };

  // 새로고침 처리
  const onRefresh = () => {
    setRefreshing(true);
  };

  // 날짜 포맷팅 함수
  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMinutes < 60) {
      return `${diffMinutes}분 전`;
    } else if (diffHours < 24) {
      return `${diffHours}시간 전`;
    } else if (diffDays < 7) {
      return `${diffDays}일 전`;
    } else {
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const day = date.getDate();
      return `${year}.${month}.${day}`;
    }
  };

  // 알림 아이템 렌더링
  const renderNotificationItem = ({ item }: { item: NotificationItem }) => (
    <TouchableOpacity 
      style={[
        styles.notificationItem, 
        item.read ? styles.readNotification : styles.unreadNotification
      ]}
      onPress={() => handleNotificationPress(item)}
    >
      <View style={styles.notificationContent}>
        <View style={styles.notificationHeader}>
          <TextWithColor style={styles.notificationTitle}>{item.title}</TextWithColor>
          <TextWithColor style={styles.notificationTime}>{formatDate(item.createdAt)}</TextWithColor>
        </View>
        <TextWithColor style={styles.notificationBody}>{item.body}</TextWithColor>
      </View>
    </TouchableOpacity>
  );

  // 빈 상태 표시
  const renderEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <TextWithColor style={styles.emptyText}>알림이 없습니다.</TextWithColor>
    </View>
  );

  // 로딩 상태 표시
  if (isLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4B7F52" />
        <TextWithColor>알림을 불러오는 중...</TextWithColor>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <TextWithColor style={styles.headerTitle}>알림</TextWithColor>
        <TouchableOpacity 
          style={styles.readAllButton}
          onPress={deleteAllNotifications}
        >
          <TextWithColor style={styles.readAllButtonText}>모두 삭제</TextWithColor>
        </TouchableOpacity>
      </View>
      
      <FlatList
        data={notifications}
        renderItem={renderNotificationItem}
        keyExtractor={item => item.id}
        ListEmptyComponent={renderEmptyComponent}
        contentContainerStyle={notifications.length === 0 ? { flex: 1 } : null}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#4B7F52']}
          />
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  readAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#FF3B30',
  },
  readAllButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  notificationItem: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  unreadNotification: {
    backgroundColor: 'rgba(75, 127, 82, 0.1)',
    borderLeftWidth: 3,
    borderLeftColor: '#4B7F52',
  },
  readNotification: {
    opacity: 0.8,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  notificationTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    flex: 1,
  },
  notificationTime: {
    fontSize: 12,
    color: '#888',
    marginLeft: 8,
  },
  notificationBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
}); 