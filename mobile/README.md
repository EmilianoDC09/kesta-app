This is a Kotlin Multiplatform project targeting Android, iOS.

* [/iosApp](./iosApp/iosApp) contains an iOS application. Even if you’re sharing your UI with Compose Multiplatform,
  you need this entry point for your iOS app. This is also where you should add SwiftUI code for your project.

* [/shared](./shared/src) is for code that will be shared across your Compose Multiplatform applications.
  It contains several subfolders:
  - [commonMain](./shared/src/commonMain/kotlin) is for code that’s common for all targets.
  - Other folders are for Kotlin code that will be compiled for only the platform indicated in the folder name.
    For example, if you want to use Apple’s CoreCrypto for the iOS part of your Kotlin app,
    the [iosMain](./shared/src/iosMain/kotlin) folder would be the right place for such calls.
    Similarly, if you want to edit the Desktop (JVM) specific part, the [jvmMain](./shared/src/jvmMain/kotlin)
    folder is the appropriate location.

### Running the apps

Use the run configurations provided by the run widget in your IDE's toolbar. You can also use these commands and options:

- Android app: `./gradlew :androidApp:assembleDebug`
- iOS app: open the [/iosApp](./iosApp) directory in Xcode and run it from there.

### Running tests

Use the run button in your IDE's editor gutter, or run tests using Gradle tasks:

- Android tests: `./gradlew :shared:testAndroidHostTest`
- iOS tests: `./gradlew :shared:iosSimulatorArm64Test`

---

Learn more about [Kotlin Multiplatform](https://www.jetbrains.com/help/kotlin-multiplatform-dev/get-started.html)…
### Ejecutar en un telefono Android fisico (desarrollo)

1. Levanta el backend en la PC (puerto 3000).
2. Conecta el telefono por USB con depuracion USB activada.
3. Ejecuta `adb reverse tcp:3000 tcp:3000` (se pierde al desconectar el cable o reiniciar adb; repitelo).
4. Comprueba en el navegador del telefono: `http://localhost:3000/api/v1/ciudades`.
5. Ejecuta la configuracion `androidApp` desde Android Studio.

La URL del backend se define por tipo de compilacion en `androidApp/build.gradle.kts` (`API_BASE_URL`):
debug apunta a `http://localhost:3000/api/v1/`; release usa la propiedad `kesta.api.baseUrl.release`
de `gradle.properties` (servidor del piloto, con HTTPS).
HTTP sin TLS solo se permite en debug y solo hacia localhost / 127.0.0.1 / 10.0.2.2
(`androidApp/src/debug/res/xml/network_security_config.xml`).

### Sesion (registro, inicio y cierre)

- `data/auth/KtorSessionRepository.kt`: AUT-01, AUT-02, AUT-04 y validacion con AUT-05 al abrir la app.
- `data/auth/AuthenticatedClient.kt`: cliente con Bearer y renovacion automatica (AUT-03) al recibir 401.
- `data/auth/TokenStore.kt` + `core/storage/SecureStore`: tokens persistidos (Android: AES-GCM con Android Keystore).
- Sin red al abrir la app, la sesion NO se cierra; solo se cierra si el servidor rechaza la renovacion o el usuario cierra sesion.

### Estructura y convenciones

- `core/`: piezas sin funcionalidad propia (red, errores, configuracion, almacenamiento).
- `data/<funcionalidad>/`: modelos y repositorios por funcionalidad (`auth`, `status`; siguen `catalogo`, `precios`, `canasta`).
- `ui/<funcionalidad>/`: pantallas y ViewModels. `ui/components/`: kit visual de Kesta (campos, botones, logo).
- Repositorios nuevos: usar `apiClient` (lleva el token y renueva solo) y `safeRequest { ... }`;
  devolver `Result` con `AppException(AppError)`, nunca textos de pantalla. El texto lo decide la UI
  (`core/ui/ErrorMessages.kt`, con ajustes por pantalla como `ui/auth/AuthMessages.kt`).
- Implementaciones de prueba (Fake...) en `shared/src/commonTest`, no en `commonMain`.
- Arranque en Android: `KestaApplication` (no `MainActivity`) inicializa el codigo compartido.
