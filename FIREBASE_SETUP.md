# Firebase 설정 가이드

이 애플리케이션은 Firebase와 연동되어 있으며, 실제 사용을 위해서는 Firebase 프로젝트 설정이 필요합니다.

## 1. Firebase 프로젝트 생성

1. [Firebase 콘솔](https://console.firebase.google.com/)에 로그인합니다.
2. "프로젝트 추가"를 클릭하여 새 프로젝트를 생성합니다.
3. 프로젝트 이름을 입력하고 화면의 지시에 따라 설정을 완료합니다.

## 2. 웹 앱 등록

1. 프로젝트 콘솔에서 "웹" 아이콘(</>) 을 클릭하여 웹 앱을 등록합니다.
2. 앱 닉네임을 입력하고 앱을 등록합니다.
3. Firebase SDK 구성 정보가 나타납니다. 이 정보를 복사해둡니다.

## 3. 프로젝트에 Firebase 구성 정보 추가

1. `config/firebase.js` 파일을 열고 아래와 같이 Firebase 구성 정보를 업데이트 합니다:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID"
};
```

Firebase 콘솔에서 제공한 구성 정보로 위의 값들을 교체하세요.

## 4. Firebase 인증 활성화

1. Firebase 콘솔에서 "인증" 메뉴로 이동합니다.
2. "시작하기" 버튼을 클릭합니다.
3. "이메일/비밀번호" 로그인 방식을 활성화합니다.
4. "저장" 버튼을 클릭합니다.

## 5. Firestore 데이터베이스 설정

1. Firebase 콘솔에서 "Firestore Database" 메뉴로 이동합니다.
2. "데이터베이스 만들기" 버튼을 클릭합니다.
3. 테스트 모드 또는 프로덕션 모드를 선택하고 "다음" 버튼을 클릭합니다.
4. 데이터베이스 위치를 선택하고 "사용 설정" 버튼을 클릭합니다.

## 6. Firestore 보안 규칙 설정

기본적으로 테스트 모드는 모든 읽기/쓰기 작업을 허용합니다. 실제 앱 배포 전에는 보안 규칙을 강화해야 합니다.

예시 보안 규칙:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /todos/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 7. 앱 실행

모든 설정이 완료되었으면 앱을 실행하여 Firebase 연동이 잘 작동하는지 확인하세요.

```bash
npx expo start
``` 