package com.motosecure.usbvault.ui

import android.app.Application
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.motosecure.usbvault.crypto.CryptoEngine
import com.motosecure.usbvault.storage.UsbStorageManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.security.SecureRandom
import javax.crypto.SecretKey

data class VaultUiState(
    val isLocked: Boolean = true,
    val isUsbConnected: Boolean = false,
    val usbVolumeName: String = "No USB Drive Detected",
    val encryptedFilesCount: Int = 0,
    val totalBytes: Long = 0L,
    val freeBytes: Long = 0L,
    val failedAttempts: Int = 0,
    val lockoutRemainingSeconds: Int = 0,
    val isScrambleKeypad: Boolean = false,
    val transferProgress: Float = 0f,
    val statusMessage: String = ""
)

class VaultViewModel(application: Application) : AndroidViewModel(application) {

    private val cryptoEngine = CryptoEngine()
    private val usbStorageManager = UsbStorageManager(application)

    private val _uiState = MutableStateFlow(VaultUiState())
    val uiState: StateFlow<VaultUiState> = _uiState.asStateFlow()

    private var activeSecretKey: SecretKey? = null

    fun unlockVault(pin: String): Boolean {
        if (pin.length >= 4) {
            val salt = ByteArray(32).also { SecureRandom().nextBytes(it) }
            activeSecretKey = cryptoEngine.deriveKey(pin.toCharArray(), salt)
            _uiState.value = _uiState.value.copy(
                isLocked = false,
                failedAttempts = 0
            )
            return true
        } else {
            val nextAttempts = _uiState.value.failedAttempts + 1
            val lockout = if (nextAttempts >= 3) 30 else 0
            _uiState.value = _uiState.value.copy(
                failedAttempts = nextAttempts,
                lockoutRemainingSeconds = lockout
            )
            return false
        }
    }

    fun lockVault() {
        activeSecretKey = null
        _uiState.value = _uiState.value.copy(isLocked = true)
    }

    fun toggleScrambleKeypad() {
        _uiState.value = _uiState.value.copy(isScrambleKeypad = !_uiState.value.isScrambleKeypad)
    }
}
