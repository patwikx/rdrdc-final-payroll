package com.rdhardware.employeeportal

import com.rdhardware.employeeportal.core.domain.AuthSession
import org.junit.Assert.assertEquals
import org.junit.Test

class SessionModelTest {
    @Test
    fun authSessionStoresCompanyId() {
        val session = AuthSession("access", "refresh", "user", "company")
        assertEquals("company", session.companyId)
    }
}
