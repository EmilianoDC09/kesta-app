import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.androidApplication)
    alias(libs.plugins.composeCompiler)
}

kotlin {
    compilerOptions {
        jvmTarget = JvmTarget.JVM_11
    }
}
dependencies {
    implementation(project(":shared"))

    implementation(libs.androidx.activity.compose)

    implementation(libs.compose.uiToolingPreview)
    debugImplementation(libs.compose.uiTooling)
}

// URL del backend para la compilacion release. El valor por defecto es invalido a proposito:
// una release sin servidor configurado falla con "sin conexion" en vez de apuntar a localhost.
val releaseApiBaseUrl: String = providers.gradleProperty("kesta.api.baseUrl.release")
    .getOrElse("https://configurar-servidor-piloto.invalid/api/v1/")

android {
    namespace = "com.kesta.app"
    compileSdk = libs.versions.android.compileSdk.get().toInt()

    defaultConfig {
        applicationId = "com.kesta.app"
        minSdk = libs.versions.android.minSdk.get().toInt()
        targetSdk = libs.versions.android.targetSdk.get().toInt()
        versionCode = 1
        versionName = "1.0"
    }
    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
    buildTypes {
        debug {
            // PC de desarrollo por USB: adb reverse tcp:3000 tcp:3000
            buildConfigField("String", "API_BASE_URL", "\"http://localhost:3000/api/v1/\"")
        }
        release {
            // Servidor del piloto (HTTPS). Se define en gradle.properties: kesta.api.baseUrl.release
            buildConfigField("String", "API_BASE_URL", "\"$releaseApiBaseUrl\"")
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
}