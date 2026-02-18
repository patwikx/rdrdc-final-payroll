package com.rdhardware.employeeportal.core.data

import android.content.Context
import com.rdhardware.employeeportal.core.data.session.SessionStore
import com.rdhardware.employeeportal.core.network.NetworkModule
import com.rdhardware.employeeportal.feature.auth.data.AuthRepository
import com.rdhardware.employeeportal.feature.auth.data.AuthRepositoryImpl
import com.rdhardware.employeeportal.feature.dashboard.data.DashboardRepository
import com.rdhardware.employeeportal.feature.dashboard.data.DashboardRepositoryImpl
import com.rdhardware.employeeportal.feature.leaves.data.LeavesRepository
import com.rdhardware.employeeportal.feature.leaves.data.LeavesRepositoryImpl
import com.rdhardware.employeeportal.feature.overtime.data.OvertimeRepository
import com.rdhardware.employeeportal.feature.overtime.data.OvertimeRepositoryImpl
import com.rdhardware.employeeportal.feature.payslips.data.PayslipsRepository
import com.rdhardware.employeeportal.feature.payslips.data.PayslipsRepositoryImpl
import com.rdhardware.employeeportal.feature.profile.data.ProfileRepository
import com.rdhardware.employeeportal.feature.profile.data.ProfileRepositoryImpl
import kotlinx.coroutines.runBlocking

object AppGraph {
    private var initialized = false

    lateinit var sessionStore: SessionStore
        private set

    lateinit var authRepository: AuthRepository
        private set

    lateinit var dashboardRepository: DashboardRepository
        private set

    lateinit var leavesRepository: LeavesRepository
        private set

    lateinit var overtimeRepository: OvertimeRepository
        private set

    lateinit var payslipsRepository: PayslipsRepository
        private set

    lateinit var profileRepository: ProfileRepository
        private set

    fun initialize(context: Context) {
        if (initialized) return

        val appContext = context.applicationContext
        sessionStore = SessionStore(appContext)
        runBlocking {
            sessionStore.primeCache()
        }

        val networkModule = NetworkModule(
            baseUrl = ApiModule.baseUrl(),
            sessionStore = sessionStore
        )
        authRepository = AuthRepositoryImpl(
            authApi = networkModule.authApi,
            sessionStore = sessionStore
        )
        dashboardRepository = DashboardRepositoryImpl(
            bootstrapApi = networkModule.bootstrapApi
        )
        leavesRepository = LeavesRepositoryImpl(
            leavesApi = networkModule.leavesApi
        )
        overtimeRepository = OvertimeRepositoryImpl(
            overtimeApi = networkModule.overtimeApi
        )
        payslipsRepository = PayslipsRepositoryImpl(
            payslipsApi = networkModule.payslipsApi
        )
        profileRepository = ProfileRepositoryImpl(
            profileApi = networkModule.profileApi
        )

        initialized = true
    }
}
