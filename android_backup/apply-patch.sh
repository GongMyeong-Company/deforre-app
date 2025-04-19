#!/bin/bash

# 현재 디렉토리를 저장
CURRENT_DIR=$(pwd)

# 부모 디렉토리로 이동
cd ..

# 패치 적용
patch -p0 node_modules/@react-native/gradle-plugin/settings.gradle.kts < android/fix-gradle-plugin.patch

# 결과 확인
RESULT=$?
if [ $RESULT -eq 0 ]; then
  echo "패치가 성공적으로 적용되었습니다."
else
  echo "패치 적용 중 오류가 발생했습니다. 오류 코드: $RESULT"
fi

# 원래 디렉토리로 돌아오기
cd "$CURRENT_DIR"

exit $RESULT 