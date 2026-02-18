package com.rdhardware.employeeportal

import android.app.Application
import com.rdhardware.employeeportal.core.data.AppGraph

class EmployeePortalApp : Application() {
    override fun onCreate() {
        super.onCreate()
        AppGraph.initialize(this)
    }
}
