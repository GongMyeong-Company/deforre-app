#!/bin/bash

cd android

# Gradle 오류 메시지 확인용 환경변수 설정
export ANDROID_SDK_ROOT=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_SDK_ROOT/tools/bin:$ANDROID_SDK_ROOT/platform-tools

# 자바 도구체인 관련 속성 설정
export GRADLE_OPTS="$GRADLE_OPTS -Dorg.gradle.toolchains.foojay-resolver-convention.skip=true"

# Gradle 빌드 및 설치 명령어 실행
./gradlew --no-daemon --no-configure-on-demand --no-build-cache assembleDebug -x lint && ./gradlew --no-daemon --no-configure-on-demand --no-build-cache installDebug -x lint

# 결과 코드 확인
RESULT=$?
if [ $RESULT -eq 0 ]; then
  echo "앱이 성공적으로 빌드되었습니다."
else
  echo "빌드 중 오류가 발생했습니다. 오류 코드: $RESULT"
fi

exit $RESULT 