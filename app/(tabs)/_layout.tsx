import { Tabs } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { Platform, TouchableOpacity, Text, ViewStyle, TextStyle, Dimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { StatusBar } from 'expo-status-bar';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';

// 메인 색상 정의
const MAIN_COLOR = '#4B7F52';

// global 타입 확장
declare global {
  var handleGuestListButtonClick: (() => void) | undefined;
  var handleAdminAuthButtonClick: (() => void) | undefined;
  var isAdminAuthenticated: boolean | undefined;
  var createChatRoomModal: ((visible: boolean) => void) | undefined;
  var goBackToRoomList: (() => void) | undefined;
  var isInChatRoom: boolean | undefined;
  var selectedRoomName: string | undefined;
  var handleRoomAuthButtonClick: (() => void) | undefined;
  var setTabBarVisible: ((visible: boolean) => void) | undefined;
}

// 라우트 파라미터 타입 정의
type RoomScreenParams = {
  isAdmin?: boolean;
  openAuthModal?: () => void;
};

export default function TabLayout() {
  const windowWidth = Dimensions.get('window').width;
  const colorScheme = useColorScheme();
  const [isTabBarVisible, setIsTabBarVisible] = useState(true);

  useEffect(() => {
    // 전역에서 탭바 가시성을 제어할 수 있도록 함수 등록
    global.setTabBarVisible = (visible: boolean) => {
      console.log(`TabLayout: 탭바 표시 상태 변경 ${isTabBarVisible} -> ${visible}`);
      setIsTabBarVisible(visible);
    };

    return () => {
      global.setTabBarVisible = undefined;
    };
  }, []);

  return (
    <View style={{ flex: 1 }}>
      {/* 상태 표시줄 설정 - 어두운 내용과 함께 밝은 배경으로 설정 */}
      <StatusBar style="dark" backgroundColor="#FFFFFF" />
      
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: MAIN_COLOR,
          tabBarInactiveTintColor: 'gray',
          headerTitleAlign: 'center',
          headerShown: true,
          tabBarButton: HapticTab,
          tabBarBackground: TabBarBackground,
          headerStyle: {
            height: 100, // 헤더 높이를 기본보다 크게 설정
          },
          headerTitleContainerStyle: {
            paddingBottom: 15, // 타이틀을 아래쪽으로 이동
            alignItems: 'center', // 타이틀 세로 중앙 정렬
          },
          headerRightContainerStyle: {
            paddingBottom: 15, // 우측 버튼도 아래쪽으로 이동
            alignItems: 'center', // 버튼 세로 중앙 정렬
          },
          tabBarStyle: {
            display: isTabBarVisible ? 'flex' : 'none',
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            elevation: 0,
            backgroundColor: colorScheme === 'dark' ? '#000' : '#fff',
            borderTopColor: colorScheme === 'dark' ? '#333' : '#ddd',
            height: 65,
            paddingBottom: 10,
            zIndex: 999,
          },
          tabBarItemStyle: {
            paddingTop: 3,
            paddingBottom: 3,
          },
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '500',
            marginTop: 0,
          },
          tabBarIconStyle: {
            marginBottom: 0,
          },
        }}>
        <Tabs.Screen
          name="room"
          options={({ route }) => {
            // 타입 캐스팅을 사용하여 TypeScript 오류 해결
            const params = route.params as RoomScreenParams || {};
            return {
              title: '객실상황',
              headerTitleAlign: 'center',
              tabBarIcon: ({ color, size, focused }) => (
                <View style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <IconSymbol size={focused ? 28 : 24} name="bed.double.fill" color={color} />
                </View>
              ),
              headerRight: () => {
                // params에서 값 추출
                const isAdmin = params?.isAdmin || false;
                const openAuthModal = params?.openAuthModal;
                
                return (
                  <TouchableOpacity
                    style={{ marginRight: 16 }}
                    onPress={() => {
                      // 모달 열기 함수가 있으면 호출
                      if (typeof global.handleRoomAuthButtonClick === 'function') {
                        global.handleRoomAuthButtonClick();
                      } else {
                        console.log('인증 버튼 핸들러가 등록되지 않았습니다.');
                      }
                    }}
                  >
                    <Ionicons name="key-outline" size={24} color={isAdmin ? "#4B7F52" : "#555"} />
                  </TouchableOpacity>
                );
              },
            };
          }}
        />
        <Tabs.Screen
          name="pickup"
          options={({ route }) => {
            // 픽업 화면의 현재 활성 탭을 가져옵니다
            const params = route.params as { activeTab?: 'new' | 'ing' | 'comp' } || {};
            const activeTab = params?.activeTab || 'new';
            
            return {
              title: '픽업요청',
              headerTitleAlign: 'center',
              tabBarIcon: ({ color, size, focused }) => (
                <View style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <IconSymbol size={focused ? 28 : 24} name="car.fill" color={color} />
                </View>
              ),
              headerRight: () => {
                // 각 탭에 따라 다른 버튼을 표시합니다
                let buttonText = '명단';
                let onPress = () => {
                  // 명단 버튼 클릭 시 전역 함수 호출
                  if (typeof global.handleGuestListButtonClick === 'function') {
                    global.handleGuestListButtonClick();
                  } else {
                    console.log('명단 버튼 클릭 - 핸들러 미등록');
                  }
                };
                
                // 버튼 스타일 기본값
                let buttonStyle: ViewStyle = {
                  marginRight: 16,
                  backgroundColor: 'white',
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 5,
                  borderWidth: 1,
                  borderColor: '#4B7F52',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 60,
                  height: 32,
                };
                
                // 텍스트 스타일 기본값
                let textStyle: TextStyle = { 
                  color: '#4B7F52', 
                  fontSize: 14, 
                  fontWeight: 'bold' as 'bold'
                };
                
                if (activeTab === 'ing') {
                  buttonText = '인증';
                  
                  // 관리자 인증 상태인지 확인
                  // @ts-ignore
                  const isAdmin = global.isAdminAuthenticated || false;
                  
                  if (isAdmin) {
                    // 관리자 모드일 때 버튼 스타일 변경
                    buttonText = '관리자모드';
                    buttonStyle = {
                      ...buttonStyle,
                      backgroundColor: '#4B7F52',
                      borderColor: '#4B7F52',
                    };
                    
                    // 텍스트 색상 흰색으로 변경
                    textStyle = {
                      ...textStyle,
                      color: 'white',
                    };
                  }
                  
                  onPress = () => {
                    // 인증 버튼 클릭 시 전역 함수 호출
                    if (typeof global.handleAdminAuthButtonClick === 'function') {
                      global.handleAdminAuthButtonClick();
                    } else {
                      console.log('인증 버튼 클릭 - 핸들러 미등록');
                    }
                  };
                } else if (activeTab === 'comp') {
                  buttonText = '전체삭제';
                  // 빨간색으로 버튼 스타일 변경
                  buttonStyle = {
                    ...buttonStyle,
                    borderColor: '#e53935',
                  };
                  
                  // 빨간색으로 텍스트 스타일 변경
                  textStyle = {
                    ...textStyle,
                    color: '#e53935',
                  };
                  
                  onPress = () => {
                    // @ts-ignore
                    if (global.handleAdminAuthButtonClick) {
                      // @ts-ignore
                      global.handleAdminAuthButtonClick();
                    } else {
                      console.log('전체삭제 핸들러가 등록되지 않았습니다.');
                    }
                  };
                }
                
                return (
                  <TouchableOpacity
                    style={buttonStyle}
                    onPress={onPress}
                  >
                    <Text style={textStyle}>
                      {buttonText}
                    </Text>
                  </TouchableOpacity>
                );
              },
            };
          }}
        />
        <Tabs.Screen
          name="chat"
          options={{
            title: '채팅',
            headerTitleAlign: 'center',
            headerTitle: global.isInChatRoom ? global.selectedRoomName : '채팅',
            tabBarLabel: '채팅',
            headerLeft: () => {
              if (global.isInChatRoom && typeof global.goBackToRoomList === 'function') {
                return (
                  <TouchableOpacity
                    style={{
                      width: 44,
                      height: 44,
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginLeft: 8,
                      paddingBottom: 8,
                      marginTop: -4,
                    }}
                    onPress={() => {
                      if (typeof global.goBackToRoomList === 'function') {
                        global.goBackToRoomList();
                      }
                    }}
                  >
                    <Ionicons name="chevron-back" size={24} color="#2E8B57" />
                  </TouchableOpacity>
                );
              }
              return null;  
            },
            headerRight: () => {
              if (!global.isInChatRoom) {
                return (
                  <TouchableOpacity
                    style={{
                      width: 44,
                      height: 44,
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginRight: 8,
                    }}
                    onPress={() => {
                      console.log('새 채팅방 버튼 클릭됨');
                      if (typeof global.createChatRoomModal === 'function') {
                        global.createChatRoomModal(true);
                      }
                    }}
                  >
                    <Ionicons name="add-circle" size={26} color="#2E8B57" />
                  </TouchableOpacity>
                );
              }
              return null;
            },
            tabBarIcon: ({ color, size, focused }) => (
              <View style={{
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <IconSymbol size={focused ? 28 : 24} name="message.fill" color={color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="notifications"
          options={{
            title: '알림',
            headerTitleAlign: 'center',
            tabBarIcon: ({ color, size, focused }) => (
              <View style={{
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Ionicons name={focused ? "notifications" : "notifications-outline"} size={focused ? 28 : 24} color={color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="my"
          options={{
            title: '프로필',
            headerTitleAlign: 'center',
            tabBarIcon: ({ color, size, focused }) => (
              <View style={{
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <IconSymbol size={focused ? 28 : 24} name="person.fill" color={color} />
              </View>
            ),
          }}
        />
      </Tabs>
    </View>
  );
}
