import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, useRef } from 'react';
import 'react-native-reanimated';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, where, getDocs, onSnapshot, orderBy, limit, QuerySnapshot, DocumentChange, DocumentData } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db } from '../config/firebase';
import { useColorScheme } from '@/hooks/useColorScheme';
import * as Notifications from 'expo-notifications';
import { registerForPushNotificationsAsync, saveUserPushToken, sendLocalNotification } from '@/utils/notificationHelper';
import { Platform } from 'react-native';
import { router as expoRouter } from 'expo-router';
import { Slot } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// 글로벌 인증 컨텍스트
let currentUser: User | null = null;

// 보호된 경로 체크 함수
function useProtectedRoute(user: User | null) {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!segments.length) return;

    const isAuthGroup = segments[0] === '(auth)';

    if (!user && !isAuthGroup) {
      router.replace('/login');
    } else if (user && isAuthGroup) {
      router.replace('/chat');
    }
  }, [user, segments]);
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const colorScheme = useColorScheme();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTabBarVisible, setIsTabBarVisible] = useState(true);

  useProtectedRoute(user);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // 푸시 알림 관련 코드
  useEffect(() => {
    if (!user) return;

    const setupNotifications = async () => {
      try {
        console.log('알림 권한 검사 시작');
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        console.log('현재 알림 권한 상태:', existingStatus);
        
        if (existingStatus !== 'granted') {
          console.log('알림 권한 요청 팝업 표시...');
          const { status } = await Notifications.requestPermissionsAsync();
          console.log('알림 권한 요청 결과:', status);
          
          if (status === 'granted') {
            console.log('알림 권한 허용됨, 토큰 등록 진행');
            await registerForPushNotificationsAsync();
          } else {
            console.log('알림 권한 거부됨');
          }
        } else {
          console.log('이미 알림 권한 있음, 토큰 등록 진행');
          await registerForPushNotificationsAsync();
        }
      } catch (error) {
        console.error('알림 설정 중 오류:', error);
      }
    };

    setupNotifications();
  }, [user]);

  // 전역에서 탭바 가시성을 제어할 수 있도록 함수 등록
  useEffect(() => {
    global.setTabBarVisible = (visible: boolean) => {
      setIsTabBarVisible(visible);
    };

    return () => {
      global.setTabBarVisible = undefined;
    };
  }, []);

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  // 앱 로딩이 완료되면 스플래시 스크린 숨기기
  useEffect(() => {
    if (loaded && !loading) {
      SplashScreen.hideAsync();
    }
  }, [loaded, loading]);

  if (!loaded || loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2E8B57" />
      </View>
    );
  }

  return (
    <ThemeProvider value={DefaultTheme}>
      <Stack screenOptions={{
        headerStyle: {
          backgroundColor: DefaultTheme.colors.background,
        },
        headerShadowVisible: false,
        headerTitleAlign: 'center',
      }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ 
          headerShown: false,
          animation: 'none',
        }} />
        <Stack.Screen name="login" options={{ 
          title: '로그인',
          headerShown: false,
          animation: 'none',
        }} />
        <Stack.Screen name="register" options={{ 
          title: '회원가입',
          headerShown: false,
          animation: 'none',
        }} />
        <Stack.Screen name="index" redirect={true} />
        <Stack.Screen name="+not-found" options={{ title: '페이지를 찾을 수 없습니다' }} />
      </Stack>
    </ThemeProvider>
  );
}
