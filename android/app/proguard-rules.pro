# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# ==================== Capacitor 官方推荐规则 ====================

# JS 桥接：@JavascriptInterface 方法不能被混淆或移除，否则 WebView 侧调用直接失效
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Capacitor 桥接核心：插件注册、bridge 调用依赖反射，类名/方法名不能混淆
-keep class com.getcapacitor.** { *; }

# Capacitor 官方插件（@capacitor/filesystem、@capacitor/share）：
# 由 assets/capacitor.plugins.json 记录类名并按反射加载，不能混淆
-keep class com.capacitorjs.plugins.** { *; }

# AndroidX / WebView 相关：AAR 自带 consumer 规则为主，此处按 Capacitor 模板兜底
# （androidx.browser 用于 Spotify OAuth 的 Custom Tabs 回调；capacitor-android 依赖 androidx.webkit）
-keep class androidx.browser.** { *; }
-keep class androidx.webkit.** { *; }

# ==================== 项目自身 ====================

# 原生桥接：WebView 侧通过 window.AndroidNative 直接调用其公共方法
-keep class com.zephyrus.player.NativeBridge { public *; }

# 入口 Activity：Manifest 引用，并注册匿名 OnBackPressedCallback 等内部回调
-keep class com.zephyrus.player.MainActivity { *; }

# ==================== 第三方库 ====================

# jaudiotagger（标签编辑）引用了桌面版 JDK 的 java.awt / javax 类，Android 上不存在；
# 缺少 dontwarn 时 R8 收缩阶段会因 Missing class 直接构建失败
-dontwarn java.awt.**
-dontwarn javax.imageio.**
-dontwarn javax.sound.**

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile
