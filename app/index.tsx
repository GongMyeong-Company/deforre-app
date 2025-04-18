import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { auth } from '@/config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, StyleSheet, View, Text } from 'react-native';
import { onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth';

// 초기 화면 - 리디렉션 처리
export default function Index() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3;

  useEffect(() => {
    // 인증 상태 변경 감지 
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('Firebase 인증 상태 변경:', user ? '로그인됨' : '로그인되지 않음');
      
      if (user) {
        // 이미 로그인된 상태
        console.log('Firebase 인증으로 확인된 사용자:', user.email);
        
        // 인증 상태 저장
        await AsyncStorage.setItem('user_auth_state', JSON.stringify({
          uid: user.uid,
          email: user.email,
          isLoggedIn: true
        }));
        
        setIsAuthenticated(true);
        setIsLoading(false);
      } else {
        // Firebase에 로그인되지 않은 상태 - AsyncStorage에서 확인
        try {
          const savedAuthState = await AsyncStorage.getItem('user_auth_state');
          if (savedAuthState) {
            const authState = JSON.parse(savedAuthState);
            if (authState.isLoggedIn) {
              // 저장된 인증 정보가 있으면 자동 로그인 시도
              checkStoredCredentials();
            } else {
              setIsAuthenticated(false);
              setIsLoading(false);
            }
          } else {
            setIsAuthenticated(false);
            setIsLoading(false);
          }
        } catch (error) {
          console.error('저장된 인증 상태 확인 중 오류:', error);
          setIsAuthenticated(false);
          setIsLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // AsyncStorage에서 저장된 로그인 정보로 로그인 시도
  const checkStoredCredentials = async () => {
    try {
      console.log('저장된 로그인 정보 확인 시작');
      
      // 저장된 로그인 정보 확인
      const email = await AsyncStorage.getItem('user_email');
      const storedPassword = await AsyncStorage.getItem('user_password');
      const isLoggedIn = await AsyncStorage.getItem('user_is_logged_in');

      if (email && storedPassword && isLoggedIn === 'true') {
        console.log('저장된 로그인 정보 발견:', email);
        
        try {
          // 로그인 시도
          await signInWithEmailAndPassword(auth, email, storedPassword);
          console.log('자동 로그인 성공!');
          setIsAuthenticated(true);
        } catch (loginError: any) {
          console.error('자동 로그인 실패:', loginError.code, loginError.message);
          
          // 에러 코드에 따른 처리
          if (loginError.code === 'auth/network-request-failed') {
            // 네트워크 오류는 재시도
            if (retryCount < MAX_RETRIES) {
              console.log(`자동 로그인 재시도 중... (${retryCount + 1}/${MAX_RETRIES})`);
              setRetryCount(prev => prev + 1);
              
              // 1초 후 재시도
              setTimeout(() => {
                checkStoredCredentials();
              }, 1000);
              return; // 함수 종료하여 로딩 상태 유지
            }
          }
          
          // 인증 정보 오류는 로그인 페이지로 이동
          setIsAuthenticated(false);
          setIsLoading(false);
        }
      } else {
        console.log('저장된 로그인 정보가 없거나 불완전합니다');
        setIsAuthenticated(false);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('로그인 정보 확인 중 오류:', error);
      setIsAuthenticated(false);
      setIsLoading(false);
    }
  };

  // 로딩 중이면 로딩 화면 표시
  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4B7F52" />
        <Text style={styles.loadingText}>로그인 상태 확인 중...</Text>
        {retryCount > 0 && (
          <Text style={styles.retryText}>재시도 중... ({retryCount}/{MAX_RETRIES})</Text>
        )}
      </View>
    );
  }

  // 인증 상태에 따라 리디렉션
  return isAuthenticated ? (
    <Redirect href="/(tabs)/room" />
  ) : (
    <Redirect href="/login" />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 16,
    color: '#555',
    fontSize: 14,
  },
  retryText: {
    marginTop: 8,
    color: '#999',
    fontSize: 12,
  }
}); 