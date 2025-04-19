// 필요한 rootProject 설정만 유지
rootProject.name = "Hotel"

// foojay 플러그인 비활성화
plugins {
    id("org.gradle.toolchains.foojay-resolver-convention") version("0.5.0") apply(false)
} 