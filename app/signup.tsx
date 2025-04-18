import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView } from 'react-native';
import { Stack, router } from 'expo-router';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../config/firebase';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSignup = async () => {
    // 입력 유효성 검사
    if (email.trim() === '' || name.trim() === '' || password.trim() === '' || confirmPassword.trim() === '') {
      Alert.alert('오류', '모든 필드를 입력해주세요.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('오류', '비밀번호가 일치하지 않습니다.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('오류', '비밀번호는 최소 6자 이상이어야 합니다.');
      return;
    }

    setIsLoading(true);
    try {
      // Firebase 회원가입 처리
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Firestore에 유저 정보 저장
      await setDoc(doc(db, "users", user.uid), {
        email: email,
        name: name,
        createdAt: new Date(),
        lastLogin: new Date()
      });
      
      Alert.alert('성공', '회원가입이 완료되었습니다. 로그인 해주세요.', [
        { text: '확인', onPress: () => router.replace('/login') }
      ]);
    } catch (error: any) {
      let errorMessage = '회원가입에 실패했습니다.';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = '이미 사용 중인 이메일입니다.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = '유효하지 않은 이메일 형식입니다.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = '비밀번호가 너무 약합니다.';
      }
      Alert.alert('오류', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <Stack.Screen options={{ title: '회원가입' }} />
      <ThemedView style={styles.content}>
        <View style={styles.centerContainer}>
          <View style={styles.formContainer}>
            <View style={styles.inputWrapper}>
              <ThemedText style={styles.inputLabel}>이메일</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="이메일을 입력하세요"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!isLoading}
              />
            </View>
            
            <View style={styles.inputWrapper}>
              <ThemedText style={styles.inputLabel}>이름</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="이름을 입력하세요"
                value={name}
                onChangeText={setName}
                autoCapitalize="none"
                editable={!isLoading}
              />
            </View>
            
            <View style={styles.inputWrapper}>
              <ThemedText style={styles.inputLabel}>비밀번호</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="비밀번호를 입력하세요"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                editable={!isLoading}
              />
            </View>
            
            <View style={styles.inputWrapper}>
              <ThemedText style={styles.inputLabel}>비밀번호 확인</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="비밀번호를 다시 입력하세요"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                editable={!isLoading}
              />
            </View>

            <TouchableOpacity 
              style={styles.signupButton} 
              onPress={handleSignup}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <ThemedText style={styles.buttonText}>회원가입</ThemedText>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.loginButton}
              onPress={() => router.replace('/login')}
              disabled={isLoading}
            >
              <ThemedText style={styles.buttonText}>로그인 화면으로 돌아가기</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </ThemedView>
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
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
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
  signupButton: {
    backgroundColor: '#4B7F52',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 10,
  },
  loginButton: {
    backgroundColor: '#cccccc',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
}); 