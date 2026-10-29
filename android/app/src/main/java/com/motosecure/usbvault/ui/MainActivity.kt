package com.motosecure.usbvault.ui

import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.ui.graphics.Color
import com.motosecure.usbvault.ui.screens.VaultAppNavigation

/**
 * Main Activity enforcing Android WindowManager FLAG_SECURE
 * Prevents screen recording, screenshots, and recents switcher leaking sensitive media.
 */
class MainActivity : ComponentActivity() {

    private val viewModel: VaultViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // CRITICAL SECURITY REQUIREMENT:
        // FLAG_SECURE treats the content of the window as secure, preventing it from appearing in
        // screenshots or from being viewed on non-secure displays.
        window.setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE
        )

        setContent {
            MaterialTheme(
                colorScheme = darkColorScheme(
                    primary = Color(0xFF6366F1), // Moto Secure Indigo
                    background = Color(0xFF030712), // Deep slate black
                    surface = Color(0xFF0F172A),
                    onPrimary = Color.White,
                    onBackground = Color(0xFFF8FAFC)
                )
            ) {
                VaultAppNavigation(viewModel = viewModel)
            }
        }
    }
}
