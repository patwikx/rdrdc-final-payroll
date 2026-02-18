package com.rdhardware.employeeportal.core.util

import java.time.LocalDate
import java.time.format.DateTimeFormatter

private val DateFormatter: DateTimeFormatter = DateTimeFormatter.ISO_LOCAL_DATE

fun LocalDate.toIsoDateString(): String = format(DateFormatter)
