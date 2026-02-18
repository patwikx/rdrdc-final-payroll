package com.rdhardware.employeeportal.core.data.session

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.emptyPreferences
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.rdhardware.employeeportal.core.domain.AuthSession
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import java.io.IOException

private const val STORE_NAME = "employee_portal_session"
private val Context.sessionDataStore: DataStore<Preferences> by preferencesDataStore(name = STORE_NAME)

class SessionStore(private val context: Context) {
    companion object {
        private val ACCESS_TOKEN_KEY = stringPreferencesKey("access_token")
        private val REFRESH_TOKEN_KEY = stringPreferencesKey("refresh_token")
        private val USER_ID_KEY = stringPreferencesKey("user_id")
        private val COMPANY_ID_KEY = stringPreferencesKey("company_id")
    }

    @Volatile
    private var cachedSession: AuthSession? = null

    val sessionFlow: Flow<AuthSession?> = context.sessionDataStore.data
        .catch { error ->
            if (error is IOException) {
                emit(emptyPreferences())
            } else {
                throw error
            }
        }
        .map { prefs -> prefs.toAuthSession() }
        .map { session ->
            cachedSession = session
            session
        }

    suspend fun primeCache() {
        cachedSession = sessionFlow.first()
    }

    suspend fun getSession(): AuthSession? = sessionFlow.first()

    fun currentAccessTokenOrNull(): String? = cachedSession?.accessToken

    suspend fun saveSession(session: AuthSession) {
        context.sessionDataStore.edit { prefs ->
            prefs[ACCESS_TOKEN_KEY] = session.accessToken
            prefs[REFRESH_TOKEN_KEY] = session.refreshToken
            prefs[USER_ID_KEY] = session.userId
            prefs[COMPANY_ID_KEY] = session.companyId
        }
        cachedSession = session
    }

    suspend fun clearSession() {
        context.sessionDataStore.edit { prefs ->
            prefs.remove(ACCESS_TOKEN_KEY)
            prefs.remove(REFRESH_TOKEN_KEY)
            prefs.remove(USER_ID_KEY)
            prefs.remove(COMPANY_ID_KEY)
        }
        cachedSession = null
    }

    private fun Preferences.toAuthSession(): AuthSession? {
        val accessToken = this[ACCESS_TOKEN_KEY] ?: return null
        val refreshToken = this[REFRESH_TOKEN_KEY] ?: ""
        val userId = this[USER_ID_KEY] ?: ""
        val companyId = this[COMPANY_ID_KEY] ?: ""

        return AuthSession(
            accessToken = accessToken,
            refreshToken = refreshToken,
            userId = userId,
            companyId = companyId
        )
    }
}
