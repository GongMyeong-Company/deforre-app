import React, { useState, useEffect } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, Alert, View, ActivityIndicator, Modal, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { auth, db } from '@/config/firebase';
import { signOut, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, setDoc } from 'firebase/firestore';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { validateAdminPassword } from '@/config/admin-auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImageManipulator from 'expo-image-manipulator';

export default function MyPage() {
  const [user, setUser] = useState(auth.currentUser);
  const [userName, setUserName] = useState('');
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [userDocId, setUserDocId] = useState<string | null>(null);
  const [isImageLoading, setIsImageLoading] = useState(false);

  useEffect(() => {
    loadCachedProfileImage();
    fetchUserData();
  }, []);

  // 캐시된 프로필 이미지 불러오기
  const loadCachedProfileImage = async () => {
    try {
      if (user && user.email) {
        // 이메일 기반 캐시 키 생성
        const cacheKey = `profileImage_${user.email.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const cachedImage = await AsyncStorage.getItem(cacheKey);
        
        if (cachedImage) {
          try {
            // 저장된 데이터 파싱
            const imageData = JSON.parse(cachedImage);
            console.log('캐시된 프로필 이미지 로드됨');
            
            // 캐시 데이터 만료 확인 (7일)
            const now = Date.now();
            const cacheTime = imageData.timestamp || 0;
            const cacheAge = now - cacheTime;
            const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7일
            
            // 캐시가 만료되었으면 서버에서 다시 가져오기
            if (cacheAge > CACHE_DURATION && imageData.url) {
              console.log('캐시가 만료되어 새로 불러옵니다');
              fetchAndCacheImageAsBase64(imageData.url);
            }
            
            // Base64 데이터가 있으면 사용, 없으면 URL 사용
            if (imageData.base64) {
              setProfileImage(`data:image/jpeg;base64,${imageData.base64}`);
              console.log('Base64 데이터로 이미지 렌더링');
            } else if (imageData.url) {
              setProfileImage(imageData.url);
              console.log('URL로 이미지 렌더링');
              
              // URL이 있으면 이미지 데이터를 가져와 Base64로 캐싱 시도
              fetchAndCacheImageAsBase64(imageData.url);
            }
          } catch (parseError) {
            // 이전 버전 캐시 형식(string)을 처리
            setProfileImage(cachedImage);
            console.log('이전 형식(URL만)으로 이미지 로드됨');
            
            // 새 형식으로 업데이트 시도
            fetchAndCacheImageAsBase64(cachedImage);
          }
        }
      }
    } catch (error) {
      console.error('캐시된 이미지 로드 오류:', error);
    }
  };

  // 프로필 이미지 캐시 초기화 (로그아웃 시 호출)
  const clearProfileImageCache = async () => {
    try {
      if (user && user.email) {
        const cacheKey = `profileImage_${user.email.replace(/[^a-zA-Z0-9]/g, '_')}`;
        await AsyncStorage.removeItem(cacheKey);
        console.log('프로필 이미지 캐시 초기화됨');
      }
    } catch (error) {
      console.error('캐시 초기화 오류:', error);
    }
  };

  // 이미지 URL을 가져와서 Base64로 변환하여 저장
  const fetchAndCacheImageAsBase64 = async (imageUrl: string) => {
    try {
      // 이미지 데이터 가져오기
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      
      // Blob을 Base64로 변환
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        try {
          const base64data = reader.result as string;
          // base64 데이터에서 앞부분 떼어내기 (data:image/jpeg;base64, 부분 제거)
          const base64Content = base64data.split(',')[1];
          
          // 이미지 크기가 너무 큰 경우 처리 (100KB 이상)
          if (base64Content.length > 100 * 1024) {
            console.log('이미지가 너무 큼, 압축 필요:', Math.round(base64Content.length / 1024), 'KB');
            // 큰 이미지는 URL만 캐싱 (Base64 데이터는 저장하지 않음)
            cacheImageUrlOnly(imageUrl);
            return;
          }
          
          // 이메일 기반 캐시 키 생성
          if (user && user.email) {
            const cacheKey = `profileImage_${user.email.replace(/[^a-zA-Z0-9]/g, '_')}`;
            const cacheData = JSON.stringify({
              url: imageUrl,
              base64: base64Content,
              timestamp: Date.now()
            });
            
            await AsyncStorage.setItem(cacheKey, cacheData);
            console.log('이미지 Base64 데이터 캐싱 완료');
          }
        } catch (cacheError) {
          console.error('Base64 이미지 캐싱 오류:', cacheError);
        }
      };
    } catch (error) {
      console.error('이미지 데이터 변환 오류:', error);
    }
  };

  // URL만 캐싱 (Base64 데이터가 너무 큰 경우)
  const cacheImageUrlOnly = async (imageUrl: string) => {
    try {
      if (user && user.email) {
        const cacheKey = `profileImage_${user.email.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const cacheData = JSON.stringify({
          url: imageUrl,
          timestamp: Date.now()
        });
        
        await AsyncStorage.setItem(cacheKey, cacheData);
        console.log('이미지 URL만 캐싱 완료 (Base64 데이터는 너무 큼)');
      }
    } catch (error) {
      console.error('URL 캐싱 오류:', error);
    }
  };

  const fetchUserData = async () => {
    setLoading(true);
    try {
      if (user && user.email) {
        // 사용자 이메일로 users 컬렉션에서 문서 검색
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', user.email));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const userDoc = querySnapshot.docs[0];
          const userData = userDoc.data();
          
          setUserName(userData.name || '');
          
          // 프로필 이미지가 있을 경우 캐싱
          if (userData.profileImage) {
            setProfileImage(userData.profileImage);
            await cacheProfileImage(userData.profileImage);
          }
          
          setUserDocId(userDoc.id); // 문서 ID 저장
        } else {
          console.log('사용자 문서를 찾을 수 없습니다.');
        }
      }
    } catch (error) {
      console.error('사용자 정보 가져오기 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectImage = async () => {
    if (uploadingImage) return;
    
    try {
      // 권한 요청
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('오류', '사진 접근 권한이 필요합니다.');
        return;
      }
      
      // 이미지 선택
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      
      if (!result.canceled) {
        uploadImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('이미지 선택 오류:', error);
      Alert.alert('오류', '이미지 선택 중 문제가 발생했습니다.');
    }
  };
  
  // 이미지 리사이징 함수 추가
  const resizeImage = async (uri: string): Promise<string> => {
    try {
      console.log('이미지 리사이징 시작:', uri);
      
      // 이미지 리사이징 - 최대 800x800 크기로 조정, 품질 80%
      const manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 800, height: 800 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );
      
      console.log('이미지 리사이징 완료:', manipResult.uri);
      console.log('원본 이미지 크기와 리사이징된 이미지 비교 필요');
      
      return manipResult.uri;
    } catch (error) {
      console.error('이미지 리사이징 오류:', error);
      // 리사이징에 실패하면 원본 URI 반환
      return uri;
    }
  };

  // 기존 uploadImage 함수를 더 간단하게 수정
  const uploadImage = async (uri: string) => {
    if (!user || !user.email) return;
    
    setUploadingImage(true);
    try {
      console.log('이미지 업로드 시작:', uri);
      
      // 이미지 리사이징 추가
      const resizedImageUri = await resizeImage(uri);
      console.log('리사이징된 이미지 사용:', resizedImageUri);
      
      // 이미지 파일 가져오기 (한 번만 실행)
      const response = await fetch(resizedImageUri);
      const blob = await response.blob();
      console.log('이미지 블롭 준비됨, 크기:', blob.size, 'bytes');
      
      // 파일 확장자 추출 및 고유한 파일 이름 생성
      const fileExtension = resizedImageUri.split('.').pop() || 'jpg';
      const fileName = `profile_${Date.now()}.${fileExtension}`;
      console.log('파일명:', fileName);
      
      try {
        // Base64로 변환하여 직접 저장
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        
        reader.onloadend = async () => {
          try {
            const base64data = reader.result as string;
            // base64 데이터에서 헤더 제거 (data:image/jpeg;base64, 부분)
            const base64Content = base64data.split(',')[1];
            console.log('Base64 변환 완료, 크기:', Math.round(base64Content.length / 1024), 'KB');
            
            // 사용자 문서에 직접 base64 이미지 저장
            if (userDocId) {
              console.log('사용자 문서 업데이트 중...');
              await updateDoc(doc(db, 'users', userDocId), {
                profileImage: base64data,
                profileImageUpdatedAt: new Date()
              });
              console.log('사용자 문서 업데이트 완료');
            } else {
              // 이메일로 문서 검색
              console.log('사용자 문서 검색 중...');
              const usersRef = collection(db, 'users');
              const q = query(usersRef, where('email', '==', user.email));
              const querySnapshot = await getDocs(q);
              
              if (!querySnapshot.empty) {
                const userDocRef = querySnapshot.docs[0].ref;
                await updateDoc(userDocRef, {
                  profileImage: base64data,
                  profileImageUpdatedAt: new Date()
                });
                setUserDocId(querySnapshot.docs[0].id);
                console.log('사용자 문서 업데이트 완료');
              } else {
                // 문서가 없으면 새로 생성
                console.log('사용자 문서 생성 중...');
                const newUserDocRef = doc(collection(db, 'users'));
                await setDoc(newUserDocRef, {
                  email: user.email,
                  name: userName || (user.email ? user.email.split('@')[0] : '사용자'),
                  profileImage: base64data,
                  profileImageUpdatedAt: new Date(),
                  createdAt: new Date()
                });
                setUserDocId(newUserDocRef.id);
                console.log('사용자 문서 생성 완료');
              }
            }
            
            // 캐시 및 상태 업데이트
            console.log('이미지 캐싱 중...');
            const cacheKey = `profileImage_${user.email.replace(/[^a-zA-Z0-9]/g, '_')}`;
            const cacheData = JSON.stringify({
              base64: base64Content,
              timestamp: Date.now()
            });
            await AsyncStorage.setItem(cacheKey, cacheData);
            
            setProfileImage(base64data);
            console.log('이미지 업데이트 완료');
            
            Alert.alert('성공', '프로필 이미지가 업데이트되었습니다.');
          } catch (saveError: any) {
            console.error('이미지 저장 오류:', saveError);
            Alert.alert('오류', '이미지 저장 중 문제가 발생했습니다.');
          } finally {
            setUploadingImage(false);
          }
        };
        
        reader.onerror = (error) => {
          console.error('Base64 변환 오류:', error);
          Alert.alert('오류', 'Base64 변환 중 오류가 발생했습니다.');
          setUploadingImage(false);
        };
      } catch (uploadError: any) {
        console.error('Firebase 업로드 오류:', uploadError);
        console.error('오류 코드:', uploadError?.code);
        console.error('오류 메시지:', uploadError?.message);
        
        // 오류 처리 및 사용자에게 알림
        Alert.alert('업로드 실패', '이미지 업로드 중 문제가 발생했습니다. 다시 시도해주세요.', [
          { text: '확인' },
          { 
            text: '재시도', 
            onPress: () => uploadImage(uri)
          }
        ]);
        setUploadingImage(false);
      }
    } catch (error: any) {
      console.error('전체 업로드 과정 오류:', error);
      Alert.alert('오류', '이미지를 처리하는 중 문제가 발생했습니다.');
      setUploadingImage(false);
    }
  };

  const handleLogout = async () => {
    try {
      // 로그아웃 전에 로그인 정보 삭제
      try {
        // 모든 인증 정보 삭제
        await AsyncStorage.removeItem('user_email');
        await AsyncStorage.removeItem('user_password');
        await AsyncStorage.removeItem('user_uid');
        await AsyncStorage.removeItem('user_last_login');
        await AsyncStorage.removeItem('user_is_logged_in');
        await AsyncStorage.removeItem('user_auth_state');
        
        console.log('모든 로그인 정보가 삭제되었습니다');
      } catch (storageError) {
        console.error('로그인 정보 삭제 실패:', storageError);
      }
      
      // Firebase 로그아웃
      await signOut(auth);
      
      // 로그인 페이지로 이동
      router.replace('/login');
    } catch (error) {
      console.error('로그아웃 오류:', error);
      Alert.alert('오류', '로그아웃 중 문제가 발생했습니다.');
    }
  };

  const handleUpdateName = async () => {
    if (!newName.trim()) {
      Alert.alert('오류', '이름을 입력해주세요.');
      return;
    }

    setIsUpdating(true);
    try {
      if (user && user.email) {
        if (userDocId) {
          // userDocId가 있는 경우 직접 업데이트
          await updateDoc(doc(db, 'users', userDocId), {
            name: newName.trim()
          });
        } else {
          // 이메일로 문서 검색
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where('email', '==', user.email));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            const userDocRef = querySnapshot.docs[0].ref;
            await updateDoc(userDocRef, {
              name: newName.trim()
            });
            setUserDocId(querySnapshot.docs[0].id);
          } else {
            // 문서가 없으면 새로 생성
            const newUserDocRef = doc(collection(db, 'users'));
            await setDoc(newUserDocRef, {
              email: user.email,
              name: newName.trim(),
              createdAt: new Date()
            });
            setUserDocId(newUserDocRef.id);
          }
        }
        
        setUserName(newName.trim());
        setNewName('');
        setNameModalVisible(false);
        Alert.alert('성공', '이름이 성공적으로 변경되었습니다.');
      }
    } catch (error) {
      console.error('이름 변경 오류:', error);
      Alert.alert('오류', '이름 변경 중 문제가 발생했습니다.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      Alert.alert('오류', '모든 필드를 입력해주세요.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      Alert.alert('오류', '새 비밀번호가 일치하지 않습니다.');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('오류', '비밀번호는 최소 6자 이상이어야 합니다.');
      return;
    }

    setIsUpdating(true);
    try {
      if (user && user.email) {
        // 현재 비밀번호로 재인증
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
        
        // 비밀번호 변경
        await updatePassword(user, newPassword);
        
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
        setPasswordModalVisible(false);
        Alert.alert('성공', '비밀번호가 성공적으로 변경되었습니다.');
      }
    } catch (error: any) {
      let errorMessage = '비밀번호 변경 중 문제가 발생했습니다.';
      if (error.code === 'auth/wrong-password') {
        errorMessage = '현재 비밀번호가 올바르지 않습니다.';
      }
      Alert.alert('오류', errorMessage);
    } finally {
      setIsUpdating(false);
    }
  };

  const renderNameModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={nameModalVisible}
      onRequestClose={() => setNameModalVisible(false)}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalContainer}
      >
        <ThemedView style={styles.modalContent}>
          <ThemedText style={styles.modalTitle}>이름 변경</ThemedText>
          
          <TextInput
            style={styles.input}
            placeholder="새 이름"
            placeholderTextColor="#888888"
            value={newName}
            onChangeText={setNewName}
            editable={!isUpdating}
          />
          
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => {
                setNewName('');
                setNameModalVisible(false);
              }}
              disabled={isUpdating}
            >
              <ThemedText style={styles.modalButtonText}>취소</ThemedText>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.modalButton, styles.confirmButton]}
              onPress={handleUpdateName}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <ThemedText style={styles.modalButtonText}>확인</ThemedText>
              )}
            </TouchableOpacity>
          </View>
        </ThemedView>
      </KeyboardAvoidingView>
    </Modal>
  );

  const renderPasswordModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={passwordModalVisible}
      onRequestClose={() => setPasswordModalVisible(false)}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.modalContainer}
      >
        <ThemedView style={styles.modalContent}>
          <ThemedText style={styles.modalTitle}>비밀번호 변경</ThemedText>
          
          <TextInput
            style={styles.input}
            placeholder="현재 비밀번호"
            placeholderTextColor="#888888"
            secureTextEntry
            value={currentPassword}
            onChangeText={setCurrentPassword}
            editable={!isUpdating}
          />
          
          <TextInput
            style={styles.input}
            placeholder="새 비밀번호"
            placeholderTextColor="#888888"
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
            editable={!isUpdating}
          />
          
          <TextInput
            style={styles.input}
            placeholder="새 비밀번호 확인"
            placeholderTextColor="#888888"
            secureTextEntry
            value={confirmNewPassword}
            onChangeText={setConfirmNewPassword}
            editable={!isUpdating}
          />
          
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => {
                setCurrentPassword('');
                setNewPassword('');
                setConfirmNewPassword('');
                setPasswordModalVisible(false);
              }}
              disabled={isUpdating}
            >
              <ThemedText style={styles.modalButtonText}>취소</ThemedText>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.modalButton, styles.confirmButton]}
              onPress={handleUpdatePassword}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <ThemedText style={styles.modalButtonText}>확인</ThemedText>
              )}
            </TouchableOpacity>
          </View>
        </ThemedView>
      </KeyboardAvoidingView>
    </Modal>
  );

  // 프로필 이미지 렌더링
  const renderProfileImage = () => {
    if (profileImage) {
      return (
        <Image 
          source={{ uri: profileImage }} 
          style={styles.profileImage}
          onLoadStart={() => setIsImageLoading(true)}
          onLoadEnd={() => setIsImageLoading(false)}
        />
      );
    }
    
    return (
      <View style={styles.profileImagePlaceholder}>
        <Ionicons name="person" size={50} color="#CCCCCC" />
      </View>
    );
  };

  // 프로필 이미지 URL 캐싱
  const cacheProfileImage = async (imageUrl: string) => {
    try {
      if (user && user.email && imageUrl) {
        // 이메일 기반 캐시 키 생성
        const cacheKey = `profileImage_${user.email.replace(/[^a-zA-Z0-9]/g, '_')}`;
        
        // 일단 URL만 먼저 저장 (빠른 반응을 위해)
        const initialCacheData = JSON.stringify({
          url: imageUrl,
          timestamp: Date.now()
        });
        
        await AsyncStorage.setItem(cacheKey, initialCacheData);
        console.log('프로필 이미지 URL 캐싱 완료');
        
        // 백그라운드에서 Base64 데이터 캐싱
        fetchAndCacheImageAsBase64(imageUrl);
      }
    } catch (error) {
      console.error('이미지 캐싱 오류:', error);
    }
  };

  return (
    <ThemedView style={styles.container}>
      {renderNameModal()}
      {renderPasswordModal()}
      
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <ActivityIndicator size="large" color="#4B7F52" style={styles.loadingIndicator} />
        ) : (
          <>
            <View style={styles.profileSection}>
              <TouchableOpacity style={styles.profileImageContainer} onPress={selectImage}>
                {renderProfileImage()}
                {(uploadingImage || isImageLoading) && (
                  <View style={styles.uploadingOverlay}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  </View>
                )}
                <View style={styles.editIconContainer}>
                  <Ionicons name="camera" size={16} color="#FFFFFF" />
                </View>
              </TouchableOpacity>
              
              <View style={styles.profileInfo}>
                <ThemedText style={styles.nameText}>{userName || user?.email?.split('@')[0] || '사용자'}</ThemedText>
                <ThemedText style={styles.emailText}>{user?.email || ''}</ThemedText>
              </View>
            </View>
            
            <View style={styles.menuSection}>
              <ThemedText style={styles.menuSectionTitle}>계정 설정</ThemedText>
              
              <View style={styles.menuList}>
                <TouchableOpacity 
                  style={styles.menuItem}
                  onPress={() => setNameModalVisible(true)}
                >
                  <View style={styles.menuIconContainer}>
                    <Ionicons name="person-outline" size={24} color="#4B7F52" />
                  </View>
                  <ThemedText style={styles.menuText}>이름 변경</ThemedText>
                  <Ionicons name="chevron-forward" size={20} color="#BBB" />
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.menuItem}
                  onPress={() => setPasswordModalVisible(true)}
                >
                  <View style={styles.menuIconContainer}>
                    <Ionicons name="lock-closed-outline" size={24} color="#4B7F52" />
                  </View>
                  <ThemedText style={styles.menuText}>비밀번호 변경</ThemedText>
                  <Ionicons name="chevron-forward" size={20} color="#BBB" />
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.menuItem}
                  onPress={handleLogout}
                >
                  <View style={styles.menuIconContainer}>
                    <Ionicons name="log-out-outline" size={24} color="#E53935" />
                  </View>
                  <ThemedText style={[styles.menuText, styles.logoutText]}>로그아웃</ThemedText>
                  <Ionicons name="chevron-forward" size={20} color="#BBB" />
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 30 : 25,
    paddingBottom: 20,
  },
  loadingIndicator: {
    marginTop: 50,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 30,
    paddingTop: Platform.OS === 'android' ? 20 : 10,
  },
  profileImageContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: Platform.OS === 'android' ? 8 : 16,
    position: 'relative',
  },
  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
  },
  profileImagePlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#4B7F52',
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  profileInfo: {
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 8 : 8,
  },
  nameText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
    lineHeight: Platform.OS === 'android' ? 32 : 24,
    paddingTop: Platform.OS === 'android' ? 4 : 0,
    paddingBottom: Platform.OS === 'android' ? 4 : 0,
  },
  emailText: {
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
  },
  menuSection: {
    marginBottom: 24,
  },
  menuSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  menuList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  menuIconContainer: {
    width: 32,
    alignItems: 'center',
    marginRight: 12,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
  },
  logoutText: {
    color: '#E53935',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '85%',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  input: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderColor: '#DDDDDD',
    borderRadius: 5,
    marginBottom: 16,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 10,
  },
  modalButton: {
    flex: 1,
    height: 45,
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#DDDDDD',
  },
  confirmButton: {
    backgroundColor: '#4B7F52',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
}); 