import React, { useState, useEffect } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, Alert, View, KeyboardAvoidingView, Platform, ActivityIndicator, Image, Modal } from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { router } from 'expo-router';
import { validateAdminPassword } from '@/config/admin-auth';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '@/config/firebase';
import Checkbox from 'expo-checkbox';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [rememberLogin, setRememberLogin] = useState(false);

  // 저장된 로그인 정보 불러오기
  useEffect(() => {
    const loadSavedLoginInfo = async () => {
      try {
        const savedEmail = await AsyncStorage.getItem('user_email');
        const savedRemember = await AsyncStorage.getItem('remember_login');
        const savedPassword = await AsyncStorage.getItem('user_password');
        
        if (savedRemember === 'true') {
          setRememberLogin(true);
          
          if (savedEmail) {
            setEmail(savedEmail);
          }
          
          if (savedPassword) {
            setPassword(savedPassword);
          }
        } else if (savedEmail) {
          // 이전 버전 호환성 유지
          setEmail(savedEmail);
        }
      } catch (error) {
        console.error('저장된 로그인 정보 불러오기 실패:', error);
      }
    };
    
    loadSavedLoginInfo();
  }, []);

  // 로그인 기능
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('오류', '이메일과 비밀번호를 모두 입력해주세요.');
      return;
    }

    setIsLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // 로그인 정보 저장 설정에 따라 처리
      if (rememberLogin) {
        await AsyncStorage.setItem('user_email', email);
        await AsyncStorage.setItem('user_password', password);
        await AsyncStorage.setItem('remember_login', 'true');
      } else {
        // 저장 안함 설정이면 비밀번호만 제거하고 이메일은 편의상 남김
        await AsyncStorage.setItem('user_email', email);
        await AsyncStorage.removeItem('user_password');
        await AsyncStorage.setItem('remember_login', 'false');
      }
      
      // 기본 로그인 정보 저장
      try {
        await AsyncStorage.setItem('user_uid', user.uid);
        await AsyncStorage.setItem('user_last_login', new Date().toISOString());
        await AsyncStorage.setItem('user_is_logged_in', 'true');
        
        console.log('로그인 정보가 안전하게 저장되었습니다');
      } catch (storageError) {
        console.error('로그인 정보 저장 실패:', storageError);
        // 저장 실패해도 로그인은 진행
      }
      
      console.log('로그인 성공:', user.email);
      // 로그인 성공 후 탭 구조의 객실 페이지로 이동
      router.replace('/(tabs)/room');
      
    } catch (error: any) {
      console.error('로그인 오류:', error.code, error.message);
      let errorMessage = '로그인에 실패했습니다.';
      if (error.code === 'auth/invalid-credential') {
        errorMessage = '이메일 또는 비밀번호가 올바르지 않습니다.';
      } else if (error.code === 'auth/user-not-found') {
        errorMessage = '해당 사용자를 찾을 수 없습니다.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = '비밀번호가 올바르지 않습니다.';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = '네트워크 연결을 확인해주세요.';
      }
      Alert.alert('오류', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // 회원가입 모달 표시
  const showSignupModal = () => {
    setModalVisible(true);
    setAdminPassword('');
  };

  // 관리자 비밀번호 확인 및 회원가입 페이지로 이동
  const handleAdminAuth = () => {
    if (validateAdminPassword(adminPassword)) {
      setModalVisible(false);
      router.push('/register');
    } else {
      Alert.alert('오류', '관리자 비밀번호가 올바르지 않습니다.');
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* 상태 표시줄 설정 - 어두운 내용과 함께 밝은 배경으로 설정 */}
      <StatusBar style="dark" backgroundColor="#FFFFFF" />
      
      <ThemedView style={styles.content}>
        {/* 로고 */}
        <View style={styles.logoContainer}>
          <Image 
            source={require('@/assets/logo.png')} 
            style={styles.logo}
            resizeMode="contain" 
          />
        </View>

        {/* 입력 폼 */}
        <View style={styles.formContainer}>
          <View style={styles.inputWrapper}>
            <ThemedText style={styles.inputLabel}>이메일</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="staff@hoteldeforet.com"
              placeholderTextColor="#888888"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!isLoading}
            />
          </View>
          
          <View style={styles.inputWrapper}>
            <ThemedText style={styles.inputLabel}>비밀번호</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="비밀번호 입력"
              placeholderTextColor="#888888"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!isLoading}
            />
          </View>

          {/* 로그인 정보 저장 체크박스 */}
          <View style={styles.checkboxContainer}>
            <Checkbox
              value={rememberLogin}
              onValueChange={setRememberLogin}
              color={rememberLogin ? '#4B7F52' : undefined}
              style={styles.checkbox}
            />
            <TouchableOpacity onPress={() => setRememberLogin(!rememberLogin)}>
              <ThemedText style={styles.checkboxLabel}>로그인 정보 저장</ThemedText>
            </TouchableOpacity>
          </View>
          
          {/* 버튼 */}
          <TouchableOpacity 
            style={styles.loginButton} 
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <ThemedText style={styles.buttonText}>로그인</ThemedText>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.signupButton, styles.disabledButton]}
            onPress={showSignupModal}
          >
            <ThemedText style={styles.buttonText}>회원가입</ThemedText>
          </TouchableOpacity>
          
          <ThemedText style={styles.signupInfoText}>
            회원가입은 관리자에게 문의하세요.
          </ThemedText>
        </View>
        
        <View style={styles.footer}>
          <ThemedText style={styles.footerText}>
            © 2023 호텔 드 포레. All rights reserved.
          </ThemedText>
        </View>
      </ThemedView>

      {/* 관리자 비밀번호 모달 */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ThemedText style={styles.modalTitle}>관리자 인증</ThemedText>
            <ThemedText style={styles.modalDescription}>회원가입을 위해 관리자 비밀번호를 입력하세요.</ThemedText>
            
            <TextInput
              style={styles.input}
              placeholder="관리자 비밀번호"
              placeholderTextColor="#888888"
              value={adminPassword}
              onChangeText={setAdminPassword}
              secureTextEntry
              autoCapitalize="none"
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalCancelButton}
                onPress={() => setModalVisible(false)}
              >
                <ThemedText style={styles.buttonText}>취소</ThemedText>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.modalConfirmButton}
                onPress={handleAdminAuth}
              >
                <ThemedText style={styles.buttonText}>확인</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 200,
    height: 100,
    marginBottom: 10,
  },
  formContainer: {
    width: '100%',
  },
  inputWrapper: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    marginBottom: 6,
    fontWeight: '500',
    color: '#4B7F52',
  },
  input: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 15,
    borderWidth: 1,
    borderColor: '#e1e1e1',
    fontSize: 16,
  },
  loginButton: {
    backgroundColor: '#4B7F52',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 10,
  },
  signupButton: {
    backgroundColor: '#D4AF37',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#cccccc',
    opacity: 0.7,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  signupInfoText: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
  },
  footer: {
    marginTop: 40,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#888',
  },
  // 모달 스타일
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#4B7F52',
  },
  modalDescription: {
    fontSize: 14,
    marginBottom: 20,
    color: '#555',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalCancelButton: {
    backgroundColor: '#888',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  modalConfirmButton: {
    backgroundColor: '#4B7F52',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    flex: 1,
    marginLeft: 10,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  checkbox: {
    marginRight: 8,
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#555',
  },
}); 