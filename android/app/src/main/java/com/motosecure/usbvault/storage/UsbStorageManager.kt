package com.motosecure.usbvault.storage

import android.content.Context
import android.net.Uri
import android.os.storage.StorageManager
import android.os.storage.StorageVolume
import androidx.documentfile.provider.DocumentFile
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Storage Access Framework (SAF) & USB OTG Controller.
 * Manages mounted USB pen drive directories, read-only checks, and capacity metrics.
 */
class UsbStorageManager(private val context: Context) {

    data class UsbDriveStatus(
        val isConnected: Boolean,
        val volumeName: String,
        val totalBytes: Long,
        val freeBytes: Long,
        val isReadOnly: Boolean,
        val treeUri: Uri?
    )

    /**
     * Queries Android StorageManager to check for connected USB mass storage volumes.
     */
    fun detectUsbOtgVolumes(): List<StorageVolume> {
        val storageManager = context.getSystemService(Context.STORAGE_SERVICE) as StorageManager
        return storageManager.storageVolumes.filter { volume ->
            volume.isRemovable && !volume.isPrimary
        }
    }

    /**
     * Resolves selected USB root DocumentFile and ensures the private vault folder exists.
     */
    suspend fun getOrCreateVaultFolder(treeUri: Uri): DocumentFile? = withContext(Dispatchers.IO) {
        val rootDir = DocumentFile.fromTreeUri(context, treeUri) ?: return@withContext null
        if (!rootDir.canWrite()) return@withContext null

        val vaultFolder = rootDir.findFile(".svault_secure")
            ?: rootDir.createDirectory(".svault_secure")

        return@withContext vaultFolder
    }

    /**
     * Lists all encrypted .svault files on the USB drive.
     */
    suspend fun listVaultFiles(vaultFolder: DocumentFile): List<DocumentFile> = withContext(Dispatchers.IO) {
        return@withContext vaultFolder.listFiles().filter {
            it.isFile && it.name?.endsWith(".svault") == true
        }
    }
}
