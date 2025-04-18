import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../config/firebase';

export default function AuthExample() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignedIn, setIsSignedIn] = useState(false);

  // 회원가입 기능
  const handleSignUp = async () => {
    if (email === '' || password === '') {
      Alert.alert('오류', '이메일과 비밀번호를 입력해주세요.');
      return;
    }

    try {
      await createUserWithEmailAndPassword(auth, email, password);
      Alert.alert('성공', '회원가입이 완료되었습니다.');
      setIsSignedIn(true);
    } catch (error: any) {
      Alert.alert('오류', error.message);
    }
  };

  // 로그인 기능
  const handleSignIn = async () => {
    if (email === '' || password === '') {
      Alert.alert('오류', '이메일과 비밀번호를 입력해주세요.');
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      Alert.alert('성공', '로그인이 완료되었습니다.');
      setIsSignedIn(true);
    } catch (error: any) {
      Alert.alert('오류', error.message);
    }
  };

  // 로그아웃 기능
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setIsSignedIn(false);
      setEmail('');
      setPassword('');
      Alert.alert('성공', '로그아웃되었습니다.');
    } catch (error: any) {
      Alert.alert('오류', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Firebase 인증 예제</Text>
      
      {isSignedIn ? (
        <View>
          <Text style={styles.welcomeText}>환영합니다!</Text>
          <Text>이메일: {email}</Text>
          <TouchableOpacity onPress={handleSignOut} style={styles.button}>
            <Text style={styles.buttonText}>로그아웃</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View>
          <TextInput
            style={styles.input}
            placeholder="이메일"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="비밀번호"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <View style={styles.buttonContainer}>
            <TouchableOpacity onPress={handleSignIn} style={styles.button}>
              <Text style={styles.buttonText}>로그인</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSignUp} style={[styles.button, styles.signUpButton]}>
              <Text style={styles.buttonText}>회원가입</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    margin: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    backgroundColor: '#3498db',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
  },
  signUpButton: {
    backgroundColor: '#2ecc71',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  welcomeText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
}); 